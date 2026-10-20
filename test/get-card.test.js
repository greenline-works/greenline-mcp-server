const { test } = require('node:test');
const assert = require('node:assert/strict');
const axios = require('axios');

const { initApiClient } = require('../src/client');
const { registerCardsTools } = require('../src/tools/cards');

const tools = {};
registerCardsTools({
    registerTool: (name, definition, handler) => {
        tools[name] = { ...definition, handler };
    },
});

// GET /cards/{id} nests the card under CardItem.
const CARD = {
    _id: '6700aabbccddeeff00112233',
    CardItem: { number: 28407, title: 'Notification follow-ups', description: 'Review the digest fixes.' },
    meta: {},
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

// "Review card https://…/c/28407" is the common request, and a link or a number is all it carries.
test('get_card takes a card number, a #number, an ObjectId or the card link', () => {
    const field = tools.greenline_get_card.inputSchema.id;
    for (const value of [
        28407,
        '28407',
        '#28407',
        '6700aabbccddeeff00112233',
        'https://app.example.com/b/OeMrbG8g/c/28407',
        'https://app.example.com/b/OeMrbG8g/c/28268-extend-api-and-make-mcp-use-it',
    ]) {
        assert.deepEqual(field.parse(value), value);
    }
    for (const value of ['abc', 0, 'https://app.example.com/b/OeMrbG8g', 'https://app.example.com/b/OeMrbG8g/c/']) {
        assert.throws(() => field.parse(value), `${value} must be refused`);
    }
});

test('get_card fetches a card by its number', async t => {
    const calls = mockApi(t, CARD);
    await tools.greenline_get_card.handler({ id: '#28407', response_format: 'json' });

    assert.match(calls[0].url, /\/v1\/cards\/28407$/);
    assert.equal(calls[0].params.board, undefined);
});

// A link names the board too, which picks the right copy of a mirrored card.
test('get_card fetches a card from its link, passing the board the link names', async t => {
    const calls = mockApi(t, CARD);
    await tools.greenline_get_card.handler({
        id: 'https://app.example.com/b/OeMrbG8g/c/28407-notification-follow-ups',
        response_format: 'json',
    });

    assert.match(calls[0].url, /\/v1\/cards\/28407$/);
    assert.equal(calls[0].params.board, 'OeMrbG8g');
});

test('an explicit board wins over the board in the link', async t => {
    const calls = mockApi(t, CARD);
    await tools.greenline_get_card.handler({
        id: 'https://app.example.com/b/OeMrbG8g/c/28407',
        board: 'zNAq4MXH',
        response_format: 'json',
    });

    assert.match(calls[0].url, /\/v1\/cards\/28407$/);
    assert.equal(calls[0].params.board, 'zNAq4MXH');
});

test('get_card markdown shows the title, number and description from CardItem', async t => {
    mockApi(t, CARD);
    const result = await tools.greenline_get_card.handler({ id: 28407, response_format: 'markdown' });

    assert.equal(
        result.content[0].text,
        '# #28407 Notification follow-ups\n- **id**: 6700aabbccddeeff00112233\n- **description**: Review the digest fixes.'
    );
});

// The API returns cards updated within the last N days (lastActionAt after now - N days).
test('list_cards describes days_since_last_update as cards updated within the last N days', () => {
    assert.match(tools.greenline_list_cards.description, /days_since_last_update[^\n]*updated within the last N days/);
});
