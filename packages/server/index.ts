import { WebSocketBridge } from "./src/ws-bridge.js";
import { registerRedditTools } from "./src/tools.js";

const DEFAULT_PORT = 7071;

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
    const port =
      typeof api.pluginConfig?.port === "number"
        ? api.pluginConfig.port
        : DEFAULT_PORT;

    const bridge = new WebSocketBridge(port, {
      logger: {
        info: (msg) => api.logger.info(msg),
        warn: (msg) => api.logger.warn(msg),
        error: (msg) => api.logger.error(msg),
      },
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
