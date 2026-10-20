const { z } = require('zod');
const { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } = require('./constants');

const objectIdField = z.string().regex(/^[a-f0-9]{24}$/i, 'Must be a 24-character MongoDB ObjectId');

// Boards are addressed by publicId (e.g. "OeMrbG8g") in the public API, not by ObjectId.
const boardPublicIdField = z.string().regex(/^[A-Za-z0-9]{6,12}$/, 'Must be a board publicId (e.g. "OeMrbG8g")');

const pageField = z.number().int().min(1).default(1).describe('1-based page number.');

const countField = z
    .number()
    .int()
    .min(1)
    .max(MAX_PAGE_SIZE)
    .default(DEFAULT_PAGE_SIZE)
    .describe(`Items per page (1-${MAX_PAGE_SIZE}, default ${DEFAULT_PAGE_SIZE}).`);

const isoDateField = z.string().refine(value => !Number.isNaN(Date.parse(value)), {
    message: 'Must be an ISO-8601 date or datetime string',
});

// The link and attachment endpoints name a card by its number as well as its ObjectId.
const CARD_REF_HELP = 'card number (e.g. 302) or card ObjectId';
const CARD_REF_PATTERN = /^#?(\d+|[a-f0-9]{24})$/i;
const CARD_REF_MESSAGE = 'Must be a card number (e.g. 302) or a 24-character ObjectId';

// A card's link: …/b/<board publicId>/c/<number>, optionally followed by a slug of its title.
const CARD_LINK_PATTERN = /\/b\/([A-Za-z0-9]{6,12})\/c\/(\d+)/;

const cardRefField = z
    .union([z.number().int().min(1), z.string().regex(CARD_REF_PATTERN, CARD_REF_MESSAGE)])
    .describe(`The ${CARD_REF_HELP}.`);

const cardLocatorField = z
    .union([
        z.number().int().min(1),
        z.string().regex(CARD_REF_PATTERN, CARD_REF_MESSAGE),
        z.string().regex(CARD_LINK_PATTERN, 'Must be a card link ending in /b/<board>/c/<number>'),
    ])
    .describe(`The ${CARD_REF_HELP}, or the card's link.`);

const cardRef = value => String(value).replace(/^#/, '');

// A link also names the board it was opened on, which picks the copy of a mirrored card.
const resolveCardLocator = value => {
    const link = typeof value === 'string' && value.match(CARD_LINK_PATTERN);
    return link ? { ref: link[2], board: link[1] } : { ref: cardRef(value), board: undefined };
};

module.exports = {
    objectIdField,
    boardPublicIdField,
    pageField,
    countField,
    isoDateField,
    CARD_REF_HELP,
    cardRefField,
    cardLocatorField,
    cardRef,
    resolveCardLocator,
};
