const { test } = require('node:test');
const assert = require('node:assert/strict');
const axios = require('axios');

const { initApiClient } = require('../src/client');
const { registerAttachmentsTools } = require('../src/tools/attachments');

const tools = {};
registerAttachmentsTools({
    registerTool: (name, definition, handler) => {
        tools[name] = { ...definition, handler };
    },
});

const SIGNED_URL = 'https://files.s3.amazonaws.com/org/contract.pdf?X-Amz-Signature=abc123';
const CONTRACT = {
    _id: '6710aabbccddeeff00110001',
    name: 'contract.pdf',
    type: 'PDF',
    source: 'S3',
    url: SIGNED_URL,
    thumbnail: null,
    fileSize: 2411724,
    pinnedAt: null,
    createdAt: '2026-10-01T09:00:00.000Z',
    owner: 'ann@example.com',
};
const ROADMAP = {
    _id: '6710aabbccddeeff00110002',
    name: 'Roadmap',
    type: 'LINK',
    source: 'GOOGLE',
    url: 'https://docs.google.com/document/d/roadmap',
    thumbnail: null,
    fileSize: 0,
    pinnedAt: null,
    createdAt: '2026-10-02T09:00:00.000Z',
    owner: 'bob@example.com',
};

const mockApi = (t, data) => {
    process.env.GREENLINE_API_KEY = 'a:b';
    initApiClient();
    const calls = [];
    t.mock.method(axios, 'request', async cfg => {
        calls.push(cfg);
        return { data };
    });
    return calls;
};

// Signed links are long and expire within the hour; listing them for every file would fill the
// context with URLs the agent rarely needs. The list names the files and get_card_attachment
// fetches one link.
test('list_card_attachments names, sizes and dates each file without its download link', async t => {
    const calls = mockApi(t, { attachments: [CONTRACT, ROADMAP] });
    const result = await tools.greenline_list_card_attachments.handler({ card: 302, response_format: 'markdown' });

    assert.equal(calls[0].method, 'GET');
    assert.match(calls[0].url, /\/v1\/cards\/302\/attachments$/);
    assert.equal(
        result.content[0].text,
        [
            '# Attachments on card #302 (2)',
            '',
            '- **contract.pdf** — PDF file, 2.3 MB, added 2026-10-01 by ann@example.com (`6710aabbccddeeff00110001`)',
            '- **Roadmap** — Google Drive link, added 2026-10-02 by bob@example.com (`6710aabbccddeeff00110002`)',
        ].join('\n')
    );
    assert.equal(result.structuredContent.attachments.length, 2);
    for (const attachment of result.structuredContent.attachments) {
        assert.equal(attachment.url, undefined);
        assert.equal(attachment.thumbnail, undefined);
    }
});

test('list_card_attachments leaves the links out of the json format too', async t => {
    mockApi(t, { attachments: [CONTRACT] });
    const result = await tools.greenline_list_card_attachments.handler({ card: 302, response_format: 'json' });

    assert.doesNotMatch(result.content[0].text, /X-Amz-Signature/);
    assert.equal(JSON.parse(result.content[0].text)[0].name, 'contract.pdf');
});

test('list_card_attachments says so when the card has none', async t => {
    mockApi(t, { attachments: [] });
    const result = await tools.greenline_list_card_attachments.handler({ card: 302, response_format: 'markdown' });

    assert.equal(result.content[0].text, 'Card #302 has no attachments.');
});

test('get_card_attachment returns the signed download link of the file asked for', async t => {
    const calls = mockApi(t, { attachments: [ROADMAP, CONTRACT] });
    const result = await tools.greenline_get_card_attachment.handler({
        card: '6700aabbccddeeff00112233',
        attachment: CONTRACT._id,
    });

    assert.match(calls[0].url, /\/v1\/cards\/6700aabbccddeeff00112233\/attachments$/);
    assert.equal(
        result.content[0].text,
        `**contract.pdf** (PDF file, 2.3 MB): ${SIGNED_URL}\n\n` +
            'The link works for about an hour; get a new one when it expires.'
    );
    assert.deepEqual(result.structuredContent, CONTRACT);
});

test('get_card_attachment returns an external link as it is', async t => {
    mockApi(t, { attachments: [CONTRACT, ROADMAP] });
    const result = await tools.greenline_get_card_attachment.handler({ card: 302, attachment: ROADMAP._id });

    assert.equal(result.content[0].text, '**Roadmap** (Google Drive link): https://docs.google.com/document/d/roadmap');
});

test('get_card_attachment reports an attachment the card does not have', async t => {
    mockApi(t, { attachments: [CONTRACT] });
    const result = await tools.greenline_get_card_attachment.handler({
        card: 302,
        attachment: '6710aabbccddeeff00119999',
    });

    assert.equal(result.isError, true);
    assert.equal(result.content[0].text, 'Not found: card #302 has no attachment 6710aabbccddeeff00119999.');
});

test('attachment tools are read-only', () => {
    for (const name of ['greenline_list_card_attachments', 'greenline_get_card_attachment']) {
        assert.equal(tools[name].annotations.readOnlyHint, true, `${name} must be read-only`);
    }
});
