/**
 * JWT 인증 서비스
 * Day 9/18: 등록, 로그인, 토큰 검증
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import db from '../db';

const JWT_SECRET = process.env.JWT_SECRET || 'gopang-dev-secret-key-2026';
const JWT_EXPIRES_IN = '24h';
const REFRESH_EXPIRES_IN = '7d';
const BCRYPT_ROUNDS = 12;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_DURATION_MINUTES = 15;

interface User {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  login_attempts: number;
  locked_until: string | null;
  created_at: string;
  updated_at: string;
}

interface AuthResult {
  success: boolean;
  message: string;
  accessToken?: string;
  refreshToken?: string;
  user?: { id: string; email: string; name: string };
}

class AuthService {
  /**
   * 사용자 등록
   */
  async register(email: string, password: string, name: string): Promise<AuthResult> {
    // 이메일 중복 확인
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      return { success: false, message: '이미 등록된 이메일입니다.' };
    }

    // 비밀번호 해싱
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const userId = uuidv4();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO users (id, email, password_hash, name, created_at, updated_at, login_attempts)
      VALUES (?, ?, ?, ?, ?, ?, 0)
    `).run(userId, email, passwordHash, name, now, now);

    console.log(`[Auth] User registered: ${email}`);

    return {
      success: true,
      message: '회원가입 완료',
      user: { id: userId, email, name }
    };
  }

  /**
   * 로그인
   */
  async login(email: string, password: string): Promise<AuthResult> {
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as User | undefined;

    if (!user) {
      return { success: false, message: '이메일 또는 비밀번호가 올바르지 않습니다.' };
    }

    // 계정 잠금 확인
    if (user.locked_until) {
      const lockTime = new Date(user.locked_until);
      if (lockTime > new Date()) {
        const remainingMinutes = Math.ceil((lockTime.getTime() - Date.now()) / 60000);
        return { success: false, message: `계정이 잠겼습니다. ${remainingMinutes}분 후 다시 시도하세요.` };
      }
      // 잠금 해제
      db.prepare('UPDATE users SET locked_until = NULL, login_attempts = 0 WHERE id = ?').run(user.id);
    }

    // 비밀번호 확인
    const isValid = await bcrypt.compare(password, user.password_hash);
    
    if (!isValid) {
      const attempts = (user.login_attempts || 0) + 1;
      
      if (attempts >= MAX_LOGIN_ATTEMPTS) {
        const lockUntil = new Date(Date.now() + LOCK_DURATION_MINUTES * 60000).toISOString();
        db.prepare('UPDATE users SET login_attempts = ?, locked_until = ? WHERE id = ?')
          .run(attempts, lockUntil, user.id);
        return { success: false, message: `로그인 ${MAX_LOGIN_ATTEMPTS}회 실패. 계정이 ${LOCK_DURATION_MINUTES}분간 잠겼습니다.` };
      }
      
      db.prepare('UPDATE users SET login_attempts = ? WHERE id = ?').run(attempts, user.id);
      return { success: false, message: '이메일 또는 비밀번호가 올바르지 않습니다.' };
    }

    // 로그인 성공 - 시도 횟수 초기화
    const now = new Date().toISOString();
    db.prepare('UPDATE users SET login_attempts = 0, last_login_at = ? WHERE id = ?').run(now, user.id);

    // 토큰 생성
    const accessToken = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    const refreshToken = jwt.sign(
      { userId: user.id, type: 'refresh' },
      JWT_SECRET,
      { expiresIn: REFRESH_EXPIRES_IN }
    );

    console.log(`[Auth] User logged in: ${email}`);

    return {
      success: true,
      message: '로그인 성공',
      accessToken,
      refreshToken,
      user: { id: user.id, email: user.email, name: user.name }
    };
  }

  /**
   * Access Token 갱신
   */
  async refreshAccessToken(refreshToken: string): Promise<AuthResult> {
    try {
      const decoded = jwt.verify(refreshToken, JWT_SECRET) as any;
      
      if (decoded.type !== 'refresh') {
        return { success: false, message: '유효하지 않은 리프레시 토큰입니다.' };
      }

      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(decoded.userId) as User | undefined;
      
      if (!user) {
        return { success: false, message: '사용자를 찾을 수 없습니다.' };
      }

      const accessToken = jwt.sign(
        { userId: user.id, email: user.email },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );

      return {
        success: true,
        message: '토큰 갱신 완료',
        accessToken
      };
    } catch (error) {
      return { success: false, message: '토큰 갱신 실패' };
    }
  }

  /**
   * 토큰 검증
   */
  verifyToken(token: string): { valid: boolean; payload?: any } {
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      return { valid: true, payload };
    } catch {
      return { valid: false };
    }
  }
}

export default new AuthService();
