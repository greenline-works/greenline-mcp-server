const { test } = require('node:test');
const assert = require('node:assert/strict');

const { SERVER_VERSION } = require('../src/constants');
const { version } = require('../package.json');

// Clients see this version on connect; a hand-kept copy stayed at 0.3.4 through two releases.
test('the server reports the version it is published as', () => {
    assert.equal(SERVER_VERSION, version);
});
