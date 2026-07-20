import axios from 'axios';

const DEFAULT_API_PORT = '5000';
const configuredApiBase = (import.meta.env.VITE_APP_API || '').replace(/\/$/, '');

const isLocalHost = (hostname) => ['localhost', '127.0.0.1', '::1'].includes(hostname);

const getRuntimeApiBase = () => {
    if (typeof window === 'undefined') {
        return configuredApiBase;
    }

    const pageHost = window.location.hostname;

    if (!configuredApiBase) {
        return `${window.location.protocol}//${pageHost}:${DEFAULT_API_PORT}`;
    }

    try {
        const apiUrl = new URL(configuredApiBase);

        if (isLocalHost(apiUrl.hostname) && !isLocalHost(pageHost)) {
            apiUrl.hostname = pageHost;
        }

        return apiUrl.toString().replace(/\/$/, '');
    } catch {
        return configuredApiBase;
    }
};

export const API_BASE_URL = getRuntimeApiBase();

export const resolveApiUrl = (url = '') => {
    if (!url) return url;

    if (configuredApiBase && url.startsWith(configuredApiBase)) {
        return `${API_BASE_URL}${url.slice(configuredApiBase.length)}`;
    }

    try {
        const parsed = new URL(url);

        if (isLocalHost(parsed.hostname) && typeof window !== 'undefined' && !isLocalHost(window.location.hostname)) {
            parsed.hostname = window.location.hostname;
            return parsed.toString();
        }
    } catch {
        // Relative URLs are handled below.
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
