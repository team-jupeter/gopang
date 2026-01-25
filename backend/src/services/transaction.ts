/**
 * Transaction Service
 * Day 18-19: 거래 서비스 + 5단계 검증
 */

import { v4 as uuidv4 } from 'uuid';
import db from '../db';
import { layerBalanceService, BalanceVerificationResult } from './layerBalance';
import { transactionValidator, ValidationResult } from './transactionValidator';

// 거래 상태
export const TRANSACTION_STATUS = {
  PENDING: 'PENDING',
  VERIFIED: 'VERIFIED',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
  APPROVAL_REQUIRED: 'APPROVAL_REQUIRED',  // 명시적 승인 필요
} as const;

export type TransactionStatus = typeof TRANSACTION_STATUS[keyof typeof TRANSACTION_STATUS];

// 거래 유형
export const TRANSACTION_TYPE = {
  TRANSFER: 'TRANSFER',
  PAYMENT: 'PAYMENT',
  REWARD: 'REWARD',
  REFUND: 'REFUND',
} as const;

export type TransactionType = typeof TRANSACTION_TYPE[keyof typeof TRANSACTION_TYPE];

// 거래 인터페이스
export interface Transaction {
  id: string;
  user_id: string;
  type: TransactionType;
  amount: number;
  currency: string;
  status: TransactionStatus;
  from_entity_id: string;
  to_entity_id?: string;
  description?: string;
  metadata?: Record<string, any>;
  failure_reason?: string;
  layer_verification?: BalanceVerificationResult;
  validation_result?: ValidationResult;
  created_at: string;
  updated_at: string;
  verified_at?: string;
  completed_at?: string;
}

// 거래 생성 입력
export interface CreateTransactionInput {
  type: TransactionType;
  amount: number;
  currency?: string;
  fromEntityId: string;
  toEntityId?: string;
  description?: string;
  metadata?: Record<string, any>;
  hasExplicitApproval?: boolean;
}

// 거래 이력 필터
export interface TransactionFilter {
  status?: TransactionStatus;
  type?: TransactionType;
  fromDate?: string;
  toDate?: string;
  limit?: number;
  offset?: number;
}

