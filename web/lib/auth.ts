import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { api, User, ApiError } from "./api";

// Server-side: read session cookie and return current user, or null.
export async function getUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const session = cookieStore.get("session");
  if (!session) return null;

  try {
    return await api.auth.me(`session=${session.value}`);
  } catch {
    return null;
  }
}

// Server-side: require authentication — redirect to /login if not logged in.
export async function requireUser(): Promise<User> {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}

// Build cookie header string for server-side API calls.
export async function getCookieHeader(): Promise<string | undefined> {
  const cookieStore = await cookies();
  const session = cookieStore.get("session");
  return session ? `session=${session.value}` : undefined;
}
