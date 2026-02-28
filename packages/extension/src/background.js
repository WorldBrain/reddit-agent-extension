import API_DOCS from "../API.md?raw";
import {
  validateLicenseCached,
  invalidateLicenseCache,
  activateLicense,
  deactivateLicense,
  WEBSITE_URL,
} from "reddit-agent-common";

// =============================================
// Connection State
// =============================================

let ws = null;
let connectionStatus = "disconnected"; // 'connected' | 'disconnected' | 'pairing'
let connectedUrl = null;
let isConnecting = false;
let reconnectTimer = null;
let keepAliveIntervalId = null;
let bridgeIdentifyTimer = null;
let activeProtocol = null; // 'bridge' | 'gateway' | null
let pendingGatewayConnectId = null;
let pendingGatewayNonce = null;
let gatewayConnectVersion = "v2";
let gatewayLegacyFallbackTried = false;

const DEFAULT_BRIDGE_PORT = "7071";
const DEFAULT_GATEWAY_PORT = "18789";
const BRIDGE_IDENTIFY_DELAY_MS = 750;
const GATEWAY_PROTOCOL_VERSION = 3;
const GATEWAY_CLIENT_ID = "cli";
const GATEWAY_CLIENT_MODE = "ui";
const GATEWAY_CLIENT_PLATFORM = "browser";
const GATEWAY_CLIENT_VERSION = "0.1.0";
const GATEWAY_SCOPES = ["operator.admin", "operator.read", "operator.write"];

const BRIDGE_DEVICE_ID_STORAGE_KEY = "bridgeDeviceId";
const BRIDGE_AUTH_TOKEN_STORAGE_KEY = "bridgeAuthToken";
const GATEWAY_DEVICE_ID_STORAGE_KEY = "gatewayDeviceId";
const GATEWAY_PRIVATE_KEY_STORAGE_KEY = "gatewayPrivateKeyPkcs8";
const GATEWAY_PUBLIC_KEY_STORAGE_KEY = "gatewayPublicKeyRaw";
const GATEWAY_DEVICE_TOKEN_STORAGE_KEY = "gatewayDeviceToken";
const GATEWAY_AUTH_TOKEN_STORAGE_KEY = "gatewayAuthToken";

const ALLOWED_REDDIT_HOSTS = new Set([
  "www.reddit.com",
  "old.reddit.com",
  "reddit.com",
]);
let pairingCode = null;
let pairingHelp = null;

// Worker Window for background commenting
let workerWindowId = null;
let workerWindowPromise = null;
let activePostCount = 0;

function setStatus(status, url) {
  connectionStatus = status;
  connectedUrl = url || null;
  console.log(`[RedditAgent] Status: ${status}${url ? ` (${url})` : ""}`);
  chrome.runtime
    .sendMessage({
      type: "status",
      status,
      url,
      pairingCode,
      pairingHelp,
      protocol: activeProtocol,
    })
    .catch(() => {});
}

function toLowerAscii(input) {
  return input.replace(/[A-Z]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) + 32),
  );
}

function normalizeDeviceMetadata(value) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  return toLowerAscii(trimmed);
}

function bytesToBase64(bytes) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function bytesToBase64Url(bytes) {
  return bytesToBase64(bytes)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function bytesToHex(bytes) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function buildGatewayDeviceAuthPayload(params, version = "v3") {
  const payload = [
    version,
    params.deviceId,
    params.clientId,
    params.clientMode,
    params.role,
    params.scopes.join(","),
    String(params.signedAtMs),
    params.token ?? "",
  ];

  if (version !== "v1") {
    payload.push(params.nonce);
  }

  if (version === "v3") {
    payload.push(
      normalizeDeviceMetadata(params.platform),
      normalizeDeviceMetadata(params.deviceFamily),
    );
  }

  return payload.join("|");
}

function randomId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function findStringByKeys(obj, keys) {
  if (!obj || typeof obj !== "object") return null;
  const stack = [obj];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || typeof current !== "object") continue;
    for (const key of Object.keys(current)) {
      const value = current[key];
      if (keys.has(key) && typeof value === "string" && value.trim().length > 0) {
        return value.trim();
      }
      if (value && typeof value === "object") {
        stack.push(value);
      }
    }
  }
  return null;
}

function extractGatewayRequestId(message) {
  return findStringByKeys(
    message,
    new Set(["requestId", "pairingRequestId", "pairRequestId"]),
  );
}

function extractGatewayErrorMessage(message) {
  const direct = findStringByKeys(message, new Set(["message", "error"]));
  if (direct) return direct;
  return "Gateway connect failed (unknown error)";
}

function extractGatewayPairingRequestId(payload) {
  return findStringByKeys(
    payload,
    new Set(["requestId", "pairingRequestId", "pairRequestId"]),
  );
}

function buildGatewayApproveHelp({ requestId = null, target = "devices", reason = null }) {
  const baseCommand = target === "nodes" ? "openclaw nodes approve" : "openclaw devices approve";
  const command = requestId ? `${baseCommand} ${requestId}` : baseCommand;
  if (reason) return `Approve with: ${command} (${reason})`;
  return `Approve with: ${command}`;
}

function resolveDeviceFamily() {
  const isMobile = Boolean(navigator?.userAgentData?.mobile);
  return isMobile ? "mobile" : "desktop";
}

async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return bytesToHex(new Uint8Array(digest));
}

async function getOrCreateBridgeDeviceIdentity() {
  const stored = await chrome.storage.local.get([
    BRIDGE_DEVICE_ID_STORAGE_KEY,
    BRIDGE_AUTH_TOKEN_STORAGE_KEY,
  ]);

  let deviceId = stored[BRIDGE_DEVICE_ID_STORAGE_KEY];
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    await chrome.storage.local.set({ [BRIDGE_DEVICE_ID_STORAGE_KEY]: deviceId });
  }

  return {
    deviceId,
    authToken: stored[BRIDGE_AUTH_TOKEN_STORAGE_KEY] || undefined,
  };
}

