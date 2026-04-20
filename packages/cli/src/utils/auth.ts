import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const KALP_DIR = join(homedir(), ".kalp");
const AUTH_FILE = join(KALP_DIR, "auth.json");

interface AuthData {
  token: string;
  email: string;
  expiresAt: string;
}

export async function getAuthToken(): Promise<string | null> {
  try {
    const content = await readFile(AUTH_FILE, "utf-8");
    const auth = JSON.parse(content) as AuthData;

    // Check if token is expired
    if (new Date(auth.expiresAt) < new Date()) {
      return null;
    }

    return auth.token;
  } catch {
    return null;
  }
}

export async function isAuthenticated(): Promise<boolean> {
  const token = await getAuthToken();
  return token !== null;
}
