import { randomBytes, scryptSync, timingSafeEqual, createHmac } from "crypto";
import { sql } from "@/lib/db";
import { SUPER_ADMIN_EMAIL, ensureAuthSchema } from "@/lib/auth-db";

export type Role = "super_admin" | "admin" | "user";

export function hashPassword(password: string): string {
    const salt = randomBytes(16).toString("hex");
    const hash = scryptSync(password, salt, 64).toString("hex");
    return salt + ":" + hash;
}

export function verifyPassword(password: string, stored: string): boolean {
    const parts = stored.split(":");
    const salt = parts[0];
    const hash = parts[1];
    if (!salt || !hash) return false;
    const hashBuffer = Buffer.from(hash, "hex");
    const derived = scryptSync(password, salt, 64);
    if (derived.length !== hashBuffer.length) return false;
    return timingSafeEqual(derived, hashBuffer);
}

export function isValidPassword(password: string): boolean {
    return typeof password === "string" && password.length >= 10;
}

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function generateBase32Secret(length = 20): string {
    const bytes = randomBytes(length);
    let bits = "";
    for (const b of bytes) bits += b.toString(2).padStart(8, "0");
    let secret = "";
    for (let i = 0; i + 5 <= bits.length; i += 5) {
          secret += BASE32_ALPHABET[parseInt(bits.slice(i, i + 5), 2)];
    }
    return secret;
}

function base32Decode(base32: string): Buffer {
    const clean = base32.toUpperCase().replace(/[^A-Z2-7]/g, "");
    let bits = "";
    for (const c of clean) {
          const val = BASE32_ALPHABET.indexOf(c);
          if (val === -1) continue;
          bits += val.toString(2).padStart(5, "0");
    }
    const bytes: number[] = [];
    for (let i = 0; i + 8 <= bits.length; i += 8) {
          bytes.push(parseInt(bits.slice(i, i + 8), 2));
    }
    return Buffer.from(bytes);
}

export function generateTotp(secretBase32: string, timeStepSeconds = 30, digits = 6, at = Date.now()): string {
    const key = base32Decode(secretBase32);
    const counter = Math.floor(at / 1000 / timeStepSeconds);
    const buf = Buffer.alloc(8);
    buf.writeBigUInt64BE(BigInt(counter));
    const hmac = createHmac("sha1", key).update(buf).digest();
    const offset = hmac[hmac.length - 1] & 0xf;
    const code =
          ((hmac[offset] & 0x7f) << 24) |
          ((hmac[offset + 1] & 0xff) << 16) |
          ((hmac[offset + 2] & 0xff) << 8) |
          (hmac[offset + 3] & 0xff);
    const str = (code % Math.pow(10, digits)).toString().padStart(digits, "0");
    return str;
}

export function verifyTotp(secretBase32: string, token: string, window = 1): boolean {
    const cleanToken = (token || "").replace(/\s/g, "");
    for (let errorWindow = -window; errorWindow <= window; errorWindow++) {
          const candidate = generateTotp(secretBase32, 30, 6, Date.now() + errorWindow * 30000);
          if (candidate === cleanToken) return true;
    }
    return false;
}

export function buildTotpUri(secretBase32: string, email: string): string {
    const label = encodeURIComponent("RPMS:" + email);
    const issuer = encodeURIComponent("RPMS");
    return "otpauth://totp/" + label + "?secret=" + secretBase32 + "&issuer=" + issuer + "&algorithm=SHA1&digits=6&period=30";
}

export const MAX_FAILED_ATTEMPTS = 5;
export const LOCKOUT_MINUTES = 15;

export async function getUserByEmail(email: string) {
    await ensureAuthSchema();
    const normalized = email.toLowerCase().trim();
    const { rows } = await sql`SELECT * FROM users WHERE email = ${normalized} LIMIT 1;`;
    return rows[0] ?? null;
}

export async function getUserById(id: number) {
    await ensureAuthSchema();
    const { rows } = await sql`SELECT * FROM users WHERE id = ${id} LIMIT 1;`;
    return rows[0] ?? null;
}

export function isSuperAdminEmail(email: string) {
    return email.toLowerCase().trim() === SUPER_ADMIN_EMAIL;
}

export function sanitizeUser(user: any) {
    if (!user) return null;
    const { password_hash, mfa_secret, ...rest } = user;
    return rest;
}