async function sendBridgeIdentify(socket) {
  const { deviceId, authToken } = await getOrCreateBridgeDeviceIdentity();
  if (socket.readyState !== WebSocket.OPEN) return;

  const manifest = chrome.runtime.getManifest();
  socket.send(
    JSON.stringify({
      type: "identify",
      role: "extension",
      deviceId,
      authToken,
      deviceName: `${manifest.name} (${chrome.runtime.id})`,
    }),
  );
}

async function getOrCreateGatewayDeviceIdentity() {
  const stored = await chrome.storage.local.get([
    GATEWAY_DEVICE_ID_STORAGE_KEY,
    GATEWAY_PRIVATE_KEY_STORAGE_KEY,
    GATEWAY_PUBLIC_KEY_STORAGE_KEY,
  ]);

  const storedDeviceId = stored[GATEWAY_DEVICE_ID_STORAGE_KEY];
  const storedPrivateKey = stored[GATEWAY_PRIVATE_KEY_STORAGE_KEY];
  const storedPublicKey = stored[GATEWAY_PUBLIC_KEY_STORAGE_KEY];

  if (storedDeviceId && storedPrivateKey && storedPublicKey) {
    try {
      const publicKeyRaw = base64ToBytes(storedPublicKey);
      const computedDeviceId = await sha256Hex(publicKeyRaw);
      const privateKey = await crypto.subtle.importKey(
        "pkcs8",
        base64ToBytes(storedPrivateKey),
        { name: "Ed25519" },
        false,
        ["sign"],
      );

      if (computedDeviceId !== storedDeviceId) {
        await chrome.storage.local.set({
          [GATEWAY_DEVICE_ID_STORAGE_KEY]: computedDeviceId,
        });
      }

      return {
        deviceId: computedDeviceId,
        privateKey,
        publicKeyRaw,
      };
    } catch (err) {
      console.warn(
        "[RedditAgent] Failed to load stored gateway identity, regenerating:",
        err,
      );
      await chrome.storage.local.remove([
        GATEWAY_DEVICE_ID_STORAGE_KEY,
        GATEWAY_PRIVATE_KEY_STORAGE_KEY,
        GATEWAY_PUBLIC_KEY_STORAGE_KEY,
      ]);
    }
  }

  const keyPair = await crypto.subtle.generateKey(
    { name: "Ed25519" },
    true,
    ["sign", "verify"],
  );
  const publicKeyRaw = new Uint8Array(
    await crypto.subtle.exportKey("raw", keyPair.publicKey),
  );
  const privateKeyPkcs8 = new Uint8Array(
    await crypto.subtle.exportKey("pkcs8", keyPair.privateKey),
  );
  const deviceId = await sha256Hex(publicKeyRaw);

  await chrome.storage.local.set({
    [GATEWAY_DEVICE_ID_STORAGE_KEY]: deviceId,
    [GATEWAY_PRIVATE_KEY_STORAGE_KEY]: bytesToBase64(privateKeyPkcs8),
    [GATEWAY_PUBLIC_KEY_STORAGE_KEY]: bytesToBase64(publicKeyRaw),
  });

  return {
    deviceId,
    privateKey: keyPair.privateKey,
    publicKeyRaw,
  };
}

async function sendGatewayConnect(socket, nonce, version = "v2") {
  if (socket.readyState !== WebSocket.OPEN) return;
  const identity = await getOrCreateGatewayDeviceIdentity();
  const stored = await chrome.storage.local.get([
    GATEWAY_AUTH_TOKEN_STORAGE_KEY,
  ]);
  const gatewayToken = stored[GATEWAY_AUTH_TOKEN_STORAGE_KEY] || undefined;
  const authToken = gatewayToken || "";
  const signedAtMs = Date.now();
  const scopes = GATEWAY_SCOPES;
  const clientId = GATEWAY_CLIENT_ID;
  const clientMode = GATEWAY_CLIENT_MODE;
  const platform = GATEWAY_CLIENT_PLATFORM;
  const deviceFamily = resolveDeviceFamily();
  const payload = buildGatewayDeviceAuthPayload(
    {
      deviceId: identity.deviceId,
      clientId,
      clientMode,
      role: "operator",
      scopes,
      signedAtMs,
      token: authToken,
      nonce,
      platform,
      deviceFamily,
    },
    version,
  );
  const signatureBytes = new Uint8Array(
    await crypto.subtle.sign(
      "Ed25519",
      identity.privateKey,
      new TextEncoder().encode(payload),
    ),
  );
  const requestId = randomId(`gateway-connect-${version}`);
  pendingGatewayConnectId = requestId;
  gatewayConnectVersion = version;

  const auth = {};
  if (gatewayToken) auth.token = gatewayToken;

  socket.send(
    JSON.stringify({
      type: "req",
      id: requestId,
      method: "connect",
      params: {
        minProtocol: GATEWAY_PROTOCOL_VERSION,
        maxProtocol: GATEWAY_PROTOCOL_VERSION,
        client: {
          id: clientId,
          version: GATEWAY_CLIENT_VERSION,
          platform,
          mode: clientMode,
        },
        role: "operator",
        scopes,
        auth: Object.keys(auth).length > 0 ? auth : {},
        device: {
          id: identity.deviceId,
          publicKey: bytesToBase64Url(identity.publicKeyRaw),
          signature: bytesToBase64Url(signatureBytes),
          signedAt: signedAtMs,
          nonce,
        },
      },
    }),
  );
}

function normalizeServerUrl(input) {
  if (typeof input !== "string") return null;
  const value = input.trim();
  if (!value) return null;

  const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(value);

  let parsed;
  try {
    parsed = hasScheme ? new URL(value) : new URL(`ws://${value}`);
  } catch {
    return null;
  }
  if (!parsed.hostname) return null;

  // Normalize to bare host only. We synthesize protocol/port/path candidates later.
  return parsed.hostname;
}

