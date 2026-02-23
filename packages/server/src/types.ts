/** Message sent from server to extension */
export interface BridgeRequest {
  id: string;
  action: string;
  params: Record<string, unknown>;
}

/** Success response from extension */
export interface BridgeSuccessResponse {
  id: string;
  success: true;
  data: unknown;
}

/** Error response from extension */
export interface BridgeErrorResponse {
  id: string;
  success: false;
  error: string;
}

export type BridgeResponse = BridgeSuccessResponse | BridgeErrorResponse;

/** Identify message from extension on connect */
export interface IdentifyMessage {
  type: "identify";
  role: "extension";
}

/** Ping message from extension */
export interface PingMessage {
  type: "ping";
}

export type ExtensionMessage = IdentifyMessage | PingMessage | BridgeResponse;

export interface PendingRequest {
  resolve: (data: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}
