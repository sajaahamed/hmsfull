import axios from 'axios';

const DEFAULT_API_PORT = '5000';
const configuredApiBase = (import.meta.env.VITE_APP_API || '').replace(/\/$/, '');

const isLocalHost = (hostname) => ['localhost', '127.0.0.1', '::1'].includes(hostname);

const getSameHostApiBase = () => {
    if (typeof window === 'undefined') {
        return configuredApiBase;
    }

    try {
        const apiUrl = configuredApiBase ? new URL(configuredApiBase) : null;
        const port = apiUrl?.port || DEFAULT_API_PORT;
        return `${window.location.protocol}//${window.location.hostname}:${port}`;
    } catch {
        return `${window.location.protocol}//${window.location.hostname}:${DEFAULT_API_PORT}`;
    }
};

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
            return `${window.location.origin}/api`;
        }

        return apiUrl.toString().replace(/\/$/, '');
    } catch {
        return configuredApiBase;
    }
};

export const API_BASE_URL = getRuntimeApiBase();
const SAME_HOST_API_BASE_URL = getSameHostApiBase();

export const resolveApiUrl = (url = '') => {
    if (!url) return url;

    if (configuredApiBase && url.startsWith(configuredApiBase)) {
        return `${API_BASE_URL}${url.slice(configuredApiBase.length)}`;
    }

    try {
        const parsed = new URL(url);

        if (isLocalHost(parsed.hostname) && typeof window !== 'undefined' && !isLocalHost(window.location.hostname)) {
            return `${API_BASE_URL}${parsed.pathname}${parsed.search}${parsed.hash}`;
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

axios.interceptors.response.use(
    response => response,
    error => {
        const originalConfig = error.config;
        const canRetryWithSameHost = originalConfig
            && !originalConfig._sameHostApiFallbackTried
            && API_BASE_URL !== SAME_HOST_API_BASE_URL
            && typeof originalConfig.url === 'string'
            && originalConfig.url.startsWith(API_BASE_URL);

        if (!canRetryWithSameHost) {
            return Promise.reject(error);
        }

        originalConfig._sameHostApiFallbackTried = true;
        originalConfig.url = `${SAME_HOST_API_BASE_URL}${originalConfig.url.slice(API_BASE_URL.length)}`;

        return axios(originalConfig);
    }
);