class TransactionService {
  /**
   * 거래 생성 (Layer 검증 + 5단계 검증)
   */
  async createTransaction(userId: string, input: CreateTransactionInput): Promise<Transaction> {
    const id = uuidv4();
    const now = new Date().toISOString();
    
    let layerVerification: BalanceVerificationResult | undefined;
    let validationResult: ValidationResult | undefined;
    let status: TransactionStatus = TRANSACTION_STATUS.PENDING;
    let failureReason: string | undefined;

    // 송금/결제인 경우 검증 수행
    if (input.toEntityId && (input.type === 'TRANSFER' || input.type === 'PAYMENT')) {
      // 1. Layer 잔액 불변성 검증
      layerVerification = layerBalanceService.verifyTransactionBalance(
        input.fromEntityId,
        input.toEntityId,
        input.amount
      );
      
      if (!layerVerification.valid) {
        status = TRANSACTION_STATUS.FAILED;
        failureReason = `Layer 검증 실패: ${layerVerification.error}`;
      } else {
        // 2. 5단계 거래 검증
        validationResult = await transactionValidator.validateTransaction(
          input.fromEntityId,
          input.toEntityId,
          input.amount,
          userId,
          input.hasExplicitApproval || false
        );

        if (!validationResult.valid) {
          if (validationResult.requiresExplicitApproval) {
            status = TRANSACTION_STATUS.APPROVAL_REQUIRED;
            failureReason = validationResult.approvalReason;
          } else {
            status = TRANSACTION_STATUS.FAILED;
            const failedStep = validationResult.steps.find(s => !s.passed);
            failureReason = failedStep?.message || '검증 실패';
          }
        }
      }
    }
    
    const stmt = db.prepare(`
      INSERT INTO transactions (
        id, user_id, type, amount, currency, status,
        from_address, to_address, description, metadata, 
        failure_reason, layer_verification, validation_result,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      id,
      userId,
      input.type,
      input.amount,
      input.currency || 'T',
      status,
      input.fromEntityId,
      input.toEntityId || null,
      input.description || null,
      input.metadata ? JSON.stringify(input.metadata) : null,
      failureReason || null,
      layerVerification ? JSON.stringify(layerVerification) : null,
      validationResult ? JSON.stringify(validationResult) : null,
      now,
      now
    );
    
    return this.getTransaction(userId, id)!;
  }

  /**
   * 거래 조회
   */
  getTransaction(userId: string, transactionId: string): Transaction | null {
    const stmt = db.prepare(`
      SELECT * FROM transactions WHERE id = ? AND user_id = ?
    `);
    const row = stmt.get(transactionId, userId) as any;
    
    if (!row) return null;
    
    return this.mapTransaction(row);
  }

  /**
   * 명시적 승인으로 거래 재시도
   */
  async approveTransaction(userId: string, transactionId: string): Promise<Transaction | null> {
    const tx = this.getTransaction(userId, transactionId);
    if (!tx) return null;

    if (tx.status !== TRANSACTION_STATUS.APPROVAL_REQUIRED) {
      throw new Error(`승인 대기 상태가 아닙니다. (현재: ${tx.status})`);
    }

    // 명시적 승인으로 재검증
    const validationResult = await transactionValidator.validateTransaction(
      tx.from_entity_id,
      tx.to_entity_id!,
      tx.amount,
      userId,
      true  // 명시적 승인
    );

    const now = new Date().toISOString();
    let newStatus: TransactionStatus;
    let failureReason: string | undefined;

    if (validationResult.valid) {
      newStatus = TRANSACTION_STATUS.PENDING;
    } else {
      newStatus = TRANSACTION_STATUS.FAILED;
      const failedStep = validationResult.steps.find(s => !s.passed);
      failureReason = failedStep?.message || '검증 실패';
    }

    db.prepare(`
      UPDATE transactions 
      SET status = ?, failure_reason = ?, validation_result = ?, updated_at = ?
      WHERE id = ? AND user_id = ?
    `).run(
      newStatus, 
      failureReason || null, 
      JSON.stringify(validationResult), 
      now, 
      transactionId, 
      userId
    );

    return this.getTransaction(userId, transactionId);
  }

  /**
   * 거래 검증 및 상태 업데이트
   */
  verifyTransaction(userId: string, transactionId: string): Transaction | null {
    const tx = this.getTransaction(userId, transactionId);
    if (!tx) return null;
    
    if (tx.status !== TRANSACTION_STATUS.PENDING) {
      throw new Error(`검증할 수 없는 상태입니다. (현재: ${tx.status})`);
    }

    return this.updateStatus(userId, transactionId, TRANSACTION_STATUS.VERIFIED);
  }

  /**
   * 거래 완료 (Layer 잔액 실제 반영)
   */
  completeTransaction(userId: string, transactionId: string): Transaction | null {
    const tx = this.getTransaction(userId, transactionId);
    if (!tx) return null;
    
    if (tx.status !== TRANSACTION_STATUS.VERIFIED) {
      throw new Error(`완료할 수 없는 상태입니다. (현재: ${tx.status})`);
    }

    // Layer 잔액 실제 반영
    if (tx.to_entity_id && tx.layer_verification?.valid) {
      layerBalanceService.executeTransfer(
        tx.from_entity_id,
        tx.to_entity_id,
        tx.amount
      );
    }

    return this.updateStatus(userId, transactionId, TRANSACTION_STATUS.COMPLETED);
  }

  /**
   * 거래 상태 업데이트
   */
  updateStatus(
    userId: string,
    transactionId: string,
    status: TransactionStatus,
    failureReason?: string
  ): Transaction | null {
    const tx = this.getTransaction(userId, transactionId);
    if (!tx) return null;
    
    if (!this.isValidTransition(tx.status, status)) {
      throw new Error(`유효하지 않은 상태 전이: ${tx.status} → ${status}`);
    }
    
    const now = new Date().toISOString();
    let verifiedAt = tx.verified_at;
    let completedAt = tx.completed_at;
    
    if (status === TRANSACTION_STATUS.VERIFIED) {
      verifiedAt = now;
    } else if (status === TRANSACTION_STATUS.COMPLETED) {
      completedAt = now;
    }
    
    db.prepare(`
      UPDATE transactions 
      SET status = ?, failure_reason = ?, verified_at = ?, completed_at = ?, updated_at = ?
      WHERE id = ? AND user_id = ?
    `).run(status, failureReason || null, verifiedAt, completedAt, now, transactionId, userId);
    
    return this.getTransaction(userId, transactionId);
  }

  /**
   * 거래 취소
   */
  cancelTransaction(userId: string, transactionId: string, reason?: string): Transaction | null {
    const tx = this.getTransaction(userId, transactionId);
    if (!tx) return null;
    
    if (tx.status !== TRANSACTION_STATUS.PENDING && tx.status !== TRANSACTION_STATUS.APPROVAL_REQUIRED) {
      throw new Error(`취소할 수 없는 상태입니다. (현재: ${tx.status})`);
    }
    
    return this.updateStatus(userId, transactionId, TRANSACTION_STATUS.CANCELLED, reason);
  }

  /**
   * 거래 이력 조회
   */
  getTransactionHistory(userId: string, filter: TransactionFilter = {}): Transaction[] {
    let query = `SELECT * FROM transactions WHERE user_id = ?`;
    const params: any[] = [userId];
    
    if (filter.status) {
      query += ` AND status = ?`;
      params.push(filter.status);
    }
    
    if (filter.type) {
      query += ` AND type = ?`;
      params.push(filter.type);
    }
    
    if (filter.fromDate) {
      query += ` AND created_at >= ?`;
      params.push(filter.fromDate);
    }
    
    if (filter.toDate) {
      query += ` AND created_at <= ?`;
      params.push(filter.toDate);
    }
    
    query += ` ORDER BY created_at DESC`;
    
    if (filter.limit) {
      query += ` LIMIT ?`;
      params.push(filter.limit);
      
      if (filter.offset) {
        query += ` OFFSET ?`;
        params.push(filter.offset);
      }
    }
    
    const stmt = db.prepare(query);
    const rows = stmt.all(...params) as any[];
    
    return rows.map(row => this.mapTransaction(row));
  }

  /**
   * 거래 통계
   */
  getTransactionStats(userId: string): {
    total: number;
    pending: number;
    completed: number;
    failed: number;
    approvalRequired: number;
    totalAmount: number;
  } {
    const stmt = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status = 'APPROVAL_REQUIRED' THEN 1 ELSE 0 END) as approvalRequired,
        COALESCE(SUM(CASE WHEN status = 'COMPLETED' THEN amount ELSE 0 END), 0) as totalAmount
      FROM transactions WHERE user_id = ?
    `);
    
    const row = stmt.get(userId) as any;
    
    return {
      total: row.total || 0,
      pending: row.pending || 0,
      completed: row.completed || 0,
      failed: row.failed || 0,
      approvalRequired: row.approvalRequired || 0,
      totalAmount: row.totalAmount || 0,
    };
  }

