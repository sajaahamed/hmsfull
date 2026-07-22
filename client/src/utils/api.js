import axios from 'axios';

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
