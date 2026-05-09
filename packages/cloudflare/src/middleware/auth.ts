import { jwtVerify } from "jose";
import type { Context, Next } from "hono";

/**
 * Authentication middleware for Kalp Studio.
 * Verifies JWT tokens signed with KALP_SECRET_KEY.
 *
 * Cloudflare Workers use c.env for environment variables, not process.env.
 */
export async function authMiddleware(c: Context, next: Next) {
  // Cloudflare Workers uses c.env for environment variables, not process.env
  const SECRET_KEY = c.env?.KALP_SECRET_KEY;
  
  if (!SECRET_KEY) {
    console.error("Missing KALP_SECRET_KEY in Cloudflare Environment");
    return c.json({ error: "Server configuration error" }, 500);
  }

  // Public routes
  if (c.req.path === "/health") return next();

  const token =
    c.req.query("token") ||
    c.req.header("Authorization")?.replace("Bearer ", "");

  if (!token) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const secret = new TextEncoder().encode(SECRET_KEY);
    const { payload } = await jwtVerify(token, secret);
    c.set("user", payload);
    return next();
  } catch {
    return c.json({ error: "Invalid token" }, 401);
  }
}

/**
 * Set authentication cookie for Studio sessions.
 */
export async function setAuthCookie(c: Context, token: string) {
  c.header(
    "Set-Cookie",
    `kalp_token=${token}; HttpOnly; Secure; SameSite=Strict; Max-Age=3600`,
  );
}
