# ChatApp — Real-Time WhatsApp-Like Messaging Application

A production-style, full-stack real-time chat application built with the MERN stack (MongoDB, Express, React, Node.js) and Socket.IO.

---

## Features

### Authentication
- User registration & login with JWT
- Refresh token rotation with reuse detection
- HTTP-only secure cookie session management
- Password hashing with bcryptjs (cost factor 12)
- Brute-force protection (5 attempts → 15-minute lockout)
- Change password (invalidates all sessions)
- Persistent login after page refresh

### Messaging
- One-to-one private messaging
- Group chat (create, manage, leave)
- Real-time delivery via Socket.IO
- Typing indicators
- Message status: sent → delivered → read (WhatsApp-style ticks)
- Reply to messages
- Edit text messages
- Delete messages (for me / for everyone)
- Emoji reactions
- Message pagination (cursor-based, load older messages)

### Media
- Image messages (JPG, JPEG, PNG, WEBP)
- Video messages (MP4, MOV, WEBM)
- Audio messages (MP3, WAV, OGG)
- Document sharing (PDF)
- Upload progress indicator
- Full-screen media preview / lightbox
- Media stored securely in ImageKit CDN
- Magic bytes validation on server

### Groups
- Create group with name and picture
- Add / remove participants
- Multiple admins
- Group description
- Leave group

### User System
- Search users by username or email
- Block / unblock users
- Online indicator & last seen
- Profile picture and bio
- Recent conversations list

### UI / UX
- WhatsApp-inspired design with original branding
- Light and dark theme
- Fully responsive (desktop two-panel + mobile single-panel)
- Loading skeletons
- Empty states
- Toast notifications
- Smooth transitions

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, Tailwind CSS |
| Backend | Node.js, Express.js |
| Database | MongoDB (Mongoose) |
| Real-time | Socket.IO |
| Auth | JWT + HTTP-only cookies |
| Media | ImageKit CDN |
| State | React Context + hooks |

---

## Project Structure

```
chat-application/
├── Backend/
│   ├── src/
│   │   ├── config/          # DB and ImageKit config
│   │   ├── controllers/     # Route handlers
│   │   ├── middleware/      # Auth, upload, error middleware
│   │   ├── models/          # Mongoose models
│   │   ├── routes/          # Express routers
│   │   ├── services/        # ImageKit, Socket services
│   │   ├── sockets/         # Socket.IO event handlers
│   │   ├── app.js           # Express app setup
│   │   └── server.js        # HTTP server entry point
│   ├── .env.example
│   └── package.json
└── Frontend/
    ├── src/
    │   ├── components/      # Reusable UI components
    │   ├── context/         # React contexts
    │   ├── hooks/           # Custom React hooks
    │   ├── pages/           # Page components
    │   ├── services/        # API and socket services
    │   ├── utils/           # Utilities and helpers
    │   ├── App.jsx
    │   └── main.jsx
    ├── .env.example
    └── package.json
```

---

## Prerequisites

