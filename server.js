const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { Server } = require('socket.io');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.mp3': 'audio/mpeg'
};

function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

// HTTP Server for Static PWA Shell Assets
const server = http.createServer((req, res) => {
  let reqPath = decodeURI(req.url.split('?')[0]);
  if (reqPath === '/' || reqPath === '') {
    reqPath = '/index.html';
  }

  const safePath = path.normalize(reqPath).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.join(PUBLIC_DIR, safePath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    const headers = {
      'Content-Type': contentType,
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600',
      'Service-Worker-Allowed': '/'
    };

    res.writeHead(200, headers);
    fs.createReadStream(filePath).pipe(res);
  });
});

// Socket.io Server for WebRTC Signaling
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Ephemeral in-memory mapping: deviceId <-> socketId
const deviceToSocket = new Map();
const socketToDevice = new Map();
// Active call mapping to handle abrupt disconnections
const activeCalls = new Map(); // socketId -> peerSocketId

io.on('connection', (socket) => {
  console.log(`[Socket] Connected: ${socket.id}`);

  // 1. Register 15-Digit Persistent Device ID
  socket.on('register', ({ deviceId }) => {
    if (!deviceId) return;
    const cleanId = String(deviceId).trim();

    // Remove any previous registration for this socket or device
    deviceToSocket.set(cleanId, socket.id);
    socketToDevice.set(socket.id, cleanId);
    socket.join(`device_${cleanId}`);

    console.log(`[Socket] Device registered: ${cleanId} -> ${socket.id}`);
    socket.emit('registered', { deviceId: cleanId });
  });

  // 2. Outgoing Call (Offer)
  socket.on('call-user', ({ targetId, callerId, callType, offer }) => {
    const cleanTarget = String(targetId).trim();
    const targetSocketId = deviceToSocket.get(cleanTarget);

    if (!targetSocketId || !io.sockets.sockets.has(targetSocketId)) {
      console.log(`[Call] Target offline: ${cleanTarget}`);
      socket.emit('call-error', {
        reason: 'offline',
        message: 'Target device is currently offline or unreachable.'
      });
      return;
    }

    // Check if target is already on another call
    if (activeCalls.has(targetSocketId)) {
      console.log(`[Call] Target busy: ${cleanTarget}`);
      socket.emit('call-busy', { targetId: cleanTarget });
      return;
    }

    console.log(`[Call] Routing call from ${callerId} to ${cleanTarget} (${callType})`);
    io.to(targetSocketId).emit('incoming-call', {
      callerId,
      callType,
      offer
    });
  });

  // 3. Answer Call
  socket.on('answer-call', ({ targetId, responderId, answer }) => {
    const cleanTarget = String(targetId).trim();
    const targetSocketId = deviceToSocket.get(cleanTarget);

    if (targetSocketId) {
      console.log(`[Call] Answer from ${responderId} to ${cleanTarget}`);
      activeCalls.set(socket.id, targetSocketId);
      activeCalls.set(targetSocketId, socket.id);

      io.to(targetSocketId).emit('call-answered', {
        responderId,
        answer
      });
    }
  });

  // 4. Relay ICE Candidate
  socket.on('ice-candidate', ({ targetId, candidate }) => {
    const cleanTarget = String(targetId).trim();
    const targetSocketId = deviceToSocket.get(cleanTarget);
    if (targetSocketId && candidate) {
      io.to(targetSocketId).emit('ice-candidate', { candidate });
    }
  });

  // 5. Call Declined
  socket.on('call-declined', ({ targetId, reason }) => {
    const cleanTarget = String(targetId).trim();
    const targetSocketId = deviceToSocket.get(cleanTarget);
    if (targetSocketId) {
      console.log(`[Call] Declined by target: ${cleanTarget}`);
      io.to(targetSocketId).emit('call-declined', { reason: reason || 'declined' });
    }
  });

  // 6. Call Busy
  socket.on('call-busy', ({ targetId }) => {
    const cleanTarget = String(targetId).trim();
    const targetSocketId = deviceToSocket.get(cleanTarget);
    if (targetSocketId) {
      io.to(targetSocketId).emit('call-busy', { targetId: cleanTarget });
    }
  });

  // 7. End Call
  socket.on('call-ended', ({ targetId }) => {
    const cleanTarget = String(targetId).trim();
    const targetSocketId = deviceToSocket.get(cleanTarget);

    activeCalls.delete(socket.id);
    if (targetSocketId) {
      activeCalls.delete(targetSocketId);
      console.log(`[Call] Call ended between ${socket.id} and ${targetSocketId}`);
      io.to(targetSocketId).emit('call-ended');
    }
  });

  // 8. Track State Sync (Mute / Camera On-Off)
  socket.on('track-toggle', ({ targetId, video, audio }) => {
    const cleanTarget = String(targetId).trim();
    const targetSocketId = deviceToSocket.get(cleanTarget);
    if (targetSocketId) {
      io.to(targetSocketId).emit('track-toggle', { video, audio });
    }
  });

  // Disconnection Cleanup
  socket.on('disconnect', () => {
    const deviceId = socketToDevice.get(socket.id);
    if (deviceId) {
      console.log(`[Socket] Device disconnected: ${deviceId}`);
      deviceToSocket.delete(deviceId);
      socketToDevice.delete(socket.id);
    }

    // If device was in an active call, notify the other peer
    const peerSocketId = activeCalls.get(socket.id);
    if (peerSocketId) {
      activeCalls.delete(socket.id);
      activeCalls.delete(peerSocketId);
      io.to(peerSocketId).emit('call-ended', { reason: 'peer_disconnected' });
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const localIp = getLocalIp();
  console.log(`\n======================================================`);
  console.log(`  Kurakani P2P Direct Calling PWA Server is running!  `);
  console.log(`======================================================`);
  console.log(`  Local:            http://localhost:${PORT}`);
  console.log(`  Network (Mobile): http://${localIp}:${PORT}`);
  console.log(`  Signaling:        Socket.io Ready                   `);
  console.log(`======================================================\n`);
});
