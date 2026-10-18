import express from 'express';
import { Server } from 'socket.io';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { initGameServer } from './src/server/game.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const PORT = Number(process.env.PORT || 3000);
  
  // Setup Socket.IO
  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
      credentials: false
    },
    transports: ['polling', 'websocket']
  });

  // Initialize Game Logic
  initGameServer(io);

  // Sajikan folder dist jika ada, jika tidak ada berikan endpoint healthcheck
  const distPath = path.join(__dirname, 'dist');
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    app.get('/', (req, res) => {
      res.send('Werewolf Backend Server is Running!');
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on port ${PORT} (http://0.0.0.0:${PORT})`);
  });
}

startServer();