function unique(values) {
  return [...new Set(values)];
}

function isLikelyLocalHost(hostname) {
  const normalized = hostname.toLowerCase();
  return (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "::1"
  );
}

function getConnectionCandidates(normalizedServerUrl) {
  let parsed;
  try {
    const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(normalizedServerUrl);
    parsed = hasScheme
      ? new URL(normalizedServerUrl)
      : new URL(`ws://${normalizedServerUrl}`);
  } catch {
    return [];
  }

  const host = parsed.hostname.includes(":")
    ? `[${parsed.hostname}]`
    : parsed.hostname;

  // Host field is normalized to bare host; build all connection candidates here.
  // Order: bridge first (plugin flow), then gateway fallbacks.
  return unique([
    `ws://${host}:${DEFAULT_BRIDGE_PORT}/ws`,
    `ws://${host}:${DEFAULT_BRIDGE_PORT}`,
    `wss://${host}`,
    `ws://${host}:${DEFAULT_GATEWAY_PORT}`,
    `ws://${host}`,
  ]);
}

// =============================================
// Connection Management
// =============================================

function tryWebSocket(url, timeout) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.close();
      reject(new Error(`Timeout after ${timeout}ms`));
    }, timeout);

    const socket = new WebSocket(url);

    socket.onopen = () => {
      clearTimeout(timer);
      resolve(socket);
    };

    socket.onerror = () => {
      clearTimeout(timer);
      reject(new Error("Connection failed"));
    };
  });
}

function forceReconnect() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (keepAliveIntervalId) {
    clearInterval(keepAliveIntervalId);
    keepAliveIntervalId = null;
  }
  if (bridgeIdentifyTimer) {
    clearTimeout(bridgeIdentifyTimer);
    bridgeIdentifyTimer = null;
  }
  activeProtocol = null;
  pendingGatewayConnectId = null;
  pendingGatewayNonce = null;
  gatewayConnectVersion = "v2";
  gatewayLegacyFallbackTried = false;
  isConnecting = false;
  if (ws) {
    ws.onclose = null; // prevent onclose from scheduling another reconnect
    ws.close();
    ws = null;
  }
  pairingCode = null;
  pairingHelp = null;
  setStatus("disconnected");
  connectToServer();
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectToServer();
  }, 5000);
}

async function connectToServer() {
  if (ws && ws.readyState === WebSocket.OPEN) return;
  if (isConnecting) return;

  isConnecting = true;

  // Cancel any pending reconnect since we're connecting now
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  const { serverUrl } = await chrome.storage.local.get("serverUrl");
  const normalizedServerUrl = normalizeServerUrl(serverUrl);
  if (!normalizedServerUrl) {
    console.log("[RedditAgent] No server URL configured");
    pairingCode = null;
    setStatus("disconnected");
    isConnecting = false;
    return;
  }
  if (normalizedServerUrl !== serverUrl) {
    chrome.storage.local.set({ serverUrl: normalizedServerUrl });
  }

  const candidates = getConnectionCandidates(normalizedServerUrl);
  if (candidates.length === 0) {
    console.log("[RedditAgent] Invalid server URL after normalization");
    pairingCode = null;
    pairingHelp = null;
    setStatus("disconnected");
    isConnecting = false;
    scheduleReconnect();
    return;
  }

  console.log(
    `[RedditAgent] Connecting candidates: ${candidates.map((c) => `"${c}"`).join(", ")}`,
  );

  let socket = null;
  let connectedCandidate = null;
  for (const candidate of candidates) {
    try {
      socket = await tryWebSocket(candidate, 3000);
      connectedCandidate = candidate;
      break;
    } catch (err) {
      console.log(`[RedditAgent] Candidate failed: ${candidate}`, err);
    }
  }

  if (socket && connectedCandidate) {
    isConnecting = false;
    setupSocket(socket, connectedCandidate);
    return;
  }

  console.log("[RedditAgent] Server not available");
  pairingCode = null;
  pairingHelp = null;
  setStatus("disconnected");
  isConnecting = false;
  scheduleReconnect();
}