  /**
   * 상태 전이 검증
   */
  private isValidTransition(from: TransactionStatus, to: TransactionStatus): boolean {
    const validTransitions: Record<TransactionStatus, TransactionStatus[]> = {
      [TRANSACTION_STATUS.PENDING]: [
        TRANSACTION_STATUS.VERIFIED,
        TRANSACTION_STATUS.FAILED,
        TRANSACTION_STATUS.CANCELLED,
      ],
      [TRANSACTION_STATUS.VERIFIED]: [
        TRANSACTION_STATUS.COMPLETED,
        TRANSACTION_STATUS.FAILED,
      ],
      [TRANSACTION_STATUS.COMPLETED]: [],
      [TRANSACTION_STATUS.FAILED]: [],
      [TRANSACTION_STATUS.CANCELLED]: [],
      [TRANSACTION_STATUS.APPROVAL_REQUIRED]: [
        TRANSACTION_STATUS.PENDING,
        TRANSACTION_STATUS.FAILED,
        TRANSACTION_STATUS.CANCELLED,
      ],
    };
    
    return validTransitions[from]?.includes(to) ?? false;
  }

  /**
   * DB row → Transaction
   */
  private mapTransaction(row: any): Transaction {
    return {
      id: row.id,
      user_id: row.user_id,
      type: row.type,
      amount: row.amount,
      currency: row.currency,
      status: row.status,
      from_entity_id: row.from_address,
      to_entity_id: row.to_address,
      description: row.description,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      failure_reason: row.failure_reason,
      layer_verification: row.layer_verification ? JSON.parse(row.layer_verification) : undefined,
      validation_result: row.validation_result ? JSON.parse(row.validation_result) : undefined,
      created_at: row.created_at,
      updated_at: row.updated_at,
      verified_at: row.verified_at,
      completed_at: row.completed_at,
    };
  }
}

export const transactionService = new TransactionService();
