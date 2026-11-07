const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const RefreshToken = require('../models/refreshToken.model');

// Parse expiration string or default
const parseExpiresInToMs = (str, defaultMs) => {
  if (!str) return defaultMs;
  const match = str.match(/^(\d+)([smhd])$/);
  if (!match) return defaultMs;
  const val = parseInt(match[1], 10);
  const unit = match[2];
  if (unit === 's') return val * 1000;
  if (unit === 'm') return val * 60 * 1000;
  if (unit === 'h') return val * 60 * 60 * 1000;
  if (unit === 'd') return val * 24 * 60 * 60 * 1000;
  return defaultMs;
};

// Persistent-login policy: access JWTs intentionally have no exp claim.
const ACCESS_EXPIRES_IN = null;
const REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
const REFRESH_EXPIRES_IN_MS = parseExpiresInToMs(REFRESH_EXPIRES_IN, 7 * 24 * 60 * 60 * 1000);
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// The frontend and API are hosted on separate Render domains. In browsers
// that block third-party cookies, a partitioned cookie is still sent when the
// user returns to this specific frontend. It is ignored safely by browsers
// that do not implement CHIPS yet.
const refreshCookieOptions = {
  httpOnly: true,
  secure: IS_PRODUCTION,
  sameSite: IS_PRODUCTION ? 'none' : 'lax',
  partitioned: IS_PRODUCTION,
  priority: 'high',
  path: '/api/auth',
};

/**
 * Generates an Access Token and a Refresh Token for a user.
 */
const generateTokens = (user) => {
  const payload = {
    id: user._id.toString(),
    email: user.email,
  };

  // A deliberately persistent device token. Logout is the revocation action;
  // do not add expiresIn unless you also change the client persistence policy.
  const accessToken = jwt.sign(
    payload,
    process.env.JWT_ACCESS_SECRET,
    ACCESS_EXPIRES_IN ? { expiresIn: ACCESS_EXPIRES_IN, algorithm: 'HS256' } : { algorithm: 'HS256' }
  );

  const refreshToken = jwt.sign({ id: user._id.toString() }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: REFRESH_EXPIRES_IN,
    algorithm: 'HS256',
  });

  return { accessToken, refreshToken };
};

/**
 * Sets the Refresh Token as a secure, HTTP-only cookie.
 */
const setRefreshCookie = (res, token) => {
  res.cookie('refreshToken', token, {
    ...refreshCookieOptions,
    maxAge: REFRESH_EXPIRES_IN_MS,
  });
};

/**
 * Clears the Refresh Token cookie.
 */
const clearRefreshCookie = (res) => {
  res.clearCookie('refreshToken', refreshCookieOptions);
};

/**
 * POST /api/auth/register
 * Registers a new user account.
 */
