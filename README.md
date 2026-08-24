# GreenLine MCP Server

[Model Context Protocol](https://modelcontextprotocol.io/) server that lets AI assistants (Claude Desktop, Claude Code, Cursor, VS Code, Windsurf, and any MCP client) drive your [GreenLine](https://greenline.legal) workspace via the public API.

27 tools across boards, cards, comments, checklists, tasks, and labels. No delete operations.

**Two ways to connect.** The **hosted server** at `https://mcp.greenline.works/mcp` is the recommended option for every client, Claude Desktop included — paste the URL, sign in with your GreenLine account, done. Nothing to install, no API key to manage, and you always get the current tool set. The **local install** (this npm package) runs the same server on your own machine over stdio — for stdio-only clients, unattended setups like CI where a browser sign-in isn't possible, restricted networks, or developing against a fork.

## What you can do

- Read your boards, columns, labels, members, and custom fields.
- Create, list, get, update, move, and search cards.
- Inspect a card's history and time-in-column metrics.
- Create, get, and update labels.
- Add comments.
- Create, update, and list checklists — including bulk task creation in a single call.
- Create, update, and move tasks.

## Quick start (hosted — recommended)

**Claude Desktop:** open **Settings → Connectors → Add custom connector**, paste `https://mcp.greenline.works/mcp`, and click **Connect**. A browser window opens to sign in to GreenLine and approve access — the tools then appear in the tool picker. No config file, no API key.

**Claude Code:**

```bash
claude mcp add --transport http greenline https://mcp.greenline.works/mcp
```

Sign in when prompted. Where a browser sign-in isn't possible, the hosted server also accepts an API key as a header: `Authorization: Bearer accessId:apiKey`.

## Local install (Claude Desktop)

Prefer the hosted quick start above. Use a local install when your client is stdio-only, your setup is unattended (an API key in an env var beats a browser sign-in there), your network blocks `mcp.greenline.works`, or you're developing against a fork.

1. **Get an API key.** In GreenLine: **Settings → Integrations → API Keys**. Copy the whole thing — it looks like `accessId:apiKey`.

2. **Edit your config.**

   - **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

   ```json
   {
     "mcpServers": {
       "greenline": {
         "command": "npx",
         "args": ["-y", "greenline-works-mcp-server"],
         "env": {
           "GREENLINE_API_KEY": "accessId:apiKey"
         }
       }
     }
   }
   ```

3. **Restart Claude Desktop.** The GreenLine tools appear in the tool picker.

4. **Try it.** Ask Claude: *"Is my GreenLine connection working?"* — Claude calls `greenline_get_me` and replies with your org name.

## Local install (Claude Code)

```bash
claude mcp add greenline \
  -e GREENLINE_API_KEY=accessId:apiKey \
  -- npx -y greenline-works-mcp-server
```

## Configuration

Environment variables for the local server:

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `GREENLINE_API_KEY` | yes | — | Composite credential `accessId:apiKey`. Generate in **Settings → Integrations → API Keys**. |
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

## Prompts

Three user-invocable prompts ship alongside the tools: **Board Review**, **Checklist Generator**,
and **Standup Summary**. In Claude Code they register as slash commands; in Claude Desktop they
appear in the prompt picker. For clients without native MCP prompt support, [PROMPTS.md](PROMPTS.md)
carries the same texts as copy-paste blocks.

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

**`401` on every tool call.** If you connected with an API key, it's wrong or expired — regenerate it. If you signed in to the hosted server, disconnect it in your client and connect again for a fresh token.

**Tools don't appear in the client.** Confirm the path is correct and the client was restarted after editing config. For `npx` installs, run `npx -y greenline-works-mcp-server` once manually to make sure it downloads cleanly.

**`Card does not exist` on a card you can see.** It's a mirror — pass `board=<publicId>` to disambiguate which mirror.

**Truncation warnings on `list_cards`.** Paginate with `page` / `count`, or narrow with `columns`, `owner`, `label`, or `daysSinceLastUpdate`.

## Security

The local server runs on your machine. It does not transmit data to any third-party AI service — every API call goes directly to `https://integrations.greenline.works`. Your API key never leaves your machine except as an `Authorization: Basic` header on those direct calls.

The hosted server is operated by GreenLine and talks to that same public API. Signing in uses OAuth and makes a **user-level** connection: your client holds an access token tied to your account, the tools reach what your account can reach, and changes are attributed to your name. An API key is an **org-level** credential — it acts as the organization's integration identity and by default reaches every board in the org (keys can be scoped to chosen boards when generated).

## License

[MIT](./LICENSE).
