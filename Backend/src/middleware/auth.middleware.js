const jwt = require('jsonwebtoken');

/**
 * Authenticates requests using a Bearer JWT in the Authorization header.
 * Enforces algorithm HS256 to prevent algorithm confusion attacks.
 */
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Authentication token is required',
      code: 'AUTH_TOKEN_MISSING',
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET, {
      algorithms: ['HS256'],
    });

    req.user = {
      id: decoded.id,
      email: decoded.email,
    };

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Access token has expired',
        code: 'TOKEN_EXPIRED',
      });
    }

    return res.status(401).json({
      success: false,
      message: 'Invalid access token',
      code: 'INVALID_TOKEN',
    });
  }
};

/**
 * Optional authentication middleware.
 * Attaches req.user if a valid token is provided, but does not block requests if absent.
 */
const authenticateOptional = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET, {
      algorithms: ['HS256'],
    });

    req.user = {
      id: decoded.id,
      email: decoded.email,
    };
  } catch {
    req.user = null;
  }

  next();
};

/**
 * Middleware factory for IDOR prevention.
 * Compares authenticated req.user.id with the resource owner's ID extracted by getter function.
 * @param {Function} getResourceUserId - Function extracting user ID from req (e.g. req => req.params.userId)
 */
const requireOwnership = (getResourceUserId) => {
  return (req, res, next) => {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
    }

    try {
      const resourceUserId = getResourceUserId(req);
      if (!resourceUserId || req.user.id !== resourceUserId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: You do not have permission for this resource',
          code: 'FORBIDDEN',
        });
      }
      next();
    } catch (err) {
      next(err);
    }
  };
};

module.exports = {
  authenticateToken,
  authenticateOptional,
  requireOwnership,
};
