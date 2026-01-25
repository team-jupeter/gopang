/**
 * Socket.IO 서버 설정
 * Day 15: ConnectionManager 통합
 */

import { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import { socketAuthMiddleware, AuthenticatedSocket } from './authMiddleware';
import { registerMessageHandlers } from './messageHandler';
import { connectionManager } from './connectionManager';

let io: Server | null = null;
const MAX_CONNECTIONS = 100;

export function initSocketServer(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ['websocket', 'polling'],
  });

  io.use(socketAuthMiddleware);

  io.on('connection', (socket: AuthenticatedSocket) => {
    const stats = connectionManager.getStats();
    if (stats.totalConnections >= MAX_CONNECTIONS) {
      socket.emit('error', { message: '서버 연결 한도 초과' });
      socket.disconnect(true);
      return;
    }

    const user = socket.data.user!;

    // ConnectionManager에 등록
    connectionManager.addConnection(socket, io!);

    socket.join(`user:${user.userId}`);

    socket.emit('connected', {
      socketId: socket.id,
      user: { userId: user.userId, email: user.email, userType: user.userType },
      serverTime: new Date().toISOString(),
    });

    // 메시지 핸들러 등록
    registerMessageHandlers(socket);

    // 재연결 시 미수신 메시지 동기화 요청
    socket.on('sync:request', (data: { lastMessageId?: string }) => {
      connectionManager.syncMissedMessages(socket, data.lastMessageId);
    });

    socket.on('disconnect', (reason) => {
      connectionManager.removeConnection(socket.id);
      console.log(`[Socket] Disconnected: ${user.email} - ${reason}`);
    });

    socket.on('error', (error) => {
      console.error(`[Socket] Error: ${socket.id}`, error);
    });

    socket.on('ping', (callback) => {
      if (typeof callback === 'function') callback({ pong: true, time: Date.now() });
    });
  });

  console.log('[Socket] Server initialized with ConnectionManager');
  return io;
}

export function getIO(): Server {
  if (!io) throw new Error('Socket.IO not initialized');
  return io;
}

export function getConnectionCount(): number {
  return connectionManager.getStats().totalConnections;
}

export function getConnectionStats() {
  return connectionManager.getStats();
}

export default { initSocketServer, getIO, getConnectionCount, getConnectionStats };
