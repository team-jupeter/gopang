/**
 * 전화번호 기반 인증 API
 * 테스트/시뮬레이션용 단순 인증
 */
import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'gopang-dev-secret-key-2026';

// 사용자 데이터 로드
let users: any[] = [];

function loadUsers() {
  try {
    const dataDir = '/gopang/frontend/data';
    
    const seogwipoPath = path.join(dataDir, 'users-registry.json');
    if (fs.existsSync(seogwipoPath)) {
      const data = JSON.parse(fs.readFileSync(seogwipoPath, 'utf-8'));
      users.push(...data.users);
    }
    
    const jejuPath = path.join(dataDir, 'users-jeju-city.json');
    if (fs.existsSync(jejuPath)) {
      const data = JSON.parse(fs.readFileSync(jejuPath, 'utf-8'));
      users.push(...data.users);
    }
    
    console.log(`[AuthPhone] Loaded ${users.length} users`);
  } catch (error) {
    console.error('[AuthPhone] Failed to load users:', error);
  }
}

loadUsers();

// 로그인
router.post('/login', (req: Request, res: Response) => {
  const { identifier, password } = req.body;
  
  if (!identifier || !password) {
    res.status(400).json({ success: false, error: '전화번호/ID와 비밀번호를 입력하세요.' });
    return;
  }
  
  // 전화번호 정규화 (하이픈 제거 후 비교)
  const normalizedId = identifier.replace(/-/g, '');
  
  const user = users.find(u => 
    u.userId === identifier ||
    u.loginId === identifier ||
    u.userId.replace(/-/g, '') === normalizedId ||
    u.phone === identifier
  );
  
  if (!user) {
    res.status(401).json({ success: false, error: '등록되지 않은 사용자입니다.' });
    return;
  }
  
  if (user.password !== password) {
    res.status(401).json({ success: false, error: '비밀번호가 올바르지 않습니다.' });
    return;
  }
  
  // JWT 토큰 생성
  const accessToken = jwt.sign({
    userId: user.userId,
    loginId: user.loginId,
    name: user.name,
    district: user.location.district
  }, JWT_SECRET, { expiresIn: '24h' });
  
  const refreshToken = jwt.sign({
    userId: user.userId
  }, JWT_SECRET, { expiresIn: '7d' });
  
  console.log(`[AuthPhone] Login: ${user.loginId} (${user.name})`);
  
  res.json({
    success: true,
    message: '로그인 성공',
    accessToken,
    refreshToken,
    user: {
      userId: user.userId,
      loginId: user.loginId,
      name: user.name,
      phone: user.phone,
      location: user.location,
      business: user.business,
      wallet: user.wallet
    }
  });
});

// 토큰 검증
router.get('/verify', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ valid: false, error: '토큰이 없습니다.' });
    return;
  }
  
  const token = authHeader.split(' ')[1];
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
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
    const decoded = jwt.verify(refreshToken, JWT_SECRET) as { userId: string };
    const user = users.find(u => u.userId === decoded.userId);
    
    if (!user) {
      res.status(401).json({ success: false, error: '사용자를 찾을 수 없습니다.' });
      return;
    }
    
    const newAccessToken = jwt.sign({
      userId: user.userId,
      loginId: user.loginId,
      name: user.name,
      district: user.location.district
    }, JWT_SECRET, { expiresIn: '24h' });
    
    res.json({ success: true, accessToken: newAccessToken });
  } catch (error) {
    res.status(401).json({ success: false, error: '유효하지 않은 토큰입니다.' });
  }
});

// 사용자 정보 조회
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
      phone: user.phone,
      location: user.location,
      business: user.business,
      wallet: user.wallet
    }
  });
});

// 지역별 사용자 목록
router.get('/users/district/:code', (req: Request, res: Response) => {
  const districtUsers = users.filter(u => 
    u.location.district.endsWith(req.params.code)
  );
  
  res.json({
    success: true,
    district: req.params.code,
    count: districtUsers.length,
    users: districtUsers.map(u => ({
      userId: u.userId,
      loginId: u.loginId,
      name: u.name,
      business: u.business.corpName
    }))
  });
});

// 전체 사용자 수
router.get('/stats', (req: Request, res: Response) => {
  const jejuCity = users.filter(u => u.location.city === 'KR-JEJU-JEJU').length;
  const seogwipo = users.filter(u => u.location.city === 'KR-JEJU-SEOGWIPO').length;
  
  res.json({
    total: users.length,
    jejuCity,
    seogwipo,
    districts: {
      jeju: 26,
      seogwipo: 12
    }
  });
});

export default router;
