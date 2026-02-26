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

export const isAuthenticated = () => !!getStoredToken();

/**
 * Standard fetch wrapper that automatically injects the Auth token.
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
        // Token might be expired or invalid
        clearAuthData();
        window.location.reload(); // Force re-auth
    }

    return response;
};