- **Node.js** v18 or later — [nodejs.org](https://nodejs.org)
- **MongoDB Atlas** (free tier) — [mongodb.com/atlas](https://www.mongodb.com/atlas)
- **ImageKit** account (free tier) — [imagekit.io](https://imagekit.io)

---

## Installation & Setup

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd chat-application
```

### 2. Backend Setup

```bash
cd Backend
npm install
cp .env.example .env
```

Edit `.env` with your credentials:

```env
PORT=5000
MONGODB_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/chatapp
JWT_ACCESS_SECRET=<generate with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))">
JWT_REFRESH_SECRET=<generate separately>
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
IMAGEKIT_PUBLIC_KEY=<from ImageKit dashboard>
IMAGEKIT_PRIVATE_KEY=<from ImageKit dashboard>
IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/<your_imagekit_id>
CLIENT_URL=http://localhost:5173
NODE_ENV=development
```

Start the backend:
```bash
npm run dev
```

The backend runs on **http://localhost:5000**

### 3. Frontend Setup

```bash
cd Frontend
npm install
cp .env.example .env
```

Edit `.env`:
```env
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
```

Start the frontend:
```bash
npm run dev
```

The frontend runs on **http://localhost:5173**

---

## Getting Credentials

### MongoDB Atlas
1. Go to [mongodb.com/atlas](https://www.mongodb.com/atlas) → Create free cluster
2. Create a database user with read/write access
3. Add your IP to the IP Access List (or use `0.0.0.0/0` for development)
4. Click **Connect** → **Drivers** → Copy the connection string
5. Replace `<username>` and `<password>` with your DB user credentials

### ImageKit
1. Go to [imagekit.io](https://imagekit.io) → Create free account
2. Dashboard → Developer Options → API Keys
3. Copy **Public Key**, **Private Key**, and **URL Endpoint**

---

## API Reference

### Authentication
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/auth/register` | Register new user | No |
| POST | `/api/auth/login` | Login | No |
| POST | `/api/auth/logout` | Logout | Yes |
| POST | `/api/auth/refresh` | Refresh access token | No (cookie) |
| GET | `/api/auth/me` | Get current user | Yes |

### Users
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/users/search?q=john` | Search users | Yes |
| GET | `/api/users/:id` | Get user profile | Yes |
| PUT | `/api/users/profile` | Update profile | Yes |
| PUT | `/api/users/change-password` | Change password | Yes |

### Conversations
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/conversations` | Create or get private chat | Yes |
| GET | `/api/conversations` | List conversations | Yes |
| GET | `/api/conversations/:id` | Get conversation | Yes |

### Messages
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/messages` | Send message | Yes |
| GET | `/api/messages/:conversationId` | Get messages | Yes |
| PUT | `/api/messages/:id` | Edit message | Yes |
| DELETE | `/api/messages/:id` | Delete message | Yes |
| POST | `/api/messages/:id/reactions` | Add reaction | Yes |
| POST | `/api/messages/:id/read` | Mark as read | Yes |

### Media
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/media/upload` | Upload file | Yes |
| DELETE | `/api/media/:fileId` | Delete file | Yes |

### Groups
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/groups` | Create group | Yes |
| PUT | `/api/groups/:id` | Update group | Admin |
| POST | `/api/groups/:id/members` | Add members | Admin |
| DELETE | `/api/groups/:id/members/:userId` | Remove member | Admin |
| POST | `/api/groups/:id/leave` | Leave group | Yes |

---

## Socket.IO Events

### Client → Server
| Event | Payload | Description |
|-------|---------|-------------|
| `message:send` | `{ conversationId, text?, mediaId?, messageType, replyTo?, idempotencyKey }` | Send a message |
| `message:read` | `{ conversationId, messageId }` | Mark messages as read |
| `message:delete` | `{ messageId, deleteFor }` | Delete message |
| `message:edit` | `{ messageId, text }` | Edit message |
| `typing:start` | `{ conversationId }` | Start typing |
| `typing:stop` | `{ conversationId }` | Stop typing |

### Server → Client
| Event | Payload | Description |
|-------|---------|-------------|
| `message:new` | Message object | New message received |
| `message:delivered` | `{ messageId, conversationId }` | Message delivered |
| `message:read` | `{ messageId, conversationId, readAt }` | Message read |
| `message:deleted` | `{ messageId, conversationId }` | Message deleted |
| `message:edited` | Message object | Message edited |
| `typing:start` | `{ userId, conversationId }` | User started typing |
| `typing:stop` | `{ userId, conversationId }` | User stopped typing |
| `user:online` | `{ userId }` | User came online |
| `user:offline` | `{ userId, lastSeen }` | User went offline |

---

## Postman Testing

### Setup
1. Import the following collection or create requests manually
2. Set base URL variable: `{{baseUrl}}` = `http://localhost:5000`
3. Set `Content-Type: application/json` header

### Test Flow
```
1. Register user 1: POST /api/auth/register
2. Register user 2: POST /api/auth/register
3. Login user 1: POST /api/auth/login → save access token
4. Set Authorization: Bearer <access_token>
5. Create conversation: POST /api/conversations { "recipientId": "<user2_id>" }
6. Send message: POST /api/messages { "conversationId": "...", "text": "Hello!" }
7. Upload media: POST /api/media/upload (multipart/form-data, field: "file")
8. Send image message: POST /api/messages { "conversationId": "...", "messageType": "image", "mediaId": "..." }
9. Test refresh: POST /api/auth/refresh (uses cookie automatically)
10. Logout: POST /api/auth/logout
```

---

## Development Notes

### Security Considerations
- Messages are **not** end-to-end encrypted. They are protected in transit via HTTPS/WSS (TLS).
- Access tokens are stored in memory (not localStorage) and refreshed automatically.
- Refresh tokens are stored as hashed values in MongoDB via HTTP-only cookies.
- All file uploads are validated by MIME type and magic bytes server-side.

### Production Deployment
Before going to production:
1. Set `NODE_ENV=production`
2. Use HTTPS and configure `Secure` cookie flag
3. Set a strong `CLIENT_URL` (your actual domain)
4. Use MongoDB Atlas with IP restrictions
5. Configure proper CORS origins
6. See `SECURITY.md` for the full checklist

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

---

## License

MIT License — See [LICENSE](LICENSE) for details.

#   W h a t s u p - A p p l i c a t i o n  
 