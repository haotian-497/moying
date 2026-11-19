import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

export const COOKIE_NAME = "moyin_session";
const MAX_AGE = 60 * 60 * 24 * 14;

type SessionPayload = {
  uid: number;
  username: string;
  exp: number;
};

function secret() {
  const value = process.env.SESSION_SECRET;
  if (value && value.length >= 16) return value;
  if (process.env.NODE_ENV === "production") {
    throw new Error("请设置 SESSION_SECRET");
  }
  return "dev-only-moyin-session-secret";
}

function sign(body: string) {
  return createHmac("sha256", secret()).update(body).digest("base64url");
}

export function createSessionToken(user: { id: number; username: string }) {
  const body = Buffer.from(
    JSON.stringify({
      uid: user.id,
      username: user.username,
      exp: Date.now() + MAX_AGE * 1000,
    } satisfies SessionPayload),
  ).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function readSessionToken(token: string | undefined | null): SessionPayload | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, signature] = parts;
  const expected = sign(body);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as SessionPayload;
    if (typeof payload.uid !== "number" || typeof payload.username !== "string" || typeof payload.exp !== "number") {
      return null;
    }
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function cookieOptions(maxAge = MAX_AGE) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

export function withSession<T>(body: T, user: { id: number; username: string }, status = 200) {
  const response = NextResponse.json(body, { status });
  response.cookies.set(COOKIE_NAME, createSessionToken(user), cookieOptions());
  return response;
}

export function clearSession() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, "", cookieOptions(0));
  return response;
}
