/**
 * Users API
 * Day 10: 사용자 조회, 수정
 */

import { Router, Response } from 'express';
import { getDatabase } from '../services/database';
import { authenticate, AuthRequest } from '../middlewares/auth';

const router = Router();

// 사용자 목록 조회 (관리용)
router.get('/', authenticate, (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const users = db.prepare(`
    SELECT id, email, name, user_type, region_code, egct_balance, is_active, created_at
    FROM users WHERE is_active = 1 LIMIT 100
  `).all();

  res.json({ users, count: users.length });
});

// 특정 사용자 조회
router.get('/:id', authenticate, (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const user = db.prepare(`
    SELECT id, email, name, user_type, region_code, egct_balance, is_active, created_at
    FROM users WHERE id = ?
  `).get(req.params.id);

  if (!user) {
    res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    return;
  }

  res.json({ user });
});

// 내 정보 수정
router.patch('/me', authenticate, (req: AuthRequest, res: Response) => {
  const { name, regionCode } = req.body;
  const db = getDatabase();

  const updates: string[] = [];
  const values: any[] = [];

  if (name) {
    updates.push('name = ?');
    values.push(name);
  }
  if (regionCode) {
    updates.push('region_code = ?');
    values.push(regionCode);
  }

  if (updates.length === 0) {
    res.status(400).json({ error: '수정할 항목이 없습니다.' });
    return;
  }

  updates.push("updated_at = datetime('now')");
  values.push(req.user!.userId);

  db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);

  res.json({ success: true, message: '정보가 수정되었습니다.' });
});

export default router;