function handleGatewayFrame(message, socket, url) {
  if (message.type === "event" && message.event === "connect.challenge") {
    const nonce =
      typeof message?.payload?.nonce === "string" ? message.payload.nonce : "";
    if (!nonce.trim()) {
      pairingCode = null;
      pairingHelp = "Gateway connect challenge was missing nonce.";
      setStatus("disconnected", url);
      socket.close(1008, "connect challenge missing nonce");
      return true;
    }
    pendingGatewayNonce = nonce.trim();
    gatewayLegacyFallbackTried = false;
    const initialVersion = pendingGatewayNonce ? "v2" : "v1";
    sendGatewayConnect(socket, pendingGatewayNonce, initialVersion).catch((err) => {
      console.error("[RedditAgent] Failed to send gateway connect:", err);
      pairingCode = null;
      pairingHelp = "Failed to initialize gateway handshake.";
      setStatus("disconnected", url);
      socket.close(1008, "connect failed");
    });
    return true;
  }

  if (
    message.type === "event" &&
    (message.event === "device.pair.requested" ||
      message.event === "node.pair.requested")
  ) {
    const requestId = extractGatewayPairingRequestId(message?.payload);
    const target = message.event === "node.pair.requested" ? "nodes" : "devices";
    pairingCode = typeof requestId === "string" && requestId.trim().length > 0 ? requestId : null;
    pairingHelp = buildGatewayApproveHelp({
      requestId: pairingCode,
      target,
    });
    setStatus("pairing", url);
    return true;
  }

  if (
    message.type === "res" &&
    pendingGatewayConnectId &&
    message.id === pendingGatewayConnectId
  ) {
    pendingGatewayConnectId = null;
    if (message.ok) {
      pendingGatewayNonce = null;
      gatewayLegacyFallbackTried = false;
      gatewayConnectVersion = "v2";
      pairingCode = null;
      pairingHelp = null;
      setStatus("connected", url);
      return true;
    }

    const requestId = extractGatewayRequestId(message);
    const reason = findStringByKeys(message, new Set(["reason"]));
    const errorMessage = extractGatewayErrorMessage(message);
    const normalizedError = errorMessage.toLowerCase();

    if (
      !gatewayLegacyFallbackTried &&
      (gatewayConnectVersion === "v2" || gatewayConnectVersion === "v3") &&
      pendingGatewayNonce &&
      normalizedError.includes("device signature invalid")
    ) {
      gatewayLegacyFallbackTried = true;
      const retryVersion = gatewayConnectVersion === "v2" ? "v3" : "v2";
      console.warn(
        `[RedditAgent] Gateway rejected ${gatewayConnectVersion} signature; retrying connect with ${retryVersion} payload`,
      );
      sendGatewayConnect(socket, pendingGatewayNonce, retryVersion).catch((err) => {
        console.error("[RedditAgent] Legacy gateway connect retry failed:", err);
        pairingCode = null;
        pairingHelp = "Failed to initialize gateway handshake.";
        setStatus("disconnected", url);
        socket.close(1008, "connect failed");
      });
      return true;
    }

    if (typeof requestId === "string" && requestId.trim().length > 0) {
      pairingCode = requestId;
      pairingHelp = buildGatewayApproveHelp({
        requestId,
        target: "devices",
        reason: typeof reason === "string" && reason.trim().length > 0 ? reason : null,
      });
      setStatus("pairing", url);
    } else {
      pairingCode = null;
      if (normalizedError.includes("pairing required")) {
        pairingHelp = buildGatewayApproveHelp({ target: "devices" });
        setStatus("pairing", url);
      } else if (normalizedError.includes("unexpected property 'devicetoken'")) {
        chrome.storage.local.remove(GATEWAY_DEVICE_TOKEN_STORAGE_KEY);
        pairingHelp =
          "Gateway rejected legacy device token auth field. Removed stale token and retrying with tokenless auth.";
        setStatus("disconnected", url);
      } else if (normalizedError.includes("origin not allowed")) {
        pairingHelp =
          "Gateway rejected extension origin. Add your extension origin to gateway.controlUi.allowedOrigins and retry.";
        setStatus("disconnected", url);
      } else {
        pairingHelp = errorMessage;
        setStatus("disconnected", url);
      }
    }
    return true;
  }

  if (message.type === "event" && message.event === "tick") {
    return true;
  }

  return false;
}

function setupSocket(socket, url) {
  ws = socket;
  activeProtocol = null;
  pendingGatewayConnectId = null;
  pendingGatewayNonce = null;
  gatewayConnectVersion = "v2";
  gatewayLegacyFallbackTried = false;
  pairingCode = null;
  pairingHelp = null;
  setStatus("disconnected", url);

  if (bridgeIdentifyTimer) {
    clearTimeout(bridgeIdentifyTimer);
  }
  bridgeIdentifyTimer = setTimeout(() => {
    if (ws !== socket || socket.readyState !== WebSocket.OPEN || activeProtocol) {
      return;
    }
    activeProtocol = "bridge";
    sendBridgeIdentify(socket).catch((err) => {
      console.error("[RedditAgent] Failed to send bridge identify:", err);
    });
    startKeepAlive();
  }, BRIDGE_IDENTIFY_DELAY_MS);

  ws.onmessage = async (event) => {
    let message;
    try {
      const raw =
        typeof event.data === "string" ? event.data : await event.data.text();
      message = JSON.parse(raw);
    } catch (err) {
      console.error("[RedditAgent] Failed to parse message:", err, event.data);
      return;
    }

    if (
      message?.type === "event" &&
      message?.event === "connect.challenge" &&
      activeProtocol !== "bridge"
    ) {
      activeProtocol = "gateway";
      if (bridgeIdentifyTimer) {
        clearTimeout(bridgeIdentifyTimer);
        bridgeIdentifyTimer = null;
      }
      if (keepAliveIntervalId) {
        clearInterval(keepAliveIntervalId);
        keepAliveIntervalId = null;
      }
    }

    const isGatewayFrame =
      message?.type === "event" ||
      message?.type === "req" ||
      message?.type === "res";

    if ((activeProtocol === "gateway" || isGatewayFrame) && activeProtocol !== "bridge") {
      activeProtocol = "gateway";
      if (handleGatewayFrame(message, socket, url)) {
        return;
      }
      return;
    }

    if (activeProtocol !== "bridge") {
      activeProtocol = "bridge";
      if (bridgeIdentifyTimer) {
        clearTimeout(bridgeIdentifyTimer);
        bridgeIdentifyTimer = null;
      }
      startKeepAlive();
    }

    if (message.type === "pong") return;
    if (message.type === "identified") {
      pairingCode = null;
      pairingHelp = null;
      setStatus("connected", url);
      return;
    }
    if (message.type === "pairing_required") {
      pairingCode = typeof message.code === "string" ? message.code : null;
      pairingHelp = "Approve this pairing code from OpenClaw.";
      console.log(
        `[RedditAgent] Pairing required with code: ${pairingCode || "unknown"}`,
      );
      setStatus("pairing", url);
      return;
    }
    if (message.type === "pairing_approved") {
      const authToken =
        typeof message.authToken === "string" ? message.authToken : null;
      if (authToken) {
        await chrome.storage.local.set({ [BRIDGE_AUTH_TOKEN_STORAGE_KEY]: authToken });
      }
      pairingCode = null;
      pairingHelp = null;
      setStatus("connected", url);
      return;
    }
    if (!message.action || !message.id) {
      console.warn("[RedditAgent] Ignoring unknown bridge message:", message);
      return;
    }

    console.log(
      "[RedditAgent] Received:",
      message.action,
      message.id,
      JSON.stringify(message.params),
    );

    try {
      const result = await handleAction(message.action, message.params);
      const preview = Array.isArray(result)
        ? `Array(${result.length})`
        : typeof result === "object"
          ? Object.keys(result).join(",")
          : String(result);
      console.log(
        "[RedditAgent] Success:",
        message.action,
        message.id,
        "| result:",
        preview,
      );
      const payload = JSON.stringify({
        id: message.id,
        success: true,
        data: result,
      });
      console.log("[RedditAgent] Sending response:", payload.length, "bytes");
      ws.send(payload);
    } catch (err) {
      console.error(
        "[RedditAgent] Error:",
        message.action,
        err.message,
        err.stack,
      );
      ws.send(
        JSON.stringify({ id: message.id, success: false, error: err.message }),
      );
    }
  };

  ws.onclose = (event) => {
    ws = null;
    if (bridgeIdentifyTimer) {
      clearTimeout(bridgeIdentifyTimer);
      bridgeIdentifyTimer = null;
    }
    if (keepAliveIntervalId) {
      clearInterval(keepAliveIntervalId);
      keepAliveIntervalId = null;
    }
    pendingGatewayConnectId = null;
    pendingGatewayNonce = null;
    gatewayConnectVersion = "v2";
    gatewayLegacyFallbackTried = false;

    const closeReason = String(event?.reason || "").toLowerCase();
    if (
      activeProtocol === "gateway" &&
      event?.code === 1008 &&
      closeReason.includes("device token mismatch")
    ) {
      chrome.storage.local.remove(GATEWAY_DEVICE_TOKEN_STORAGE_KEY);
    }

    console.log(
      `[RedditAgent] Connection closed (${event?.code || "?"} ${event?.reason || "no reason"})`,
    );
    if (closeReason.includes("pairing required") && connectionStatus !== "pairing") {
      pairingCode = null;
      pairingHelp = buildGatewayApproveHelp({ target: "devices" });
      setStatus("pairing", connectedUrl || url);
    } else if (connectionStatus !== "pairing") {
      pairingCode = null;
      pairingHelp = null;
      setStatus("disconnected");
    } else {
      setStatus("pairing", connectedUrl || url);
    }
    scheduleReconnect();
  };

  ws.onerror = () => {
    ws?.close();
  };
}

