import { createHash, randomInt, randomUUID } from "node:crypto";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { isIP } from "node:net";
import { homedir } from "node:os";
import path from "node:path";
import { WebSocket, WebSocketServer } from "ws";
import type {
  BridgeRequest,
  BridgeResponse,
  IdentifyMessage,
  PairedDevice,
  PendingPairing,
  PendingRequest,
} from "./types.js";

const REQUEST_TIMEOUT_MS = 60_000;
const DEFAULT_IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const DEFAULT_BIND_HOST = "0.0.0.0";
const DEFAULT_PAIRING_TTL_MS = 10 * 60 * 1000; // 10 minutes
const DEFAULT_MAX_PAYLOAD_BYTES = 8 * 1024 * 1024; // 8 MiB
const DEFAULT_NETWORK_POLICY: BridgeNetworkPolicy = "private";
const DEFAULT_PAIRING_STORE_PATH = path.join(
  homedir(),
  ".openclaw",
  "reddit-agent-pairings.json"
);
const PAIRING_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const PAIRING_CODE_LENGTH = 6;
const MAX_RESPONSE_ID_LENGTH = 200;
const MAX_RESPONSE_ERROR_LENGTH = 2_000;
const EXTENSION_RECONNECT_WAIT_MS = 6_500;
const EXTENSION_RECONNECT_POLL_MS = 250;
const ALLOWED_ACTIONS = new Set([
  "get_skill",
  "fetch_subreddit",
  "search_reddit",
  "fetch_user_posts",
  "fetch_post",
  "reply_to_comment",
]);

interface PairedDeviceRecord {
  deviceId: string;
  deviceName: string;
  authTokenHash: string;
  approvedAt: string;
  lastSeenAt: string;
}

interface PairingStoreFile {
  version: number;
  devices: Array<
    Omit<PairedDeviceRecord, "authTokenHash"> & {
      authTokenHash?: string;
      authToken?: string;
    }
  >;
}

interface PendingPairingRecord {
  code: string;
  deviceId: string;
  deviceName: string;
  requestedAt: number;
  expiresAt: number;
  socket: WebSocket;
}

export interface BridgeLogger {
  info: (msg: string) => void;
  warn: (msg: string) => void;
  error: (msg: string) => void;
}

export interface BridgeOptions {
  logger?: BridgeLogger;
  host?: string;
  pairingStorePath?: string;
  pairingCodeTtlMs?: number;
  networkPolicy?: BridgeNetworkPolicy;
  /** Shut down after this many ms of inactivity (0 to disable). Defaults to 5 minutes. */
  idleTimeoutMs?: number;
  /** Called after the bridge stops itself due to inactivity. */
  onIdleShutdown?: () => void;
}

export type BridgeNetworkPolicy = "loopback" | "private" | "any";

export class WebSocketBridge {
  private wss: WebSocketServer | null = null;
  private extensionSocket: WebSocket | null = null;
  private pendingRequests = new Map<string, PendingRequest>();
  private pendingPairings = new Map<string, PendingPairingRecord>();
  private pendingPairingCodeBySocket = new Map<WebSocket, string>();
  private pairedDevices = new Map<string, PairedDeviceRecord>();
  private port: number;
  private host: string;
  private logger: BridgeLogger;
  private pairingStorePath: string;
  private pairingCodeTtlMs: number;
  private networkPolicy: BridgeNetworkPolicy;
  private idleTimeoutMs: number;
  private onIdleShutdown?: () => void;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(port: number, options?: BridgeOptions) {
    this.port = port;
    this.host = options?.host?.trim() || DEFAULT_BIND_HOST;
    this.logger = options?.logger ?? {
      info: (msg: string) => console.log(`[openclaw-reddit-agent-server] ${msg}`),
      warn: (msg: string) => console.warn(`[openclaw-reddit-agent-server] ${msg}`),
      error: (msg: string) =>
        console.error(`[openclaw-reddit-agent-server] ${msg}`),
    };
    this.pairingStorePath =
      options?.pairingStorePath?.trim() || DEFAULT_PAIRING_STORE_PATH;
    this.pairingCodeTtlMs = options?.pairingCodeTtlMs ?? DEFAULT_PAIRING_TTL_MS;
    this.networkPolicy = options?.networkPolicy ?? DEFAULT_NETWORK_POLICY;
    this.idleTimeoutMs = options?.idleTimeoutMs ?? DEFAULT_IDLE_TIMEOUT_MS;
    this.onIdleShutdown = options?.onIdleShutdown;

    this.loadPairedDevices();
  }

