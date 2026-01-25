/**
 * Gopang Backend Server
 * Day 18: Transaction API 추가
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';

import authRoutes from './routes/auth';
import vaultRoutes from './routes/vault';
import transactionRoutes from './routes/transaction';
import aiRoutes from './routes/ai';
import identityRoutes from './routes/identity';
import authUnifiedRoutes from './routes/auth-unified';
import tradingRoutes from './routes/trading';
import aiChatRoutes from './routes/ai-chat';
import { setupSocketIO } from './socket';
import { layerBalanceService } from './services/layerBalance';

const app = express();
const httpServer = createServer(app);

// Socket.IO 설정
const io = new SocketIOServer(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 60000,
  pingInterval: 25000,
});

// 미들웨어
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json());

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '0.21.0',
    services: {
      auth: 'active',
      vault: 'active',
      transaction: 'active',
      socketio: 'active',
      ai: 'active',
      identity: 'active',
    }
  });
});

// API 라우트
app.use('/api/auth', authRoutes);
app.use('/api/vault', vaultRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/identity', identityRoutes);
app.use('/api/auth-unified', authUnifiedRoutes);
app.use('/api/trading', tradingRoutes);
app.use('/api/ai-chat', aiChatRoutes);
app.use('/api/auth-unified', authUnifiedRoutes);
app.use('/api/trading', tradingRoutes);
app.use('/api/ai-chat', aiChatRoutes);

// Socket.IO 설정
setupSocketIO(io);

// Layer 테이블 초기화
layerBalanceService.initializeTables();
console.log('✓ Layer tables initialized');

// 서버 시작
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════╗
║         Gopang Backend Server             ║
║═══════════════════════════════════════════║
║  REST API: http://localhost:${PORT}          ║
║  Socket.IO: ws://localhost:${PORT}           ║
║  Version: 0.21.0 (Day 21)                 ║
╠═══════════════════════════════════════════╣
║  Endpoints:                               ║
║  - /api/health                            ║
║  - /api/auth/*                            ║
║  - /api/vault/*                           ║
║  - /api/transactions/*                    ║
║  - /api/ai/*                    ║
╚═══════════════════════════════════════════╝
  `);
});

export { io };
