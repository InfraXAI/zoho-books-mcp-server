# Zoho Books Skill — Setup Guide

## Prerequisites
- Zoho Books account (any plan)
- Node.js 18+
- pnpm

## Step 1: Create Zoho OAuth Self Client

1. Go to [Zoho API Console](https://api-console.zoho.in/) (use `.in` for India)
2. Click **Add Client** → Select **Self Client**
3. Note down your **Client ID** and **Client Secret**

## Step 2: Generate Refresh Token

1. In the Self Client page, click **Generate Code**
2. Enter scope: `ZohoBooks.fullaccess.all`
3. Set time duration: 10 minutes
4. Enter description: "Zoho Books MCP Server"
5. Click **Create** → Copy the **grant token**

6. Exchange grant token for refresh token:
```bash
curl -X POST "https://accounts.zoho.in/oauth/v2/token" \
  -d "grant_type=authorization_code" \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET" \
  -d "code=YOUR_GRANT_TOKEN"
```

7. Response will contain `refresh_token` — save it (never expires)

## Step 3: Get Organization ID

After getting the refresh token, you can find your Organization ID in:
- Zoho Books → Settings → Organization Profile → Organization ID
- Or via API after configuring the server

## Step 4: Configure Environment

Create `.env` in the repo directory:
```bash
cd ~/workspace_treta/skills/zoho-books/repo
cp .env.example .env
```

Edit `.env`:
```
ZOHO_CLIENT_ID=1000.xxxxxxxxxxxxxxxxxxxxxxxxxxxx
ZOHO_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
ZOHO_REFRESH_TOKEN=1000.xxxxxxxxxxxxxxxx.xxxxxxxxxxxxxxxx
ZOHO_ORGANIZATION_ID=your_org_id_here
ZOHO_API_URL=https://www.zohoapis.in/books/v3
```

## Step 5: Build

```bash
cd ~/workspace_treta/skills/zoho-books/repo
pnpm install
pnpm run build
```

## Step 6: Add to Claude Code MCP Config

Add to `~/.claude.json` under `mcpServers`:
```json
{
  "mcpServers": {
    "zoho-books": {
      "command": "node",
      "args": ["~/workspace_treta/skills/zoho-books/repo/dist/bin.js"],
      "env": {
        "ZOHO_CLIENT_ID": "your_client_id",
        "ZOHO_CLIENT_SECRET": "your_client_secret",
        "ZOHO_REFRESH_TOKEN": "your_refresh_token",
        "ZOHO_ORGANIZATION_ID": "your_org_id",
        "ZOHO_API_URL": "https://www.zohoapis.in/books/v3"
      }
    }
  }
}
```

## Step 7: Verify

Restart Claude Code and test:
- "List all Zoho Books organizations"
- "Show chart of accounts"
- "List recent invoices"

## For Other Beings (Chanakya, etc.)

Each Being needs:
1. Clone the repo or access the built `dist/` directory
2. Same OAuth credentials (shared org) or separate credentials
3. Add MCP server config to their Claude Code / runtime config
4. Read SKILL.md for available tools

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `ZOHO_CLIENT_ID is not configured` | Check .env file or MCP config env vars |
| `Failed to refresh token` | Regenerate grant token → get new refresh token |
| `Request timeout` | Check network, Zoho API status |
| `429 Too Many Requests` | Rate limit hit — wait 1 minute |
| Region mismatch | Ensure API URL matches your Zoho datacenter (`.in` for India) |
