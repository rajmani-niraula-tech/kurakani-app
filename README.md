# Kurakani (कुराकानी) — P2P Direct Call PWA

> **A production-ready, zero-database Progressive Web App (PWA) for direct Peer-to-Peer Voice and Video Calling with zero text messaging and zero server persistence.**

---

## 🌟 Key Architectural Highlights

* **Zero Database & Zero Persistence:**  
  Operating state is completely ephemeral (in-memory). No user accounts, database structures, or message storage. When the tab or app is closed, all session data disappears.
* **Direct Dialing Model (FaceTime / Phone Style):**  
  - Upon app load, automatically assigns the user a random 6-digit numeric Phone ID (e.g. `784-291`).
  - Interactive tactile phone dial pad (0–9, \*, #) allowing User A to dial User B's 6-digit ID directly.
  - Quick "Copy ID" button and "Share Direct Link" (`?dial=784-291`).
  - Clipboard paste support: paste any 6-digit ID to dial instantly.
* **Signaling & End-to-End Encryption:**  
  - Built with PeerJS CDN (`peerjs.min.js`) for zero-database P2P signaling.
  - Audio and video streams flow directly between browsers using native **WebRTC DTLS/SRTP encryption**.
  - Dual-channel signaling: Parallel WebRTC DataChannel provides instant call rejection, busy status, and track state synchronization.
* **Strict Media Focus:**  
  Exclusively dedicated to audio and video calling. **Zero chat boxes, zero text messaging, zero call logs.**
* **Local Web Audio API Synthesis (No External MP3 Assets):**  
  All ringtones, ringback tones, DTMF dial pad tones, and call state chimes are synthesized directly in the browser via `window.AudioContext` oscillators. This guarantees 100% reliability with zero broken media URLs or CORS issues.
* **Production-Ready PWA:**  
  - Fully responsive layout via Tailwind CSS.
  - Mobile viewport locking (`overscroll-behavior: none`, `touch-action: manipulation`).
  - Web App Manifest (`manifest.json`) configured for standalone portrait mode (`#0f172a`).
  - Service Worker (`sw.js`) for offline app shell caching and native "Add to Home Screen" support.

---

## 🔄 Call Lifecycle & State Machine

The application gracefully manages four distinct UI states:

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
   - Displays assigned 6-digit Phone ID badge with one-click Copy, Share, and Regenerate buttons.
   - Live local camera self-view preview in Picture-in-Picture style with front/rear flip camera and toggle preview options.
   - Interactive 0–9 phone dial pad with instant DTMF feedback.
   - Distinct **Voice Call** (Green) and **Video Call** (Indigo) action buttons.
2. **OUTGOING CALL STATE:**
   - Fullscreen ring overlay saying `Calling [Target ID]...` with animated pulsing radar waves.
   - Synthetic ringback audio generator (dual-tone 440 Hz + 480 Hz modulated on 4s cycle).
   - "Cancel Call" red button that immediately terminates the connection attempt.
   - Automatic 45-second timeout for unanswered calls.
3. **INCOMING CALL STATE:**
   - Modal alert overlay showing `Incoming [Voice/Video] Call from [Caller ID]`.
   - Dual-tone phone ringtone synthesized via Web Audio API (853 Hz + 960 Hz chime cadence).
   - Distinct green **Accept** and red **Decline** action buttons.
4. **IN-CALL STATE:**
   - Full-bleed remote video stream (or animated audio waveform avatar if voice-only / camera off).
   - Floating Picture-in-Picture local camera view in bottom-right corner (tap to swap PiP and fullscreen).
   - Top status pill displaying remote ID, encryption badge (`🔒 WebRTC DTLS/SRTP`), and live call timer (`00:00`).
   - Fixed bottom control panel:
     - **Mute / Unmute Microphone** (`MediaStreamTrack.enabled`).
     - **Toggle Camera On / Off** (gracefully manages video tracks; dynamically upgrades voice calls to video).
     - **Flip Camera** (switches between front and rear cameras on mobile).
     - **End Call** (red hangup button).

---

## 🎛️ Web Audio API Sound Specifications

All tones are generated purely in code:

| Tone | Oscillators & Frequencies | Cadence |
|---|---|---|
| **Ringback (Outgoing)** | Dual sine waves: 440 Hz + 480 Hz | 1.8s tone, 2.2s silence (repeating) |
| **Ringtone (Incoming)** | Dual sine waves: 853 Hz + 960 Hz | 0.4s burst, 0.1s pause, 0.4s burst, 2.1s silence |
| **DTMF Dialpad (0–9, \*, #)** | Standard Bell System Dual-Tones (697–941 Hz + 1209–1477 Hz) | 85ms burst per keypress |
| **Call Connected** | Ascending chime: C5 (523 Hz) → E5 (659 Hz) | 250ms gentle chime |
| **Call Ended** | Descending tone: A4 (440 Hz) → E4 (330 Hz) | 280ms soft boop |
| **Busy / Rejected** | Square wave: 480 Hz | 150ms quick buzz |

---

## 🚀 Quick Start & Local Testing

### Prerequisites
- Node.js (v18+)

### Running the App
```bash
# Clone or navigate to the workspace
cd Kurakani

# Start the static PWA server
npm start
```

The server will print:
```
======================================================
  Kurakani P2P Direct Calling PWA Server is running!  
======================================================
  Local:            http://localhost:3000
  Network (Mobile): http://192.168.x.x:3000
======================================================
```

### Testing a Call Between 2 Devices
1. Open `http://localhost:3000` in **Browser Tab 1** (or Device A). Note the assigned 6-digit ID (e.g. `123-456`).
2. Open `http://localhost:3000` in **Browser Tab 2** (or Device B). Note its assigned 6-digit ID (e.g. `987-654`).
3. On Tab 1, dial `987-654` using the dial pad and click **Video Call** or **Voice Call**.
4. Tab 2 will ring with the synthesized phone ringtone and display `Incoming Call from 123-456`.
5. Click **Accept** on Tab 2 to connect the call!

> **Direct Dial Links:** You can also share `http://localhost:3000/?dial=123-456` to have the target ID prefilled on the other device!

---

## 📱 Progressive Web App (PWA) Installation

- **iOS Safari:** Tap the **Share** button at the bottom of Safari, scroll down and tap **"Add to Home Screen"**.
- **Android / Desktop Chrome:** Click the **"Install"** button in the header or the browser URL bar's install icon.

---

## 📂 File Structure

```
Kurakani/
├── index.html       # Self-contained PWA markup, styling, and WebRTC/Audio logic
├── manifest.json    # PWA configuration (standalone, portrait-primary, #0f172a)
├── sw.js            # Service worker for offline shell caching
├── server.js        # Zero-dependency local Node.js static HTTP server
├── package.json     # NPM scripts (npm start)
├── icons/           # High-resolution vector & raster app icons
│   ├── icon.svg
│   ├── icon-192.png
│   └── icon-512.png
└── README.md        # Comprehensive documentation
```

---

## 🔒 Security & Privacy Notice
- WebRTC connections use native **DTLS (Datagram Transport Layer Security)** and **SRTP (Secure Real-time Transport Protocol)** encryption.
- No media, logs, or identifiers are recorded or saved. State is completely lost when the page is closed.
