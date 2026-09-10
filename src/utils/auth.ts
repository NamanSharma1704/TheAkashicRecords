import { User, AuthResponse } from '../core/types';

/**
 * Session handling.
 *
 * The JWT is NOT stored here. It lives in an httpOnly cookie that the browser attaches
 * to same-origin requests and that page scripts cannot read, so there is no token for
 * injected code to steal. What is kept in localStorage is display state only — who is
 * signed in and when the session lapses — none of which grants access on its own.
 *
 * Every value read back from localStorage is a hint for rendering. The server is the
 * only authority on whether a request is authorised.
 */

const USER_KEY = 'akashic_system_user';
const EXPIRY_KEY = 'akashic_session_expires';

// Earlier builds persisted the raw JWT under this key.
const LEGACY_TOKEN_KEY = 'akashic_system_token';

/**
 * Remove any token left behind by a previous version of the app. Runs once at import,
 * so a returning user's stored credential is cleared the first time they load the
 * updated build rather than lingering indefinitely.
 */
const purgeLegacyToken = () => {
    try {
        localStorage.removeItem(LEGACY_TOKEN_KEY);
    } catch {
        // Storage can throw outright in private mode; nothing to clean up in that case.
    }
};
purgeLegacyToken();

export const saveAuthData = (data: AuthResponse) => {
    try {
        localStorage.setItem(USER_KEY, JSON.stringify(data.user));
        if (typeof data.expiresAt === 'number') {
            localStorage.setItem(EXPIRY_KEY, String(data.expiresAt));
        }
    } catch {
        // Non-fatal: the session cookie is already set, so the app still works. Only the
        // no-flash boot hint is lost.
    }
    purgeLegacyToken();
};

export const clearAuthData = () => {
    try {
        localStorage.removeItem(USER_KEY);
        localStorage.removeItem(EXPIRY_KEY);
        localStorage.removeItem(LEGACY_TOKEN_KEY);
    } catch {
        // Nothing to do — the authoritative session is the cookie, cleared by the server.
    }
};

export const getStoredUser = (): User | null => {
    try {
        const user = localStorage.getItem(USER_KEY);
        return user ? JSON.parse(user) : null;
    } catch {
        return null;
    }
};

/**
 * Whether the app should render as signed in on first paint.
 *
 * Purely a hint to avoid flashing the login screen at a user whose session is still
 * good. It cannot be trusted and does not need to be: the session cookie is unreadable
 * from here, so the first API call is what actually settles the question, and a 401
 * unwinds the optimistic state.
 */
export const isAuthenticated = (): boolean => {
    try {
        const raw = localStorage.getItem(EXPIRY_KEY);
        if (!raw) return false;
        const expiresAt = Number(raw);
        return Number.isFinite(expiresAt) && expiresAt > Date.now();
    } catch {
        return false;
    }
};

/**
 * Standard fetch wrapper. The session travels as an httpOnly cookie, so there is no
 * Authorization header to attach — the browser handles it.
 * On 401, dispatches a custom event instead of a hard reload to prevent loops.
 */
export const systemFetch = async (url: string, options: RequestInit = {}) => {
    const headers = {
        ...options.headers,
        'Content-Type': 'application/json'
    };

    const response = await fetch(url, {
        ...options,
        headers,
        // Same-origin only. The cookie is SameSite=Strict, so it is never sent anywhere else.
        credentials: 'same-origin'
    });

    if (response.status === 401) {
        // Session is gone or was revoked server-side — drop local state and notify the app.
        clearAuthData();
        window.dispatchEvent(new Event('akashic:session-expired'));
    }

    return response;
};

/**
 * Perform a graceful logout by notifying the backend (to purge sandboxes and clear the
 * session cookie) and clearing local display state.
 */
export const performLogout = async () => {
    try {
        await systemFetch('/api/auth/logout', { method: 'POST' });
    } catch (err) {
        console.error('Logout sync failed:', err);
    } finally {
        clearAuthData();
    }
};
