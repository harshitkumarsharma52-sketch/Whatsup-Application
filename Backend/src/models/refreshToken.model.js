const mongoose = require('mongoose');
const crypto = require('crypto');

const refreshTokenSchema = new mongoose.Schema(
  {
    tokenHash: {
      type: String,
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    deviceInfo: {
      type: String,
      default: 'Unknown Device',
    },
    ipAddress: {
      type: String,
      default: 'Unknown IP',
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }, // TTL index
    },
    isRevoked: {
      type: Boolean,
      default: false,
      index: true,
    },
    revokedAt: {
      type: Date,
      default: null,
    },
    revokedReason: {
      type: String,
      default: null,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: false,
  }
);

// Hash helper
refreshTokenSchema.statics.hashToken = function (token) {
  return crypto.createHash('sha256').update(token).digest('hex');
};

// Static method: Create and save a refresh token record
refreshTokenSchema.statics.createToken = async function (
  userId,
  rawToken,
  deviceInfo = 'Unknown Device',
  ipAddress = 'Unknown IP',
  expiresAtDate
) {
  const tokenHash = this.hashToken(rawToken);
  return this.create({
    tokenHash,
    userId,
    deviceInfo,
    ipAddress,
    expiresAt: expiresAtDate,
    isRevoked: false,
  });
};

// Static method: Find a non-revoked, non-expired token by raw token string
refreshTokenSchema.statics.findValidToken = async function (rawToken) {
  if (!rawToken) return null;
  const tokenHash = this.hashToken(rawToken);
  return this.findOne({
    tokenHash,
    isRevoked: false,
    expiresAt: { $gt: new Date() },
  });
};

// Static method: Find token regardless of revocation (for reuse detection)
refreshTokenSchema.statics.findByToken = async function (rawToken) {
  if (!rawToken) return null;
  const tokenHash = this.hashToken(rawToken);
  return this.findOne({ tokenHash });
};

// Instance method: Revoke the token
refreshTokenSchema.methods.revoke = async function (reason = 'Manual revocation') {
  this.isRevoked = true;
  this.revokedAt = new Date();
  this.revokedReason = reason;
  return this.save();
};

const RefreshToken = mongoose.model('RefreshToken', refreshTokenSchema);

module.exports = RefreshToken;
