import { SignJWT } from "jose";

export async function createStudioToken(secretKey: string): Promise<string> {
  const secret = new TextEncoder().encode(secretKey);

  return new SignJWT({
    sub: "cli-user",
    aud: "kalp-studio",
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  })
    .setProtectedHeader({ alg: "HS256" })
    .sign(secret);
}
