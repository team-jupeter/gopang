/**
 * Socket.IO 설정
 * Day 11-15: 실시간 통신
 */

import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'gopang-dev-secret-key-2026';

interface AuthenticatedSocket extends Socket {
  data: {
    user?: {
      userId: string;
      email: string;
    };
  };
}

export function setupSocketIO(io: SocketIOServer): void {
  // 인증 미들웨어
  io.use((socket: AuthenticatedSocket, next) => {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      return next(new Error('Authentication required'));
    }
    
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      socket.data.user = {
        userId: decoded.userId,
        email: decoded.email,
      };
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    console.log(`✓ Socket connected: ${socket.id} (${socket.data.user?.email})`);
    
    // 메시지 전송
    socket.on('message:send', async (data, callback) => {
      try {
        const { content, conversationId } = data;
        
        // 메시지 처리 (간단한 에코)
        const response = {
          id: `msg_${Date.now()}`,
          content,
          conversationId,
          timestamp: new Date().toISOString(),
          status: 'delivered',
        };
        
        socket.emit('message:status', { 
          messageId: response.id, 
          status: 'delivered' 
        });
        
        if (callback) callback({ success: true, message: response });
      } catch (error) {
        if (callback) callback({ success: false, error: 'Message send failed' });
      }
    });

    // 고팡 상태 요청
    socket.on('gopang:status', (callback) => {
      callback({
        status: 'active',
        version: '0.18.0',
        timestamp: new Date().toISOString(),
      });
    });

    // 연결 해제
    socket.on('disconnect', (reason) => {
      console.log(`✗ Socket disconnected: ${socket.id} (${reason})`);
    });
  });

  console.log('✓ Socket.IO initialized');
}
