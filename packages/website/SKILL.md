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

3. **Provide the connection host to the user.** After the bridge is running on first install, tell the user the host they should enter into the Chrome extension (typically a Tailscale IP/name, or `localhost` for same-machine setups). The extension normalizes host-only input to `ws://<host>:7071/ws` automatically, and also accepts full `ws://...` / `wss://...` URLs. Always provide this proactively during setup, and whenever the user asks for it.

4. **Approve first-time pairing.** New extension devices must be explicitly approved: read pending requests with `reddit_list_pairing_requests`, approve a code with `reddit_approve_pairing`, and optionally audit with `reddit_list_paired_devices`.

5. **Discover available actions first.** Call `reddit_extension_get_schema` to retrieve the extension's live API schema markdown (`get_skill` under the hood). This is the source of truth for supported actions and parameter shapes.

6. **Execute through the thin bridge adapter.** Call `reddit_extension_call` with:
   - `action`: extension action name from schema
   - `params`: action-specific object
   - `timeoutMs` (optional): custom timeout for slower actions

Always read schema first, then choose the minimal matching action(s) for the user's request.

## Connection

The Chrome extension accepts host input and connects via normalized WebSocket URL `ws://<host>:7071/ws` (fixed port `7071`, `/ws` appended automatically). It also accepts full `ws://...` and `wss://...` URLs. First-time devices require pairing approval. All communication is JSON over that socket.

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
