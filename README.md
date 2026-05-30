<div align="center">

```
A:\> KLICKS_SERVER_V2.EXE█
LOADING MODULES...
config/env.js        ✓
config/cors.js       ✓
services/roomService ✓
sockets/handlers     ✓
middlewares          ✓
routes               ✓
```

# ⚙️ Klicks — Backend `v2`

### *Now with actual folder structure. We grew up. Slightly.*

[![Node.js](https://img.shields.io/badge/Runtime-Node.js-339933?style=flat-square&logo=nodedotjs)](https://nodejs.org)
[![Express 5](https://img.shields.io/badge/Express-v5-black?style=flat-square)](https://expressjs.com)
[![Socket.io](https://img.shields.io/badge/Realtime-Socket.io%20v4-white?style=flat-square)](https://socket.io)
[![Helmet](https://img.shields.io/badge/Security-Helmet%20%F0%9F%AA%96-blue?style=flat-square)](https://helmetjs.github.io)
[![No Database](https://img.shields.io/badge/Database-Still%20No-red?style=flat-square)](.)
[![Files Stored](https://img.shields.io/badge/Files%20Stored-Absolutely%20Zero-brightgreen?style=flat-square)](.)

</div>

---

## 🆕 What Changed From v1

The old backend was a single `server.js` doing everything — routing, socket logic, room management, ICE config, all jammed together. It worked. It was also a mild disaster to read after 11pm.

v2 splits everything into proper layers. Same behavior, much less suffering when reading the code.

| Old (v1) | New (v2) | Why |
|---|---|---|
| Everything in `server.js` | Split into `config/`, `services/`, `sockets/`, `middlewares/`, `routes/` | Maintainability |
| `room-manager.js` class | `services/roomService.js` singleton | Single instance, no manual instantiation |
| CORS hardcoded as `*` | `config/cors.js` — strict in prod, open in dev | Security |
| Rate limiting in `.env` but never applied | `middlewares/rateLimiter.js` actually wired up | Abuse protection |
| ICE servers inline in server.js | `config/env.js` builds `ICE_SERVERS` array | Centralised config |
| Signals broadcast to entire room | `signalHandler.js` with `targetPeerId` + `ensureSameRoom()` | Mesh-ready, no cross-room leakage |
| Rooms store `Set<peerId>` | Rooms store `Map<peerId, { name, color, isHost, joinedAt }>` | Identity support |
| Room deleted immediately when empty | 60-second grace period via `emptyAt` + sweep | Allows page-refresh rejoin |
| No host concept | `hostId` tracked, `isHost()`, `kill-room` event | Host can terminate session |
| No late joiner file log | `sharedFilesLog[]` + `allowLateJoinerFiles` flag | Late joiners can see file history |
| No health endpoint | `GET /health` via `routes/` + `controllers/` | Deployment monitoring |

`room-manager.js` still exists but it's **deprecated** — it re-exports the `roomService` class for backwards compatibility only. Don't use it in new code. It will yell a deprecation warning at you if you try. 🔔

---

## 📁 Folder Structure

```
server/
│
├── 🚀 server.js                  ← Entry point. Boots Express, Socket.io, middleware, routes.
│
├── ⚙️  config/
│   ├── env.js                    ← Single source of truth for all config & env vars
│   └── cors.js                   ← CORS policy (strict prod / open dev)
│
├── 🛡️  middlewares/
│   └── rateLimiter.js            ← express-rate-limit (20 req/min per IP, configurable)
│
├── 🏠 services/
│   └── roomService.js            ← All room logic. Singleton. The real room-manager.
│
├── 🔌 sockets/
│   ├── index.js                  ← Wires up all socket handlers on connection
│   ├── roomHandler.js            ← create-room, join-room, kill-room, file-sent-log, disconnect
│   ├── signalHandler.js          ← WebRTC offer/answer/ICE relay with peer validation
│   └── state.js                  ← In-memory socketId → roomCode map + ensureSameRoom()
│
├── 🛣️  routes/
│   └── index.js                  ← HTTP route registration (just /health for now)
│
├── 🎮 controllers/
│   └── statusController.js       ← GET /health handler
│
├── 📦 package.json
├── 🔒 .env                       ← Secrets. Do not commit. We cannot stress this enough.
└── 🧪 test_rm.js                 ← Scratch test file. Ignore in prod.
```

---

## 🏗️ Architecture — How It All Connects

```
 HTTP Request          Socket.io Connection
      │                        │
      ▼                        ▼
 middlewares/            sockets/index.js
 rateLimiter.js      ┌─────────────────────────────┐
      │              │  io.on('connection', socket  │
      ▼              │    registerRoomHandlers()     │
 routes/index.js     │    registerSignalHandlers()   │
      │              │  )                           │
      ▼              └─────────────────────────────┘
 controllers/                  │              │
 statusController          roomHandler    signalHandler
      │                        │              │
      ▼                        ▼              ▼
 GET /health             services/        sockets/
 { status, uptime,       roomService      state.js
   timestamp }          (singleton)    peerToRoomMap
                                       ensureSameRoom()
                        config/env.js
                     (ICE_SERVERS, limits,
                      port, allowed origins)
```

Every module reads config from `config/env.js`. Nobody hardcodes anything. Clean dependency tree, no circular imports. 👌

---

## 🏠 RoomService — The Core (`services/roomService.js`)

This is where rooms live. Exported as a **singleton** (`module.exports = new RoomService()`) — the same instance is shared across all socket handlers automatically. No passing it around as an argument.

### What a room looks like in memory

```javascript
{
  peers: Map {
    "socketId_A" → { name: "ARJUN", color: "#566434", isHost: true,  joinedAt: 1716890000 },
    "socketId_B" → { name: "PRIYA", color: "#875400", isHost: false, joinedAt: 1716890042 }
  },
  maxSize: 4,               // Set by host at creation (default: 2, max: 10)
  createdAt: 1716890000,
  hostId: "socketId_A",
  emptyAt: null,            // Set when last peer leaves — starts the 60s grace period
  allowLateJoinerFiles: true,
  sharedFilesLog: [         // Only populated when allowLateJoinerFiles is true
    { name: "report.pdf", size: 1048576, senderName: "ARJUN", timestamp: 1716890100 }
  ]
}
```

### Methods

| Method | Arguments | Returns | What it does |
|---|---|---|---|
| `createRoom()` | `maxSize, allowLateJoinerFiles` | `roomCode` | Generates unique `XXX-XXX` code, initialises room |
| `joinRoom()` | `roomCode, peerId, name, isHost` | `{ success, color }` or `{ success: false, error }` | Adds peer, assigns color, sets host if first joiner |
| `leaveRoom()` | `roomCode, peerId` | `boolean` | Removes peer, sets `emptyAt` if last peer leaves |
| `getPeerList()` | `roomCode` | `[{ peerId, name, color, isHost, connected }]` | Full peer list for broadcasting |
| `isHost()` | `roomCode, peerId` | `boolean` | Checks if socket is the room host |
| `deleteRoom()` | `roomCode` | `boolean` | Hard delete (used by `kill-room`) |
| `addFileLog()` | `roomCode, fileEntry` | `void` | Appends to `sharedFilesLog` if flag is on |
| `getRoomInfo()` | `roomCode` | `{ allowLateJoinerFiles, sharedFilesLog }` | Sent to late joiners on `join-room` |
| `cleanupExpiredRooms()` | — | `void` | Called by `setInterval` every 15 seconds |

### Color Palette — Auto-assigned by Join Order

```
Slot 0  →  #566434  green    (brand secondary)
Slot 1  →  #875400  amber    (brand tertiary)
Slot 2  →  #4a7c9e  blue
Slot 3  →  #7a3f6e  purple
Slot 4  →  #c0392b  red
Slot 5  →  #2c7a6b  teal
Slot 6  →  #6b4c2a  brown
Slot 7  →  #3d5a80  navy
           (wraps if more than 8 peers)
```

### Room Lifecycle & The 60-Second Grace Period

```
createRoom()
     │
  first peer joins → hostId set, isHost: true
     │
  more peers join → assigned colors in order
     │
  ...P2P session running, server no longer involved...
     │
  last peer disconnects
     │
  room.peers.size = 0 → room.emptyAt = Date.now()  ⏱️  Grace period starts
     │
  ├── [within 60s] → peer refreshes, calls join-room → room still exists ✅
     │
  └── [after 60s]  → cleanupExpiredRooms() deletes room ❌
     │
  Also hard-deleted if older than ROOM_MAX_AGE_MINUTES (default: 30 min)
  regardless of peer count.
```

The 60-second window is what makes page-refresh session recovery work. Without it, a browser refresh would always land back on the landing screen.

---

## 🔌 Socket Events — Full Reference

### Client → Server

#### `create-room`
```javascript
// Payload:
{ name: "Arjun", maxSize: 4, allowLateJoinerFiles: true }
// name: max 30 chars, falls back to "Anonymous" if empty/missing
// maxSize: 1–10, falls back to MAX_ROOM_SIZE from env

// Response (callback):
{
  success: true,
  roomCode: "KMN-7PQ",
  iceServers: [...],
  peerColor: "#566434",
  peerList: [{ peerId, name, color, isHost, connected }]
}
```

#### `join-room`
```javascript
// Payload:
{ roomCode: "KMN-7PQ", name: "Priya" }

// Response (callback) — success:
{
  success: true,
  roomCode: "KMN-7PQ",
  iceServers: [...],
  peerColor: "#875400",
  peerList: [...],
  allowLateJoinerFiles: true,
  sharedFilesLog: [{ name, size, senderName, timestamp }, ...]
}

// Response (callback) — failure:
{ success: false, error: "Room not found" | "Room is full" | "Invalid room code provided." }
```

#### `kill-room`
```javascript
// Payload: "KMN-7PQ"  (just the room code string)
// Server checks: is socket.id === room.hostId?
// Yes → emits 'room-killed' to all other peers, deletes room
// No  → silently ignored 😏
```

#### `file-sent-log`
```javascript
// Payload:
{ name: "design.figma", size: 4403200, senderName: "ARJUN" }
// Appended to sharedFilesLog only if allowLateJoinerFiles is true for that room
// Silently ignored if feature is disabled
```

#### `signal-offer` / `signal-answer` / `signal-ice-candidate`
```javascript
// Payload (same shape for all three):
{ targetPeerId: "socketId_of_target", offer/answer/candidate: <WebRTC data> }

// Server validates:
// 1. targetPeerId is present
// 2. sender and target are in the SAME room (ensureSameRoom check)
// Pass → relay to target only
// Fail → silently dropped. No cross-room signal leakage. Ever.
```

### Server → Client

| Event | When fired | Payload |
|---|---|---|
| `peer-joined` | New peer joins the room | `{ peerId, name, color }` |
| `peer-left` | A peer disconnects | `{ peerId }` |
| `peer-list-updated` | Any join or leave | `{ peerList: [...] }` — full updated list |
| `room-killed` | Host calls `kill-room` | *(no payload)* — clients return to landing |
| `signal-offer` | Relayed from peer | `{ offer, senderPeerId }` |
| `signal-answer` | Relayed from peer | `{ answer, senderPeerId }` |
| `signal-ice-candidate` | Relayed from peer | `{ candidate, senderPeerId }` |

---

## 🔒 Security Layers

### CORS (`config/cors.js`)

- **Development:** open to all origins — makes local multi-device testing not a headache
- **Production:** only `CLIENT_URL` origins allowed — anything else gets rejected with an explicit CORS error

The same policy applies to both the Express HTTP layer and Socket.io separately via `corsOptions` and `socketCorsOptions`.

### Rate Limiting (`middlewares/rateLimiter.js`)

20 HTTP requests per IP per minute (set via `MAX_CONNECTIONS_PER_MINUTE`). Returns a proper JSON `429` response — not a wall of HTML. Standard rate-limit headers included so clients can read retry timing.

### Helmet

Applied globally on all HTTP responses. Handles 14 security headers automatically — CSP, X-Frame-Options, X-Content-Type-Options, and more. You didn't have to configure any of them. That's Helmet's entire pitch. 🪖

### `ensureSameRoom()` — Signal Security

Before relaying any WebRTC signal, `signalHandler.js` calls `ensureSameRoom(senderId, targetId)`. This checks that both socket IDs are mapped to the exact same room code. A peer in room `AAA-BBB` cannot relay signals to a peer in room `CCC-DDD`. Cross-room signal injection is structurally impossible.

```javascript
// From state.js — one function, one job:
const ensureSameRoom = (senderId, targetId) => {
  const roomA = peerToRoomMap.get(senderId);
  const roomB = peerToRoomMap.get(targetId);
  return !!(roomA && roomB && roomA === roomB);
};
```

---

## ⚙️ Configuration (`config/env.js`)

All configurable values are read once at startup and exported as a single `config` object. No `process.env` scattered across files.

```env
PORT=3000
NODE_ENV=development

# CORS — comma-separated for multiple allowed origins
CLIENT_URL=https://klickshare-theta.vercel.app,http://localhost:5173

# Room settings
ROOM_CODE_LENGTH=6            # Each half of the XXX-XXX code
MAX_ROOM_SIZE=2               # Default capacity (host can override 1–10)
ROOM_MAX_AGE_MINUTES=30       # Hard TTL for any room regardless of activity
MAX_CONNECTIONS_PER_MINUTE=20 # Rate limiter threshold per IP

# STUN/TURN
STUN_URL=stun:free.expressturn.com:3478
TURN_URL=turn:free.expressturn.com:3478
TURN_USERNAME=your_username
TURN_PASSWORD=your_password
```

`ICE_SERVERS` is assembled as an array directly in `config/env.js` and attached to the config export. Socket handlers just pass `config.ICE_SERVERS` to clients — no array-building in event handlers.

---

## 🚀 Running Locally

```bash
cd server
npm install
# fill in your .env (copy the values above)
npm start
```

```
+===========================================+
|        Klicks Server Started              |
|===========================================|
|  Port:     3000                           |
|  Mode:     development                    |
+===========================================+
```

**Verify it's alive:**
```bash
curl http://localhost:3000/health
# {"status":"ok","uptime":4.2,"timestamp":"2025-05-27T10:00:00.000Z"}
```

---

## 📦 Dependencies

```
express              ^5.2.1     HTTP server (Express 5 — async error handling built-in)
socket.io            ^4.8.3     WebSocket signaling layer
cors                 ^2.8.6     Cross-origin headers
dotenv               ^17.3.1    .env file loading
express-rate-limit   ^8.5.2     Per-IP rate limiting
helmet               ^8.1.0     Security response headers
```

Six dependencies. For a production signaling server. The smugness is earned. 🧘

---

## 🚢 Deploying

### Render / Railway / Fly.io / Any Node host

1. Set root directory to `server/`
2. Build: `npm install`
3. Start: `node server.js`
4. Add env vars in dashboard

**Critical production env vars:**
```env
NODE_ENV=production
CLIENT_URL=https://your-frontend.com    # Exact match. No trailing slash.
TURN_USERNAME=<your credentials>
TURN_PASSWORD=<your credentials>
```

Setting `NODE_ENV=production` does two things:
1. CORS locks to `CLIENT_URL` only — dev open-origin mode is off
2. If a React build exists at `../client-react/dist`, it gets served as static assets with SPA fallback routing. Useful for monorepo setups.

**On TURN servers:** The `.env` defaults to `free.expressturn.com`. It's free. It's a shared relay. Latency varies, uptime is not guaranteed. For real users — especially on mobile data or behind corporate NAT — a flaky TURN server means failed P2P connections with no obvious error. Register at [metered.ca](https://metered.ca) for a proper free tier (100 GB/month). Worth it. 🌏

---

## 🧱 What This Server Still Does Not Have

| Thing | Status | Reason |
|---|---|---|
| Database | ✅ Still none | Nothing to persist. Rooms live in RAM by design. |
| User authentication | ✅ Still none | There are no users. Only socket connections. |
| File upload endpoint | ✅ Still none | Files go P2P. This server would have no idea what to do with one. |
| Disk logging | ✅ Still none | Console only. No PII in log files. |
| Actual test suite | ⚠️ `test_rm.js` is a scratch file | Noted. Judged. It's on the list. 👀 |

---

<div align="center">

```
> SERVER v2: ONLINE ✓
> ROOMS IN MEMORY: 0 (good, you just started)
> FILES STORED: 0 (always, forever)
> ARCHITECTURE: ACTUALLY ORGANISED NOW ✓
> DEPRECATED FILES: 1 (room-manager.js says goodbye)
> WAITING FOR BROWSERS TO INTRODUCE THEMSELVES_
```

*Part of the [Klicks](../README.md) project.*

</div>