const register = async (req, res, next) => {
  try {
    const { username, email, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email: email.toLowerCase().trim() }, { username: username.trim() }],
    });

    if (existingUser) {
      if (existingUser.email === email.toLowerCase().trim()) {
        return res.status(409).json({
          success: false,
          message: 'An account with this email already exists',
          code: 'EMAIL_ALREADY_EXISTS',
        });
      }
      return res.status(409).json({
        success: false,
        message: 'Username is already taken',
        code: 'USERNAME_ALREADY_EXISTS',
      });
    }

    const newUser = await User.create({
      username: username.trim(),
      email: email.toLowerCase().trim(),
      password,
    });

    const { accessToken, refreshToken } = generateTokens(newUser);

    // Record refresh token in DB
    const expiresAt = new Date(Date.now() + REFRESH_EXPIRES_IN_MS);
    await RefreshToken.createToken(
      newUser._id,
      refreshToken,
      req.headers['user-agent'] || 'Unknown Device',
      req.ip || 'Unknown IP',
      expiresAt
    );

    setRefreshCookie(res, refreshToken);

    return res.status(201).json({
      success: true,
      message: 'Account created successfully',
      user: {
        id: newUser._id,
        username: newUser.username,
        email: newUser.email,
        profilePicture: newUser.profilePicture,
        avatar: newUser.avatar,
        bio: newUser.bio,
        isOnline: newUser.isOnline,
        lastSeen: newUser.lastSeen,
        createdAt: newUser.createdAt,
      },
      accessToken,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/login
 * Authenticates user credentials and issues tokens.
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findByCredentials(email, password);

    const { accessToken, refreshToken } = generateTokens(user);

    const expiresAt = new Date(Date.now() + REFRESH_EXPIRES_IN_MS);
    await RefreshToken.createToken(
      user._id,
      refreshToken,
      req.headers['user-agent'] || 'Unknown Device',
      req.ip || 'Unknown IP',
      expiresAt
    );

    setRefreshCookie(res, refreshToken);

    return res.status(200).json({
      success: true,
      message: 'Logged in successfully',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        profilePicture: user.profilePicture,
        avatar: user.avatar,
        bio: user.bio,
        isOnline: user.isOnline,
        lastSeen: user.lastSeen,
        createdAt: user.createdAt,
      },
      accessToken,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/logout
 * Revokes refresh token and clears cookie.
 */
const logout = async (req, res, next) => {
  try {
    const token = req.cookies?.refreshToken;

    if (token) {
      const tokenDoc = await RefreshToken.findByToken(token);
      if (tokenDoc && !tokenDoc.isRevoked) {
        await tokenDoc.revoke('User logout');
      }
    }

    clearRefreshCookie(res);

    return res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/refresh
 * Validates refresh token, detects reuse, and performs token rotation.
 */
const refresh = async (req, res, next) => {
  try {
    const token = req.cookies?.refreshToken;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token is required',
        code: 'REFRESH_TOKEN_MISSING',
      });
    }

    // First find if the token exists in DB (even if revoked)
    const storedToken = await RefreshToken.findByToken(token);

    if (!storedToken) {
      clearRefreshCookie(res);
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token',
        code: 'INVALID_REFRESH_TOKEN',
      });
    }

    // Token reuse detection: if token is already revoked, an attacker may be reusing it!
    if (storedToken.isRevoked) {
      // Invalidate all tokens for this user for security
      await RefreshToken.updateMany(
        { userId: storedToken.userId },
        {
          $set: {
            isRevoked: true,
            revokedAt: new Date(),
            revokedReason: 'Token reuse attempt detected',
          },
        }
      );

      clearRefreshCookie(res);

      return res.status(403).json({
        success: false,
        message: 'Security alert: Refresh token reuse detected. All sessions have been terminated. Please log in again.',
        code: 'TOKEN_REUSE_DETECTED',
      });
    }

    // Check expiration
    if (storedToken.expiresAt < new Date()) {
      clearRefreshCookie(res);
      return res.status(401).json({
        success: false,
        message: 'Refresh token has expired',
        code: 'REFRESH_TOKEN_EXPIRED',
      });
    }

    // Verify JWT cryptographic signature
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET, {
        algorithms: ['HS256'],
      });
    } catch {
      await storedToken.revoke('JWT verification failed');
      clearRefreshCookie(res);
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token signature',
        code: 'INVALID_REFRESH_TOKEN',
      });
    }

    const user = await User.findById(decoded.id);
    if (!user) {
      await storedToken.revoke('User not found');
      clearRefreshCookie(res);
      return res.status(401).json({
        success: false,
        message: 'User no longer exists',
        code: 'USER_NOT_FOUND',
      });
    }

    // Atomic rotation prevents two concurrent refreshes from issuing valid pairs.
    const rotatedToken = await RefreshToken.findOneAndUpdate(
      { _id: storedToken._id, isRevoked: false },
      { $set: { isRevoked: true, revokedAt: new Date(), revokedReason: 'Rotated on refresh' } },
      { new: true }
    );
    if (!rotatedToken) {
      clearRefreshCookie(res);
      return res.status(401).json({
        success: false,
        message: 'Refresh token has already been used',
        code: 'REFRESH_TOKEN_REUSED',
      });
    }

    // Issue new pair
    const { accessToken, refreshToken: newRefreshToken } = generateTokens(user);

    // Save new refresh token
    const newExpiresAt = new Date(Date.now() + REFRESH_EXPIRES_IN_MS);
    await RefreshToken.createToken(
      user._id,
      newRefreshToken,
      req.headers['user-agent'] || storedToken.deviceInfo,
      req.ip || storedToken.ipAddress,
      newExpiresAt
    );

    setRefreshCookie(res, newRefreshToken);

    return res.status(200).json({
      success: true,
      message: 'Tokens refreshed successfully',
      accessToken,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/auth/me
 * Retrieves current authenticated user profile.
 */
const me = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        code: 'USER_NOT_FOUND',
      });
    }

    return res.status(200).json({
      success: true,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        profilePicture: user.profilePicture,
        avatar: user.avatar,
        bio: user.bio,
        isOnline: user.isOnline,
        lastSeen: user.lastSeen,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

/** PUT /api/avatar - stores a 256px client-compressed JPEG data URL. */
const updateAvatar = async (req, res, next) => {
  try {
    const avatar = req.body?.avatar;
    if (avatar !== '' && (typeof avatar !== 'string' || !/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(avatar))) {
      return res.status(400).json({ success: false, message: 'Avatar must be a JPEG data URL', code: 'INVALID_AVATAR' });
    }
    const bytes = avatar ? Buffer.from(avatar.split(',')[1], 'base64').length : 0;
    if (bytes > 150 * 1024) {
      return res.status(413).json({ success: false, message: 'Avatar must be 150KB or smaller', code: 'AVATAR_TOO_LARGE' });
    }
    const user = await User.findByIdAndUpdate(req.user.id, { avatar }, { new: true });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    // Any connected contact can update their cached avatar immediately.
    try { require('../services/socket.service').getIO().emit('user:avatar', { userId: user._id.toString(), avatar }); } catch {}
    return res.json({ success: true, user: { id: user._id, username: user.username, email: user.email, avatar: user.avatar, profilePicture: user.profilePicture } });
  } catch (error) { next(error); }
};

module.exports = {
  register,
  login,
  logout,
  refresh,
  me,
  generateTokens,
  setRefreshCookie,
  clearRefreshCookie,
  updateAvatar,
};