function startKeepAlive() {
  // Clear any previous keepAlive interval to prevent leaks
  if (keepAliveIntervalId) {
    clearInterval(keepAliveIntervalId);
  }
  if (activeProtocol !== "bridge") {
    keepAliveIntervalId = null;
    return;
  }
  keepAliveIntervalId = setInterval(() => {
    if (ws && ws.readyState === WebSocket.OPEN && activeProtocol === "bridge") {
      ws.send(JSON.stringify({ type: "ping" }));
    } else {
      clearInterval(keepAliveIntervalId);
      keepAliveIntervalId = null;
    }
  }, 20000);
}

function sendContentScriptMessage(tabId, type, payload = {}) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Timed out waiting for content script response: ${type}`));
    }, 8000);

    chrome.tabs.sendMessage(
      tabId,
      { scope: "reddit-agent-reply", type, payload },
      (response) => {
        clearTimeout(timeout);
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (!response) {
          reject(new Error("No response from content script"));
          return;
        }
        resolve(response);
      },
    );
  });
}

// Handle messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "get_status") {
    sendResponse({
      status: connectionStatus,
      url: connectedUrl,
      pairingCode,
      pairingHelp,
      protocol: activeProtocol,
    });
    return;
  }
  if (message.type === "set_server_url") {
    const rawInput = message.url?.trim();
    if (!rawInput) {
      chrome.storage.local.remove("serverUrl");
      sendResponse({ ok: true, serverUrl: null });
      return;
    }

    const normalizedServerUrl = normalizeServerUrl(rawInput);
    if (!normalizedServerUrl) {
      sendResponse({
        ok: false,
        error: "Invalid server host. Use a host/IP or hostname.",
      });
      return;
    }

    chrome.storage.local.set({ serverUrl: normalizedServerUrl });

    // Force reconnect with new URL
    forceReconnect();
    sendResponse({ ok: true, serverUrl: normalizedServerUrl });
    return;
  }
  if (message.type === "retry") {
    forceReconnect();
    sendResponse({ ok: true });
    return;
  }
  if (message.type === "open_install") {
    chrome.tabs.create({ url: `${WEBSITE_URL}/install` });
    sendResponse({ ok: true });
    return;
  }
  if (message.type === "validate_license") {
    const key = message.licenseKey?.trim();
    if (!key) {
      sendResponse({ valid: false, error: "No license key provided" });
      return true;
    }
    validateLicenseCached(key, undefined, true)
      .then(async (result) => {
        if (result.valid) {
          // Activate to register this instance and track usage
          const activation = await activateLicense(
            key,
            "reddit-agent-extension",
          );
          if (activation.activated && activation.instanceId) {
            chrome.storage.local.set({
              licenseKey: key,
              licenseValid: true,
              licenseInstanceId: activation.instanceId,
            });
          } else {
            chrome.storage.local.set({ licenseKey: key, licenseValid: true });
          }
          sendResponse({ valid: true });
        } else {
          chrome.storage.local.set({ licenseKey: key, licenseValid: false });
          sendResponse({ valid: false, error: result.error });
        }
      })
      .catch((err) => {
        sendResponse({ valid: false, error: err.message });
      });
    return true; // keep message channel open for async response
  }
  if (message.type === "remove_license") {
    chrome.storage.local.get(
      ["licenseKey", "licenseInstanceId"],
      async ({ licenseKey, licenseInstanceId }) => {
        // Deactivate the instance with LemonSqueezy so it can be reactivated
        if (licenseKey && licenseInstanceId) {
          await deactivateLicense(licenseKey, licenseInstanceId);
        }
        chrome.storage.local.remove([
          "licenseKey",
          "licenseValid",
          "licenseInstanceId",
        ]);
        invalidateLicenseCache();
        sendResponse({ ok: true });
      },
    );
    return true; // keep message channel open for async response
  }
});

// Open the install page on first install
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    chrome.tabs.create({ url: `${WEBSITE_URL}/install` });
  }
});

// Start — only one call needed; onStartup/onInstalled re-run the service worker
// which already calls connectToServer() at the top level.
connectToServer();

// =============================================
// Action Dispatcher
// =============================================

async function handleAction(action, params) {
  console.log(`[RedditAgent] handleAction: ${action}`, params);

  // get_skill is the discovery endpoint — no license required
  if (action === "get_skill") {
    return getSkill();
  }

  // All other actions require a valid license
  const { licenseKey } = await chrome.storage.local.get("licenseKey");
  if (!licenseKey) {
    throw new Error(
      "No license key configured. Please add your license key in the extension popup.",
    );
  }

  const validation = await validateLicenseCached(licenseKey);
  if (!validation.valid) {
    chrome.storage.local.set({ licenseValid: false });
    throw new Error(
      "License expired or invalid. Please renew your subscription.",
    );
  }
  chrome.storage.local.set({ licenseValid: true });

  switch (action) {
    case "fetch_subreddit":
      return await fetchRedditJSON(params.url || params.subreddit, params.sort);
    case "search_reddit":
      return await searchReddit(
        params.query,
        params.sort,
        params.time,
        params.subreddit || params.url,
      );
    case "fetch_user_posts":
      return await fetchUserPosts(params.username, params.sort, params.time);
    case "fetch_post":
      return await fetchRedditJSON(params.url);
    case "reply_to_comment":
      return await replyToComment(params.commentUrl, params.replyText);
    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

// =============================================
// Action — Skill
// =============================================

function getSkill() {
  return API_DOCS;
}

// =============================================
// Actions A & C — Fetch Subreddit/Post JSON
// =============================================

// Normalize shorthand subreddit references to full URLs:
//   "supplements"       -> "https://www.reddit.com/r/supplements"
//   "r/supplements"     -> "https://www.reddit.com/r/supplements"
//   "/r/supplements"    -> "https://www.reddit.com/r/supplements"
//   Full URLs pass through unchanged.
function normalizeSubredditUrl(input) {
  let normalized = input.trim();
  if (!/^https?:\/\//i.test(normalized)) {
    normalized = normalized.replace(/^\/+/, "");
    if (!/^r\//i.test(normalized)) {
      normalized = `r/${normalized}`;
    }
    normalized = `https://www.reddit.com/${normalized}`;
  } else {
    validateRedditUrl(normalized);
  }
  return normalized.replace(/\/+$/, "");
}

