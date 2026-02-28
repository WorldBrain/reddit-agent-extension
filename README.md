# Reddit Agent Extension

A Chrome extension that exposes Reddit automation actions, enabling external agents to fetch subreddit/post data, search Reddit, and reply to comments.

## SKILL.md (Standard Frontmatter)

Use this structure for skill metadata:

```yaml
---
name: reddit-agent
description: Browse, search, read, and interact with Reddit through the Reddit Agent Chrome extension and OpenClaw bridge. Use when the user wants Reddit discovery, thread reading, profile lookups, or posting replies.
homepage: https://github.com/oliversauter/reddit-agent-extension
metadata:
  openclaw:
    emoji: "🤖"
    requires:
      bins:
        - openclaw
    install:
      - id: npm
        kind: npm
        package: openclaw-reddit-agent-server@latest
        bins:
          - openclaw-reddit-agent-server
        label: Install OpenClaw Reddit Agent server (npm)
---
```

## Setup

```bash
npm install
npm run build    # Build extension to dist/
```

Optional: configure a shared website base URL for all packages:

```bash
cp .env.example .env
```

Then edit `.env`:

```bash
VITE_WEBSITE_URL=https://redditclaw.com
```

Load `dist/` in Chrome: `chrome://extensions/` → Developer mode → Load unpacked

For development with auto-rebuild: `npm run dev`

## Server

The bridge server connects the Chrome extension (via WebSocket) to HTTP API endpoints:

```bash
npm run server    # Starts on http://localhost:7071
```

In the extension popup, enter your bridge host (Tailscale IP/name or `localhost` for same-machine setups). The extension normalizes host-only input to `ws://<host>:7071/ws` automatically, and also accepts full `ws://...` / `wss://...` URLs.
On first connection, approve the pairing code from OpenClaw with `reddit_approve_pairing`.

## HTTP API

### `GET /api/subreddit?url=...`

Fetch subreddit listing JSON.

```bash
curl "http://localhost:7071/api/subreddit?url=https://www.reddit.com/r/supplements"
```

### `GET /api/search?query=...`

Search Reddit, returns post titles + URLs.

```bash
curl "http://localhost:7071/api/search?query=javascript+frameworks"
```

### `GET /api/post?url=...`

Fetch post + comments JSON.

```bash
curl "http://localhost:7071/api/post?url=https://www.reddit.com/r/programming/comments/abc123/post/"
```

### `POST /api/reply`

Reply to a comment (requires Reddit login in Chrome).

```bash
curl -X POST http://localhost:7071/api/reply \
  -H "Content-Type: application/json" \
  -d '{"commentUrl": "https://www.reddit.com/r/sub/comments/abc123/title/def456/", "replyText": "Great point!"}'
```

### `GET /health`

Check server status and extension connection.

## Project Structure

```
├── server.js            # Bridge server (WebSocket + HTTP API)
├── package.json         # Dependencies & scripts
├── vite.config.js       # Vite + CRXJS config
├── manifest.json        # Chrome MV3 manifest (source)
├── src/
│   └── background.js    # Extension service worker (all action logic)
└── dist/                # Built extension (load in Chrome)
```

## Notes

- Tabs for search/reply open in background and close automatically
- Reddit rate limits apply — avoid rapid-fire requests
- Reply action requires an active Reddit login session in Chrome
- The extension ID is assigned by Chrome on install — needed by callers
