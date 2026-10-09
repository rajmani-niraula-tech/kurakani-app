# Kurakani (कुराकानी) — P2P WebRTC Direct Calling PWA

> **A production-ready Progressive Web App (PWA) for direct Peer-to-Peer Voice and Video Calling with persistent 15-digit Device IDs, Light/Dark mode, zero database requirements, and a self-contained Node.js + Socket.io WebRTC signaling backend.**

---

## 🌟 Key Technical Enhancements

* **Persistent 15-Digit Device ID:**  
  - On page load, checks `localStorage` for `kurakani_device_id`. If found, reuses it; otherwise, generates a unique 15-digit numeric string (via `Array.from({ length: 15 }, () => Math.floor(Math.random() * 10)).join('')`) and persists it to `localStorage`.
  - Displayed and dialed in clean, readable 3-digit groups (e.g. `123-456-789-012-345`).
  - Used for socket registration and direct WebRTC signaling.
  - Includes instant **Copy**, **Share Link** (`?dial=123456789012345`), and **Regenerate ID** buttons.
* **Light / Dark Mode Toggle:**  
  - Dynamic theme toggle button in the header with animated Sun/Moon icons.
  - Class-based theme toggling on `document.documentElement` via Tailwind CSS (`dark` class).
  - Automatically persists user theme preference (`'light'` or `'dark'`) in `localStorage` under `kurakani_theme` and re-applies it on page load with zero flash of unstyled content.
* **Deployment-Ready Backend (Node.js & Socket.io):**  
  - `server.js` dynamically binds to `process.env.PORT || 3000` (ready for Railway, Render, Fly.io, Heroku, Docker, VPS, or cloud deployments).
  - Clean `package.json` with `"start": "node server.js"`.
  - Frontend dynamically connects to `window.ENV_SOCKET_URL || window.location.origin` instead of hardcoded hostnames.
  - Native `RTCPeerConnection` configured with standard **Google public STUN servers** (`stun:stun.l.google.com:19302`) for cross-network WebRTC candidate gathering.
* **PWA & Android / Chrome Installability:**  
  - Validated `manifest.json` meeting all Chrome PWA installability requirements: `start_url: "/"`, `display: "standalone"`, `orientation: "portrait-primary"`, `theme_color: "#0f172a"`, and properly scoped `192x192` and `512x512` icons (`purpose: "any"` and `"maskable"`).
  - Robust `sw.js` (Service Worker) registered with fetch handlers, offline shell caching, and Socket.io bypass.
* **Web Audio API Tone Synthesis (Zero External MP3s):**  
  - All ringtones, ringbacks, DTMF dialpad tones, and call state chimes are synthesized directly in the browser using `window.AudioContext` oscillators.

---

## 🔄 Call Lifecycle & State Machine

```
                  ┌──────────────┐
                  │  IDLE STATE  │
                  └──────┬───────┘
                         │
        Dial ID & Call   │   Incoming Call Event
       ┌─────────────────┴─────────────────┐
       ▼                                   ▼
┌──────────────┐                    ┌──────────────┐
│   OUTGOING   │                    │   INCOMING   │
│  CALL STATE  │                    │  CALL STATE  │
└──────┬───────┘                    └──────┬───────┘
       │                                   │
Remote │ Answer                     Accept │ Call
       └─────────────────┬─────────────────┘
                         ▼
                  ┌──────────────┐
                  │   IN-CALL    │
                  │    STATE     │
                  └──────┬───────┘
                         │ End Call / Disconnect
                         ▼
                  ┌──────────────┐
                  │  IDLE STATE  │
                  └──────────────┘
```

1. **IDLE STATE:**
   - Displays persistent 15-digit Device ID with Copy, Share, and Regenerate buttons.
   - Light / Dark theme toggle button.
   - Live local camera self-view Picture-in-Picture preview with front/rear flip option.
   - 0–9 phone dial pad with instant DTMF audio feedback.
   - Distinct **Voice Call** (Green) and **Video Call** (Indigo) buttons.
2. **OUTGOING CALL STATE:**
   - Fullscreen overlay: `Calling [Target ID]...` with pulsing radar waves.
   - Continuous Web Audio dual-tone ringback (440 Hz + 480 Hz).
   - Red **Cancel Call** button.
   - 45-second timeout for unanswered calls.
3. **INCOMING CALL STATE:**
   - Modal alert: `Incoming [Voice/Video] Call from [Caller ID]`.
   - Dual-tone phone ringtone (853 Hz + 960 Hz cadence).
   - Distinct green **Accept** and red **Decline** buttons.
4. **IN-CALL STATE:**
   - Full-bleed remote video stream (with animated audio waveform fallback for voice-only calls).
   - Floating Picture-in-Picture local camera view in bottom-right corner (tap to swap PiP and fullscreen).
   - Top status pill with remote Device ID, encryption badge (`🔒 DTLS/SRTP`), and live call timer (`00:00`).
   - Bottom control dock:
     - **Mute / Unmute Microphone** (`MediaStreamTrack.enabled`).
     - **Toggle Camera On / Off** (supports mid-call upgrades from voice to video).
     - **Flip Camera** (front/rear camera switch for mobile devices).
     - **End Call** (red hangup button).

---

## 🚀 Running and Deploying

### Local Development
```bash
# Clone or navigate to the directory
cd Kurakani

# Start the server
npm start
```

The server will print:
```
======================================================
  Kurakani P2P Direct Calling PWA Server is running!  
======================================================
  Local:            http://localhost:3000
  Network (Mobile): http://192.168.x.x:3000
  Signaling:        Socket.io Ready                   
======================================================
```

### Production Deployment (Railway, Render, Fly.io, Heroku, Docker)
- The app requires zero database setup.
- Simply deploy the repository and set the start command to `npm start`.
- The server will dynamically bind to `process.env.PORT` provided by the hosting platform.

---

## 📂 File Layout

```
Kurakani/
├── index.html       # Single-codebase PWA with UI, WebRTC, Audio & Socket.io logic
├── manifest.json    # PWA configuration (standalone, portrait-primary, start_url: "/")
├── sw.js            # Service Worker for PWA shell caching and offline support
├── server.js        # Node.js HTTP server + Socket.io WebRTC signaling server
├── package.json     # Node.js dependencies (socket.io) and start script
├── icons/           # High-resolution vector & raster app icons (192x192, 512x512, SVG)
└── README.md        # Technical documentation
```
