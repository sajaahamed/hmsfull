import axios from 'axios';
import { clearAuthentication } from './auth';

const configuredApiBase = (import.meta.env.VITE_APP_API || '/api').replace(/\/$/, '');

export const API_BASE_URL = configuredApiBase;

export const resolveApiUrl = (url = '') => {
    if (!url) return url;

    if (configuredApiBase && url.startsWith(configuredApiBase)) {
        return `${API_BASE_URL}${url.slice(configuredApiBase.length)}`;
    }

    if (url.startsWith('/')) {
        return `${API_BASE_URL}${url}`;
    }

    return url;
};

axios.interceptors.request.use((config) => {
    if (typeof config.url === 'string') {
        config.url = resolveApiUrl(config.url);
    }

    return config;
});

axios.interceptors.response.use(
    response => response,
    error => {
        const status = error.response?.status;
        const code = error.response?.data?.code;
        const headers = error.config?.headers;
        const authorization = typeof headers?.get === 'function'
            ? headers.get('Authorization')
            : headers?.Authorization || headers?.authorization;
        const isAuthenticatedRequest = typeof authorization === 'string'
            && authorization.startsWith('Bearer ');

        if (code === 'AUTH_USER_NOT_FOUND' || (status === 401 && isAuthenticatedRequest)) {
            clearAuthentication();

            // A hard navigation also cancels any sibling requests started by the
            // now-invalid dashboard, preventing a cascade of misleading errors.
            if (typeof window !== 'undefined' && window.location.pathname !== '/') {
                window.location.replace('/');
            }
        }

        return Promise.reject(error);
    }
);
