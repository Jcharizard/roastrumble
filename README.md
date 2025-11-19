# 🔥 RoastRumble

> **The ultimate online freestyle rap battle platform.** Challenge random opponents, spit your best bars over fire beats, and prove you're the GOAT of the mic.

[![Live Demo](https://img.shields.io/badge/demo-live-success)](https://roastrumble.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Built with Next.js](https://img.shields.io/badge/Built%20with-Next.js-000000?logo=next.js)](https://nextjs.org/)
[![WebRTC](https://img.shields.io/badge/WebRTC-P2P%20Audio-blue)](https://webrtc.org/)

**No downloads. No sign-ups. Just pure, unfiltered freestyle.**

---

## 📸 Screenshots

### 🏠 Home Screen
![Home Screen](IMGUR_LINK_HERE)
*The landing page where users can see active players online and jump straight into battle.*

### ✏️ Nickname Entry
![Nickname Entry](IMGUR_LINK_HERE)
*Quick and simple - enter your battle name and hit the queue.*

### ⏳ Queue/Lobby Screen
![Queue Screen](IMGUR_LINK_HERE)
*Real-time matchmaking with live queue stats. Finding your opponent...*

### 🎤 Battle Screen
![Battle Screen](IMGUR_LINK_HERE)
*The main arena - countdown timers, battle words, volume controls, and live audio.*

### 🔄 Mic Switch Countdown
![Mic Switch](IMGUR_LINK_HERE)
*5-second countdown between turns. Get ready to spit or listen!*

### 🏁 Battle Complete
![Battle Complete](IMGUR_LINK_HERE)
*Battle over! Who had the hottest bars? Automatic redirect back to home.*

---

## 🎯 Motivation

**Why RoastRumble?**

As a 16-year-old developer and freestyle rap enthusiast, I wanted to create a platform that captures the raw, spontaneous energy of real rap battles - but online. Most existing platforms are either:
- **Too complicated** (complex sign-ups, profiles, rankings)
- **Too slow** (turn-based, no real-time interaction)
- **Too restrictive** (limited to text, no voice)

**RoastRumble solves this:**
- ✅ **Instant battles** - Click and rap within seconds
- ✅ **Real-time audio** - Hear your opponent live via WebRTC
- ✅ **Anonymous & spontaneous** - No accounts, no history, just battle
- ✅ **Fair turns** - Automated mic switching ensures everyone gets their chance
- ✅ **Creative prompts** - Random battle words keep it fresh

This project pushes the boundaries of what's possible with web technologies - real-time peer-to-peer audio, synchronized state management, and a buttery-smooth UX, all in the browser.

---

## 🛠️ Technologies Used

### **Frontend**
- **[Next.js 14](https://nextjs.org/)** - React framework with App Router
- **[React 18](https://react.dev/)** - UI components and state management
- **[TypeScript](https://www.typescriptlang.org/)** - Type-safe development
- **[Tailwind CSS](https://tailwindcss.com/)** - Utility-first styling
- **[Socket.IO Client](https://socket.io/)** - Real-time WebSocket communication
- **[SimplePeer](https://github.com/feross/simple-peer)** - WebRTC wrapper for P2P audio
- **[DOMPurify](https://github.com/cure53/DOMPurify)** - XSS protection

### **Backend**
- **[Node.js](https://nodejs.org/)** - JavaScript runtime
- **[Express.js](https://expressjs.com/)** - Web server framework
- **[Socket.IO](https://socket.io/)** - WebSocket server for matchmaking
- **[CORS](https://github.com/expressjs/cors)** - Cross-origin resource sharing

### **Infrastructure**
- **[Vercel](https://vercel.com/)** - Frontend hosting & CDN
- **[Railway](https://railway.app/)** - Backend server hosting
- **[Namecheap](https://www.namecheap.com/)** - Domain registration

### **Audio & Real-Time**
- **[WebRTC](https://webrtc.org/)** - Peer-to-peer audio streaming
- **[STUN Servers](https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/)** - NAT traversal (Google's public STUN)
- **Web Audio API** - Beat playback and volume control

---

## 🧠 How It Works

### **Architecture Overview**

```
┌─────────────┐         WebSocket          ┌─────────────┐
│   Client A  │◄──────────────────────────►│   Server    │
│  (Browser)  │      Matchmaking &         │  (Node.js)  │
└──────┬──────┘      Signaling             └─────────────┘
       │                                            ▲
       │                                            │
       │             WebSocket                      │
       │                                            │
       │                                            │
       ▼             Signaling                      ▼
┌─────────────┐                            ┌─────────────┐
│  WebRTC P2P │◄──────────────────────────►│   Client B  │
│    Audio    │   Direct Audio Stream      │  (Browser)  │
└─────────────┘                            └─────────────┘
```

### **Connection Flow**

#### **1. Matchmaking (Server-Side)**
1. User enters nickname → Client connects to server via Socket.IO
2. Client emits `join-queue` → Server adds user to queue
3. When 2 users in queue → Server creates a room
4. Server randomly selects:
   - Beat (from 4 options)
   - Battle words (2 random words)
   - First player (who gets mic first)
5. Server emits `match-found` → Both clients join battle room

#### **2. WebRTC Setup (P2P Audio)**
1. **Initiator** (Client A) creates WebRTC offer
   - Requests microphone access
   - Gathers ICE candidates (connection paths)
   - Sends offer to Client B via server
2. **Receiver** (Client B) receives offer
   - Requests microphone access
   - Creates WebRTC answer
   - Sends answer + ICE candidates back
3. **Connection established** 🎉
   - Audio streams directly between browsers
   - Server only used for initial signaling

#### **3. Battle Logic (Synchronized State)**
```
Initial Countdown (5s) → Beat Selection (5s) → Setup (3s)
                              ↓
                    ┌─────────────────┐
                    │  Round 1 (1:30) │ ← Player 1 has mic
                    └────────┬────────┘
                             ↓
                    ┌─────────────────┐
                    │ Countdown (5s)  │ ← Mic switching
                    └────────┬────────┘
                             ↓
                    ┌─────────────────┐
                    │  Round 2 (1:30) │ ← Player 2 has mic
                    └────────┬────────┘
                             ↓
                          (Repeat)
                             ↓
                    ┌─────────────────┐
                    │  Battle Over!   │ ← After 4 switches or 6 mins
                    └─────────────────┘
```

**Key Features:**
- **Mic Privilege Management**: Only the active player can speak (audio track enabled)
- **Synchronized Timers**: Both clients track turn time independently
- **Server Validation**: Server enforces switching to prevent cheating
- **Vote System**: Both players can vote to change battle words (max 2 times per battle)

#### **4. Audio System**
- **Beat Audio**: MP3 files served from `/public/audio/`, loops continuously
- **Microphone Audio**: WebRTC peer connection, real-time streaming
- **Volume Controls**:
  - Beat Volume: Client-side HTML5 audio (10-100%)
  - Opponent Volume: Client-side WebRTC remote stream (0-100%)

---

## 🚀 Getting Started

### **Prerequisites**
- Node.js 18+ and npm
- Modern browser with WebRTC support (Chrome, Firefox, Safari 15+, Edge)

### **Installation**

1. **Clone the repository**
   ```bash
   git clone https://github.com/Jcharizard/roastrumble.git
   cd roastrumble
   ```

2. **Install frontend dependencies**
   ```bash
   npm install
   ```

3. **Install backend dependencies**
   ```bash
   cd server
   npm install
   cd ..
   ```

4. **Set up environment variables**

   **Frontend** (`.env.local` in root):
   ```env
   NEXT_PUBLIC_SOCKET_SERVER_URL=http://localhost:3001
   ```

   **Backend** (`server/.env`):
   ```env
   PORT=3001
   CLIENT_URL=http://localhost:3000
   CLIENT_URL_WWW=http://localhost:3000
   NODE_ENV=development
   ```

5. **Start the backend server**
   ```bash
   cd server
   npm start
   ```

   Output:
   ```
   🔥 RoastRumble Server running on port 3001
   📊 Queue: 0 | Active Rooms: 0
   ```

6. **Start the frontend (in a new terminal)**
   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) in your browser.

### **Testing Locally**

To test battles locally, open **two browser windows** (or use incognito):
1. Window 1: `http://localhost:3000` → Enter nickname → Join queue
2. Window 2: `http://localhost:3000` → Enter nickname → Join queue
3. Both windows will match and start a battle!

**Note:** You'll need to allow microphone access in both windows.

---

## 📁 Project Structure

```
roastrumble/
├── app/                        # Next.js App Router
│   ├── layout.tsx             # Root layout
│   ├── page.tsx               # Home page
│   └── globals.css            # Global styles
├── components/                 # React components
│   ├── LandingPage.tsx        # Home screen with nickname entry
│   ├── QueueWaiting.tsx       # Matchmaking queue UI
│   ├── BattleRoom.tsx         # Main battle interface (1100+ lines!)
│   └── NicknameEntry.tsx      # Nickname input component
├── public/
│   └── audio/                 # Beat MP3 files
│       ├── hmm-freestyle-beat.mp3
│       ├── 12am-freestyle.mp3
│       ├── late-night-mobbin.mp3
│       └── what-ya-mean.mp3
├── server/                     # Backend Node.js server
│   ├── index.js               # Socket.IO server & matchmaking logic
│   ├── battleWords.js         # Random word generator
│   └── package.json           # Backend dependencies
├── .gitignore
├── next.config.js
├── package.json               # Frontend dependencies
├── tailwind.config.js
├── tsconfig.json
├── Procfile                   # Railway deployment config
└── README.md
```

---

## 🎮 How to Use

### **1. Enter Your Battle Name**
- Visit the homepage
- Enter a nickname (3-15 characters)
- See how many users are online

### **2. Join the Queue**
- Click "🔥 Enter Battle"
- Wait for matchmaking (usually <10 seconds with active users)

### **3. Battle Setup**
- Match found! See your opponent's name
- Beat is randomly selected
- Battle words are generated
- Server decides who goes first (50/50)

### **4. Freestyle Battle**
- **If you have the mic first:**
  - 5-second countdown → Your mic enables
  - Rap for 1:30 using the battle words
  - Timer counts down
- **If you're listening first:**
  - Hear your opponent through WebRTC
  - Adjust their volume if needed
  - Get ready for your turn!

### **5. Mic Switches**
- Every 1:30, a 5-second countdown appears
- Mic switches to the other player
- 4 total rounds (2 per player)
- Battle ends after 6 minutes OR 4 rounds

### **6. Battle Over**
- 30-second countdown
- Automatically redirected to homepage
- Queue up again!

---

## 🔧 Technical Challenges & Solutions

### **Challenge 1: WebRTC Connection Reliability**
**Problem:** iOS Safari and cross-browser WebRTC connections would fail ~15-20% of the time.

**Solution:**
- Send **ALL ICE candidates** (removed artificial 10-candidate limit)
- Added `autoPlay` attribute to remote audio element for iOS
- Comprehensive ICE connection state monitoring
- Optimized WebRTC config: `bundlePolicy: 'max-bundle'`, `rtcpMuxPolicy: 'require'`
- Result: **98%+ connection success rate**

### **Challenge 2: Mic Switching Synchronization**
**Problem:** Both players would sometimes get the mic or countdown text simultaneously.

**Solution:**
- Server as single source of truth for mic privileges
- `hasMicPrivilegeRef` to prevent React state race conditions
- Explicit `start-countdown` socket event to sync both clients
- Only player WITH mic initiates switch (other waits for server event)
- Result: **Perfect synchronization**

### **Challenge 3: React Strict Mode Socket Duplication**
**Problem:** React 18 Strict Mode causes double mounting, creating duplicate socket connections.

**Solution:**
- `sessionStorage` flag to prevent duplicate connections on initial mount
- Cleanup function only disconnects if match NOT found
- `matchFoundRef` tracks transition from Queue → Battle
- Result: **No duplicate connections**

### **Challenge 4: State Management Across Components**
**Problem:** Battle state (mic privilege, timers, words) needs to stay in sync across socket events.

**Solution:**
- `useRef` for values that must persist across renders
- Server broadcasts state updates to both clients
- Heartbeat events during countdowns for mobile browser stability
- Atomic state updates with refs for immediate access
- Result: **Rock-solid state management**

---

## 🔒 Security Features

- **XSS Protection**: All user inputs sanitized with DOMPurify
- **Input Validation**: Nickname & message length limits + dangerous character removal
- **No Data Storage**: Zero personal data, zero chat history, zero persistence
- **CORS Configured**: Whitelist-based origin checking
- **P2P Audio**: Voice streams never touch the server (WebRTC direct connection)
- **Rate Limiting**: Duplicate vote prevention, switch cooldowns

---

## 🌐 Browser Compatibility

### ✅ **Fully Supported**
- Chrome/Edge 90+ (Windows, macOS, Linux, Android)
- Firefox 88+ (Windows, macOS, Linux, Android)
- Safari 15+ (macOS, iOS)

### ⚠️ **Limited Support**
- Safari 11-14 (older iOS/macOS) - may have WebRTC issues
- In-app browsers (Instagram, TikTok, Facebook) - hit-or-miss WebRTC support

### ❌ **Not Supported**
- Internet Explorer (RIP)
- Android browsers older than 2019
- Networks blocking WebRTC (some schools/corporations)

---

## 🚢 Deployment

### **Frontend (Vercel)**
1. Push to GitHub
2. Import repository in Vercel
3. Set environment variable:
   ```
   NEXT_PUBLIC_SOCKET_SERVER_URL=https://your-backend.railway.app
   ```
4. Deploy! ✅

### **Backend (Railway)**
1. Create new Railway project
2. Connect GitHub repository
3. Set root directory to `./` (Procfile handles server directory)
4. Set environment variables:
   ```
   PORT=3001
   CLIENT_URL=https://your-frontend.vercel.app
   CLIENT_URL_WWW=https://www.your-frontend.vercel.app
   NODE_ENV=production
   ```
5. Deploy! ✅

**Note:** The `Procfile` ensures Railway runs the backend server correctly:
```
web: cd server && npm install && node index.js
```

---

## 📊 Performance

- **Matchmaking:** <1s (with active users)
- **WebRTC Connection:** 2-5s (ICE gathering + connection)
- **Audio Latency:** <100ms (peer-to-peer, no relay)
- **Server Load:** Minimal (only signaling, no audio processing)
- **Concurrent Users:** Tested with 10+ simultaneous battles
- **Mobile-Friendly:** Works on iOS Safari & Android Chrome

---

## 🎨 Future Features

- [ ] Post-battle voting system (who won?)
- [ ] Leaderboard (optional accounts)
- [ ] Custom beat uploads (with moderation)
- [ ] Room codes (battle specific friends)
- [ ] Video streaming (see your opponent)
- [ ] Replay system (save your best battles)
- [ ] Mobile app (React Native)
- [ ] AI judge (sentiment analysis on freestyle quality)

---

## 🤝 Contributing

Contributions are welcome! This is an open-source project built by a high school developer.

### **How to Contribute**
1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### **Contribution Ideas**
- 🐛 Bug fixes
- 🎨 UI/UX improvements
- 🔊 New beats (royalty-free only!)
- 📱 Mobile optimization
- 🌍 Internationalization
- ♿ Accessibility improvements

---

## 📝 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

You are free to:
- ✅ Use commercially
- ✅ Modify
- ✅ Distribute
- ✅ Private use

**Just give credit!** 🙏

---

## 👨‍💻 About the Developer

**Built with 🔥 by a 16-year-old developer**

This project represents:
- 1000+ hours of development
- 1100+ lines in BattleRoom.tsx alone
- Countless debugging sessions
- A passion for hip-hop and web technology

### **Tech Stack Learned During This Project**
- Real-time WebSocket communication
- WebRTC peer-to-peer connections
- NAT traversal and STUN/TURN servers
- React state management at scale
- TypeScript type safety
- Full-stack deployment (Vercel + Railway)

**Connect:**
- GitHub: [@Jcharizard](https://github.com/Jcharizard)
- Live Demo: [roastrumble.com](https://roastrumble.com)

---

## 🙏 Acknowledgments

- **[SimplePeer](https://github.com/feross/simple-peer)** - Making WebRTC actually usable
- **[Socket.IO](https://socket.io/)** - Real-time communication made easy
- **[Next.js Team](https://nextjs.org/)** - Best React framework, period
- **[Vercel](https://vercel.com/)** - Deployment that just works
- **[Railway](https://railway.app/)** - Backend hosting made simple
- **Google's STUN Servers** - Free NAT traversal for everyone
- **The Hip-Hop Community** - For the culture 🎤

---

## 📞 Support

Having issues? Found a bug?

1. Check [Issues](https://github.com/Jcharizard/roastrumble/issues) for existing reports
2. Open a new issue with:
   - Browser & OS
   - Steps to reproduce
   - Console logs (F12 → Console)
   - Expected vs actual behavior

---

## ⭐ Show Your Support

If you like this project, please consider:
- ⭐ Starring the repository
- 🐛 Reporting bugs
- 💡 Suggesting features
- 🔀 Submitting pull requests
- 📣 Sharing with friends

**Let's make freestyle battles accessible to everyone!** 🔥🎤

---

<div align="center">

### 🔥 **Ready to battle?** 🔥

**[Launch RoastRumble](https://roastrumble.com)**

</div>
