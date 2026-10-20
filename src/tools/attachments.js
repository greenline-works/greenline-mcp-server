const { makeApiRequest, safeRun } = require('../client');
const { responseFormatField, ResponseFormat, toJsonString, truncateIfNeeded, cardLabel } = require('../format');
const { CARD_REF_HELP, cardRefField, cardRef, objectIdField } = require('../schemas');

const READ = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true };

const LINK_SOURCES = { GOOGLE: 'Google Drive', DROPBOX: 'Dropbox', ONEDRIVE: 'OneDrive', BOX: 'Box', URL: 'web' };

const MB = 1024 * 1024;
const formatSize = bytes => (bytes < MB ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / MB).toFixed(1)} MB`);

// "PDF file, 2.3 MB" for an uploaded file, "Google Drive link" for a linked one.
const describeKind = attachment => {
    if (attachment.source !== 'S3') return `${LINK_SOURCES[attachment.source] || attachment.source} link`;
    return attachment.fileSize ? `${attachment.type} file, ${formatSize(attachment.fileSize)}` : `${attachment.type} file`;
};

// Signed download links are long and expire within the hour, so lists leave them out.
const withoutLinks = ({ url, thumbnail, ...attachment }) => attachment;

const renderAttachmentLine = attachment => {
    const added = attachment.createdAt ? `, added ${attachment.createdAt.slice(0, 10)}` : '';
    const by = attachment.owner ? ` by ${attachment.owner}` : '';
    return `- **${attachment.name}** — ${describeKind(attachment)}${added}${by} (\`${attachment._id}\`)`;
};

const registerAttachmentsTools = server => {
    server.registerTool(
        'greenline_list_card_attachments',
        {
            title: "List a card's attachments",
            description: [
                "List the files and links in a card's Attachments section, oldest first: name, kind, size, who",
                'added it and when, and its id. Download links are left out; get one with',
                'greenline_get_card_attachment.',
                '',
                'Args:',
                `  - card (string | number, required): ${CARD_REF_HELP}.`,
                '  - response_format ("markdown" | "json").',
                '',
                'Examples:',
                '  - "What files are attached to card 302?"',
            ].join('\n'),
            inputSchema: {
                card: cardRefField,
                response_format: responseFormatField,
            },
            annotations: READ,
        },
        async ({ card, response_format }) =>
            safeRun(async () => {
                const ref = cardRef(card);
                const data = await makeApiRequest(`/cards/${ref}/attachments`);
                const attachments = (data.attachments || []).map(withoutLinks);

                if (response_format === ResponseFormat.JSON) {
                    return {
                        content: [{ type: 'text', text: toJsonString(attachments) }],
                        structuredContent: { attachments },
                    };
                }
                if (!attachments.length) {
                    return {
                        content: [{ type: 'text', text: `Card ${cardLabel(ref)} has no attachments.` }],
                        structuredContent: { attachments },
                    };
                }

                const rerender = list =>
                    [
                        `# Attachments on card ${cardLabel(ref)} (${list.length})`,
                        '',
                        ...list.map(renderAttachmentLine),
                    ].join('\n');
                const { text } = truncateIfNeeded({ items: attachments, rendered: rerender(attachments), rerender });
                return { content: [{ type: 'text', text }], structuredContent: { attachments } };
            })
    );

    server.registerTool(
        'greenline_get_card_attachment',
        {
            title: 'Get a download link for an attachment',
            description: [
                "Get the download link of one of a card's attachments. An uploaded file gets a signed link that",
                'works for about an hour; Google Drive, Dropbox, Box, OneDrive and web links come back as they',
                'are. The file itself is not returned.',
                '',
                'Args:',
                `  - card (string | number, required): ${CARD_REF_HELP}.`,
                '  - attachment (string, required): attachment ObjectId, as listed by greenline_list_card_attachments.',
                '',
                'Examples:',
                '  - "Give me a link to the contract on card 302"',
            ].join('\n'),
            inputSchema: {
                card: cardRefField,
                attachment: objectIdField,
            },
            annotations: READ,
        },
        async ({ card, attachment }) =>
            safeRun(async () => {
                const ref = cardRef(card);
                const data = await makeApiRequest(`/cards/${ref}/attachments`);
                const found = (data.attachments || []).find(item => item._id === attachment.toLowerCase());
                if (!found) {
                    return {
                        isError: true,
                        content: [
                            { type: 'text', text: `Not found: card ${cardLabel(ref)} has no attachment ${attachment}.` },
                        ],
                    };
                }

                const expiry =
                    found.source === 'S3' ? '\n\nThe link works for about an hour; get a new one when it expires.' : '';
                return {
                    content: [{ type: 'text', text: `**${found.name}** (${describeKind(found)}): ${found.url}${expiry}` }],
                    structuredContent: found,
                };
            })
    );
};

module.exports = { registerAttachmentsTools };
