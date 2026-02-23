import { WebSocketServer, WebSocket } from "ws";
import { randomUUID } from "node:crypto";
import type {
  BridgeRequest,
  BridgeResponse,
  ExtensionMessage,
  PendingRequest,
} from "./types.js";

const REQUEST_TIMEOUT_MS = 60_000;
const DEFAULT_IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export interface BridgeLogger {
  info: (msg: string) => void;
  warn: (msg: string) => void;
  error: (msg: string) => void;
}

export interface BridgeOptions {
  logger?: BridgeLogger;
  /** Shut down after this many ms of inactivity (0 to disable). Defaults to 5 minutes. */
  idleTimeoutMs?: number;
  /** Called after the bridge stops itself due to inactivity. */
  onIdleShutdown?: () => void;
}

export class WebSocketBridge {
  private wss: WebSocketServer | null = null;
  private extensionSocket: WebSocket | null = null;
  private pendingRequests = new Map<string, PendingRequest>();
  private port: number;
  private logger: BridgeLogger;
  private idleTimeoutMs: number;
  private onIdleShutdown?: () => void;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(port: number, options?: BridgeOptions) {
    this.port = port;
    this.logger = options?.logger ?? {
      info: (msg: string) => console.log(`[openclaw-reddit-agent-server] ${msg}`),
      warn: (msg: string) => console.warn(`[openclaw-reddit-agent-server] ${msg}`),
      error: (msg: string) => console.error(`[openclaw-reddit-agent-server] ${msg}`),
    };
    this.idleTimeoutMs = options?.idleTimeoutMs ?? DEFAULT_IDLE_TIMEOUT_MS;
    this.onIdleShutdown = options?.onIdleShutdown;
  }

  get isExtensionConnected(): boolean {
    return (
      this.extensionSocket !== null &&
      this.extensionSocket.readyState === WebSocket.OPEN
    );
  }

  private resetIdleTimer(): void {
    if (this.idleTimeoutMs <= 0) return;
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => {
      this.idleTimer = null;
      this.logger.info(
        `No activity for ${this.idleTimeoutMs / 1000}s — idle shutdown`
      );
      this.stop();
      this.onIdleShutdown?.();
    }, this.idleTimeoutMs);
  }

  start(): void {
    if (this.wss) return;

    this.resetIdleTimer();
    this.wss = new WebSocketServer({ port: this.port, path: "/ws" });
    this.logger.info(
      `WebSocket bridge listening on ws://localhost:${this.port}/ws`
    );

    this.wss.on("connection", (socket) => {
      this.logger.info("New WebSocket connection");

      socket.on("message", (raw) => {
        let message: ExtensionMessage;
        try {
          message = JSON.parse(
            typeof raw === "string" ? raw : raw.toString("utf8")
          );
        } catch {
          this.logger.warn("Failed to parse incoming WebSocket message");
          return;
        }

        // Handle identify
        if ("type" in message && message.type === "identify") {
          this.logger.info(
            `Extension identified (role: ${(message as { role: string }).role})`
          );
          this.extensionSocket = socket;
          this.resetIdleTimer();
          return;
        }

        // Handle ping/pong keepalive
        if ("type" in message && message.type === "ping") {
          socket.send(JSON.stringify({ type: "pong" }));
          return;
        }

        // Handle response to a pending request
        if ("id" in message && "success" in message) {
          const response = message as BridgeResponse;
          const pending = this.pendingRequests.get(response.id);
          if (!pending) {
            this.logger.warn(
              `Received response for unknown request id: ${response.id}`
            );
            return;
          }
          this.pendingRequests.delete(response.id);
          clearTimeout(pending.timer);
          this.resetIdleTimer();

          if (response.success) {
            pending.resolve(response.data);
          } else {
            pending.reject(new Error(response.error));
          }
        }
      });

      socket.on("close", () => {
        if (socket === this.extensionSocket) {
          this.logger.info("Extension disconnected");
          this.extensionSocket = null;
        }
      });

      socket.on("error", (err) => {
        this.logger.error(`WebSocket error: ${err.message}`);
      });
    });
  }

  stop(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }

    // Reject all pending requests
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timer);
      pending.reject(new Error("WebSocket bridge shutting down"));
      this.pendingRequests.delete(id);
    }

    if (this.extensionSocket) {
      this.extensionSocket.close();
      this.extensionSocket = null;
    }

    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }

    this.logger.info("WebSocket bridge stopped");
  }

  /**
   * Send an action to the connected Chrome extension and wait for a response.
   * Returns the `data` field from the success response.
   */
  sendAction(
    action: string,
    params: Record<string, unknown>,
    timeoutMs = REQUEST_TIMEOUT_MS
  ): Promise<unknown> {
    if (!this.isExtensionConnected) {
      return Promise.reject(
        new Error(
          "Reddit Agent Chrome extension is not connected. " +
          "Please ensure the extension is installed, the server URL is configured " +
          `to ws://localhost:${this.port}/ws in the extension popup, and the browser is running.`
        )
      );
    }

    this.resetIdleTimer();

    const id = randomUUID();
    const request: BridgeRequest = { id, action, params };

    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(
          new Error(
            `Request timed out after ${timeoutMs}ms for action: ${action}`
          )
        );
      }, timeoutMs);

      this.pendingRequests.set(id, { resolve, reject, timer });
      this.extensionSocket!.send(JSON.stringify(request));
    });
  }
}
