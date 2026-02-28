import { WebSocketBridge } from "./src/ws-bridge.js";
import { registerRedditTools } from "./src/tools.js";

const BRIDGE_PORT = 7071;
const DEFAULT_HOST = "0.0.0.0";
const DEFAULT_PAIRING_CODE_TTL_SECONDS = 600;
const DEFAULT_NETWORK_POLICY = "private";

interface PluginLogger {
  info: (msg: string) => void;
  warn: (msg: string) => void;
  error: (msg: string) => void;
}

interface PluginApi {
  pluginConfig: Record<string, unknown> | undefined;
  logger: PluginLogger;
  registerTool: (config: unknown) => void;
  registerService: (config: {
    id: string;
    start: () => void | Promise<void>;
    stop: () => void | Promise<void>;
  }) => void;
}

const redditAgentPlugin = {
  id: "openclaw-reddit-agent-server",
  name: "OpenClaw Reddit Agent",
  description:
    "Bridge to Reddit Chrome extension for browsing, searching, and commenting.",

  register(api: PluginApi) {
    const host =
      typeof api.pluginConfig?.host === "string" &&
      api.pluginConfig.host.trim().length > 0
        ? api.pluginConfig.host.trim()
        : DEFAULT_HOST;
    const pairingCodeTtlSeconds =
      typeof api.pluginConfig?.pairingCodeTtlSeconds === "number" &&
      api.pluginConfig.pairingCodeTtlSeconds > 0
        ? api.pluginConfig.pairingCodeTtlSeconds
        : DEFAULT_PAIRING_CODE_TTL_SECONDS;
    const pairingStorePath =
      typeof api.pluginConfig?.pairingStorePath === "string" &&
      api.pluginConfig.pairingStorePath.trim().length > 0
        ? api.pluginConfig.pairingStorePath.trim()
        : undefined;
    const networkPolicy =
      api.pluginConfig?.networkPolicy === "loopback" ||
      api.pluginConfig?.networkPolicy === "private" ||
      api.pluginConfig?.networkPolicy === "any"
        ? api.pluginConfig.networkPolicy
        : DEFAULT_NETWORK_POLICY;

    const bridge = new WebSocketBridge(BRIDGE_PORT, {
      logger: {
        info: (msg) => api.logger.info(msg),
        warn: (msg) => api.logger.warn(msg),
        error: (msg) => api.logger.error(msg),
      },
      host,
      pairingCodeTtlMs: pairingCodeTtlSeconds * 1000,
      pairingStorePath,
      networkPolicy,
    });

    api.registerService({
      id: "reddit-agent-bridge",
      start: () => {
        bridge.start();
      },
      stop: () => {
        bridge.stop();
      },
    });

    registerRedditTools(
      (config) => api.registerTool(config),
      bridge
    );
  },
};

export default redditAgentPlugin;
