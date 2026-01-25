/**
 * GOPANG 통합 인증 API
 * 
 * 【인증 방식】
 * 1. 전화번호 + 비밀번호 (테스트/시뮬레이션)
 * 2. 오픈해시 신원 증명 (상용)
 * 3. WebAuthn 생체인증 (향후)
 */

import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import identityService from '../services/auth-identity';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'gopang-dev-secret-key-2026';

// 사용자 데이터 로드
let users: any[] = [];

function loadUsers() {
  try {
    const dataDir = '/gopang/frontend/data';
    
    ['users-registry.json', 'users-jeju-city.json'].forEach(file => {
      const filePath = path.join(dataDir, file);
      if (fs.existsSync(filePath)) {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        users.push(...data.users);
      }
    });
    
    console.log(`[AuthUnified] Loaded ${users.length} users`);
  } catch (error) {
    console.error('[AuthUnified] Failed to load users:', error);
  }
}

loadUsers();

// ============================================================================
// 방식 1: 전화번호 + 비밀번호 로그인 (테스트용)
// ============================================================================

router.post('/login/phone', (req: Request, res: Response) => {
  const { identifier, password } = req.body;
  
  if (!identifier || !password) {
    res.status(400).json({ success: false, error: '전화번호/ID와 비밀번호를 입력하세요.' });
    return;
  }
  
  const normalizedId = identifier.replace(/-/g, '');
  
  const user = users.find(u => 
    u.userId === identifier ||
    u.loginId === identifier ||
    u.userId.replace(/-/g, '') === normalizedId
  );
  
  if (!user) {
    res.status(401).json({ success: false, error: '등록되지 않은 사용자입니다.' });
    return;
  }
  
  if (user.password !== password) {
    res.status(401).json({ success: false, error: '비밀번호가 올바르지 않습니다.' });
    return;
  }
  
  const accessToken = jwt.sign({
    userId: user.userId,
    loginId: user.loginId,
    name: user.name,
    authMethod: 'phone'
  }, JWT_SECRET, { expiresIn: '24h' });
  
  console.log(`[AuthUnified] Phone login: ${user.loginId}`);
  
  res.json({
    success: true,
    authMethod: 'phone',
    accessToken,
    user: {
      userId: user.userId,
      loginId: user.loginId,
      name: user.name,
      location: user.location,
      business: user.business,
      wallet: user.wallet
    }
  });
});

// ============================================================================
// 방식 2: 오픈해시 신원 증명 로그인 (상용)
// ============================================================================

router.post('/login/identity', async (req: Request, res: Response) => {
  try {
    const { proof } = req.body;
    
    if (!proof) {
      res.status(400).json({ success: false, error: '신원 증명이 필요합니다.' });
      return;
    }

    const result = await identityService.verifyIdentity(proof);
    
    if (!result.verified) {
      res.status(401).json({ 
        success: false, 
        error: result.message,
        details: result.details 
      });
      return;
    }

    const accessToken = jwt.sign({
      name: result.identity?.name,
      documentType: result.identity?.documentType,
      issuer: result.identity?.issuer,
      authMethod: 'identity'
    }, JWT_SECRET, { expiresIn: '24h' });

    console.log(`[AuthUnified] Identity login: ${result.identity?.name}`);

    res.json({
      success: true,
      authMethod: 'identity',
      accessToken,
      identity: result.identity
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// 방식 3: 오픈해시 간편 인증 (해시 기반 빠른 로그인)
// ============================================================================

router.post('/login/quick', async (req: Request, res: Response) => {
  try {
    const { documentHash, layerId, timestamp, signature } = req.body;
    
    if (!documentHash || !layerId) {
      res.status(400).json({ 
        success: false, 
        error: 'documentHash와 layerId가 필요합니다.' 
      });
      return;
    }

    const ts = timestamp || new Date().toISOString();
    const sig = signature || crypto.createHash('sha256')
      .update(`${documentHash}:${ts}`)
      .digest('hex');

    const result = await identityService.quickAuth(documentHash, layerId, ts, sig);
    
    res.status(result.success ? 200 : 401).json({
      ...result,
      authMethod: 'quick'
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// 토큰 관리
// ============================================================================

// 토큰 검증
router.get('/verify', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ valid: false, error: '토큰이 없습니다.' });
    return;
  }
  
  try {
    const decoded = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
    res.json({ valid: true, user: decoded });
  } catch (error) {
    res.status(401).json({ valid: false, error: '유효하지 않은 토큰입니다.' });
  }
});

// 토큰 갱신
router.post('/refresh', (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  
  if (!refreshToken) {
    res.status(400).json({ success: false, error: 'refreshToken이 필요합니다.' });
    return;
  }
  
  try {
    const decoded = jwt.verify(refreshToken, JWT_SECRET) as any;
    
    const newAccessToken = jwt.sign({
      userId: decoded.userId,
      authMethod: decoded.authMethod || 'refresh'
    }, JWT_SECRET, { expiresIn: '24h' });
    
    res.json({ success: true, accessToken: newAccessToken });
  } catch (error) {
    res.status(401).json({ success: false, error: '유효하지 않은 토큰입니다.' });
  }
});

// ============================================================================
// 사용자 정보
// ============================================================================

// 사용자 조회
router.get('/user/:id', (req: Request, res: Response) => {
  const user = users.find(u => 
    u.userId === req.params.id || u.loginId === req.params.id
  );
  
  if (!user) {
    res.status(404).json({ success: false, error: '사용자를 찾을 수 없습니다.' });
    return;
  }
  
  res.json({
    success: true,
    user: {
      userId: user.userId,
      loginId: user.loginId,
      name: user.name,
      location: user.location,
      business: user.business,
      wallet: user.wallet
    }
  });
});

// 통계
router.get('/stats', (req: Request, res: Response) => {
  res.json({
    totalUsers: users.length,
    jejuCity: users.filter(u => u.location.city === 'KR-JEJU-JEJU').length,
    seogwipo: users.filter(u => u.location.city === 'KR-JEJU-SEOGWIPO').length,
    authMethods: ['phone', 'identity', 'quick', 'webauthn (향후)']
  });
});

export default router;
