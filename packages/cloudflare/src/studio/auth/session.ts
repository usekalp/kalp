import { deleteCookie, getSignedCookie, setSignedCookie } from "hono/cookie";
import type { Context } from "hono";
import type { StudioSession } from "./types";

export async function readSession(
  c: Context<any>,
): Promise<StudioSession | null> {
  const secret = c.env.KALP_SECRET_KEY;
  if (!secret) return null;

  const username = await getSignedCookie(c, secret, "kalp_studio_session");
  if (!username || typeof username !== "string") return null;
  return { username };
}

export async function requireSession(
  c: Context<any>,
  next: () => Promise<void>,
): Promise<Response | void> {
  const session = await readSession(c);
  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  c.set("session" as never, session as never);
  return next();
}

export async function handleStudioLogin(
  c: Context<any>,
): Promise<Response> {
  const secret = c.env.KALP_SECRET_KEY;
  const password = c.env.KALP_STUDIO_PASSWORD;
  const adminUser = c.env.KALP_STUDIO_ADMIN_USER || "admin";

  if (!secret || !password) {
    return c.json({ error: "Studio auth is not configured." }, 500);
  }

  const body = (await c.req
    .json()
    .catch(() => ({ username: undefined, password: undefined }))) as {
    username?: string;
    password?: string;
  };
  const username = body.username || adminUser;

  if (username !== adminUser || body.password !== password) {
    return c.json({ error: "Invalid credentials." }, 401);
  }

  const isSecure = new URL(c.req.url).protocol === "https:";
  await setSignedCookie(c, "kalp_studio_session", username, secret, {
    path: "/",
    httpOnly: true,
    sameSite: "Lax",
    secure: isSecure,
    maxAge: 60 * 60 * 8,
  });

  return c.json({ ok: true, user: { username } });
}

export async function handleStudioLogout(
  c: Context<any>,
): Promise<Response> {
  deleteCookie(c, "kalp_studio_session", { path: "/" });
  return c.json({ ok: true });
}