function validateRedditUrl(input) {
  let parsed;
  try {
    parsed = new URL(input);
  } catch {
    throw new Error("Invalid Reddit URL");
  }

  if (parsed.protocol !== "https:") {
    throw new Error("Reddit URL must use https");
  }

  if (!ALLOWED_REDDIT_HOSTS.has(parsed.hostname.toLowerCase())) {
    throw new Error("Only reddit.com URLs are allowed");
  }

  return parsed;
}

function normalizeCommentUrl(input) {
  if (typeof input !== "string" || !input.trim()) {
    throw new Error("Missing required parameter: commentUrl");
  }
  const parsed = validateRedditUrl(input.trim());
  if (!/\/comments\//.test(parsed.pathname)) {
    throw new Error("commentUrl must point to a Reddit comments URL");
  }
  return `${parsed.origin}${parsed.pathname}${parsed.search}`;
}

async function fetchRedditJSON(url, sort) {
  if (!url) throw new Error("Missing required parameter: url");
  const VALID_SORTS = ["hot", "new", "top", "rising", "best"];
  let normalized = normalizeSubredditUrl(url);

  // If a sort is specified and the URL doesn't already include it, append it
  // e.g. https://www.reddit.com/r/workout -> https://www.reddit.com/r/workout/hot
  if (sort && VALID_SORTS.includes(sort.toLowerCase())) {
    const sortLower = sort.toLowerCase();
    // Only append if the URL doesn't already end with a sort segment or .json
    if (
      !normalized.includes(".json") &&
      !VALID_SORTS.some((s) => normalized.endsWith(`/${s}`))
    ) {
      normalized = `${normalized}/${sortLower}`;
    }
  }

  const jsonUrl = normalized.includes(".json")
    ? normalized
    : normalized + ".json";
  console.log(`[RedditAgent] fetchRedditJSON: ${jsonUrl}`);

  const response = await fetch(jsonUrl, {
    headers: { "User-Agent": "RedditAgentExtension/1.0" },
  });

  console.log(
    `[RedditAgent] fetchRedditJSON response: ${response.status} ${response.statusText}`,
  );

  if (!response.ok) {
    throw new Error(
      `Reddit API returned ${response.status}: ${response.statusText}`,
    );
  }

  const data = await response.json();
  console.log(
    `[RedditAgent] fetchRedditJSON parsed: ${Array.isArray(data) ? `Array(${data.length})` : typeof data}`,
  );
  return data;
}

// =============================================
// Action B — Search Reddit and Extract Posts
// =============================================

