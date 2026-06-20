import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Enable access from dev clients
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3001;

// Keep track of rooms and who is the host
interface RoomSession {
  roomId: string;
  hostSocketId: string;
  controllerSocketId?: string;
  createdAt: number;
}

const activeRooms = new Map<string, RoomSession>();

// Helper to generate a room ID
function generateRoomId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let roomId = '';
  for (let i = 0; i < 6; i++) {
    roomId += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  // Ensure uniqueness
  if (activeRooms.has(roomId)) {
    return generateRoomId();
  }
  return roomId;
}

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // 1. Host creates a room (Desktop client)
  socket.on('host-room', (callback) => {
    const roomId = generateRoomId();
    activeRooms.set(roomId, {
      roomId,
      hostSocketId: socket.id,
      createdAt: Date.now()
    });
    socket.join(roomId);
    console.log(`Host created room: ${roomId} (Socket: ${socket.id})`);
    if (callback && typeof callback === 'function') {
      callback({ success: true, roomId });
    }
  });

  // 2. Controller joins a room (Mobile device)
  socket.on('join-room', (roomId: string, callback) => {
    const cleanRoomId = roomId.trim().toUpperCase();
    const session = activeRooms.get(cleanRoomId);

    if (!session) {
      console.log(`Join failed: room ${cleanRoomId} not found`);
      if (callback && typeof callback === 'function') {
        callback({ success: false, error: 'Room not found' });
      }
      return;
    }

    if (session.controllerSocketId) {
      console.log(`Join failed: room ${cleanRoomId} already has a controller`);
      if (callback && typeof callback === 'function') {
        callback({ success: false, error: 'Room already occupied' });
      }
      return;
    }

    // Pair the controller
    session.controllerSocketId = socket.id;
    socket.join(cleanRoomId);
    console.log(`Controller joined room: ${cleanRoomId} (Socket: ${socket.id})`);

    // Notify the host
    socket.to(cleanRoomId).emit('controller-joined', { socketId: socket.id });

    if (callback && typeof callback === 'function') {
      callback({ success: true, roomId: cleanRoomId });
    }
  });

  // 3. Forward controller data (smoothed motion telemetry) to the host
  socket.on('controller-data', (data) => {
    const roomId = Array.from(socket.rooms).find(r => r !== socket.id);
    if (roomId) {
      socket.to(roomId).emit('motion-data', data);
    }
  });

  // 3b. Forward pre-classified gesture events from controller to host
  //     These take priority over desktop-side re-classification
  socket.on('controller-gesture', (gesture) => {
    const roomId = Array.from(socket.rooms).find(r => r !== socket.id);
    if (roomId) {
      socket.to(roomId).emit('controller-gesture', gesture);
    }
  });

  // 4. Forward game feedback events (vibrations, visual cues) from host to controller
  socket.on('game-event', (event) => {
    const roomId = Array.from(socket.rooms).find(r => r !== socket.id);
    if (roomId) {
      socket.to(roomId).emit('game-feedback', event);
    }
  });

  // Handle disconnection
  socket.on('disconnecting', () => {
    console.log(`Socket disconnecting: ${socket.id}`);
    
    // Check if this socket was a host or controller in any active room
    for (const [roomId, session] of activeRooms.entries()) {
      if (session.hostSocketId === socket.id) {
        console.log(`Host disconnected from room: ${roomId}. Cleaning up room.`);
        socket.to(roomId).emit('host-disconnected');
        activeRooms.delete(roomId);
      } else if (session.controllerSocketId === socket.id) {
        console.log(`Controller disconnected from room: ${roomId}`);
        session.controllerSocketId = undefined;
        socket.to(roomId).emit('controller-disconnected');
      }
    }
  });

  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

app.get('/health', (req, res) => {
  res.send({ status: 'healthy', activeRooms: activeRooms.size });
});

server.listen(PORT, () => {
  console.log(`Neon Ronin backend server listening on port ${PORT}`);
});
