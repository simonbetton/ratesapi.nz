// Protocol-version handling for the MCP endpoint.
//
// The endpoint is "dual-era" (MCP 2026-07-28, basic/versioning): it serves
// modern clients statelessly, with the protocol version, client capabilities,
// and mirrored headers on every request, and it still answers the `initialize`
// handshake of the legacy revisions, so existing clients keep working.

export const MODERN_PROTOCOL_VERSION = "2026-07-28";

/** Handshake-based revisions, newest first. */
export const LEGACY_PROTOCOL_VERSIONS = [
  "2025-11-25",
  "2025-06-18",
  "2025-03-26",
  "2024-11-05",
] as const;

export const SUPPORTED_PROTOCOL_VERSIONS = [
  MODERN_PROTOCOL_VERSION,
  ...LEGACY_PROTOCOL_VERSIONS,
];

// Legacy clients that predate the MCP-Protocol-Version header (added in
// 2025-06-18) are served as this revision, as the transport spec allows.
const HEADERLESS_LEGACY_VERSION = "2025-03-26";

export const META_PROTOCOL_VERSION = "io.modelcontextprotocol/protocolVersion";
export const META_CLIENT_CAPABILITIES =
  "io.modelcontextprotocol/clientCapabilities";
export const META_SERVER_INFO = "io.modelcontextprotocol/serverInfo";

export const JSON_RPC_ERRORS = {
  parseError: -32_700,
  invalidRequest: -32_600,
  methodNotFound: -32_601,
  invalidParams: -32_602,
  internalError: -32_603,
  headerMismatch: -32_020,
  unsupportedProtocolVersion: -32_022,
} as const;

export interface ProtocolError {
  httpStatus: number;
  code: number;
  message: string;
  data?: unknown;
}

export type Era =
  | { kind: "modern"; version: typeof MODERN_PROTOCOL_VERSION }
  | { kind: "legacy"; version: string };

/** Picks the legacy version to answer an `initialize` request with. */
export function negotiateLegacyVersion(requested: unknown): string {
  const match = LEGACY_PROTOCOL_VERSIONS.find(
    (version) => version === requested
  );
  return match ?? LEGACY_PROTOCOL_VERSIONS[0];
}

