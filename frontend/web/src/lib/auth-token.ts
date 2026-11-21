// Firma y verificacion de tokens de sesion usando HMAC-SHA256 (Web Crypto API).
// Compatible con Edge Runtime (middleware) y Node.js (API routes).

const encoder = new TextEncoder();

async function getKey(secret: string) {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

function base64UrlEncode(bytes: Uint8Array): string {
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(str: string): Uint8Array {
  const pad = (4 - (str.length % 4)) % 4;
  const padded = str.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(pad);
  const bin = atob(padded);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buf = new ArrayBuffer(bytes.length);
  new Uint8Array(buf).set(bytes);
  return buf;
}

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET no esta configurado en las variables de entorno");
  return secret;
}

export type SessionPayload = {
  uid: number;
  email: string;
  role: string;
  iat: number;
  exp: number;
  ttlMs: number;
};

export async function signSession(payload: SessionPayload): Promise<string> {
  const secret = getSecret();
  const key = await getKey(secret);
  const body = base64UrlEncode(encoder.encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign("HMAC", key, toArrayBuffer(encoder.encode(body)));
  const sigStr = base64UrlEncode(new Uint8Array(sig));
  return body + "." + sigStr;
}

export async function verifySession(token: string | undefined | null): Promise<SessionPayload | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const body = parts[0];
  const sig = parts[1];
  if (!body || !sig) return null;
  try {
    const secret = getSecret();
    const key = await getKey(secret);
    const valid = await crypto.subtle.verify("HMAC", key, toArrayBuffer(base64UrlDecode(sig)), toArrayBuffer(encoder.encode(body)));
    if (!valid) return null;
    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(body))) as SessionPayload;
    if (!payload.exp || Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export const SESSION_COOKIE_NAME = "rpms_session";
export const DEFAULT_SESSION_TTL_MS = 30 * 60 * 1000;
