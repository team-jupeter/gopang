/**
 * Transaction API
 * Day 18-19: 거래 서비스 + 5단계 검증 API
 */

import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middlewares/auth';
import { 
  transactionService, 
  TRANSACTION_STATUS, 
  TRANSACTION_TYPE,
  CreateTransactionInput 
} from '../services/transaction';
import { layerBalanceService } from '../services/layerBalance';
import { transactionValidator } from '../services/transactionValidator';

const router = Router();
router.use(authenticate);

// ============ 통계 및 Layer 관련 (먼저 정의) ============

// 거래 통계
router.get('/stats/summary', async (req: AuthRequest, res: Response) => {
  try {
    const stats = transactionService.getTransactionStats(req.user!.userId);
    res.json({ success: true, stats });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || '통계 조회 실패' });
  }
});

// Layer 계층 구조 조회
router.get('/layers/hierarchy', async (req: AuthRequest, res: Response) => {
  try {
    const hierarchy = layerBalanceService.getHierarchy();
    res.json({ success: true, hierarchy });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || '계층 조회 실패' });
  }
});

// 엔티티 Layer 등록
router.post('/layers/register', async (req: AuthRequest, res: Response) => {
  const { entityId, layer1Id } = req.body;

  if (!entityId || !layer1Id) {
    res.status(400).json({ success: false, error: 'entityId와 layer1Id는 필수입니다' });
    return;
  }

  try {
    const info = layerBalanceService.registerEntity(entityId, layer1Id);
    res.status(201).json({ success: true, layerInfo: info });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message || '등록 실패' });
  }
});

// 엔티티 Layer 정보 조회
router.get('/layers/entity/:entityId', async (req: AuthRequest, res: Response) => {
  try {
    const entityId = req.params.entityId as string;
    const info = layerBalanceService.getEntityLayerInfo(entityId);
    if (!info) {
      res.status(404).json({ success: false, error: '엔티티를 찾을 수 없습니다' });
      return;
    }
    res.json({ success: true, layerInfo: info });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || '조회 실패' });
  }
});

// 거래 잔액 검증 미리보기
router.post('/layers/verify-transfer', async (req: AuthRequest, res: Response) => {
  const { fromEntityId, toEntityId, amount } = req.body;

  if (!fromEntityId || !toEntityId || !amount) {
    res.status(400).json({ success: false, error: '필수 파라미터가 누락되었습니다' });
    return;
  }

  try {
    const result = layerBalanceService.verifyTransactionBalance(fromEntityId, toEntityId, amount);
    res.json({ success: true, verification: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || '검증 실패' });
  }
});

// ============ 엔티티 잔액 관리 ============

// 엔티티 잔액 설정
router.post('/entity/balance', async (req: AuthRequest, res: Response) => {
  const { entityId, balance, verified, kycLevel, dailyLimit } = req.body;

  if (!entityId || balance === undefined) {
    res.status(400).json({ success: false, error: 'entityId와 balance는 필수입니다' });
    return;
  }

  try {
    const result = transactionValidator.setEntityBalance(
      entityId, 
      balance, 
      verified ?? false, 
      kycLevel ?? 0,
      dailyLimit ?? 100
    );
    res.status(201).json({ success: true, entityBalance: result });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message || '설정 실패' });
  }
});

// 엔티티 잔액 조회
router.get('/entity/balance/:entityId', async (req: AuthRequest, res: Response) => {
  try {
    const entityId = req.params.entityId as string;
    const balance = transactionValidator.getEntityBalance(entityId);
    if (!balance) {
      res.status(404).json({ success: false, error: '엔티티 잔액 정보를 찾을 수 없습니다' });
      return;
    }
    res.json({ success: true, entityBalance: balance });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || '조회 실패' });
  }
});

// 5단계 검증 미리보기
router.post('/validate', async (req: AuthRequest, res: Response) => {
  const { fromEntityId, toEntityId, amount, hasExplicitApproval } = req.body;

  if (!fromEntityId || !toEntityId || !amount) {
    res.status(400).json({ success: false, error: '필수 파라미터가 누락되었습니다' });
    return;
  }

  try {
    const result = await transactionValidator.validateTransaction(
      fromEntityId,
      toEntityId,
      amount,
      req.user!.userId,
      hasExplicitApproval ?? false
    );
    res.json({ success: true, validation: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || '검증 실패' });
  }
});

