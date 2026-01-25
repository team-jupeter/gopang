/**
 * Auth API
 * Day 10/18: 회원가입, 로그인, 토큰 갱신
 */

import { Router, Request, Response } from 'express';
import authService from '../services/auth';
import { authenticate, AuthRequest } from '../middlewares/auth';

const router = Router();

// 회원가입
router.post('/register', async (req: Request, res: Response) => {
  const { email, password, name } = req.body;

  if (!email || !password || !name) {
    res.status(400).json({ success: false, error: 'email, password, name은 필수입니다.' });
    return;
  }

  const result = await authService.register(email, password, name);
  res.status(result.success ? 201 : 400).json(result);
});

// 로그인
router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ success: false, error: 'email, password는 필수입니다.' });
    return;
  }

  const result = await authService.login(email, password);
  res.status(result.success ? 200 : 401).json(result);
});

// 토큰 갱신
router.post('/refresh', async (req: Request, res: Response) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    res.status(400).json({ success: false, error: 'refreshToken은 필수입니다.' });
    return;
  }

  const result = await authService.refreshAccessToken(refreshToken);
  res.status(result.success ? 200 : 401).json(result);
});

// 현재 사용자 정보
router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  res.json({ 
    success: true, 
    user: { 
      userId: req.user!.userId, 
      email: req.user!.email 
    } 
  });
});

export default router;
