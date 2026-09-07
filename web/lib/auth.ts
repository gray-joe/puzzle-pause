import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { api, User } from './api';

// Server-side: read session cookie and return current user, or null.
export async function getUser(): Promise<User | null> {
    const cookieStore = await cookies();
    const session = cookieStore.get('session');
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
    if (!user) redirect('/login');
    return user;
}

// Server-side: require an authenticated user whose email is configured for admin access.
export async function requireAdmin(): Promise<User> {
    const user = await requireUser();
    const adminEmails = (process.env.ADMIN_EMAILS ?? '')
        .split(',')
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean);

    if (!adminEmails.includes(user.email.toLowerCase())) redirect('/');
    return user;
}

// Build cookie header string for server-side API calls.
export async function getCookieHeader(): Promise<string | undefined> {
    const cookieStore = await cookies();
    const session = cookieStore.get('session');
    const guestSession = cookieStore.get('guest_session');
    const parts = [
        session ? `session=${session.value}` : null,
        guestSession ? `guest_session=${guestSession.value}` : null,
    ].filter(Boolean);

    return parts.length > 0 ? parts.join('; ') : undefined;
}
