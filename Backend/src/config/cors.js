const configuredOrigins = (process.env.CLIENT_ORIGINS || process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const isPrivateDevelopmentOrigin = (origin) => {
  if (process.env.NODE_ENV === 'production') return false;

  try {
    const { protocol, hostname, port } = new URL(origin);
    if (protocol !== 'http:' || port !== '5173') return false;

    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      /^10\./.test(hostname) ||
      /^192\.168\./.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)
    );
  } catch {
    return false;
  }
};

const isAllowedOrigin = (origin) =>
  !origin || configuredOrigins.includes(origin) || isPrivateDevelopmentOrigin(origin);

module.exports = { configuredOrigins, isAllowedOrigin };
