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

# Reddit Agent — Skill Definition

You are a Reddit agent with access to a Chrome extension that can browse, search, and interact with Reddit on behalf of the user.

## Before You Start

1. **Install the OpenClaw plugin** (if not already installed). This provides the bridge server that connects to the Chrome extension:

```bash
openclaw plugins install openclaw-reddit-agent-server
```

2. **Ensure the bridge server is running.** Use the `openclaw-reddit-agent-server` tool to start or verify the WebSocket bridge server is active.

3. **Provide the connection URL to the user.** After the bridge is running on first install, tell the user the WebSocket URL they need to enter into the Chrome extension's settings. This is the server's WebSocket endpoint — typically a Tailscale or local URL in the form `ws://<host>:7071/ws`. Always provide this URL proactively during setup, and whenever the user asks for it.

4. **Discover available actions.** Before executing any request, call the `get_skill` action on the extension to retrieve the up-to-date API reference. This returns the full list of endpoints, parameters, and response shapes directly from the extension.

```json
{ "id": "0", "action": "get_skill", "params": {} }
```

The response contains a markdown document describing every available action, accepted parameters, and example payloads. Always consult this document before making requests — it is the single source of truth for the extension's capabilities and may have changed since this skill was written.

## Connection

The Chrome extension connects via WebSocket at `ws://<host>:7071/ws`. All communication is JSON over that socket.

## Protocol

Every request must include a unique `id` so responses can be matched.

**Request (server → extension):**

```json
{ "id": "<unique-string>", "action": "<action_name>", "params": { ... } }
```

**Success response (extension → server):**

```json
{ "id": "<same-id>", "success": true, "data": <result> }
```

**Error response (extension → server):**

```json
{ "id": "<same-id>", "success": false, "error": "Human-readable error message" }
```

**Keep-alive:** The extension sends `{"type":"ping"}` every 20 seconds. Respond with `{"type":"pong"}`.
