const isLoopbackHost = (host) =>
  host === 'localhost' || host === '127.0.0.1' || host === '::1';

/**
 * While developing on a phone, `localhost` points to the phone rather than
 * the computer running the API. Keep the configured port/path, but use the
 * host from the page that the phone actually opened.
 *
 * Explicit non-local API URLs (the normal production setup) are never changed.
 */
const replaceLoopbackHostForRemoteDevice = (url) => {
  if (typeof window === 'undefined') return url;

  try {
    const parsedUrl = new URL(url);
    const pageHost = window.location.hostname;

    if (isLoopbackHost(parsedUrl.hostname) && !isLoopbackHost(pageHost)) {
      parsedUrl.hostname = pageHost;
      return parsedUrl.toString().replace(/\/$/, '');
    }
  } catch {
    // A relative API URL does not need changing.
  }

  return url;
};

const configuredApiUrl = import.meta.env.VITE_API_URL || '/api';

export const API_URL = replaceLoopbackHostForRemoteDevice(configuredApiUrl);

export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL
  ? replaceLoopbackHostForRemoteDevice(import.meta.env.VITE_SOCKET_URL)
  : API_URL.startsWith('http')
    ? API_URL.replace(/\/api\/?$/, '')
    : window.location.origin;