  get isExtensionConnected(): boolean {
    return (
      this.extensionSocket !== null &&
      this.extensionSocket.readyState === WebSocket.OPEN
    );
  }

  getPendingPairings(): PendingPairing[] {
    this.ensureStarted();
    this.pruneExpiredPairings();
    return Array.from(this.pendingPairings.values())
      .sort((a, b) => b.requestedAt - a.requestedAt)
      .map((entry) => ({
        code: entry.code,
        deviceId: entry.deviceId,
        deviceName: entry.deviceName,
        requestedAt: new Date(entry.requestedAt).toISOString(),
        expiresAt: new Date(entry.expiresAt).toISOString(),
      }));
  }

  getPairedDevices(): PairedDevice[] {
    return Array.from(this.pairedDevices.values())
      .sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt))
      .map((device) => ({
        deviceId: device.deviceId,
        deviceName: device.deviceName,
        approvedAt: device.approvedAt,
        lastSeenAt: device.lastSeenAt,
      }));
  }

  getBridgeStatus(): {
    endpoint: { host: string; port: number; path: string };
    networkPolicy: BridgeNetworkPolicy;
    isExtensionConnected: boolean;
    pendingPairings: PendingPairing[];
    pairedDevices: PairedDevice[];
  } {
    this.ensureStarted();
    return {
      endpoint: {
        host: this.host,
        port: this.port,
        path: "/ws",
      },
      networkPolicy: this.networkPolicy,
      isExtensionConnected: this.isExtensionConnected,
      pendingPairings: this.getPendingPairings(),
      pairedDevices: this.getPairedDevices(),
    };
  }

  approvePairing(codeInput: string): PairedDevice {
    this.ensureStarted();
    const code = this.normalizePairingCode(codeInput);
    if (!code) {
      throw new Error("Missing pairing code.");
    }

    this.pruneExpiredPairings();
    const pairing = this.pendingPairings.get(code);
    if (!pairing) {
      throw new Error(
        `Pairing code "${code}" is invalid or expired. Request a new code in the extension.`
      );
    }

    if (pairing.socket.readyState !== WebSocket.OPEN) {
      this.deletePendingPairing(code);
      throw new Error("Pairing request is no longer active. Request a new code.");
    }

    const now = new Date().toISOString();
    const authToken = randomUUID();
    const paired: PairedDeviceRecord = {
      deviceId: pairing.deviceId,
      deviceName: pairing.deviceName,
      authTokenHash: this.hashAuthToken(authToken),
      approvedAt: now,
      lastSeenAt: now,
    };

    this.pairedDevices.set(paired.deviceId, paired);
    this.persistPairedDevices();

    this.sendJson(pairing.socket, {
      type: "pairing_approved",
      deviceId: paired.deviceId,
      deviceName: paired.deviceName,
      authToken,
    });

    this.deletePendingPairing(code);
    this.markSocketAsExtension(pairing.socket, paired);

    this.logger.info(
      `Approved extension pairing for "${paired.deviceName}" (${paired.deviceId})`
    );
    return {
      deviceId: paired.deviceId,
      deviceName: paired.deviceName,
      approvedAt: paired.approvedAt,
      lastSeenAt: paired.lastSeenAt,
    };
  }

  start(): void {
    if (this.wss) return;

    this.resetIdleTimer();
    this.wss = new WebSocketServer({
      port: this.port,
      host: this.host,
      path: "/ws",
      maxPayload: DEFAULT_MAX_PAYLOAD_BYTES,
    });
    this.logger.info(
      `WebSocket bridge listening on ws://${this.host}:${this.port}/ws`
    );

    this.wss.on("connection", (socket, request) => {
      const remoteAddress = request.socket.remoteAddress ?? "unknown";
      if (!this.isClientAddressAllowed(remoteAddress)) {
        this.logger.warn(
          `Rejected bridge connection from ${remoteAddress} due to network policy "${this.networkPolicy}"`
        );
        this.closeProtocolViolation(socket, "Client network not allowed");
        return;
      }
      this.logger.info(
        `New WebSocket connection from ${remoteAddress}`
      );

      socket.on("message", (raw) => {
        const message = this.parseIncomingMessage(raw);
        if (!message) {
          this.logger.warn("Failed to parse incoming WebSocket message");
          this.closeProtocolViolation(socket, "Invalid JSON message");
          return;
        }

        if (this.isPingMessage(message)) {
          this.sendJson(socket, { type: "pong" });
          return;
        }

        if (this.isIdentifyMessage(message)) {
          this.handleIdentify(socket, message);
          return;
        }

        if (this.isBridgeResponseMessage(message)) {
          if (socket !== this.extensionSocket) {
            this.logger.warn(
              `Dropping response from unauthenticated socket id: ${message.id}`
            );
            this.closeProtocolViolation(socket, "Unauthenticated response");
            return;
          }

          const pending = this.pendingRequests.get(message.id);
          if (!pending) {
            this.logger.warn(
              `Received response for unknown request id: ${message.id}`
            );
            this.closeProtocolViolation(socket, "Unknown request id");
            return;
          }

          this.pendingRequests.delete(message.id);
          clearTimeout(pending.timer);
          this.resetIdleTimer();

          if (message.success) {
            pending.resolve(message.data);
          } else {
            pending.reject(new Error(message.error));
          }
          return;
        }

        if (this.isObject(message) && "action" in message) {
          this.logger.warn(
            `Rejected illegal inbound action from extension socket ${this.describeSocket(socket)}`
          );
          this.closeProtocolViolation(
            socket,
            "Inbound actions are not allowed from extension"
          );
          return;
        }

        this.logger.warn(
          `Ignoring unexpected bridge message from ${this.describeSocket(socket)}`
        );
        this.closeProtocolViolation(socket, "Unexpected message shape");
      });

      socket.on("close", () => {
        const code = this.pendingPairingCodeBySocket.get(socket);
        if (code) {
          this.deletePendingPairing(code);
        }

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

  ensureStarted(): void {
    if (!this.wss) {
      this.start();
    }
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

    this.pendingPairings.clear();
    this.pendingPairingCodeBySocket.clear();

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
  async sendAction(
    action: string,
    params: Record<string, unknown>,
    timeoutMs = REQUEST_TIMEOUT_MS
  ): Promise<unknown> {
    if (!ALLOWED_ACTIONS.has(action)) {
      return Promise.reject(new Error(`Unsupported bridge action: ${action}`));
    }

    this.ensureStarted();
    if (!this.isExtensionConnected) {
      await this.waitForExtensionConnection(EXTENSION_RECONNECT_WAIT_MS);
    }

    if (!this.isExtensionConnected) {
      const pendingCodes = this.getPendingPairings().map((pairing) => pairing.code);
      const pairingHint =
        pendingCodes.length > 0
          ? `Pending pairing code(s): ${pendingCodes.join(", ")}. Approve one with reddit_approve_pairing.`
          : "Open the extension popup and request pairing, then approve with reddit_approve_pairing.";
      return Promise.reject(
        new Error(
          "Reddit Agent Chrome extension is not connected. " +
            `Ensure the extension points to ws://<your-openclaw-host>:${this.port}/ws and is approved. ` +
            pairingHint
        )
      );
    }

    this.resetIdleTimer();

    const id = randomUUID();
    const request: BridgeRequest = { id, action, params };

    return new Promise<unknown>((resolve, reject) => {
      const activeSocket = this.extensionSocket;
      if (!activeSocket || activeSocket.readyState !== WebSocket.OPEN) {
        reject(new Error("Extension socket is not open"));
        return;
      }

      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(
          new Error(
            `Request timed out after ${timeoutMs}ms for action: ${action}`
          )
        );
      }, timeoutMs);

      this.pendingRequests.set(id, { resolve, reject, timer });
      try {
        activeSocket.send(JSON.stringify(request));
      } catch (error) {
        clearTimeout(timer);
        this.pendingRequests.delete(id);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
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

  private async waitForExtensionConnection(timeoutMs: number): Promise<void> {
    if (this.isExtensionConnected) return;

    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (this.isExtensionConnected) return;
      await new Promise((resolve) =>
        setTimeout(resolve, EXTENSION_RECONNECT_POLL_MS)
      );
    }
  }

  private handleIdentify(
    socket: WebSocket,
    message: IdentifyMessage
  ): void {
    if (message.role !== "extension") {
      this.logger.warn(`Ignoring identify with unsupported role: ${message.role}`);
      this.closeProtocolViolation(socket, "Unsupported role");
      return;
    }

    const deviceId = this.sanitizeDeviceId(message.deviceId);
    if (!deviceId) {
      this.logger.warn("Identify message has an invalid deviceId");
      this.closeProtocolViolation(socket, "Invalid deviceId");
      return;
    }

    const deviceName = this.sanitizeDeviceName(message.deviceName);
    const paired = this.pairedDevices.get(deviceId);
    const providedToken = message.authToken?.trim();
    const providedTokenHash = providedToken
      ? this.hashAuthToken(providedToken)
      : null;

    if (paired && providedTokenHash && providedTokenHash === paired.authTokenHash) {
      this.deletePendingPairingBySocket(socket);
      this.markSocketAsExtension(socket, {
        ...paired,
        deviceName,
      });
      this.logger.info(`Extension authenticated (${deviceName}, ${deviceId})`);
      return;
    }

    const pairing = this.createOrRefreshPairing(socket, deviceId, deviceName);
    this.logger.info(
      `Pairing required for "${pairing.deviceName}" (${pairing.deviceId}). Awaiting user approval.`
    );
    this.sendJson(socket, {
      type: "pairing_required",
      code: pairing.code,
      deviceId: pairing.deviceId,
      deviceName: pairing.deviceName,
      requestedAt: new Date(pairing.requestedAt).toISOString(),
      expiresAt: new Date(pairing.expiresAt).toISOString(),
    });
  }

  private markSocketAsExtension(
    socket: WebSocket,
    paired: PairedDeviceRecord
  ): void {
    if (this.extensionSocket && this.extensionSocket !== socket) {
      this.extensionSocket.close();
    }

    const now = new Date().toISOString();
    const updated: PairedDeviceRecord = {
      ...paired,
      lastSeenAt: now,
    };
    this.pairedDevices.set(updated.deviceId, updated);
    this.persistPairedDevices();

    this.extensionSocket = socket;
    this.resetIdleTimer();
    this.sendJson(socket, {
      type: "identified",
      deviceId: updated.deviceId,
      deviceName: updated.deviceName,
    });
  }

  private createOrRefreshPairing(
    socket: WebSocket,
    deviceId: string,
    deviceName: string
  ): PendingPairingRecord {
    this.pruneExpiredPairings();
    this.deletePendingPairingBySocket(socket);

    for (const pairing of this.pendingPairings.values()) {
      if (pairing.deviceId === deviceId && pairing.socket.readyState === WebSocket.OPEN) {
        this.pendingPairingCodeBySocket.delete(pairing.socket);
        this.pendingPairingCodeBySocket.set(socket, pairing.code);
        pairing.socket = socket;
        pairing.deviceName = deviceName;
        pairing.requestedAt = Date.now();
        pairing.expiresAt = pairing.requestedAt + this.pairingCodeTtlMs;
        return pairing;
      }
    }

    let code = this.generatePairingCode();
    while (this.pendingPairings.has(code)) {
      code = this.generatePairingCode();
    }

    const requestedAt = Date.now();
    const pairing: PendingPairingRecord = {
      code,
      deviceId,
      deviceName,
      requestedAt,
      expiresAt: requestedAt + this.pairingCodeTtlMs,
      socket,
    };
    this.pendingPairings.set(code, pairing);
    this.pendingPairingCodeBySocket.set(socket, code);
    return pairing;
  }

  private pruneExpiredPairings(): void {
    const now = Date.now();
    for (const [code, pairing] of this.pendingPairings) {
      if (pairing.expiresAt <= now || pairing.socket.readyState !== WebSocket.OPEN) {
        this.deletePendingPairing(code);
      }
    }
  }

  private deletePendingPairing(code: string): void {
    const pairing = this.pendingPairings.get(code);
    if (!pairing) return;
    this.pendingPairings.delete(code);
    this.pendingPairingCodeBySocket.delete(pairing.socket);
  }

  private deletePendingPairingBySocket(socket: WebSocket): void {
    const code = this.pendingPairingCodeBySocket.get(socket);
    if (!code) return;
    this.deletePendingPairing(code);
  }

  private normalizePairingCode(input: string): string {
    return input.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  }

  private generatePairingCode(): string {
    let code = "";
    for (let index = 0; index < PAIRING_CODE_LENGTH; index += 1) {
      const pos = randomInt(0, PAIRING_CODE_ALPHABET.length);
      code += PAIRING_CODE_ALPHABET[pos];
    }
    return code;
  }

  private sanitizeDeviceName(raw?: string): string {
    const value = raw?.trim();
    return value ? value.slice(0, 120) : "Reddit Agent Extension";
  }

  private sanitizeDeviceId(raw?: string): string | null {
    const value = raw?.trim();
    if (!value || value.length > 120) return null;
    return /^[A-Za-z0-9._:-]+$/.test(value) ? value : null;
  }

  private hashAuthToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  private loadPairedDevices(): void {
    try {
      if (!existsSync(this.pairingStorePath)) {
        return;
      }
      const raw = readFileSync(this.pairingStorePath, "utf8");
      const parsed = JSON.parse(raw) as Partial<PairingStoreFile>;
      const devices = Array.isArray(parsed.devices) ? parsed.devices : [];
      let needsMigration = false;

      for (const device of devices) {
        const authTokenHash =
          typeof device.authTokenHash === "string"
            ? device.authTokenHash
            : typeof device.authToken === "string"
              ? this.hashAuthToken(device.authToken)
              : null;
        if (
          typeof device.deviceId === "string" &&
          typeof device.deviceName === "string" &&
          typeof authTokenHash === "string" &&
          authTokenHash.length > 0 &&
          typeof device.approvedAt === "string" &&
          typeof device.lastSeenAt === "string"
        ) {
          if (typeof device.authToken === "string" && !device.authTokenHash) {
            needsMigration = true;
          }
          this.pairedDevices.set(device.deviceId, {
            deviceId: device.deviceId,
            deviceName: device.deviceName,
            authTokenHash,
            approvedAt: device.approvedAt,
            lastSeenAt: device.lastSeenAt,
          });
        }
      }

      if (needsMigration) {
        this.persistPairedDevices();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Failed to load pairing store at ${this.pairingStorePath}: ${message}`
      );
    }
  }

  private persistPairedDevices(): void {
    try {
      const storeDir = path.dirname(this.pairingStorePath);
      mkdirSync(storeDir, { recursive: true, mode: 0o700 });
      const payload: PairingStoreFile = {
        version: 2,
        devices: Array.from(this.pairedDevices.values()),
      };
      writeFileSync(this.pairingStorePath, JSON.stringify(payload, null, 2), {
        encoding: "utf8",
        mode: 0o600,
      });
      try {
        chmodSync(storeDir, 0o700);
        chmodSync(this.pairingStorePath, 0o600);
      } catch {
        // Best-effort on platforms that don't support POSIX permissions.
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to persist pairing store at ${this.pairingStorePath}: ${message}`
      );
    }
  }

  private sendJson(socket: WebSocket, payload: object): void {
    if (socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify(payload));
  }

  private parseIncomingMessage(raw: unknown): unknown | null {
    try {
      let text: string;
      if (typeof raw === "string") {
        text = raw;
      } else if (raw instanceof Buffer) {
        text = raw.toString("utf8");
      } else if (raw instanceof ArrayBuffer) {
        text = Buffer.from(raw).toString("utf8");
      } else if (Array.isArray(raw)) {
        text = Buffer.concat(raw).toString("utf8");
      } else {
        return null;
      }
      return JSON.parse(text);
    } catch {
      return null;
    }
  }

  private isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
  }

  private isPingMessage(message: unknown): message is { type: "ping" } {
    return this.isObject(message) && message.type === "ping";
  }

  private isIdentifyMessage(message: unknown): message is IdentifyMessage {
    return (
      this.isObject(message) &&
      message.type === "identify" &&
      message.role === "extension" &&
      typeof message.deviceId === "string" &&
      (typeof message.deviceName === "undefined" ||
        typeof message.deviceName === "string") &&
      (typeof message.authToken === "undefined" ||
        typeof message.authToken === "string")
    );
  }

  private isBridgeResponseMessage(message: unknown): message is BridgeResponse {
    if (!this.isObject(message)) return false;
    if (typeof message.id !== "string" || message.id.length === 0) return false;
    if (message.id.length > MAX_RESPONSE_ID_LENGTH) return false;
    if (typeof message.success !== "boolean") return false;

    if (message.success) {
      return "data" in message;
    }

    return (
      typeof message.error === "string" &&
      message.error.length <= MAX_RESPONSE_ERROR_LENGTH
    );
  }

  private closeProtocolViolation(socket: WebSocket, reason: string): void {
    try {
      socket.close(1008, reason.slice(0, 123));
    } catch {
      socket.close();
    }
  }

  private describeSocket(socket: WebSocket): string {
    return socket === this.extensionSocket ? "authenticated" : "unauthenticated";
  }

  private isClientAddressAllowed(remoteAddress: string): boolean {
    const normalized = this.normalizeRemoteAddress(remoteAddress);
    if (!normalized) return false;

    if (this.isLoopbackAddress(normalized)) {
      return true;
    }

    if (this.networkPolicy === "loopback") {
      return false;
    }

    if (this.networkPolicy === "any") {
      return true;
    }

    return this.isPrivateOrTailscaleAddress(normalized);
  }

  private normalizeRemoteAddress(address: string): string | null {
    const value = address.trim();
    if (!value) return null;
    if (value.startsWith("::ffff:")) {
      return value.slice("::ffff:".length);
    }
    return value;
  }

  private isLoopbackAddress(address: string): boolean {
    return address === "::1" || address === "127.0.0.1";
  }

  private isPrivateOrTailscaleAddress(address: string): boolean {
    if (this.isTailscaleIPv6(address)) {
      return true;
    }

    if (isIP(address) !== 4) {
      return false;
    }

    const parts = address.split(".").map((part) => Number(part));
    if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) {
      return false;
    }

    const [a, b] = parts;

    if (a === 10) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    // Tailscale CGNAT range 100.64.0.0/10
    if (a === 100 && b >= 64 && b <= 127) return true;

    return false;
  }

  private isTailscaleIPv6(address: string): boolean {
    const normalized = address.toLowerCase();
    // Tailscale ULA range: fd7a:115c:a1e0::/48
    return normalized.startsWith("fd7a:115c:a1e0:");
  }
}
