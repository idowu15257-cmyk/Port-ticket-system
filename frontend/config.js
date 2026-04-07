(() => {
  const storedApiUrl = localStorage.getItem('ticketmaster_api_url');
  const defaultApiUrl = 'http://localhost:5000/api';

  window.APP_CONFIG = {
    API_BASE_URL: storedApiUrl || defaultApiUrl
  };

  window.setApiBaseUrl = (url) => {
    if (!url || typeof url !== 'string') {
      throw new Error('API URL is required.');
    }

    const trimmed = url.trim().replace(/\/$/, '');
    if (!/^https?:\/\//i.test(trimmed)) {
      throw new Error('API URL must start with http:// or https://');
    }

    localStorage.setItem('ticketmaster_api_url', trimmed);
    window.APP_CONFIG.API_BASE_URL = trimmed;
    return trimmed;
  };
})();
