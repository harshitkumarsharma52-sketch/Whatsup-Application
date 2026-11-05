# Initial application audit

## Bugs and security issues found before changes

- **Real-time event contract is inconsistent.** The backend emits `message:new`, `message:deleted`, and `message:edited`; the socket context forwards `message:new` but listens for the different names `message:delete` and `message:edit`. Socket room joins are asynchronous, so a message can be sent before the connection joins its conversation rooms.
- **Socket auth and lifecycle can use stale credentials.** `initSocket` returns an already-connected socket without updating its auth token. The HTTP refresh interceptor updates only the axios token, so a reconnect can authenticate using an expired socket token. Socket listeners in the context are tied to subscriptions rather than a stable, explicit event contract.
- **Delivery/read receipts are incomplete.** REST message creation emits a new message but never a delivered status, while read paths do not consistently update unread state or notify the right active tabs. The frontend send operation uses REST, so socket acknowledgements and retry state are not integrated.
- **Conversation and unread updates are fragile.** The sidebar reads `unreadCount`, while the database stores per-user counts in `unreadCounts`; a newly created conversation is emitted only to the recipient and the client refetch behavior can run inside a state updater.
- **Authorization and input validation have gaps.** Idempotency keys are queried globally instead of being scoped to sender/conversation; socket typing handlers do not verify room membership; user supplied media metadata/URLs and message text need stronger server-side validation. A message request can carry media fields inconsistent with its declared type.
- **Refresh-token rotation is race-prone.** Concurrent refresh requests can both pass the revoked check before rotation completes. Logout only revokes one supplied refresh token and is unauthenticated, and refresh token requests accept body tokens in addition to the cookie.
- **Media handling has cleanup and validation gaps.** Upload size ceilings are not enforced consistently by category before buffering; errors are returned directly rather than through the central handler, MIME signatures do not cover every accepted type, and failed upload persistence can leave remote media orphaned.
- **Backend configuration is incomplete.** CORS reads one `CLIENT_URL` instead of an origins list; there is no `trust proxy` setting for Render; startup logs and process handlers use console; and package scripts provide no lint/build checks. Error handling has inconsistent direct responses and validation returns submitted values.
- **Frontend state and API behavior have defects.** Session restoration falls back to `/auth/me` after refresh failure (which cannot restore a missing token); retry queue requests can retain stale headers; socket connection errors/logs are unhandled for users; optimistic messages can be mistaken for server messages; read receipts and deletes use inconsistent event names.
- **Several UI actions are incomplete or inaccessible.** Clear chat only displays a success toast without calling the API; hover-only message actions are hard to use on touch/keyboard; profile/avatar fields use inconsistent backend names; old-message pagination can jump the scroll position; message list keys fall back to array indexes; responsive layout lacks keyboard/safe-area handling.
- **Code quality and verification gaps.** Multiple screens/components contain repeated patterns and stale/commented-out UI code, console logging, and direct empty catches. Frontend has no lint script and the requested real two-user/network/mobile checks require running services and valid MongoDB/ImageKit credentials.

## Fix order

1. Establish one authenticated Socket.IO event contract and repair real-time message, presence, typing, receipts, delete, conversation, and unread updates.
2. Close security and data consistency gaps in auth, authorization, validation, upload handling, CORS, and deployment config.
3. Repair frontend session/socket lifecycle, optimistic state, unread updates, and incomplete interactions.
4. Run the available build/check commands and document any checks that require external credentials or manual browser testing.

## Fixes applied and remaining verification

- Standardized message delivery on `newMessage`; authenticated sockets join per-user and conversation rooms, and REST/socket message writes notify every participant tab. Added delivered/read, delete/edit, conversation, unread, typing timeout, and reconnect fetch handling.
- Updated socket auth after refresh, made refresh requests single-flight, made token rotation atomic, restricted refresh tokens to the httpOnly cookie, and scoped message idempotency by sender and conversation.
- Added membership checks to typing/edit paths, per-user unread updates, profile/group payload alignment, real microphone recording, safe-area/reduced-motion/focus styling, and preserved scroll position while loading older messages. Fixed clear chat to call its API and added failed-message retry.
- Configured comma-separated CORS origins, Render proxy trust, and corrected validation output to avoid echoing submitted values. Added a partial unique idempotency index and audio/webm upload validation.
- Frontend production build and backend JavaScript syntax checks pass. Both packages lack a lint script/config. Two-user live messaging, network reconnect, refresh-cookie behavior against MongoDB, and browser-size checks still require running credentials/services and browser sessions; these were not exercised here.
