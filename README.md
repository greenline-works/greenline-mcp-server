# GreenLine MCP Server

[Model Context Protocol](https://modelcontextprotocol.io/) server that lets AI assistants (Claude Desktop, Claude Code, Cursor, VS Code, Windsurf, and any stdio-capable MCP client) drive your [GreenLine](https://greenline.legal) workspace via the public API.

27 tools across boards, cards, comments, checklists, tasks, and labels. No delete operations.

## What you can do

- Read your boards, columns, labels, members, and custom fields.
- Create, list, get, update, move, and search cards.
- Inspect a card's history and time-in-column metrics.
- Create, get, and update labels.
- Add comments.
- Create, update, and list checklists — including bulk task creation in a single call.
- Create, update, and move tasks.

## Quick start (Claude Desktop)

1. **Get an API key.** In GreenLine: **Org Settings → Integrations → API Key**. Copy the whole thing — it looks like `accessId:apiKey`.

2. **Edit your config.**

   - **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

   ```json
   {
     "mcpServers": {
       "greenline": {
         "command": "npx",
         "args": ["-y", "greenline-mcp-server"],
         "env": {
           "GREENLINE_API_KEY": "accessId:apiKey"
         }
       }
     }
   }
   ```

3. **Restart Claude Desktop.** The GreenLine tools appear in the tool picker.

4. **Try it.** Ask Claude: *"Is my GreenLine connection working?"* — Claude calls `greenline_get_me` and replies with your org name.

## Quick start (Claude Code)

```bash
claude mcp add greenline \
  -e GREENLINE_API_KEY=accessId:apiKey \
  -- npx -y greenline-mcp-server
```

## Configuration

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `GREENLINE_API_KEY` | yes | — | Composite credential `accessId:apiKey`. Generate in **Org Settings → Integrations → API Key**. |
| `GREENLINE_BASE_URL` | no | `https://integrations.greenline.works/v1` | Override only when pointing at a non-production environment. |

The server validates the key on startup. A missing or malformed value (no `:` separator) exits immediately with a message pointing at the org settings page.

## Tools

27 tools, all prefixed with `greenline_`:

| Group | Tools |
| --- | --- |
| **Organization & Auth** | `get_me`, `get_organization` |
| **Boards** | `list_boards`, `get_board`, `list_board_columns`, `list_board_labels`, `list_board_members`, `list_board_custom_fields` |
| **Cards** | `create_card`, `list_cards`, `get_card`, `update_card`, `move_card`, `get_card_history`, `get_card_metrics`, `search_cards` |
| **Comments** | `create_comment`, `list_card_comments` |
| **Checklists** | `create_checklist`, `update_checklist`, `list_card_checklists` |
| **Tasks** | `create_task`, `update_task`, `move_task` |
| **Labels** | `create_label`, `get_label`, `update_label` |

User-facing docs with example prompts: <https://docs.greenline.works/mcp>.
Full input/output schemas: <https://docs.greenline.works/api>.

## Running from source

If you'd rather run from a local clone (development, contributions, custom modifications):

```bash
git clone https://github.com/greenline-works/greenline-mcp-server.git
cd greenline-mcp-server
npm install
GREENLINE_API_KEY=accessId:apiKey node src/index.js
```

Plain JavaScript — no compile step.

## Troubleshooting

**`401` on every tool call.** API key is wrong or expired. Regenerate it.

**Tools don't appear in the client.** Confirm the path is correct and the client was restarted after editing config. For `npx` installs, run `npx -y greenline-mcp-server` once manually to make sure it downloads cleanly.

**`Card does not exist` on a card you can see.** It's a mirror — pass `board=<publicId>` to disambiguate which mirror.

**Truncation warnings on `list_cards`.** Paginate with `page` / `count`, or narrow with `columns`, `owner`, `label`, or `daysSinceLastUpdate`.

## Security

This server runs locally on your machine. It does not transmit data to any third-party AI service — every API call goes directly to `https://integrations.greenline.works`. Your API key never leaves your machine except as an `Authorization: Basic` header on those direct calls.

## What's next

The server is local-stdio only today. A hosted version (paste a URL into your client, no install) is on the roadmap.

## License

[MIT](./LICENSE).
