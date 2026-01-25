/**
 * Vault API
 * Day 17: 자동 분류 엔드포인트 추가
 */

import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middlewares/auth';
import { vaultService, DrawerType, DRAWER_TYPES, DRAWER_LABELS } from '../services/vault';

const router = Router();
router.use(authenticate);

// Vault 요약 조회
router.get('/summary', async (req: AuthRequest, res: Response) => {
  try {
    const summary = await vaultService.getVaultSummary(req.user!.userId);
    res.json({ success: true, summary });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Vault 조회 실패' });
  }
});

// 모든 서랍 조회
router.get('/drawers', async (req: AuthRequest, res: Response) => {
  try {
    const drawers = await vaultService.getDrawers(req.user!.userId);
    res.json({
      success: true,
      drawers: drawers.map(d => ({
        id: d.id,
        type: d.drawer_type,
        label: DRAWER_LABELS[d.drawer_type],
        updatedAt: d.updated_at,
      })),
    });
  } catch (error) {
    res.status(500).json({ success: false, error: '서랍 조회 실패' });
  }
});

// 특정 서랍 내용 조회
router.get('/drawers/:type', async (req: AuthRequest, res: Response) => {
  const drawerType = (req.params.type as string).toUpperCase() as DrawerType;
  if (!DRAWER_TYPES.includes(drawerType)) {
    res.status(400).json({ success: false, error: '유효하지 않은 서랍 유형' });
    return;
  }

  try {
    const items = await vaultService.getDrawerContent(req.user!.userId, drawerType);
    res.json({ success: true, drawerType, label: DRAWER_LABELS[drawerType], items, count: items.length });
  } catch (error) {
    res.status(500).json({ success: false, error: '서랍 내용 조회 실패' });
  }
});

// 서랍에 항목 추가
router.post('/drawers/:type/items', async (req: AuthRequest, res: Response) => {
  const drawerType = (req.params.type as string).toUpperCase() as DrawerType;
  const { title, data } = req.body;

  if (!DRAWER_TYPES.includes(drawerType)) {
    res.status(400).json({ success: false, error: '유효하지 않은 서랍 유형' });
    return;
  }
  if (!title) {
    res.status(400).json({ success: false, error: 'title은 필수입니다.' });
    return;
  }

  try {
    const item = await vaultService.addItem(req.user!.userId, drawerType, title, data || {});
    res.status(201).json({ success: true, item });
  } catch (error) {
    res.status(500).json({ success: false, error: '항목 추가 실패' });
  }
});

// 자동 분류하여 항목 추가 (Day 17)
router.post('/items/auto', async (req: AuthRequest, res: Response) => {
  const { title, data } = req.body;

  if (!title) {
    res.status(400).json({ success: false, error: 'title은 필수입니다.' });
    return;
  }

  try {
    const result = await vaultService.addItemAutoClassify(req.user!.userId, title, data || {});
    res.status(201).json({
      success: true,
      item: result.item,
      classification: {
        drawerType: result.classification.drawerType,
        label: DRAWER_LABELS[result.classification.drawerType],
        confidence: result.classification.confidence,
        matchedKeywords: result.classification.matchedKeywords,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: '자동 분류 실패' });
  }
});

// 분류 미리보기 (저장 없이)
router.post('/classify', async (req: AuthRequest, res: Response) => {
  const { content } = req.body;

  if (!content) {
    res.status(400).json({ success: false, error: 'content는 필수입니다.' });
    return;
  }

  const result = vaultService.classifyContent(content);
  res.json({
    success: true,
    classification: {
      drawerType: result.drawerType,
      label: DRAWER_LABELS[result.drawerType],
      confidence: result.confidence,
      matchedKeywords: result.matchedKeywords,
      scores: result.scores,
    },
  });
});

// 서랍 항목 수정
router.patch('/drawers/:type/items/:itemId', async (req: AuthRequest, res: Response) => {
  const drawerType = (req.params.type as string).toUpperCase() as DrawerType;
  const itemId = req.params.itemId as string;
  const { title, data } = req.body;

  if (!DRAWER_TYPES.includes(drawerType)) {
    res.status(400).json({ success: false, error: '유효하지 않은 서랍 유형' });
    return;
  }

  try {
    const item = await vaultService.updateItem(req.user!.userId, drawerType, itemId, { title, data });
    if (!item) {
      res.status(404).json({ success: false, error: '항목을 찾을 수 없습니다.' });
      return;
    }
    res.json({ success: true, item });
  } catch (error) {
    res.status(500).json({ success: false, error: '항목 수정 실패' });
  }
});

// 서랍 항목 삭제
router.delete('/drawers/:type/items/:itemId', async (req: AuthRequest, res: Response) => {
  const drawerType = (req.params.type as string).toUpperCase() as DrawerType;
  const itemId = req.params.itemId as string;

  if (!DRAWER_TYPES.includes(drawerType)) {
    res.status(400).json({ success: false, error: '유효하지 않은 서랍 유형' });
    return;
  }

  try {
    const deleted = await vaultService.deleteItem(req.user!.userId, drawerType, itemId);
    if (!deleted) {
      res.status(404).json({ success: false, error: '항목을 찾을 수 없습니다.' });
      return;
    }
    res.json({ success: true, message: '항목이 삭제되었습니다.' });
  } catch (error) {
    res.status(500).json({ success: false, error: '항목 삭제 실패' });
  }
});

export default router;
