import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import path from 'path';
import process from 'process';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { randomBytes } from 'node:crypto';

// Load env from backend-core in dev, or local .env in production
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const coreEnvPath = path.join(__dirname, '../backend-core/.env');

if (fs.existsSync(coreEnvPath)) {
  dotenv.config({ path: coreEnvPath });
  // Prevent backend-core's PORT (5001) from overriding watch2gether-service's port locally
   if (!process.env.WT_PORT) delete process.env.PORT;
} else {
  dotenv.config(); // Load local .env
}

const app = express();
app.use(cors({
  origin: "*",
  methods: ['GET', 'POST']
}));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ['GET', 'POST']
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'watch2gether-service' });
});

app.get('/api/rooms', (req, res) => {
  const activeRooms = Array.from(wtRooms.entries())
    .filter((entry) => entry[1].members.size > 0 || entry[1].status === 'scheduled' || entry[1].status === 'ended')
    .map(([roomId, room]) => {
    return {
      roomId,
      animeId: room.animeId,
      animeTitle: room.animeTitle,
      animeCover: room.animeCover,
      host: room.members.get(room.host) || Array.from(room.members.values())[0] || { displayName: room.hostName || 'Unknown Host', avatar: room.hostAvatar },
      membersCount: room.members.size,
      episode: room.state.episode,
      createdAt: room.createdAt,
      status: room.status || 'live',
      scheduledFor: room.scheduledFor || null
    };
  });
  
  // Sort by newest first
  activeRooms.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  
  res.json(activeRooms);
});

// Database Connection
const connectDB = async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error('MONGO_URI is missing');
    }
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Watch2Gether Service: Connected to MongoDB');
  } catch (error) {
    console.error('MongoDB Connection Error:', error);
    process.exit(1);
  }
};

// Middleware to authenticate socket connections
const authenticateSocket = async (socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token || token === 'null' || token === 'undefined') {
    socket.user = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = decoded; // Contains id
    
    // Fetch user doc so displayName is immediately available for events
    if (mongoose.connection.readyState === 1) {
      const userDoc = await mongoose.connection.collection('users').findOne({ _id: new mongoose.Types.ObjectId(decoded.id) });
      if (userDoc) {
        if (userDoc.isBot || (userDoc.tokenVersion || 0) !== (decoded.ver || 0)) throw new Error('Session expired');
        socket.displayName = userDoc.displayName || userDoc.username;
        socket.role = userDoc.role || 'user';
        socket.user = { ...userDoc, id: String(userDoc._id) };
      } else {
        throw new Error('User no longer exists');
      }
    }
  } catch (err) {
    console.error("Socket authentication failed:", err.message);
    socket.user = null;
  }
  next();
};

io.use(authenticateSocket);

const wtRooms = new Map();

