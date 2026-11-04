# Security Architecture — ChatApp

## Overview

ChatApp implements defense-in-depth security across all layers: authentication, authorization, API, database, media, real-time communication, and frontend.

> **Important**: ChatApp messages are **protected in transit** via HTTPS/WSS (TLS). Messages are **not** end-to-end encrypted at the application layer. The server can read message content. This is clearly stated to users.

---

## 1. Authentication Architecture

### Password Security
- Passwords hashed with **bcryptjs** at cost factor **12**
- Passwords never stored in plain text
- Password field excluded from all queries by default (`select: false`)
- Password never returned in API responses

### JWT Token Lifecycle

```
Login
  ↓
Generate access token (15 min, HS256) + refresh token (7 days)
  ↓
Store HASHED refresh token in MongoDB
Set HTTP-only cookie with refresh token
Return access token in response body (stored in memory, never localStorage)
  ↓
On API call: attach access token in Authorization header
  ↓
On 401: axios interceptor auto-calls /auth/refresh
  ↓
/auth/refresh:
  - Read token from cookie
  - Hash it and find in DB (must be non-revoked, non-expired)
  - Verify JWT signature
  - Revoke old token (rotation)
  - Issue new access + refresh tokens
  ↓
On logout: revoke refresh token, clear cookie
```

### Refresh Token Security
- Stored only as SHA-256 hash in MongoDB
- TTL index auto-deletes expired tokens
- Rotation: every refresh issues a new token and revokes the old one
- **Reuse detection**: if a revoked token is used, ALL user tokens are revoked immediately
- Revocation reason logged (logout, password-change, reuse-detected, admin-revoke)

### Brute-Force Protection
- 5 failed login attempts → account locked for 15 minutes
- Login errors are **generic** ("Invalid credentials") — no account enumeration
- Rate limit: 10 requests per 15-minute window on `/auth/login` and `/auth/register`

### Session Management
- Track active refresh tokens per user (device info, IP, created at)
- Password change → revoke ALL refresh tokens (all sessions)
- Logout → revoke single refresh token

---

## 2. Cookie Configuration

```javascript
// Development
{
  httpOnly: true,
  secure: false,          // HTTP allowed in dev
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000  // 7 days
}

// Production
{
  httpOnly: true,
  secure: true,           // HTTPS only
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000  // 7 days
}
```

---

## 3. API Security

### Helmet Configuration
- `Content-Security-Policy`: restrict scripts, styles, media sources
- `X-Frame-Options: DENY` (clickjacking protection)
- `X-Content-Type-Options: nosniff`
- `Strict-Transport-Security` (HSTS, production only)
- `Referrer-Policy: no-referrer`

### Rate Limiting (separate limits per endpoint group)
| Route Group | Limit | Window |
|-------------|-------|--------|
| Auth (login/register) | 10 req | 15 min |
| Password reset | 5 req | 1 hour |
| Media upload | 30 req | 1 hour |
| General API | 200 req | 15 min |
| Messaging (REST) | 100 req | 1 min |

### Input Validation
- express-validator on all routes
- Zod-style schema validation where applicable
- Request body size limit: 10 KB for JSON, 100 MB for uploads
- Unexpected fields rejected (strict schema)
- Content-Type validation on all POST/PUT endpoints

### MongoDB Security
- express-mongo-sanitize prevents `$` and `.` injection in request data
- hpp prevents HTTP parameter pollution
- Mongoose schema types enforce data integrity
- Unique indexes on email and username

---

## 4. Authorization Rules

| Action | Rule |
|--------|------|
| Read messages | Must be participant of conversation (verified in DB) |
| Send message | Sender set from `req.user.id` (JWT), never from request body |
| Edit message | Must be message sender |
| Delete message | Must be message sender |
| Update group | Must be group admin |
| Add/remove members | Must be group admin |
| Delete media | Must own the message containing the media |
| View user profile | Only public fields (no email for others) |

**IDOR Prevention**: All resource lookups verify ownership/membership using the authenticated user ID from the JWT, never from client-supplied parameters.

---

## 5. Socket.IO Security

### Connection Authentication
```javascript
// Every socket connection requires JWT in handshake
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('Unauthorized'));
  
  const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET, {
    algorithms: ['HS256']  // prevent algorithm confusion
  });
  socket.userId = decoded.id;
  next();
});
```

### Event-Level Security
- Conversation membership verified before joining rooms
- Message sender set to authenticated socket.userId (never from event payload)
- Idempotency keys prevent duplicate messages on reconnect
- Max 60 messages per minute per socket (rate limiting)
- Event payload size limit: 10 KB for text, metadata only for media
- Expired tokens → socket disconnected

---

## 6. File Upload Security

### Validation Pipeline
```
Client uploads file
  ↓
Multer: Check MIME type against allowlist
  ↓
Multer: Check file size limit
  ↓
Controller: Read first 16 bytes → validate magic bytes
  ↓
Controller: Generate UUID filename (never use client filename)
  ↓
ImageKit: Upload to CDN
  ↓
Return URL and metadata
```

### Magic Bytes Validation
| Format | Magic Bytes |
|--------|-------------|
| JPEG | `FF D8 FF` |
| PNG | `89 50 4E 47` |
| PDF | `25 50 44 46` |
| MP4 | Various (ftyp box detection) |
| WebM | `1A 45 DF A3` |

### File Size Limits
| Type | Max Size |
|------|---------|
| Images | 10 MB |
| Videos | 100 MB |
| Audio | 20 MB |
| Documents | 25 MB |

### Additional Upload Rules
- ImageKit private key **never** sent to frontend
- Server generates unique filenames using UUID
- No executable files allowed
- Path traversal prevented (server-controlled paths)
- Orphaned uploads cleaned up if DB save fails
- Media ownership verified before deletion

