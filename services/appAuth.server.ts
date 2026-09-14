import crypto from "node:crypto";
import type { VercelRequest } from "@vercel/node";

const COOKIE_NAME = "rafiq_app_session";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 180;
const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/i;

export class AppAuthConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AppAuthConfigurationError";
  }
}

const sha256 = (value: string): string => (
  crypto.createHash("sha256").update(value).digest("hex")
);

const timingSafeEqual = (left: string, right: string): boolean => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

const getPasswordHash = (): string => {
  const value = process.env.RAFIQ_APP_PASSWORD_HASH?.trim();
  if (!value || !SHA256_HEX_PATTERN.test(value)) {
    throw new AppAuthConfigurationError(
      "RAFIQ_APP_PASSWORD_HASH must be configured as a 64-character SHA-256 hex digest.",
    );
  }
  return value.toLowerCase();
};

const getSessionSecret = (): string => {
  const value = process.env.RAFIQ_APP_SESSION_SECRET?.trim();
  if (!value || value.length < 32) {
    throw new AppAuthConfigurationError(
      "RAFIQ_APP_SESSION_SECRET must be configured with at least 32 characters.",
    );
  }
  if (value.toLowerCase() === getPasswordHash()) {
    throw new AppAuthConfigurationError(
      "RAFIQ_APP_SESSION_SECRET must be independent from RAFIQ_APP_PASSWORD_HASH.",
    );
  }
  return value;
};

const getExpectedSession = (): string => (
  crypto.createHmac("sha256", getSessionSecret()).update(getPasswordHash()).digest("hex")
);

export const getAppAuthConfiguration = () => {
  getPasswordHash();
  getSessionSecret();
  return { configured: true as const };
};

export const verifyAppPassword = (password: unknown): boolean => {
  if (typeof password !== "string") return false;
  return timingSafeEqual(sha256(password), getPasswordHash());
};

export const createAppSessionCookie = (): string => {
  const secure = process.env.NODE_ENV === "production" ? " Secure;" : "";
  return `${COOKIE_NAME}=${getExpectedSession()}; Path=/; Max-Age=${COOKIE_MAX_AGE_SECONDS}; HttpOnly; SameSite=Lax;${secure}`;
};

export const hasValidAppSession = (cookieHeader: unknown): boolean => {
  if (typeof cookieHeader !== "string") return false;
  const cookies = Object.fromEntries(
    cookieHeader
      .split(";")
      .map(part => part.trim().split("="))
      .filter(parts => parts.length >= 2)
      .map(([key, ...value]) => [key, value.join("=")]),
  );
  const session = cookies[COOKIE_NAME];
  return typeof session === "string" && timingSafeEqual(session, getExpectedSession());
};

export const assertAppSession = (req: Pick<VercelRequest, "headers">) => {
  if (hasValidAppSession(req.headers.cookie)) return;
  const error = new Error("App password required.");
  (error as Error & { statusCode?: number }).statusCode = 401;
  throw error;
};