// ============ 거래 CRUD ============

// 거래 생성
router.post('/', async (req: AuthRequest, res: Response) => {
  const { type, amount, fromEntityId, toEntityId, description, metadata, hasExplicitApproval } = req.body;

  if (!type || !Object.values(TRANSACTION_TYPE).includes(type)) {
    res.status(400).json({ success: false, error: '유효하지 않은 거래 유형' });
    return;
  }
  if (!amount || amount <= 0) {
    res.status(400).json({ success: false, error: '금액은 0보다 커야 합니다' });
    return;
  }
  if (!fromEntityId) {
    res.status(400).json({ success: false, error: 'fromEntityId는 필수입니다' });
    return;
  }

  try {
    const input: CreateTransactionInput = {
      type,
      amount,
      fromEntityId,
      toEntityId,
      description,
      metadata,
      hasExplicitApproval,
    };

    const tx = await transactionService.createTransaction(req.user!.userId, input);
    
    const statusCode = tx.status === TRANSACTION_STATUS.FAILED ? 400 : 
                       tx.status === TRANSACTION_STATUS.APPROVAL_REQUIRED ? 202 : 201;
    res.status(statusCode).json({ 
      success: tx.status !== TRANSACTION_STATUS.FAILED, 
      transaction: tx 
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || '거래 생성 실패' });
  }
});

// 거래 이력 조회
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const filter = {
      status: req.query.status as any,
      type: req.query.type as any,
      fromDate: req.query.fromDate as string,
      toDate: req.query.toDate as string,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
      offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
    };

    const transactions = transactionService.getTransactionHistory(req.user!.userId, filter);
    res.json({ success: true, transactions, count: transactions.length });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || '거래 이력 조회 실패' });
  }
});

// 거래 조회
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const txId = req.params.id as string;
    const tx = transactionService.getTransaction(req.user!.userId, txId);
    if (!tx) {
      res.status(404).json({ success: false, error: '거래를 찾을 수 없습니다' });
      return;
    }
    res.json({ success: true, transaction: tx });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || '거래 조회 실패' });
  }
});

// 거래 검증
router.post('/:id/verify', async (req: AuthRequest, res: Response) => {
  try {
    const txId = req.params.id as string;
    const tx = transactionService.verifyTransaction(req.user!.userId, txId);
    if (!tx) {
      res.status(404).json({ success: false, error: '거래를 찾을 수 없습니다' });
      return;
    }
    res.json({ success: true, transaction: tx });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message || '거래 검증 실패' });
  }
});

// 거래 완료
router.post('/:id/complete', async (req: AuthRequest, res: Response) => {
  try {
    const txId = req.params.id as string;
    const tx = transactionService.completeTransaction(req.user!.userId, txId);
    if (!tx) {
      res.status(404).json({ success: false, error: '거래를 찾을 수 없습니다' });
      return;
    }
    res.json({ success: true, transaction: tx });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message || '거래 완료 실패' });
  }
});

// 거래 취소
router.post('/:id/cancel', async (req: AuthRequest, res: Response) => {
  const { reason } = req.body;

  try {
    const txId = req.params.id as string;
    const tx = transactionService.cancelTransaction(req.user!.userId, txId, reason);
    if (!tx) {
      res.status(404).json({ success: false, error: '거래를 찾을 수 없습니다' });
      return;
    }
    res.json({ success: true, transaction: tx });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message || '거래 취소 실패' });
  }
});

// 명시적 승인
router.post('/:id/approve', async (req: AuthRequest, res: Response) => {
  try {
    const txId = req.params.id as string;
    const tx = await transactionService.approveTransaction(req.user!.userId, txId);
    if (!tx) {
      res.status(404).json({ success: false, error: '거래를 찾을 수 없습니다' });
      return;
    }
    res.json({ success: true, transaction: tx });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message || '승인 실패' });
  }
});

export default router;
