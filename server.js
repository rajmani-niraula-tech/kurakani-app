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

// Ephemeral in-memory mapping: socketId <-> deviceId
const socketToDevice = new Map();
// Active calls tracking: deviceId -> peerDeviceId
const activeCalls = new Map();

io.on('connection', (socket) => {
  console.log(`[Socket] Connected: ${socket.id}`);

  // 1. Register 15-Digit Persistent Device ID
  socket.on('register', ({ deviceId }) => {
    if (!deviceId) return;
    const cleanId = String(deviceId).trim();

    socketToDevice.set(socket.id, cleanId);
    socket.join(`device_${cleanId}`);

    console.log(`[Socket] Device registered: ${cleanId} (socket: ${socket.id})`);
    socket.emit('registered', { deviceId: cleanId });
  });

  // 2. Outgoing Call (Offer)
  socket.on('call-user', ({ targetId, callerId, callType, offer }) => {
    const cleanTarget = String(targetId).trim();
    const cleanCaller = String(callerId).trim();

    console.log(`[Call] Request: ${cleanCaller} -> ${cleanTarget} (${callType})`);

    const targetRoom = io.sockets.adapter.rooms.get(`device_${cleanTarget}`);
    const isOnline = targetRoom && targetRoom.size > 0;

    if (!isOnline) {
      console.log(`[Call] Target offline: ${cleanTarget}`);
      socket.emit('call-error', {
        reason: 'offline',
        message: 'Target device is currently offline or unreachable.'
      });
      return;
    }

    // Check if target is already on another call
    if (activeCalls.has(cleanTarget)) {
      console.log(`[Call] Target busy: ${cleanTarget}`);
      socket.emit('call-busy', { targetId: cleanTarget });
      return;
    }

    // Relay incoming-call to target device room
    io.to(`device_${cleanTarget}`).emit('incoming-call', {
      callerId: cleanCaller,
      callType,
      offer
    });
  });

  // 3. Answer Call
  socket.on('answer-call', ({ targetId, responderId, answer }) => {
    const cleanTarget = String(targetId).trim();
    const cleanResponder = String(responderId).trim();

    console.log(`[Call] Answer: ${cleanResponder} -> ${cleanTarget}`);
    activeCalls.set(cleanResponder, cleanTarget);
    activeCalls.set(cleanTarget, cleanResponder);

    // Relay call-answered to caller device room
    io.to(`device_${cleanTarget}`).emit('call-answered', {
      responderId: cleanResponder,
      answer
    });
  });

  // 4. Relay ICE Candidate
  socket.on('ice-candidate', ({ targetId, candidate }) => {
    const cleanTarget = String(targetId).trim();
    if (candidate) {
      io.to(`device_${cleanTarget}`).emit('ice-candidate', { candidate });
    }
  });

  // 5. Call Declined
  socket.on('call-declined', ({ targetId, reason }) => {
    const cleanTarget = String(targetId).trim();
    activeCalls.delete(cleanTarget);
    console.log(`[Call] Declined: target ${cleanTarget}`);
    io.to(`device_${cleanTarget}`).emit('call-declined', { reason: reason || 'declined' });
  });

  // 6. Call Busy
  socket.on('call-busy', ({ targetId }) => {
    const cleanTarget = String(targetId).trim();
    io.to(`device_${cleanTarget}`).emit('call-busy', { targetId: cleanTarget });
  });

  // 7. End Call
  socket.on('call-ended', ({ targetId }) => {
    const cleanTarget = String(targetId).trim();
    const myDevice = socketToDevice.get(socket.id);

    if (myDevice) activeCalls.delete(myDevice);
    if (cleanTarget) activeCalls.delete(cleanTarget);

    console.log(`[Call] Ended call: ${myDevice} <-> ${cleanTarget}`);
    io.to(`device_${cleanTarget}`).emit('call-ended');
  });

  // 8. Track State Sync (Mute / Camera On-Off)
  socket.on('track-toggle', ({ targetId, video, audio }) => {
    const cleanTarget = String(targetId).trim();
    io.to(`device_${cleanTarget}`).emit('track-toggle', { video, audio });
  });

  // Disconnection Cleanup
  socket.on('disconnect', () => {
    const deviceId = socketToDevice.get(socket.id);
    console.log(`[Socket] Disconnected: ${socket.id} (device: ${deviceId})`);
    
    if (deviceId) {
      socketToDevice.delete(socket.id);
      const peerDevice = activeCalls.get(deviceId);
      if (peerDevice) {
        activeCalls.delete(deviceId);
        activeCalls.delete(peerDevice);
        io.to(`device_${peerDevice}`).emit('call-ended', { reason: 'peer_disconnected' });
      }
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
