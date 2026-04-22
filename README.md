# BitTorrent Client

A full-stack BitTorrent client built from scratch in Node.js with a React frontend. Implements the core BitTorrent wire protocol (BEP 3), DHT peer discovery (BEP 5), and the extension protocol for magnet links (BEP 9/10).

---

## Features

- **Search** torrents via a local [Prowlarr](https://github.com/Prowlarr/Prowlarr) instance (aggregates 100+ indexers)
- **Download** via `.torrent` file upload, magnet link, torrent URL, or raw info-hash
- **3-step fallback chain** — automatically falls back from URL → magnet → hash on 429/5xx errors
- **DHT peer discovery** — finds peers without a tracker using Kademlia routing
- **BitTorrent wire protocol** — full handshake, BITFIELD, REQUEST, PIECE, CHOKE/UNCHOKE
- **Tit-for-tat unchoke** — rewards peers who upload to you; optimistic unchoke every 30s
- **SHA1 piece verification** — every piece is hash-verified before writing to disk
- **BEP 10 extension protocol** — signals `ut_metadata` support for magnet link metadata exchange
- **Real-time stats** — live download progress polled from the backend every 2s
- **uTorrent-style UI** — deep purple sidebar, search bar, torrent results table

---

## Project Structure

```
bittorrent/
├── backend/
│   ├── server.js           # Entry point — P2P engine + unchoke timer
│   ├── api.js              # Express HTTP API (port 8000)
│   ├── config.js           # All env-configurable settings
│   ├── messagePeer.js      # BitTorrent message parser (parseMessage + MESSAGE_IDS)
│   ├── peers/
│   │   └── peerWire.js     # TCP stream reassembly + wire protocol handler
│   └── utils/
│       ├── torrentParser.js   # .torrent file bencode decoder
│       ├── tracker.js         # HTTP tracker announce client
│       ├── magnetHandler.js   # Magnet URI → torrent object (DHT + BEP 9)
│       ├── pieceSelector.js   # PieceManager — block tracking, SHA1 verify, file write
│       ├── handshake.js       # 68-byte BitTorrent handshake builder
│       └── peerMessage.js     # Outgoing message encoders (sendChoke, sendPiece, etc.)
└── frontend/
    └── src/
        ├── App.jsx              # Root layout
        ├── api.js               # Axios wrappers for all backend endpoints
        ├── components/
        │   ├── SearchBar.jsx    # Search input → /api/search
        │   ├── TorrentTable.jsx # Results table + download fallback chain
        │   ├── StatsPanel.jsx   # Live download stats with backoff polling
        │   ├── Sidebar.jsx      # Navigation sidebar
        │   └── Toolbar.jsx      # Top toolbar
        └── main.jsx             # Vite entry point
```

---

## Prerequisites

| Tool | Purpose | Install |
|------|---------|---------|
| Node.js ≥ 18 | Backend runtime | [nodejs.org](https://nodejs.org) |
| npm | Package manager | Bundled with Node.js |
| Prowlarr | Torrent indexer aggregator | [prowlarr.com](https://prowlarr.com) |

> Prowlarr must be running and have at least one indexer configured. Get your API key from **Settings → General → API Key**.

---

## Setup

### 1. Clone and install

```bash
git clone <your-repo-url>
cd bittorrent

# Install backend dependencies
cd backend && npm install

# Install frontend dependencies
cd ../frontend && npm install
```

### 2. Configure environment

Create `backend/.env`:

```env
PORT=8000
PROWLARR_URL=http://localhost:9696
PROWLARR_API_KEY=your_prowlarr_api_key_here

# Optional overrides (defaults shown)
MAX_CONNECTIONS=4
MAX_RETRIES=2
BLOCK_SIZE=16384
SOCKET_TIMEOUT=10000
UPLOAD_PATH=./uploads
DOWNLOAD_PATH=./downloads
SEARCH_LIMIT=20
```

### 3. Run

**Backend** (start from project root or `backend/`):

```bash
cd backend
npm run dev        # development (nodemon, auto-restart)
# or
npm start          # production
```

**Frontend** (in a separate terminal):

```bash
cd frontend
npm run dev        # Vite dev server on http://localhost:5173
```

Open **http://localhost:5173** in your browser.

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/status` | Live download stats `{ downloaded, total, percent }` |
| `GET` | `/api/search?q=<query>` | Search via Prowlarr |
| `POST` | `/api/peers` | Upload `.torrent` file (multipart), returns peer list |
| `POST` | `/api/download/url` | Start download from torrent URL |
| `POST` | `/api/download/magnet` | Start download from magnet link |
| `POST` | `/api/download/hash` | Start download from raw info-hash |

---

## How It Works

### Download flow

```
User clicks Download
  → TorrentTable tries: URL → magnet → hash (fallback on 429/5xx)
  → api.js fetches .torrent or calls magnetToTorrent()
  → parseTorrent() extracts infoHash, piece hashes, tracker URLs
  → getPeers() announces to HTTP trackers → peer list
  → startDownload(torrent, peers) initialises PieceManager
  → tryNextPeer() opens TCP connections up to MAX_CONNECTIONS
  → Handshake → INTERESTED → BITFIELD → UNCHOKE → REQUEST → PIECE
  → SHA1 verify each piece → write to downloads/{name}
```

### Magnet link flow

```
magnetToTorrent(magnetLink)
  → DHT.lookup(infoHash) + HTTP tracker announce (parallel)
  → Connect to discovered peers
  → BEP 10 extension handshake (byte[25] = 0x10)
  → BEP 9 ut_metadata exchange → reconstruct info dict
  → Return torrent object identical to a parsed .torrent file
```

### Tit-for-tat unchoke

Every **10 seconds**: unchoke the top 3 peers by bytes they uploaded to you. Choke everyone else.  
Every **30 seconds**: additionally unchoke one random choked peer (optimistic unchoke) so new peers can prove themselves.

---

## Configuration Reference

All settings live in `backend/config.js` and can be overridden via `.env`:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8000` | HTTP API port |
| `MAX_CONNECTIONS` | `4` | Max simultaneous peer connections |
| `MAX_RETRIES` | `2` | Retry attempts per peer |
| `BLOCK_SIZE` | `16384` | Block request size (16KB — BitTorrent standard) |
| `SOCKET_TIMEOUT` | `10000` | Peer socket timeout in ms |
| `UPLOAD_PATH` | `./uploads` | Where .torrent files are saved |
| `DOWNLOAD_PATH` | `./downloads` | Where completed files are saved |
| `PROWLARR_URL` | `http://localhost:9696` | Prowlarr base URL |
| `PROWLARR_API_KEY` | _(empty)_ | Prowlarr API key |
| `SEARCH_LIMIT` | `20` | Max search results returned |

---

## Known Limitations

- **One active download at a time** — module-level state means a second download overwrites the first
- **No resume** — restarting the server loses all progress
- **Sequential piece selection** — downloads pieces in order instead of rarest-first
- **No endgame mode** — no simultaneous multi-peer requests for the last few pieces
- **Local filesystem only** — downloads saved to disk on the server machine

---

## Tech Stack

**Backend:** Node.js · Express · `bittorrent-dht` · `bencode` · `magnet-uri` · `axios` · `dotenv`

**Frontend:** React · Vite · Tailwind CSS · Axios

---

## License

ISC