io.on('connection', async (socket) => {
  let eventWindow = Date.now();
  let eventCount = 0;
  socket.use(async (packet, next) => {
    if (Date.now() - eventWindow > 60000) { eventWindow = Date.now(); eventCount = 0; }
    const callback = typeof packet.at(-1) === 'function' ? packet.at(-1) : () => {};
    if (typeof packet.at(-1) !== 'function') packet.push(callback);
    if (++eventCount > 120) return callback({ error: 'Too many requests.' });
    if (packet[0] === 'create_wt_room' && (!packet[1] || typeof packet[1] !== 'object')) return callback({ error: 'Invalid room payload' });
    if (packet[0] === 'wt_chat_message' && (typeof packet[1] !== 'string' || packet[1].length > 500)) return callback({ error: 'Message must be at most 500 characters.' });
    if (packet[0] === 'create_wt_room') {
      const data = packet[1];
      if (!/^\d+$/.test(String(data.animeId)) || typeof data.animeTitle !== 'string' || data.animeTitle.length > 300 || (data.episode !== undefined && (!Number.isInteger(data.episode) || data.episode < 1)) || (data.scheduledFor && !Number.isFinite(new Date(data.scheduledFor).getTime()))) return callback({ error: 'Invalid room details' });
      if (wtRooms.size >= 1000) return callback({ error: 'Room limit reached. Please try later.' });
    }
    if (socket.user && !['get_room_state', 'leave_wt_room'].includes(packet[0])) {
      try {
        const account = await mongoose.connection.collection('users').findOne({ _id: new mongoose.Types.ObjectId(socket.user.id) });
        const decoded = jwt.verify(socket.handshake.auth.token, process.env.JWT_SECRET);
        if (!account || account.isBot || (account.tokenVersion || 0) !== (decoded.ver || 0) || (account.banUntil && new Date(account.banUntil) > new Date())) return callback({ error: 'Your session is expired or your account is banned.' });
        socket.user = { ...account, id: String(account._id) };
        socket.displayName = account.displayName || account.username;
      } catch { return callback({ error: 'Authentication unavailable.' }); }
    }
    next();
  });
  console.log(`User connected to Watch2Gether Service: ${socket.id} (User: ${socket.user?.id || 'Guest'}, Name: ${socket.displayName || 'Unknown'})`);

  // --- WATCH TOGETHER LOGIC ---
  socket.on('create_wt_room', (data, callback) => {
    if (!socket.user) return callback({ error: 'Must be logged in to create a room.' });
    handleWTRoomDisconnect(socket);
    
    // Generate 6-char random alphanumeric code
    let roomId;
    do { roomId = randomBytes(4).toString('hex').slice(0, 6).toUpperCase(); } while (wtRooms.has(roomId));
    
    wtRooms.set(roomId, {
      host: socket.id,
      hostUserId: socket.user.id,
      animeId: data.animeId,
      animeTitle: data.animeTitle,
      animeCover: data.animeCover,
      createdAt: Date.now(),
      status: data.scheduledFor ? 'scheduled' : 'live',
      scheduledFor: data.scheduledFor || null,
      hostName: socket.displayName || socket.user.username || 'User',
      hostAvatar: socket.user.avatar || null,
      members: new Map([[socket.id, { 
        id: socket.user.id, 
        displayName: socket.displayName || socket.user.username || 'User', 
        avatar: socket.user.avatar || null
      }]]),
      state: {
        episode: data.episode || 1,
        time: 0,
        playing: false
      },
      messages: []
    });

    socket.join(`wt-${roomId}`);
    socket.wtRoomId = roomId;

    callback({ success: true, roomId, state: wtRooms.get(roomId).state, isHost: true });
  });

  socket.on('join_wt_room', (roomId, callback) => {
    if (!socket.user) return callback({ error: 'Must be logged in to join a room.' });
    const room = wtRooms.get(roomId);
    if (!room) return callback({ error: 'Room not found or expired.' });
    if (room.status === 'ended') return callback({ error: 'This room has ended.' });
    if (socket.wtRoomId && socket.wtRoomId !== roomId) handleWTRoomDisconnect(socket);
    if (room.status === 'scheduled' && new Date(room.scheduledFor) <= new Date()) room.status = 'live';

    if (room.deleteTimeout) {
      clearTimeout(room.deleteTimeout);
      room.deleteTimeout = null;
    }

    room.members.set(socket.id, { 
      id: socket.user.id, 
      displayName: socket.displayName || socket.user.username || 'User', 
      avatar: socket.user.avatar || null
    });

    socket.join(`wt-${roomId}`);
    socket.wtRoomId = roomId;

    // Check if the joining user is the original host
    if (socket.user.id === room.hostUserId) {
      room.host = socket.id;
      if (room.hostTransferTimeout) {
        clearTimeout(room.hostTransferTimeout);
        room.hostTransferTimeout = null;
      }
    } else if (!room.members.has(room.host) && !room.hostTransferTimeout) {
      // If host is missing and no transfer is pending, take over
      room.host = socket.id;
      room.hostUserId = socket.user.id;
    }

    // Notify others
    io.to(`wt-${roomId}`).emit('wt_room_update', {
      members: Array.from(room.members.values()),
      hostId: room.members.get(room.host)?.id
    });

    const sysMsg = {
      _id: `sys_${Date.now()}_${Math.random()}`,
      type: 'system',
      text: `${socket.displayName} joined the room`,
      createdAt: new Date()
    };
    room.messages.push(sysMsg);
    if (room.messages.length > 100) room.messages.shift();
    socket.to(`wt-${roomId}`).emit('wt_new_message', sysMsg);
    
    socket.emit('wt_chat_history', room.messages);

    callback({ 
      success: true, 
      animeId: room.animeId,
      state: room.state, 
      isHost: room.host === socket.id,
      members: Array.from(room.members.values()),
      hostId: room.members.get(room.host)?.id
    });
  });

  socket.on('get_room_state', (callback) => {
    if (!socket.wtRoomId) return callback({ error: 'Not in a room' });
    const room = wtRooms.get(socket.wtRoomId);
    if (!room) return callback({ error: 'Room not found' });
    
    let currentState = { ...room.state };
    if (currentState.playing && currentState.lastUpdate) {
      currentState.time += (Date.now() - currentState.lastUpdate) / 1000;
    }
    
    callback({ state: currentState });
  });

  socket.on('wt_sync_state', (newState) => {
    if (!socket.wtRoomId) return;
    const room = wtRooms.get(socket.wtRoomId);
    if (!room) return;
    if (room.host !== socket.id || !newState || typeof newState.playing !== 'boolean' || !Number.isFinite(newState.time) || newState.time < 0) return;
    
    // Allow any user to update the global room state
    room.state = { ...room.state, time: newState.time, playing: newState.playing, lastUpdate: Date.now() };
    // Broadcast to everyone ELSE in the room
    socket.to(`wt-${socket.wtRoomId}`).emit('wt_sync_state', room.state);
  });

  socket.on('wt_change_episode', (epNum) => {
    if (!socket.wtRoomId) return;
    const room = wtRooms.get(socket.wtRoomId);
    if (!room) return;
    if (room.host !== socket.id || !Number.isInteger(epNum) || epNum < 1) return;

    room.state.episode = epNum;
    room.state.time = 0;
    room.state.playing = false;
    io.to(`wt-${socket.wtRoomId}`).emit('wt_change_episode', epNum);
  });

  socket.on('wt_chat_message', (text) => {
    if (!socket.wtRoomId || !socket.user) return;
    const room = wtRooms.get(socket.wtRoomId);
    if (!room) return;

    const msg = {
      _id: `wtmsg_${Date.now()}_${Math.random()}`,
      userId: socket.user.id,
      displayName: socket.displayName,
      avatar: socket.user.avatar,
      text: text.trim(),
      createdAt: new Date(),
      isHost: room.host === socket.id
    };

    room.messages.push(msg);
    if (room.messages.length > 100) room.messages.shift();

    io.to(`wt-${socket.wtRoomId}`).emit('wt_new_message', msg);
  });

  socket.on('wt_typing', () => {
    if (!socket.wtRoomId || !socket.user) return;
    socket.to(`wt-${socket.wtRoomId}`).emit('wt_user_typing', { 
      userId: socket.user.id, 
      displayName: socket.displayName 
    });
  });

  socket.on('wt_stop_typing', () => {
    if (!socket.wtRoomId || !socket.user) return;
    socket.to(`wt-${socket.wtRoomId}`).emit('wt_user_stop_typing', socket.user.id);
  });

  socket.on('leave_wt_room', () => {
    handleWTRoomDisconnect(socket);
  });

  socket.on('end_wt_room', () => {
    if (!socket.wtRoomId || !socket.user) return;
    const room = wtRooms.get(socket.wtRoomId);
    if (room && room.host === socket.id) {
      room.status = 'ended';
      io.to(`wt-${socket.wtRoomId}`).emit('wt_room_ended');
      const sysMsg = {
        _id: `sys_end_${Date.now()}_${Math.random()}`,
        type: 'system',
        text: `${socket.displayName} ended the room session`,
        createdAt: new Date()
      };
      room.messages.push(sysMsg);
      io.to(`wt-${socket.wtRoomId}`).emit('wt_new_message', sysMsg);
    }
  });

  socket.on('start_scheduled_room', () => {
    if (!socket.wtRoomId || !socket.user) return;
    const room = wtRooms.get(socket.wtRoomId);
    if (room && room.host === socket.id && room.status === 'scheduled') {
      room.status = 'live';
      io.to(`wt-${socket.wtRoomId}`).emit('wt_room_started');
    }
  });

  const handleWTRoomDisconnect = (sock) => {
    if (sock.wtRoomId) {
      const departingRoomId = sock.wtRoomId;
      const room = wtRooms.get(departingRoomId);
      if (room) {
        room.members.delete(sock.id);
        
        if (room.members.size === 0) {
          if (room.status === 'scheduled' || room.status === 'ended') {
            // Keep scheduled/ended rooms for a longer duration (e.g. 2 hours)
            room.deleteTimeout = setTimeout(() => {
              wtRooms.delete(departingRoomId);
            }, 7200000);
          } else {
            // Give a 30-second grace period before deleting the live room
            // This allows users to survive accidental unmounts/refreshes
            room.deleteTimeout = setTimeout(() => {
              wtRooms.delete(departingRoomId);
            }, 30000);
          }
        } else {
          // Transfer host if host disconnected (with 10s delay)
          if (room.host === sock.id) {
            room.hostTransferTimeout = setTimeout(() => {
              if (wtRooms.has(departingRoomId)) {
                const currentRoom = wtRooms.get(departingRoomId);
                // If the host hasn't rejoined and there are still members
                if (currentRoom.host === sock.id && currentRoom.members.size > 0) {
                  const newHostSocketId = currentRoom.members.keys().next().value;
                  currentRoom.host = newHostSocketId;
                  currentRoom.hostUserId = currentRoom.members.get(newHostSocketId).id;
                  
                  io.to(newHostSocketId).emit('wt_host_transferred');
                  
                  const sysMsg = {
                    _id: `sys_host_${Date.now()}_${Math.random()}`,
                    type: 'system',
                    text: `${currentRoom.members.get(newHostSocketId).displayName} is the new host`,
                    createdAt: new Date()
                  };
                  currentRoom.messages.push(sysMsg);
                  if (currentRoom.messages.length > 100) currentRoom.messages.shift();
                  io.to(`wt-${departingRoomId}`).emit('wt_new_message', sysMsg);
                  
                  io.to(`wt-${departingRoomId}`).emit('wt_room_update', {
                    members: Array.from(currentRoom.members.values()),
                    hostId: currentRoom.members.get(currentRoom.host)?.id
                  });
                }
                currentRoom.hostTransferTimeout = null;
              }
            }, 10000);
          }
          
          io.to(`wt-${sock.wtRoomId}`).emit('wt_room_update', {
            members: Array.from(room.members.values()),
            hostId: room.members.get(room.host)?.id
          });
          
          const sysMsg2 = {
            _id: `sys_${Date.now()}_${Math.random()}`,
            type: 'system',
            text: `${sock.displayName} left the room`,
            createdAt: new Date()
          };
          room.messages.push(sysMsg2);
          if (room.messages.length > 100) room.messages.shift();
          io.to(`wt-${sock.wtRoomId}`).emit('wt_new_message', sysMsg2);
        }
      }
      sock.leave(`wt-${sock.wtRoomId}`);
      sock.wtRoomId = null;
    }
  };

  socket.on('disconnect', () => {
    console.log(`User disconnected from Watch2Gether Service: ${socket.id}`);
    handleWTRoomDisconnect(socket);
  });
});

const PORT = process.env.WT_PORT || process.env.PORT || 8081;

// Background cleanup job for expired scheduled rooms
setInterval(() => {
  const now = Date.now();
  for (const [roomId, room] of wtRooms.entries()) {
    if (room.status === 'scheduled' && room.scheduledFor) {
      const scheduledTime = new Date(room.scheduledFor).getTime();
      if (now >= scheduledTime && room.members.size > 0) {
        room.status = 'live';
        io.to(`wt-${roomId}`).emit('wt_room_started');
      }
      // If 5 minutes have passed since scheduled time and room is still empty
      if (now > scheduledTime + (5 * 60 * 1000) && room.members.size === 0) {
        wtRooms.delete(roomId);
        console.log(`Deleted expired scheduled room ${roomId}`);
      }
    }
  }
}, 60000); // Check every minute

connectDB().then(() => {
  server.listen(PORT, process.env.HOST || '0.0.0.0', () => {
    console.log(`Watch2Gether service running on port ${PORT}`);
  });
});
