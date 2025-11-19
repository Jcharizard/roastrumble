# RoastRumble

Real-time freestyle rap battle platform built with Next.js, Node.js, Socket.io, and WebRTC.

## Setup

### Frontend
```bash
npm install
npm run dev
```

### Backend
```bash
cd server
npm install
npm start
```

## Environment Variables

### Frontend (.env.local)
```
NEXT_PUBLIC_SOCKET_SERVER_URL=http://localhost:3001
```

### Backend (server/.env)
```
PORT=3001
CLIENT_URL=http://localhost:3000
CLIENT_URL_WWW=http://localhost:3000  # For production: add www subdomain
```

## Deployment

- **Frontend:** Deploy to Vercel
- **Backend:** Deploy to Railway

See deployment documentation for details.

---

Built with 🔥 by a 16-year-old developer
