import { User, AuthResponse } from '../core/types';

const STORAGE_KEY = 'akashic_system_token';
const USER_KEY = 'akashic_system_user';

export const saveAuthData = (data: AuthResponse) => {
    localStorage.setItem(STORAGE_KEY, data.token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
};

export const clearAuthData = () => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(USER_KEY);
};

export const getStoredToken = () => localStorage.getItem(STORAGE_KEY);

export const getStoredUser = (): User | null => {
    const user = localStorage.getItem(USER_KEY);
    return user ? JSON.parse(user) : null;
};

/**
 * Check auth state by decoding the JWT exp claim client-side.
 * Prevents the flash of the authenticated UI for users with expired tokens.
 */
export const isAuthenticated = (): boolean => {
    const token = getStoredToken();
    if (!token) return false;
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        // payload.exp is in seconds; Date.now() is in milliseconds
        return typeof payload.exp === 'number' && payload.exp * 1000 > Date.now();
    } catch {
        return false; // Malformed token
    }
};

/**
 * Standard fetch wrapper that automatically injects the Auth token.
 * On 401, dispatches a custom event instead of a hard reload to prevent loops.
 */
export const systemFetch = async (url: string, options: RequestInit = {}) => {
    const token = getStoredToken();

    const headers = {
        ...options.headers,
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };

    const response = await fetch(url, { ...options, headers });

    if (response.status === 401) {
        // Token is invalid or expired — clear local state and notify the app
        clearAuthData();
        window.dispatchEvent(new Event('akashic:session-expired'));
    }

    return response;
};
