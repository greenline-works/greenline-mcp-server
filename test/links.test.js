const { test } = require('node:test');
const assert = require('node:assert/strict');
const axios = require('axios');

const { initApiClient } = require('../src/client');
const { registerLinksTools } = require('../src/tools/links');

const tools = {};
registerLinksTools({
    registerTool: (name, definition, handler) => {
        tools[name] = { ...definition, handler };
    },
});

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

test('create_card_link posts the other card and the type to the card links', async t => {
    const calls = mockApi(t, { card: 305, type: 'parent' });
    const result = await tools.greenline_create_card_link.handler({ card: 302, to_card: '#305', type: 'parent' });

    assert.equal(calls[0].method, 'POST');
    assert.match(calls[0].url, /\/v1\/cards\/302\/links$/);
    assert.deepEqual(calls[0].data, { toCard: '305', type: 'parent' });
    assert.equal(result.content[0].text, 'Card #305 is now the parent of card #302.');
    assert.deepEqual(result.structuredContent, { card: 305, type: 'parent' });
});

test('list_card_links names each linked card by number with its type', async t => {
    const links = [
        { card: 305, type: 'parent' },
        { card: 410, type: 'predecessor' },
    ];
    const calls = mockApi(t, { links });
    const result = await tools.greenline_list_card_links.handler({
        card: '6700aabbccddeeff00112233',
        response_format: 'markdown',
    });

    assert.equal(calls[0].method, 'GET');
    assert.match(calls[0].url, /\/v1\/cards\/6700aabbccddeeff00112233\/links$/);
    assert.equal(
        result.content[0].text,
        '# Links on card 6700aabbccddeeff00112233 (2)\n\n- parent: #305\n- predecessor: #410'
    );
    assert.deepEqual(result.structuredContent, { links });
});

test('list_card_links says so when the card has no links', async t => {
    mockApi(t, { links: [] });
    const result = await tools.greenline_list_card_links.handler({ card: 302, response_format: 'markdown' });

    assert.equal(result.content[0].text, 'Card #302 has no links to other cards.');
});

test('update_card_link patches the type of the link to the other card', async t => {
    const calls = mockApi(t, { card: 305, type: 'child' });
    const result = await tools.greenline_update_card_link.handler({ card: '302', to_card: 305, type: 'child' });

    assert.equal(calls[0].method, 'PATCH');
    assert.match(calls[0].url, /\/v1\/cards\/302\/links\/305$/);
    assert.deepEqual(calls[0].data, { type: 'child' });
    assert.equal(result.content[0].text, 'Card #305 is now the child of card #302.');
});

test('delete_card_link deletes the link to the other card', async t => {
    const calls = mockApi(t, 'OK');
    const result = await tools.greenline_delete_card_link.handler({ card: 302, to_card: '6700aabbccddeeff00112233' });

    assert.equal(calls[0].method, 'DELETE');
    assert.match(calls[0].url, /\/v1\/cards\/302\/links\/6700aabbccddeeff00112233$/);
    assert.equal(result.content[0].text, 'Unlinked card #302 and card 6700aabbccddeeff00112233.');
});

// Clients use the hint to ask before running a tool; removing a link loses it on both cards.
test('delete_card_link is the only link tool marked destructive', () => {
    assert.equal(tools.greenline_delete_card_link.annotations.destructiveHint, true);
    for (const name of ['greenline_list_card_links', 'greenline_create_card_link', 'greenline_update_card_link']) {
        assert.equal(tools[name].annotations.destructiveHint, false, `${name} must not be destructive`);
    }
    assert.equal(tools.greenline_list_card_links.annotations.readOnlyHint, true);
});

// The link list names cards by number, so the tools must take numbers as well as ObjectIds.
test('link tools take a card number, a #number or an ObjectId', () => {
    for (const field of [
        tools.greenline_create_card_link.inputSchema.card,
        tools.greenline_create_card_link.inputSchema.to_card,
    ]) {
        assert.equal(field.parse(302), 302);
        assert.equal(field.parse('302'), '302');
        assert.equal(field.parse('#302'), '#302');
        assert.equal(field.parse('6700aabbccddeeff00112233'), '6700aabbccddeeff00112233');
        assert.throws(() => field.parse('abc'));
        assert.throws(() => field.parse('30x'));
        assert.throws(() => field.parse(0));
        assert.throws(() => field.parse(3.5));
    }
});

test('the link type is one of the four link types', () => {
    const field = tools.greenline_create_card_link.inputSchema.type;
    for (const type of ['parent', 'child', 'predecessor', 'successor']) {
        assert.equal(field.parse(type), type);
    }
    assert.throws(() => field.parse('blocks'));
});

test('a refused link comes back as a tool error with the API message', async t => {
    process.env.GREENLINE_API_KEY = 'a:b';
    initApiClient();
    t.mock.method(axios, 'request', async () => {
        const error = new Error('Request failed with status code 400');
        error.isAxiosError = true;
        error.response = { status: 400, data: { message: 'These cards are already linked' } };
        throw error;
    });
    const result = await tools.greenline_create_card_link.handler({ card: 302, to_card: 305, type: 'parent' });

    assert.equal(result.isError, true);
    assert.equal(result.content[0].text, 'Validation error: These cards are already linked');
});
