/**
 * Socket.IO 인증 미들웨어
 * Day 12: JWT 검증, socket.data.user 저장, 토큰 만료 10분 전 refresh 알림
 */

import { Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { getConfig } from '../config';

interface TokenPayload {
  userId: string;
  email: string;
  userType: string;
  iat: number;
  exp: number;
}

export interface AuthenticatedSocket extends Socket {
  data: {
    user?: TokenPayload;
  };
}

/**
 * Socket.IO 인증 미들웨어
 */
export function socketAuthMiddleware(socket: AuthenticatedSocket, next: (err?: Error) => void): void {
  const token = socket.handshake.auth?.token;

  if (!token) {
    console.log(`[Socket Auth] Rejected: No token - ${socket.id}`);
    return next(new Error('인증 토큰이 필요합니다.'));
  }

  try {
    const config = getConfig();
    const payload = jwt.verify(token, config.jwtSecret) as TokenPayload;

    // 사용자 정보 저장
    socket.data.user = payload;
    console.log(`[Socket Auth] Authenticated: ${payload.email} - ${socket.id}`);

    // 토큰 만료 10분 전 refresh 이벤트 예약
    const now = Math.floor(Date.now() / 1000);
    const timeUntilExpiry = payload.exp - now;
    const refreshTime = (timeUntilExpiry - 600) * 1000; // 만료 10분 전

    if (refreshTime > 0) {
      setTimeout(() => {
        if (socket.connected) {
          socket.emit('token:refresh', {
            message: '토큰이 곧 만료됩니다. 갱신이 필요합니다.',
            expiresIn: 600,
          });
          console.log(`[Socket Auth] Refresh reminder sent: ${payload.email}`);
        }
      }, refreshTime);
    }

    next();
  } catch (error) {
    const message = error instanceof jwt.TokenExpiredError
      ? '토큰이 만료되었습니다.'
      : '유효하지 않은 토큰입니다.';
    console.log(`[Socket Auth] Rejected: ${message} - ${socket.id}`);
    return next(new Error(message));
  }
}

export default socketAuthMiddleware;