function filterPost(child) {
  const d = child.data;
  return {
    kind: child.kind,
    data: {
      // Identification
      id: d.id,
      name: d.name,
      author: d.author,
      author_fullname: d.author_fullname,

      // Subreddit
      subreddit: d.subreddit,
      subreddit_name_prefixed: d.subreddit_name_prefixed,
      subreddit_id: d.subreddit_id,
      subreddit_subscribers: d.subreddit_subscribers,

      // Content
      title: d.title,
      selftext: d.selftext,
      url: d.url,
      domain: d.domain,
      permalink: d.permalink,
      is_self: d.is_self,
      post_hint: d.post_hint,
      is_video: d.is_video,

      // Engagement
      score: d.score,
      ups: d.ups,
      downs: d.downs,
      upvote_ratio: d.upvote_ratio,
      num_comments: d.num_comments,
      num_crossposts: d.num_crossposts,

      // Timestamps
      created_utc: d.created_utc,

      // Flags
      over_18: d.over_18,
      spoiler: d.spoiler,
      locked: d.locked,
      stickied: d.stickied,
      archived: d.archived,
      pinned: d.pinned,
      is_original_content: d.is_original_content,

      // Media — video posts
      media: d.media
        ? {
            reddit_video: d.media.reddit_video
              ? {
                  fallback_url: d.media.reddit_video.fallback_url,
                  dash_url: d.media.reddit_video.dash_url,
                  hls_url: d.media.reddit_video.hls_url,
                  scrubber_media_url: d.media.reddit_video.scrubber_media_url,
                  width: d.media.reddit_video.width,
                  height: d.media.reddit_video.height,
                  duration: d.media.reddit_video.duration,
                  bitrate_kbps: d.media.reddit_video.bitrate_kbps,
                  has_audio: d.media.reddit_video.has_audio,
                  is_gif: d.media.reddit_video.is_gif,
                  transcoding_status: d.media.reddit_video.transcoding_status,
                }
              : undefined,
          }
        : null,

      // Media — thumbnails & image preview
      thumbnail: d.thumbnail,
      thumbnail_height: d.thumbnail_height,
      thumbnail_width: d.thumbnail_width,
      preview: d.preview
        ? {
            images: d.preview.images?.map((img) => ({
              source: img.source,
            })),
          }
        : undefined,

      // Flair
      author_flair_text: d.author_flair_text,
      link_flair_text: d.link_flair_text,
    },
  };
}

async function searchReddit(query, sort, time, subreddit) {
  if (!query) throw new Error("Missing required parameter: query");
  const VALID_SORTS = ["relevance", "top", "new", "comments"];
  const VALID_TIMES = ["hour", "day", "week", "month", "year"];

  // If a subreddit is provided, search within it; otherwise search all of Reddit
  let searchUrl;
  if (subreddit) {
    const base = normalizeSubredditUrl(subreddit);
    searchUrl = `${base}/search.json?q=${encodeURIComponent(query)}&restrict_sr=1`;
  } else {
    searchUrl = `https://www.reddit.com/search.json?q=${encodeURIComponent(query)}`;
  }
  if (sort && VALID_SORTS.includes(sort.toLowerCase())) {
    searchUrl += `&sort=${sort.toLowerCase()}`;
  }
  if (time && VALID_TIMES.includes(time.toLowerCase())) {
    searchUrl += `&t=${time.toLowerCase()}`;
  }
  console.log(
    `[RedditAgent] searchReddit: query="${query}" sort="${sort || "default"}" time="${time || "all"}" url=${searchUrl}`,
  );

  const response = await fetch(searchUrl, {
    headers: { "User-Agent": "RedditAgentExtension/1.0" },
  });

  console.log(
    `[RedditAgent] searchReddit response: ${response.status} ${response.statusText}`,
  );

  if (!response.ok) {
    throw new Error(
      `Reddit search API returned ${response.status}: ${response.statusText}`,
    );
  }

  const data = await response.json();
  console.log(
    `[RedditAgent] searchReddit: got ${data?.data?.children?.length || 0} results`,
  );

  return {
    kind: data.kind,
    data: {
      after: data.data?.after,
      before: data.data?.before,
      children: (data.data?.children || []).map(filterPost),
    },
  };
}

// =============================================
// Action E — Fetch User Posts
// =============================================

async function fetchUserPosts(username, sort, time) {
  if (!username) throw new Error("Missing required parameter: username");
  const VALID_SORTS = ["hot", "new", "top", "controversial"];
  const VALID_TIMES = ["hour", "day", "week", "month", "year"];

  // Strip u/ or /u/ prefix if provided
  let cleaned = username.trim().replace(/^\/?(u\/)/i, "");

  // Build URL: https://www.reddit.com/user/<username>/submitted.json
  let userUrl = `https://www.reddit.com/user/${encodeURIComponent(cleaned)}/submitted`;

  // Append sort to path (same pattern as subreddit listings)
  if (sort && VALID_SORTS.includes(sort.toLowerCase())) {
    userUrl += `/${sort.toLowerCase()}`;
  }

  userUrl += ".json";

  // Append time filter as query parameter
  if (time && VALID_TIMES.includes(time.toLowerCase())) {
    userUrl += `?t=${time.toLowerCase()}`;
  }

  console.log(
    `[RedditAgent] fetchUserPosts: username="${cleaned}" sort="${sort || "default"}" time="${time || "all"}" url=${userUrl}`,
  );

  const response = await fetch(userUrl, {
    headers: { "User-Agent": "RedditAgentExtension/1.0" },
  });

  console.log(
    `[RedditAgent] fetchUserPosts response: ${response.status} ${response.statusText}`,
  );

  if (!response.ok) {
    throw new Error(
      `Reddit user API returned ${response.status}: ${response.statusText}`,
    );
  }

  const data = await response.json();
  console.log(
    `[RedditAgent] fetchUserPosts: got ${data?.data?.children?.length || 0} posts`,
  );

  return {
    kind: data.kind,
    data: {
      after: data.data?.after,
      before: data.data?.before,
      children: (data.data?.children || []).map(filterPost),
    },
  };
}

// =============================================
// Action D — Reply to a Comment
// =============================================

function isSubComment(url) {
  // Sub-comments have "/comment/<id>" in the path
  // e.g. https://www.reddit.com/r/workout/comments/1oohnh6/comment/nn53chl
  // Top-level posts don't:
  // e.g. https://www.reddit.com/r/workout/comments/1oohnh6/
  return /\/comment\/\w+/.test(url);
}

