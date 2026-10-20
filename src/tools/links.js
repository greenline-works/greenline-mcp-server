const { z } = require('zod');
const { makeApiRequest, safeRun } = require('../client');
const { responseFormatField, ResponseFormat, toJsonString, truncateIfNeeded, cardLabel } = require('../format');
const { CARD_REF_HELP, cardRefField, cardRef } = require('../schemas');

const READ = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true };
const WRITE = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true };
const IDEMPOTENT_WRITE = { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true };
const DESTRUCTIVE = { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true };

const linkTypeField = z
    .enum(['parent', 'child', 'predecessor', 'successor'])
    .describe("What to_card becomes to card: 'parent' makes it card's parent, 'predecessor' puts it before card.");

const TYPE_ARG = "  - type (string, required): what to_card becomes to card: 'parent', 'child', 'predecessor' or 'successor'.";

const describeLink = (ref, link) => `Card #${link.card} is now the ${link.type} of card ${cardLabel(ref)}.`;

const registerLinksTools = server => {
    server.registerTool(
        'greenline_list_card_links',
        {
            title: "List a card's links to other cards",
            description: [
                'List the cards a card is linked to, by number, with the type of each link: what the other card',
                'is to this one (parent, child, predecessor or successor). Links to web pages are not included.',
                '',
                'Args:',
                `  - card (string | number, required): ${CARD_REF_HELP}.`,
                '  - response_format ("markdown" | "json").',
                '',
                'Examples:',
                '  - "What is card 302 linked to?"',
                '  - "Which cards have to be done before card 302?"',
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
                const data = await makeApiRequest(`/cards/${ref}/links`);
                const links = data.links || [];

                if (response_format === ResponseFormat.JSON) {
                    return { content: [{ type: 'text', text: toJsonString(links) }], structuredContent: { links } };
                }
                if (!links.length) {
                    return {
                        content: [{ type: 'text', text: `Card ${cardLabel(ref)} has no links to other cards.` }],
                        structuredContent: { links },
                    };
                }

                const rerender = list =>
                    [
                        `# Links on card ${cardLabel(ref)} (${list.length})`,
                        '',
                        ...list.map(link => `- ${link.type}: #${link.card}`),
                    ].join('\n');
                const { text } = truncateIfNeeded({ items: links, rendered: rerender(links), rerender });
                return { content: [{ type: 'text', text }], structuredContent: { links } };
            })
    );

    server.registerTool(
        'greenline_create_card_link',
        {
            title: 'Link two cards',
            description: [
                'Link a card to another card in the organization, on the same board or another one. The other card',
                "gets the opposite link: parent and child, predecessor and successor. Needs edit access to both cards'",
                'boards. Two cards can be linked only once; change the type with greenline_update_card_link.',
                '',
                'Args:',
                `  - card (string | number, required): ${CARD_REF_HELP}.`,
                `  - to_card (string | number, required): the card to link to, as a ${CARD_REF_HELP}.`,
                TYPE_ARG,
                '',
                'Examples:',
                '  - "Make card 305 the parent of card 302" (card 302, to_card 305, type parent)',
                '  - "Card 410 has to be done before card 412" (card 412, to_card 410, type predecessor)',
            ].join('\n'),
            inputSchema: {
                card: cardRefField,
                to_card: cardRefField,
                type: linkTypeField,
            },
            annotations: WRITE,
        },
        async ({ card, to_card, type }) =>
            safeRun(async () => {
                const ref = cardRef(card);
                const data = await makeApiRequest(`/cards/${ref}/links`, {
                    method: 'POST',
                    body: { toCard: cardRef(to_card), type },
                });
                return { content: [{ type: 'text', text: describeLink(ref, data) }], structuredContent: data };
            })
    );

    server.registerTool(
        'greenline_update_card_link',
        {
            title: 'Change the type of a card link',
            description: [
                "Change what a linked card is to this card. The other card's side of the link changes to the",
                'opposite type.',
                '',
                'Args:',
                `  - card (string | number, required): ${CARD_REF_HELP}.`,
                `  - to_card (string | number, required): the linked card, as a ${CARD_REF_HELP}.`,
                TYPE_ARG,
                '',
                'Examples:',
                '  - "Card 305 should be a child of card 302, not its parent" (card 302, to_card 305, type child)',
            ].join('\n'),
            inputSchema: {
                card: cardRefField,
                to_card: cardRefField,
                type: linkTypeField,
            },
            annotations: IDEMPOTENT_WRITE,
        },
        async ({ card, to_card, type }) =>
            safeRun(async () => {
                const ref = cardRef(card);
                const data = await makeApiRequest(`/cards/${ref}/links/${cardRef(to_card)}`, {
                    method: 'PATCH',
                    body: { type },
                });
                return { content: [{ type: 'text', text: describeLink(ref, data) }], structuredContent: data };
            })
    );

    server.registerTool(
        'greenline_delete_card_link',
        {
            title: 'Unlink two cards',
            description: [
                'Remove the link between two cards, from both of them. Only the link goes; both cards stay.',
                '',
                'Args:',
                `  - card (string | number, required): ${CARD_REF_HELP}.`,
                `  - to_card (string | number, required): the linked card, as a ${CARD_REF_HELP}.`,
                '',
                'Examples:',
                '  - "Card 305 no longer has anything to do with card 302"',
            ].join('\n'),
            inputSchema: {
                card: cardRefField,
                to_card: cardRefField,
            },
            annotations: DESTRUCTIVE,
        },
        async ({ card, to_card }) =>
            safeRun(async () => {
                const ref = cardRef(card);
                const toRef = cardRef(to_card);
                await makeApiRequest(`/cards/${ref}/links/${toRef}`, { method: 'DELETE' });
                return {
                    content: [{ type: 'text', text: `Unlinked card ${cardLabel(ref)} and card ${cardLabel(toRef)}.` }],
                };
            })
    );
};

module.exports = { registerLinksTools };
