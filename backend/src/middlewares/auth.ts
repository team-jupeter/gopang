/**
 * Auth Middleware
 * Day 9/18: JWT 인증 미들웨어
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'gopang-dev-secret-key-2026';

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
  };
}

/**
 * JWT 인증 미들웨어
 */
export function authenticate(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: '인증 토큰이 필요합니다.' });
    return;
  }

  const token = authHeader.substring(7);

  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: string; email: string };
    req.user = {
      userId: payload.userId,
      email: payload.email,
    };
    next();
  } catch (error) {
    res.status(401).json({ success: false, error: '유효하지 않은 토큰입니다.' });
  }
}

/**
 * 선택적 인증 (토큰 있으면 파싱, 없어도 통과)
 */
export function optionalAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const payload = jwt.verify(token, JWT_SECRET) as { userId: string; email: string };
      req.user = {
        userId: payload.userId,
        email: payload.email,
      };
    } catch {
      // 토큰 검증 실패해도 계속 진행
    }
  }

  next();
}