async function replyToComment(commentUrl, replyText) {
  if (!replyText) throw new Error("Missing required parameter: replyText");
  const normalizedCommentUrl = normalizeCommentUrl(commentUrl);
  const windowId = await getWorkerWindow();
  activePostCount++;

  try {
    const tab = await createTabAndWaitForLoad(normalizedCommentUrl, windowId);

    await sleep(3000);

    if (isSubComment(normalizedCommentUrl)) {
      // --- Sub-comment reply: click Reply button, then type in composer ---
      let clickSuccess = false;
      for (let attempt = 0; attempt < 3; attempt++) {
        const clickResult = await sendContentScriptMessage(tab.id, "click_reply_button", {
          commentUrl: normalizedCommentUrl,
        });

        if (clickResult?.success) {
          clickSuccess = true;
          break;
        }

        console.log(
          `[RedditAgent] Reply button attempt ${attempt + 1} failed, retrying...`,
        );
        await sleep(2000);
      }

      if (!clickSuccess) {
        throw new Error("Failed to click Reply button after 3 attempts");
      }

      // Type the reply (with retry — composer may take time to mount)
      let typeResult;
      for (let attempt = 0; attempt < 5; attempt++) {
        await sleep(2000);

        typeResult = await sendContentScriptMessage(tab.id, "type_comment_reply", {
          replyText,
        });

        if (typeResult?.success) {
          break;
        }

        console.log(
          `[RedditAgent] Type attempt ${attempt + 1} failed: ${typeResult?.error}`,
        );
      }

      if (!typeResult?.success) {
        throw new Error(
          typeResult?.error || "Failed to type reply after 5 attempts",
        );
      }
    } else {
      // --- Top-level post comment ---
      // Step 1: Click the composer to activate it (editor mounts on click)
      const activateResult = await sendContentScriptMessage(
        tab.id,
        "activate_top_level_composer",
      );
      console.log(
        "[RedditAgent] activateTopLevelComposer result:",
        JSON.stringify(activateResult),
      );

      // Step 2: Wait for editor to mount, then type
      let typeResult;
      for (let attempt = 0; attempt < 5; attempt++) {
        await sleep(2000);

        typeResult = await sendContentScriptMessage(tab.id, "type_top_level_comment", {
          replyText,
        });
        console.log(
          `[RedditAgent] typeTopLevelComment attempt ${attempt + 1} result:`,
          JSON.stringify(typeResult),
        );

        if (typeResult?.success) {
          break;
        }

        console.log(
          `[RedditAgent] Top-level comment attempt ${attempt + 1} failed: ${typeResult?.error}`,
        );
      }

      if (!typeResult?.success) {
        throw new Error(
          typeResult?.error ||
            "Failed to type top-level comment after 5 attempts",
        );
      }
    }

    // Click the Comment/Reply button to submit (with retry)
    await sleep(500);
    let submitSuccess = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      const result = await sendContentScriptMessage(tab.id, "submit_comment");
      console.log(
        `[RedditAgent] submitComment attempt ${attempt + 1} result:`,
        JSON.stringify(result),
      );

      if (result?.success) {
        submitSuccess = true;
        break;
      }

      console.log(
        `[RedditAgent] Submit attempt ${attempt + 1} failed: ${result?.error}`,
      );
      await sleep(1000);
    }

    if (!submitSuccess) {
      throw new Error(
        "Failed to submit comment: could not find or click submit button",
      );
    }

    // Verify the comment was actually posted
    const replySubstring = replyText.substring(0, 50);
    let verified = false;
    let lastVerifyResult = null;

    for (let poll = 0; poll < 8; poll++) {
      await sleep(1500);

      lastVerifyResult = await sendContentScriptMessage(
        tab.id,
        "verify_comment_posted",
        {
          replyTextSubstring: replySubstring,
        },
      );

      console.log(
        `[RedditAgent] Verify poll ${poll + 1}: ${lastVerifyResult?.status}`,
      );

      if (
        lastVerifyResult?.status === "confirmed" ||
        lastVerifyResult?.status === "likely_success"
      ) {
        verified = true;
        break;
      }

      if (lastVerifyResult?.status === "error") {
        throw new Error(
          lastVerifyResult.error || "Reddit reported an error after submission",
        );
      }
    }

    if (!verified) {
      throw new Error(
        `Comment submission could not be verified after 12s. Last status: ${JSON.stringify(lastVerifyResult)}`,
      );
    }

    return {
      success: true,
      message: "Reply posted and verified",
      tabId: tab.id,
    };
  } finally {
    activePostCount--;
    if (activePostCount === 0 && workerWindowId !== null) {
      const toClose = workerWindowId;
      workerWindowId = null;
      workerWindowPromise = null;
      chrome.windows.remove(toClose).catch(() => {});
    }
  }
}

// =============================================
// Utilities
// =============================================

async function getWorkerWindow() {
  if (workerWindowId !== null) {
    try {
      await chrome.windows.get(workerWindowId);
      return workerWindowId;
    } catch (e) {
      workerWindowId = null;
      workerWindowPromise = null;
    }
  }

  if (workerWindowPromise) return workerWindowPromise;

  workerWindowPromise = (async () => {
    try {
      console.log("[RedditAgent] Creating worker window...");
      const window = await chrome.windows.create({
        focused: false,
        type: "normal",
      });
      workerWindowId = window.id;
      return workerWindowId;
    } catch (err) {
      workerWindowPromise = null;
      throw err;
    }
  })();

  return workerWindowPromise;
}

function createTabAndWaitForLoad(url, windowId) {
  return new Promise((resolve, reject) => {
    let tabId = null;
    const timeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error(`Tab load timeout for ${url}`));
    }, 30000);

    function listener(updatedTabId, changeInfo, tab) {
      if (updatedTabId === tabId && changeInfo.status === "complete") {
        clearTimeout(timeout);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve(tab);
      }
    }

    chrome.tabs.onUpdated.addListener(listener);

    chrome.tabs.create({ url, windowId, active: false }, (tab) => {
      if (chrome.runtime.lastError) {
        clearTimeout(timeout);
        chrome.tabs.onUpdated.removeListener(listener);
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      tabId = tab.id;
    });
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
