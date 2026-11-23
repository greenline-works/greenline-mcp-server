const { test } = require('node:test');
const assert = require('node:assert/strict');
const axios = require('axios');
const { z } = require('zod');

const { initApiClient } = require('../src/client');
const { registerCardsTools } = require('../src/tools/cards');

const tools = {};
registerCardsTools({
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

const CARD = '6700aabbccddeeff00112233';
const COLUMN = '5aec5dce764c7d002523719c';

// The API moves a card to the board that owns the column. For a mirrored card, `board` in the body picks which copy
// moves, so sending the destination there made every cross-board move of a mirrored card fail.
test('move_card sends only the column, so the API takes the copy on its board or the newest one', async t => {
    const calls = mockApi(t, { _id: CARD });
    await tools.greenline_move_card.handler({ id: CARD, column: COLUMN });

    assert.equal(calls[0].method, 'POST');
    assert.match(calls[0].url, /\/v1\/cards\/6700aabbccddeeff00112233\/move$/);
    assert.deepEqual(calls[0].data, { columnId: COLUMN });
});

test('move_card sends from_board as the board whose copy moves', async t => {
    const calls = mockApi(t, { _id: CARD });
    await tools.greenline_move_card.handler({ id: CARD, column: COLUMN, from_board: 'Hds5Zuks' });

    assert.deepEqual(calls[0].data, { columnId: COLUMN, board: 'Hds5Zuks' });
});

test('move_card puts the card last in the column with add_to_top false', async t => {
    const calls = mockApi(t, { _id: CARD });
    await tools.greenline_move_card.handler({ id: CARD, column: COLUMN, add_to_top: false });

    assert.deepEqual(calls[0].data, { columnId: COLUMN, addToTop: false });
});

test("move_card drops a client's old destination board and position instead of sending them", () => {
    const parsed = z.object(tools.greenline_move_card.inputSchema).parse({
        id: CARD,
        board: 'OeMrbG8g',
        column: COLUMN,
        position: 2,
    });

    assert.deepEqual(parsed, { id: CARD, column: COLUMN });
});
