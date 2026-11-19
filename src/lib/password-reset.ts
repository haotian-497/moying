import { timingSafeEqual } from "node:crypto";

/** Local machine gate for forgot-password. Prefer PASSWORD_RESET_KEY; else SESSION_SECRET. */
export function passwordResetSecret() {
  const dedicated = (process.env.PASSWORD_RESET_KEY || "").trim();
  if (dedicated) return dedicated;
  return (process.env.SESSION_SECRET || "").trim();
}

export function passwordResetEnabled() {
  return passwordResetSecret().length >= 8;
}

export function verifyPasswordResetKey(input: string) {
  const expected = passwordResetSecret();
  if (expected.length < 8) return false;
  const left = Buffer.from(input);
  const right = Buffer.from(expected);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