/** Whether a revision has the behavior introduced by `since`. */
export function hasFeature(era: Era, since: string) {
  return era.version >= since;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function metaOf(params: unknown): Record<string, unknown> | undefined {
  if (!isRecord(params) || !isRecord(params._meta)) {
    return undefined;
  }
  return params._meta;
}

/**
 * Decides which revision serves a request. The per-request `_meta` version
 * (modern) or the `MCP-Protocol-Version` header (legacy, 2025-06-18+) names
 * it; a request with neither is an older legacy client.
 */
export function resolveEra(
  headerVersion: string | null,
  method: string,
  params: unknown
): Era | ProtocolError {
  const bodyVersion = metaOf(params)?.[META_PROTOCOL_VERSION];

  if (bodyVersion !== undefined && typeof bodyVersion !== "string") {
    return invalidParams(`${META_PROTOCOL_VERSION} must be a string`);
  }
  if (
    headerVersion !== null &&
    bodyVersion !== undefined &&
    headerVersion !== bodyVersion
  ) {
    return headerMismatch(
      `MCP-Protocol-Version header value '${headerVersion}' does not match body value '${bodyVersion}'`
    );
  }

  const requested = bodyVersion ?? headerVersion;
  if (requested === null) {
    return { kind: "legacy", version: HEADERLESS_LEGACY_VERSION };
  }
  if (!SUPPORTED_PROTOCOL_VERSIONS.includes(requested)) {
    return {
      httpStatus: 400,
      code: JSON_RPC_ERRORS.unsupportedProtocolVersion,
      message: "Unsupported protocol version",
      data: { supported: SUPPORTED_PROTOCOL_VERSIONS, requested },
    };
  }
  // `initialize` only exists in the handshake-based revisions.
  if (requested !== MODERN_PROTOCOL_VERSION || method === "initialize") {
    return {
      kind: "legacy",
      version:
        requested === MODERN_PROTOCOL_VERSION
          ? LEGACY_PROTOCOL_VERSIONS[0]
          : requested,
    };
  }
  return { kind: "modern", version: MODERN_PROTOCOL_VERSION };
}

const BASE64_PREFIX = "=?base64?";
const BASE64_SUFFIX = "?=";
const BASE64_PAYLOAD = /^[A-Za-z0-9+/]*={0,2}$/u;
// Visible ASCII, space, and horizontal tab (RFC 9110 field values).
const SAFE_HEADER_VALUE = /^[\t -~]*$/u;

/** Decodes a mirrored header value; `null` means it is malformed. */
export function decodeHeaderValue(value: string): string | null {
  const isEncoded =
    value.length >= BASE64_PREFIX.length + BASE64_SUFFIX.length &&
    value.startsWith(BASE64_PREFIX) &&
    value.endsWith(BASE64_SUFFIX);
  if (!isEncoded) {
    return SAFE_HEADER_VALUE.test(value) ? value : null;
  }

  // Any value in the sentinel form is encoded (clients must encode a plain
  // value that looks like one), so a bad payload is malformed, not literal.
  const encoded = value.slice(BASE64_PREFIX.length, -BASE64_SUFFIX.length);
  if (!BASE64_PAYLOAD.test(encoded)) {
    return null;
  }
  try {
    const bytes = Uint8Array.from(
      atob(encoded),
      (char) => char.codePointAt(0) ?? 0
    );
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

/**
 * Checks the fields a modern request must carry: the per-request `_meta`
 * and the headers that mirror the body (transports/streamable-http,
 * "Server Validation").
 */
export function validateModernRequest(
  headers: Headers,
  method: string,
  params: unknown
): ProtocolError | null {
  const meta = metaOf(params);
  if (meta?.[META_PROTOCOL_VERSION] === undefined) {
    return invalidParams(
      `Missing required _meta field ${META_PROTOCOL_VERSION}`
    );
  }
  if (!isRecord(meta[META_CLIENT_CAPABILITIES])) {
    return invalidParams(
      `Missing required _meta field ${META_CLIENT_CAPABILITIES}`
    );
  }
  if (headers.get("mcp-protocol-version") === null) {
    return headerMismatch("Missing required MCP-Protocol-Version header");
  }

  const methodHeader = headers.get("mcp-method");
  if (methodHeader === null) {
    return headerMismatch("Missing required Mcp-Method header");
  }
  if (methodHeader !== method) {
    return headerMismatch(
      `Mcp-Method header value '${methodHeader}' does not match body value '${method}'`
    );
  }

  if (method === "tools/call") {
    const nameHeader = headers.get("mcp-name");
    const name = isRecord(params) ? params.name : undefined;
    if (nameHeader === null) {
      return headerMismatch("Missing required Mcp-Name header");
    }
    const decoded = decodeHeaderValue(nameHeader);
    if (decoded === null) {
      return headerMismatch("Mcp-Name header contains invalid characters");
    }
    if (decoded !== name) {
      return headerMismatch(
        `Mcp-Name header value '${decoded}' does not match body value '${String(name)}'`
      );
    }
  }

  return null;
}

function invalidParams(message: string): ProtocolError {
  return { httpStatus: 400, code: JSON_RPC_ERRORS.invalidParams, message };
}

function headerMismatch(message: string): ProtocolError {
  return {
    httpStatus: 400,
    code: JSON_RPC_ERRORS.headerMismatch,
    message: `Header mismatch: ${message}`,
  };
}

export function isProtocolError(
  value: Era | ProtocolError
): value is ProtocolError {
  return "code" in value;
}
