// Converts the markdown LLM clients naturally produce into the HTML the API accepts.
//
// The public API takes rich text as an HTML string — POST /comments, POST /tasks and the
// checklist tasks[] all validate `required|string` on it — so markdown must become HTML here
// rather than a delta. The server reads that HTML back into the delta it stores, and the markup
// written here is the subset it reads exactly: inline formats and links, headings, quotes,
// images, code spans, fenced code with its language, and lists including their depth and their
// checkboxes. A table has no delta to be read into, so it stays the text it was.
//
// Input that already contains HTML is returned untouched, so a client following the documented
// format is never double-converted.

const SUPPORTED_TAG = /<(?:p|br|strong|em|u|s|a|ul|ol|li|h[1-6]|blockquote|pre|code|img)\b[^>]*>/i;
const containsHtml = text => SUPPORTED_TAG.test(text);

const escapeHtml = text => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// A bare address is a link to everyone who writes one, but only outside an address we already
// wrote: the text of a markdown link is not itself a link.
const LINKED = /(<a\b[^>]*>[\s\S]*?<\/a>)/;
const BARE_ADDRESS = /(^|[\s(])(https?:\/\/[^\s<)]+[^\s<).,;:!?])/g;

const linkBareAddresses = html =>
    html
        .split(LINKED)
        .map(part => (LINKED.test(part) ? part : part.replace(BARE_ADDRESS, '$1<a href="$2">$2</a>')))
        .join('');

const renderMarkers = text =>
    linkBareAddresses(
        text
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
            .replace(/__([^_]+)__/g, '<strong>$1</strong>')
            .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
            .replace(/(^|[^_])_([^_\s][^_]*)_/g, '$1<em>$2</em>')
            .replace(/~~([^~]+)~~/g, '<s>$1</s>')
            // Images are matched before links, or the leading ! is left behind as text.
            .replace(/!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g, '<img src="$2" alt="$1"/>')
            .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2">$1</a>')
    );

// Code spans are split out before the other markers so they cannot mangle their contents —
// `run_a_test` is a name, not italics.
const renderInline = text =>
    escapeHtml(text)
        .split(/(`[^`]+`)/)
        .map(part =>
            part.length > 2 && part.startsWith('`') && part.endsWith('`')
                ? `<code>${part.slice(1, -1)}</code>`
                : renderMarkers(part)
        )
        .join('');

const UNORDERED = /^(\s*)[-*+]\s+(.*)$/;
const ORDERED = /^(\s*)\d+[.)]\s+(.*)$/;
const HEADING = /^(#{1,6})\s+(.*)$/;
const QUOTE = /^>[\s>]*(.*)$/;
const FENCE = /^\s*```(\w+)?/;
const TASK = /^\[([ xX])\]\s+(.*)$/;

// Quill carries a list item's depth as its own class, and reads two spaces or a tab as one
// level. Eight is where the server stops accepting them.
const INDENT_LEVELS = 8;
const indentOf = whitespace => {
    const columns = whitespace.replace(/\t/g, '  ').length;
    return Math.min(Math.floor(columns / 2), INDENT_LEVELS);
};
const listItem = (indent, attributes, content) => {
    const indented = indent ? ` class="ql-indent-${indent}"` : '';
    return `<li${indented}${attributes}>${content}</li>`;
};

const markdownToHtml = value => {
    if (typeof value !== 'string' || !value.trim()) return value;
    if (containsHtml(value)) return value;

    const lines = value.replace(/\r\n/g, '\n').split('\n');
    const out = [];
    let list = null;
    let paragraph = [];
    let fenced = false;
    let fence = [];
    let language = '';

    const closeList = () => {
        if (list) {
            out.push(`</${list}>`);
            list = null;
        }
    };
    const closeParagraph = () => {
        if (paragraph.length) {
            out.push(`<p>${renderInline(paragraph.join(' '))}</p>`);
            paragraph = [];
        }
    };
    const closeFence = () => {
        const named = language ? ` data-language="${language}"` : '';
        out.push(`<pre${named}>${fence.map(escapeHtml).join('\n')}</pre>`);
        fence = [];
        language = '';
    };
    const openList = kind => {
        if (list !== kind) {
            closeList();
            out.push(`<${kind}>`);
            list = kind;
        }
    };

    for (const line of lines) {
        const fenceMarker = line.match(FENCE);
        if (fenceMarker) {
            closeParagraph();
            closeList();
            if (fenced) closeFence();
            else language = (fenceMarker[1] || '').toLowerCase();
            fenced = !fenced;
            continue;
        }
        if (fenced) {
            fence.push(line);
            continue;
        }
        if (!line.trim()) {
            closeParagraph();
            closeList();
            continue;
        }

        const heading = line.match(HEADING);
        if (heading) {
            closeParagraph();
            closeList();
            out.push(`<h${heading[1].length}>${renderInline(heading[2])}</h${heading[1].length}>`);
            continue;
        }

        const quote = line.match(QUOTE);
        if (quote) {
            closeParagraph();
            closeList();
            out.push(`<blockquote>${renderInline(quote[1])}</blockquote>`);
            continue;
        }

        const unordered = line.match(UNORDERED);
        const ordered = unordered ? null : line.match(ORDERED);
        if (unordered || ordered) {
            closeParagraph();
            openList(unordered ? 'ul' : 'ol');
            const [, whitespace, content] = unordered || ordered;
            const task = content.match(TASK);
            const checked = task ? ` data-checked="${task[1].toLowerCase() === 'x'}"` : '';
            out.push(listItem(indentOf(whitespace), checked, renderInline(task ? task[2] : content)));
            continue;
        }

        paragraph.push(line.trim());
    }

    closeParagraph();
    closeList();
    // An unterminated fence still carries its lines.
    if (fenced && fence.length) closeFence();
    return out.join('');
};

// Every rich-text field on the API is an HTML string; markdown is converted, HTML passes through.
const richTextBody = (field, value) => ({ [field]: markdownToHtml(value) });

module.exports = { markdownToHtml, richTextBody, containsHtml };
