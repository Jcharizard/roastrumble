const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// CORS configuration
app.use(cors());

// Allow both www and non-www versions of the domain
const allowedOrigins = [
  'http://localhost:3000',
  'https://roastrumble.com',
  'https://www.roastrumble.com',
  process.env.CLIENT_URL
].filter(Boolean); // Remove any undefined values

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: false
  }
});

// Queue management
const queue = [];
const activeRooms = new Map();
let connectedUsers = 0;

// Broadcast queue stats to all users
function broadcastQueueUpdate() {
  io.emit('queue-update', {
    queueSize: queue.length,
    usersOnline: connectedUsers
  });
}

// Battle words for random selection
const battleWords = require('./battleWords');

// Helper function to generate room ID
function generateRoomId() {
  return Math.random().toString(36).substring(2, 15);
}

// Helper function to get random battle words
function getRandomWords(count = 2) {
  const shuffled = [...battleWords].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

io.on('connection', (socket) => {
  connectedUsers++;
  console.log(`User connected: ${socket.id} (Total: ${connectedUsers})`);
  broadcastQueueUpdate();
  
  let currentRoomId = null;

  // Handle joining queue
  socket.on('join-queue', ({ nickname }) => {
    // ===== INPUT VALIDATION =====
    // Validate nickname exists and is a string
    if (!nickname || typeof nickname !== 'string') {
      console.log(`Invalid nickname from ${socket.id}: empty or not string`);
      socket.emit('error', { message: 'Invalid nickname' });
      return;
    }
    
    // Trim whitespace
    nickname = nickname.trim();
    
    // Check minimum length
    if (nickname.length === 0) {
      console.log(`Invalid nickname from ${socket.id}: empty after trim`);
      socket.emit('error', { message: 'Nickname cannot be empty' });
      return;
    }
    
    // Limit maximum length (30 characters)
    if (nickname.length > 30) {
      nickname = nickname.substring(0, 30);
      console.log(`Nickname truncated to 30 chars: ${nickname}`);
    }
    
    // Remove potentially dangerous characters
    nickname = nickname.replace(/[<>'"]/g, '');
    
    console.log(`${nickname} (${socket.id}) attempting to join queue`);

    // First, remove any existing entries for this socket ID (cleanup from React Strict Mode double-mount)
    const existingSocketIndex = queue.findIndex(user => user.id === socket.id);
    if (existingSocketIndex !== -1) {
      queue.splice(existingSocketIndex, 1);
      console.log(`Cleaned up duplicate socket ${socket.id} from queue`);
    }

    // Then check if this nickname is already in queue with a DIFFERENT socket (actual duplicate user)
    const nicknameInQueue = queue.find(user => user.nickname === nickname && user.id !== socket.id);
    if (nicknameInQueue) {
      console.log(`Nickname ${nickname} already in queue with different socket (${nicknameInQueue.id}), rejecting`);
      return;
    }
    
    // Check if there's someone waiting
    if (queue.length > 0) {
      // Match found!
      const opponent = queue.shift();
      const roomId = generateRoomId();
      const words = getRandomWords(2);

            // Create room
            activeRooms.set(roomId, {
              players: [
                { id: opponent.id, nickname: opponent.nickname, ready: false, hasMicPrivilege: false },
                { id: socket.id, nickname, ready: false, hasMicPrivilege: false }
              ],
              words,
              startTime: Date.now(),
              lastSwitchTime: 0, // Initialize lastSwitchTime
              newWordsVotes: new Set(), // Track who voted for new words
              shouldGenerateNewWords: false // Flag to generate new words on next switch
            });

      // Join both players to room
      socket.join(roomId);
      opponent.socket.join(roomId);

      // Notify both players
      opponent.socket.emit('match-found', {
        roomId,
        opponent: nickname
      });

      socket.emit('match-found', {
        roomId,
        opponent: opponent.nickname
      });

      console.log(`Match created: ${opponent.nickname} vs ${nickname} (Room: ${roomId})`);
      broadcastQueueUpdate();
    } else {
      // Add to queue
      queue.push({
        id: socket.id,
        nickname,
        socket,
        joinedAt: Date.now()
      });
      console.log(`Queue size: ${queue.length}`);
      broadcastQueueUpdate();
    }
  });

  // Handle leaving queue
  socket.on('leave-queue', () => {
    const index = queue.findIndex(user => user.id === socket.id);
    if (index !== -1) {
      const user = queue.splice(index, 1)[0];
      console.log(`${user.nickname} left queue`);
      broadcastQueueUpdate();
    }
  });

  // Handle joining room
  socket.on('join-room', ({ roomId, nickname }) => {
    // ===== INPUT VALIDATION =====
    if (!roomId || typeof roomId !== 'string') {
      console.log(`Invalid roomId from ${socket.id}`);
      return;
    }
    
    if (!nickname || typeof nickname !== 'string') {
      console.log(`Invalid nickname from ${socket.id} joining room`);
      return;
    }
    
    const room = activeRooms.get(roomId);
    if (!room) {
      console.log(`Room ${roomId} not found`);
      return;
    }

    socket.join(roomId);
    currentRoomId = roomId; // Track current room for this socket
    
    // Mark this player as ready
    const playerIndex = room.players.findIndex(p => p.id === socket.id);
    if (playerIndex !== -1) {
      room.players[playerIndex].ready = true;
    }
    
    // Check if both players are now in the room
    const bothReady = room.players.filter(p => p.ready).length === 2;
    
           if (bothReady && !room.battleStarted) {
             // Mark battle as started to prevent duplicate starts
             room.battleStarted = true;
             
             // Randomly choose who goes first (animation effect)
             const firstPlayerIndex = Math.random() < 0.5 ? 0 : 1;
             const firstPlayer = room.players[firstPlayerIndex].nickname;
             
             // Set mic privileges server-side
             room.players.forEach((player, index) => {
               player.hasMicPrivilege = (index === firstPlayerIndex);
             });
             
             // Choose beat server-side
             const beats = ['hmm-freestyle-beat', '12am-freestyle', 'what-ya-mean', 'late-night-mobbin'];
             const selectedBeat = beats[Math.floor(Math.random() * beats.length)];
             room.selectedBeat = selectedBeat;
             
             // Send battle start to BOTH players
             room.players.forEach((player, index) => {
               const opponent = room.players[1 - index];
               io.to(player.id).emit('battle-start', {
                 opponent: opponent.nickname,
                 words: room.words,
                 isInitiator: index === 0,
                 firstPlayer: firstPlayer,
                 hasMicPrivilege: player.hasMicPrivilege,
                 selectedBeat: selectedBeat
               });
             });
             console.log(`Battle starting in room ${roomId}: ${room.players[0].nickname} vs ${room.players[1].nickname} (${firstPlayer} goes first)`);
           } else {
      console.log(`${nickname} joined room ${roomId}, waiting for opponent...`);
    }
  });

  // Handle WebRTC signaling
  socket.on('webrtc-signal', ({ roomId, signal }) => {
    // Forward signal to other player in room
    socket.to(roomId).emit('webrtc-signal', signal);
  });

  // Handle chat messages
  socket.on('chat-message', (message) => {
    // ===== INPUT VALIDATION =====
    // Validate message object exists
    if (!message || typeof message !== 'object') {
      console.log(`Invalid chat message from ${socket.id}: not an object`);
      return;
    }
    
    // Validate message.message field
    if (!message.message || typeof message.message !== 'string') {
      console.log(`Invalid chat message from ${socket.id}: message field missing or not string`);
      return;
    }
    
    // Trim and validate message content
    message.message = message.message.trim();
    
    // Ignore empty messages
    if (message.message.length === 0) {
      return;
    }
    
    // Limit message length (500 characters max)
    if (message.message.length > 500) {
      message.message = message.message.substring(0, 500);
      console.log(`Chat message truncated to 500 chars`);
    }
    
    // Validate user field
    if (!message.user || typeof message.user !== 'string') {
      console.log(`Invalid chat message from ${socket.id}: user field missing`);
      return;
    }
    
    console.log('Chat message from', message.user, 'in room:', currentRoomId);
    // Forward chat message to other players in the same room
    if (currentRoomId) {
      socket.to(currentRoomId).emit('chat-message', message);
      console.log('Forwarded chat message to room:', currentRoomId);
    } else {
      console.log('No current room ID for chat message');
    }
  });

  // Handle force mute
  socket.on('force-mute-opponent', ({ roomId }) => {
    // Forward force mute to other players in the same room
    if (roomId) {
      socket.to(roomId).emit('force-mute');
    } else if (currentRoomId) {
      socket.to(currentRoomId).emit('force-mute');
    }
  });

  // Handle mic privilege switch
  socket.on('switch-mic-privilege', ({ roomId }) => {
    const room = activeRooms.get(roomId);
    if (room && room.players.length === 2) {
      // Prevent double-switching: add a small cooldown
      const now = Date.now();
      if (room.lastSwitchTime && (now - room.lastSwitchTime) < 1000) {
        console.log(`Ignoring duplicate switch request in room ${roomId} (too soon)`);
        return;
      }
      
      // Find current mic holder and switch to the other player
      const currentMicHolder = room.players.find(player => player.hasMicPrivilege);
      const otherPlayer = room.players.find(player => !player.hasMicPrivilege);
      
      if (currentMicHolder && otherPlayer) {
        // Switch mic privileges: current holder loses it, other player gets it
        currentMicHolder.hasMicPrivilege = false;
        otherPlayer.hasMicPrivilege = true;
        room.lastSwitchTime = now; // Record switch time
        
        console.log(`Mic switched: ${currentMicHolder.nickname} -> ${otherPlayer.nickname}`);
        
        // Check if new words should be generated (both players voted)
        if (room.shouldGenerateNewWords) {
          const newWords = getRandomWords(2);
          room.words = newWords;
          room.shouldGenerateNewWords = false;
          room.newWordsVotes.clear(); // Clear votes
          
          console.log(`🔄 Generating new words for room ${roomId}:`, newWords);
          
          // Broadcast new words to both players
          io.to(roomId).emit('new-words-generated', { words: newWords });
        }
        
        // Notify each player of their new mic privilege
        room.players.forEach(player => {
          io.to(player.id).emit('mic-privilege-updated', { 
            hasPrivilege: player.hasMicPrivilege
          });
        });
        
        console.log(`Mic privileges switched in room ${roomId}: ${currentMicHolder.nickname} -> ${otherPlayer.nickname}`);
      } else {
        console.log(`Warning: Could not find mic holder or other player in room ${roomId}`);
      }
    }
  });

  // Handle countdown start - broadcast to opponent
  socket.on('start-countdown', ({ roomId }) => {
    const room = activeRooms.get(roomId);
    if (room && room.players.length === 2) {
      // Find opponent
      const opponent = room.players.find(p => p.id !== socket.id);
      if (opponent) {
        console.log(`🔄 Broadcasting countdown start to opponent in room ${roomId}`);
        io.to(opponent.id).emit('start-countdown');
      }
    }
  });

  // Handle new words voting
  socket.on('vote-new-words', ({ roomId, vote }) => {
    const room = activeRooms.get(roomId);
    if (room && room.players.length === 2) {
      const player = room.players.find(p => p.id === socket.id);
      if (!player) {
        console.log(`Warning: Player ${socket.id} not found in room ${roomId}`);
        return;
      }
      
      if (vote) {
        // Add vote
        room.newWordsVotes.add(socket.id);
        console.log(`🗳️ ${player.nickname} voted for new words in room ${roomId} (${room.newWordsVotes.size}/2)`);
      } else {
        // Remove vote
        room.newWordsVotes.delete(socket.id);
        console.log(`🗳️ ${player.nickname} unvoted for new words in room ${roomId} (${room.newWordsVotes.size}/2)`);
      }
      
      // Check if both players voted
      if (room.newWordsVotes.size === 2) {
        room.shouldGenerateNewWords = true;
        console.log(`✅ Both players voted! New words will be generated on next switch in room ${roomId}`);
      } else {
        room.shouldGenerateNewWords = false;
      }
      
      // Notify opponent about vote update
      const opponent = room.players.find(p => p.id !== socket.id);
      if (opponent) {
        io.to(opponent.id).emit('new-words-vote-update', {
          votes: room.newWordsVotes.size,
          opponentVoted: room.newWordsVotes.has(socket.id)
        });
      }
    }
  });

  // Handle mic privilege request
  socket.on('request-mic-privilege', ({ roomId }) => {
    const room = activeRooms.get(roomId);
    if (room) {
      // Check if this player should have mic privilege
      const player = room.players.find(p => p.id === socket.id);
      if (player) {
        // Grant mic privilege based on server state
        socket.emit('mic-privilege-granted', { hasPrivilege: player.hasMicPrivilege || false });
      }
    }
  });

  // Handle heartbeat (keep connection alive, especially during countdowns)
  socket.on('heartbeat', ({ roomId }) => {
    // Just acknowledge - this keeps the connection active during countdown periods
    // Especially important for mobile browsers (Instagram, etc.) that aggressively suspend tabs
  });

  // Handle skip battle
  socket.on('skip-battle', ({ roomId }) => {
    const room = activeRooms.get(roomId);
    if (room) {
      // Notify opponent that this player skipped
      socket.to(roomId).emit('opponent-skipped');
      activeRooms.delete(roomId);
      console.log(`Room ${roomId} ended (skipped by ${socket.id})`);
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    connectedUsers--;
    console.log(`User disconnected: ${socket.id} (Total: ${connectedUsers})`);
    
    // Remove from queue
    const queueIndex = queue.findIndex(user => user.id === socket.id);
    if (queueIndex !== -1) {
      queue.splice(queueIndex, 1);
      broadcastQueueUpdate();
    }

    // Handle active room disconnection
    for (const [roomId, room] of activeRooms.entries()) {
      const playerIndex = room.players.findIndex(p => p.id === socket.id);
      if (playerIndex !== -1) {
        // Notify other player
        socket.to(roomId).emit('opponent-left');
        activeRooms.delete(roomId);
        console.log(`Room ${roomId} ended (disconnect)`);
        break;
      }
    }
    
    broadcastQueueUpdate();
  });
});

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    queueSize: queue.length,
    activeRooms: activeRooms.size
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🔥 RoastRumble Server running on port ${PORT}`);
  console.log(`📊 Queue: 0 | Active Rooms: 0`);
});

// Periodic stats logging
setInterval(() => {
  console.log(`📊 Queue: ${queue.length} | Active Rooms: ${activeRooms.size}`);
}, 30000); // Every 30 seconds

