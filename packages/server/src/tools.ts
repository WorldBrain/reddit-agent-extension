import { Type } from "@sinclair/typebox";
import type { WebSocketBridge } from "./ws-bridge.js";

const MAX_ACTION_TIMEOUT_MS = 5 * 60_000;

interface ToolConfig {
  name: string;
  description: string;
  parameters: unknown;
  execute: (
    id: string,
    params: Record<string, unknown>
  ) => Promise<{ content: { type: "text"; text: string }[] }>;
}

function asJsonText(data: unknown): { content: { type: "text"; text: string }[] } {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

function asPlainText(text: string): { content: { type: "text"; text: string }[] } {
  return {
    content: [{ type: "text" as const, text }],
  };
}

function toPlainObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function resolveTimeoutMs(raw: unknown): number | undefined {
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return undefined;
  }
  const normalized = Math.floor(raw);
  if (normalized <= 0) return undefined;
  return Math.min(normalized, MAX_ACTION_TIMEOUT_MS);
}

export function registerRedditTools(
  registerTool: (config: ToolConfig) => void,
  bridge: WebSocketBridge
) {
  registerTool({
    name: "reddit_list_pairing_requests",
    description:
      "List pending browser-extension pairing requests that need user approval.",
    parameters: Type.Object({}),
    async execute() {
      const data = bridge.getPendingPairings();
      return asJsonText(data);
    },
  });

  registerTool({
    name: "reddit_approve_pairing",
    description:
      "Approve a pending browser-extension pairing request by its pairing code.",
    parameters: Type.Object({
      code: Type.String({
        description:
          "Pairing code shown in the extension popup (for example: ABC123).",
      }),
    }),
    async execute(_id: string, params: Record<string, unknown>) {
      const code = String(params.code ?? "").trim();
      const data = bridge.approvePairing(code);
      return asJsonText(data);
    },
  });

  registerTool({
    name: "reddit_list_paired_devices",
    description:
      "List previously approved extension devices that can auto-connect.",
    parameters: Type.Object({}),
    async execute() {
      const data = bridge.getPairedDevices();
      return asJsonText(data);
    },
  });

  registerTool({
    name: "reddit_bridge_status",
    description:
      "Return Reddit bridge runtime status, endpoint details, and pairing state.",
    parameters: Type.Object({}),
    async execute() {
      const data = bridge.getBridgeStatus();
      return asJsonText(data);
    },
  });

  registerTool({
    name: "reddit_extension_get_schema",
    description:
      "Return the extension API schema markdown from the `get_skill` action. " +
      "Call this before executing other extension actions.",
    parameters: Type.Object({}),
    async execute() {
      const data = await bridge.sendAction("get_skill", {});
      if (typeof data === "string") {
        return asPlainText(data);
      }
      return asJsonText(data);
    },
  });

  registerTool({
    name: "reddit_extension_call",
    description:
      "Call a browser-extension action through the Reddit bridge using " +
      "the extension's action schema. Use `reddit_extension_get_schema` first.",
    parameters: Type.Object({
      action: Type.String({
        description:
          "Extension action name from the schema (for example: fetch_subreddit, search_reddit, fetch_post, reply_to_comment).",
      }),
      params: Type.Optional(
        Type.Record(Type.String(), Type.Unknown(), {
          description:
            "Action parameters as an object. Shape depends on the selected action.",
        })
      ),
      timeoutMs: Type.Optional(
        Type.Number({
          description:
            "Optional timeout in milliseconds (max 300000). If omitted, bridge default is used.",
          minimum: 1,
        })
      ),
    }),
    async execute(_id: string, params: Record<string, unknown>) {
      const action = String(params.action ?? "").trim();
      if (!action) {
        throw new Error("Missing required parameter: action");
      }

      const actionParams = toPlainObject(params.params);
      const timeoutMs = resolveTimeoutMs(params.timeoutMs);
      const data = await bridge.sendAction(action, actionParams, timeoutMs);
      return asJsonText(data);
    },
  });
}