---

## 7. Frontend Security

- Access tokens stored **in memory only** (module-level variable in api.js)
- **Never** in localStorage or sessionStorage (XSS risk)
- HTTP-only cookies hold refresh tokens (inaccessible to JavaScript)
- All user-generated content sanitized with DOMPurify before rendering
- No `dangerouslySetInnerHTML` without DOMPurify
- Axios `withCredentials: true` for cookie attachment
- Route guards are **UX-only** — backend enforces all authorization
- No sensitive data logged to browser console in production

---

## 8. Database Security

- Passwords excluded from all queries (`select: false`)
- Refresh tokens stored as hashes only
- Mongoose schema validation on all models
- Unique indexes prevent duplicate accounts
- TLS connection to MongoDB Atlas (enforced by Atlas)
- Connection string in environment variables only
- `.env` files in `.gitignore`
- Least-privilege DB user (read/write to chatapp database only)

---

## 9. Error Handling

```json
// All errors follow this format
{
  "success": false,
  "message": "Human-readable message",
  "code": "ERROR_CODE",
  "errors": []  // validation errors only
}
```

- Stack traces **never** exposed in production
- Generic error messages for auth failures (no info leakage)
- Different HTTP status codes used correctly
- Internal errors logged server-side, not in response

---

## 10. Logging

### Logged (structured JSON)
- Failed login attempts (email, IP, timestamp)
- Successful logins (userId, IP, device)
- Password changes (userId, timestamp)
- Refresh token reuse detection (userId, IP)
- Session revocations (userId, reason)
- Unauthorized API access (endpoint, userId, IP)
- Socket authentication failures (IP)
- Rate limit violations (IP, endpoint)
- File upload errors (userId, fileName, error)

### Never Logged
- Plain-text passwords
- Access tokens
- Refresh tokens
- Private encryption keys
- Full private message content

---

## 11. Environment Variables

| Variable | Purpose | Required |
|----------|---------|---------|
| `MONGODB_URI` | Database connection string | Yes |
| `JWT_ACCESS_SECRET` | Sign access tokens (min 64 chars random) | Yes |
| `JWT_REFRESH_SECRET` | Sign refresh tokens (min 64 chars random) | Yes |
| `JWT_ACCESS_EXPIRES_IN` | Access token TTL (e.g., `15m`) | Yes |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token TTL (e.g., `7d`) | Yes |
| `IMAGEKIT_PRIVATE_KEY` | ImageKit server-side upload | Yes |
| `IMAGEKIT_PUBLIC_KEY` | ImageKit client init | Yes |
| `IMAGEKIT_URL_ENDPOINT` | ImageKit CDN URL | Yes |
| `CLIENT_URL` | CORS allowed origin | Yes |
| `NODE_ENV` | `development` or `production` | Yes |
| `PORT` | Server port | Yes |

Generate secrets:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

## 12. Production Security Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Use HTTPS with valid TLS certificate (Let's Encrypt / Cloudflare)
- [ ] Set `secure: true` on cookies
- [ ] Configure strict CORS origin (your actual domain)
- [ ] Enable HSTS headers
- [ ] MongoDB Atlas: restrict IP access to server IPs only
- [ ] Use MongoDB Atlas audit logging
- [ ] Rotate JWT secrets periodically
- [ ] Set up log aggregation (e.g., Datadog, Logtail)
- [ ] Configure uptime monitoring
- [ ] Set up rate limiting alerts
- [ ] Review ImageKit usage limits
- [ ] Enable CDN caching for static assets
- [ ] Configure error tracking (e.g., Sentry)

---

## 13. Known Limitations

1. **No E2E Encryption**: Messages are readable by the server. Transport-layer encryption (TLS) is used.
2. **No TOTP/MFA**: Two-factor authentication is not implemented.
3. **No Email Verification**: Email addresses are not verified on registration.
4. **No Push Notifications**: Background push notifications require additional infrastructure (FCM/APNs).
5. **Voice/Video Calls**: UI placeholders exist but actual WebRTC calling infrastructure is not configured.

---

## 14. Security Testing Commands

```bash
# Test brute force protection (should be locked after 5 attempts)
for i in {1..6}; do
  curl -X POST http://localhost:5000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com","password":"wrong"}'
done

# Test unauthorized access (should return 401)
curl http://localhost:5000/api/conversations

# Test expired token (should return 401 with TOKEN_EXPIRED code)
curl -H "Authorization: Bearer eyJ..." http://localhost:5000/api/conversations

# Test NoSQL injection (should be sanitized)
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": {"$gt": ""}, "password": "anything"}'

# Test oversized upload (should return 413)
dd if=/dev/urandom bs=1M count=200 | curl -X POST \
  http://localhost:5000/api/media/upload \
  -H "Authorization: Bearer <token>" \
  -F "file=@/dev/stdin"
```

---

## 15. Recommended Next Security Improvements

1. **Email Verification** — Verify email addresses before enabling account
2. **TOTP/MFA** — Implement 2FA using TOTP (Google Authenticator compatible)
3. **E2E Encryption** — Implement Signal Protocol using `@matrix-org/olm` or `libsodium`
4. **Device Trust** — Track and trust verified devices
5. **Audit Log UI** — Allow users to view their login history
6. **WebAuthn/Passkeys** — Support passwordless authentication
7. **Content Moderation** — AI-based content scanning for uploaded media
8. **IP Allowlisting** — Optional IP restriction per account
9. **Anomaly Detection** — ML-based suspicious login detection
10. **Security Headers Audit** — Regular automated scans with securityheaders.com

