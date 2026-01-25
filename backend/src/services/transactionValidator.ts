/**
 * Transaction Validator Service
 * Day 19: 5단계 거래 검증
 * 
 * 1. 잔액 확인
 * 2. 신원 확인
 * 3. 한도 확인 (기본 100T, 명시적 승인 시 상향)
 * 4. 이상 탐지 (1시간 내 10건 미만)
 * 5. 규정 준수 (법률 준수 검사)
 */

import db from '../db';
import { layerBalanceService } from './layerBalance';

// 검증 단계
export const VALIDATION_STEPS = {
  BALANCE: 'BALANCE',           // 잔액 확인
  IDENTITY: 'IDENTITY',         // 신원 확인
  LIMIT: 'LIMIT',               // 한도 확인
  ANOMALY: 'ANOMALY',           // 이상 탐지
  COMPLIANCE: 'COMPLIANCE',     // 규정 준수
} as const;

export type ValidationStep = typeof VALIDATION_STEPS[keyof typeof VALIDATION_STEPS];

// 검증 결과
export interface StepResult {
  step: ValidationStep;
  passed: boolean;
  message: string;
  details?: Record<string, any>;
}

export interface ValidationResult {
  valid: boolean;
  steps: StepResult[];
  failedStep?: ValidationStep;
  requiresExplicitApproval: boolean;
  approvalReason?: string;
}

// 검증 설정
export interface ValidationConfig {
  defaultLimit: number;           // 기본 한도 (T)
  explicitApprovalLimit: number;  // 명시적 승인 필요 한도 (T)
  maxTransactionsPerHour: number; // 시간당 최대 거래 수
  maxAmountPerHour: number;       // 시간당 최대 금액 (T)
}

const DEFAULT_CONFIG: ValidationConfig = {
  defaultLimit: 100,
  explicitApprovalLimit: 100,
  maxTransactionsPerHour: 10,
  maxAmountPerHour: 500,
};

// 엔티티 잔액 정보 (실제로는 별도 테이블에서 관리)
interface EntityBalance {
  daily_limit?: number;
  entityId: string;
  balance: number;
  currency: string;
  verified: boolean;
  kycLevel: number;  // 0: 미인증, 1: 기본, 2: 강화, 3: 완전
}

class TransactionValidatorService {
  private config: ValidationConfig;

  constructor(config: ValidationConfig = DEFAULT_CONFIG) {
    this.config = config;
    this.initializeTables();
  }

  /**
   * 엔티티 잔액 테이블 초기화
   */
  private initializeTables(): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS entity_balances (
        entity_id TEXT PRIMARY KEY,
        balance REAL DEFAULT 0,
        currency TEXT DEFAULT 'T',
        verified INTEGER DEFAULT 0,
        kyc_level INTEGER DEFAULT 0,
        daily_limit REAL DEFAULT 100,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);
  }

  /**
   * 전체 5단계 검증 실행
   */
  async validateTransaction(
    fromEntityId: string,
    toEntityId: string,
    amount: number,
    userId: string,
    hasExplicitApproval: boolean = false
  ): Promise<ValidationResult> {
    const steps: StepResult[] = [];
    let requiresExplicitApproval = false;
    let approvalReason: string | undefined;

    // 1. 잔액 확인
    const balanceResult = await this.validateBalance(fromEntityId, amount);
    steps.push(balanceResult);
    if (!balanceResult.passed) {
      return {
        valid: false,
        steps,
        failedStep: VALIDATION_STEPS.BALANCE,
        requiresExplicitApproval: false,
      };
    }

    // 2. 신원 확인
    const identityResult = await this.validateIdentity(fromEntityId, toEntityId);
    steps.push(identityResult);
    if (!identityResult.passed) {
      return {
        valid: false,
        steps,
        failedStep: VALIDATION_STEPS.IDENTITY,
        requiresExplicitApproval: false,
      };
    }

    // 3. 한도 확인
    const limitResult = await this.validateLimit(fromEntityId, amount, hasExplicitApproval);
    steps.push(limitResult);
    if (!limitResult.passed) {
      if (limitResult.details?.requiresApproval) {
        requiresExplicitApproval = true;
        approvalReason = limitResult.message;
      } else {
        return {
          valid: false,
          steps,
          failedStep: VALIDATION_STEPS.LIMIT,
          requiresExplicitApproval: true,
          approvalReason: limitResult.message,
        };
      }
    }

    // 4. 이상 탐지
    const anomalyResult = await this.detectAnomaly(fromEntityId, userId, amount);
    steps.push(anomalyResult);
    if (!anomalyResult.passed) {
      return {
        valid: false,
        steps,
        failedStep: VALIDATION_STEPS.ANOMALY,
        requiresExplicitApproval: true,
        approvalReason: anomalyResult.message,
      };
    }

    // 5. 규정 준수
    const complianceResult = await this.checkCompliance(fromEntityId, toEntityId, amount);
    steps.push(complianceResult);
    if (!complianceResult.passed) {
      return {
        valid: false,
        steps,
        failedStep: VALIDATION_STEPS.COMPLIANCE,
        requiresExplicitApproval: false,
      };
    }

    return {
      valid: true,
      steps,
      requiresExplicitApproval,
      approvalReason,
    };
  }

  /**
   * 1단계: 잔액 확인
   */
  private async validateBalance(entityId: string, amount: number): Promise<StepResult> {
    const balance = this.getEntityBalance(entityId);
    
    if (!balance) {
      return {
        step: VALIDATION_STEPS.BALANCE,
        passed: false,
        message: '엔티티 잔액 정보를 찾을 수 없습니다.',
        details: { entityId },
      };
    }

    if (balance.balance < amount) {
      return {
        step: VALIDATION_STEPS.BALANCE,
        passed: false,
        message: `잔액이 부족합니다. (현재: ${balance.balance}T, 필요: ${amount}T)`,
        details: { 
          currentBalance: balance.balance, 
          requiredAmount: amount,
          shortage: amount - balance.balance,
        },
      };
    }

    return {
      step: VALIDATION_STEPS.BALANCE,
      passed: true,
      message: '잔액 확인 완료',
      details: { 
        currentBalance: balance.balance, 
        afterBalance: balance.balance - amount,
      },
    };
  }

  /**
   * 2단계: 신원 확인
   */
  private async validateIdentity(fromEntityId: string, toEntityId: string): Promise<StepResult> {
    const fromBalance = this.getEntityBalance(fromEntityId);
    const toBalance = this.getEntityBalance(toEntityId);

    // 발신자 확인
    if (!fromBalance) {
      return {
        step: VALIDATION_STEPS.IDENTITY,
        passed: false,
        message: '발신자 정보를 찾을 수 없습니다.',
        details: { fromEntityId },
      };
    }

    if (!fromBalance.verified) {
      return {
        step: VALIDATION_STEPS.IDENTITY,
        passed: false,
        message: '발신자 신원이 확인되지 않았습니다.',
        details: { fromEntityId, verified: false },
      };
    }

    // 수신자 확인
    if (!toBalance) {
      return {
        step: VALIDATION_STEPS.IDENTITY,
        passed: false,
        message: '수신자 정보를 찾을 수 없습니다.',
        details: { toEntityId },
      };
    }

    // Layer 등록 확인
    const fromLayer = layerBalanceService.getEntityLayerInfo(fromEntityId);
    const toLayer = layerBalanceService.getEntityLayerInfo(toEntityId);

    if (!fromLayer || !toLayer) {
      return {
        step: VALIDATION_STEPS.IDENTITY,
        passed: false,
        message: 'Layer 등록이 필요합니다.',
        details: { 
          fromLayerRegistered: !!fromLayer, 
          toLayerRegistered: !!toLayer,
        },
      };
    }

    return {
      step: VALIDATION_STEPS.IDENTITY,
      passed: true,
      message: '신원 확인 완료',
      details: { 
        fromKycLevel: fromBalance.kycLevel,
        toVerified: toBalance.verified,
      },
    };
  }

  /**
   * 3단계: 한도 확인
   */
  private async validateLimit(
    entityId: string, 
    amount: number, 
    hasExplicitApproval: boolean
  ): Promise<StepResult> {
    const balance = this.getEntityBalance(entityId);
    const dailyLimit = balance?.daily_limit || this.config.defaultLimit;

    // 오늘 거래 총액 조회
    const todayTotal = this.getTodayTransactionTotal(entityId);
    const newTotal = todayTotal + amount;

    // 기본 한도 초과 체크
    if (amount > this.config.explicitApprovalLimit && !hasExplicitApproval) {
      return {
        step: VALIDATION_STEPS.LIMIT,
        passed: false,
        message: `${this.config.explicitApprovalLimit}T 초과 거래는 명시적 승인이 필요합니다.`,
        details: { 
          amount, 
          limit: this.config.explicitApprovalLimit,
          requiresApproval: true,
        },
      };
    }

    // 일일 한도 초과 체크
    if (newTotal > dailyLimit && !hasExplicitApproval) {
      return {
        step: VALIDATION_STEPS.LIMIT,
        passed: false,
        message: `일일 한도(${dailyLimit}T)를 초과합니다.`,
        details: { 
          todayTotal, 
          amount, 
          newTotal, 
          dailyLimit,
          requiresApproval: true,
        },
      };
    }

    return {
      step: VALIDATION_STEPS.LIMIT,
      passed: true,
      message: '한도 확인 완료',
      details: { 
        todayTotal, 
        amount, 
        newTotal, 
        dailyLimit,
        remainingLimit: dailyLimit - newTotal,
      },
    };
  }

  /**
   * 4단계: 이상 탐지
   */
  private async detectAnomaly(
    entityId: string, 
    userId: string, 
    amount: number
  ): Promise<StepResult> {
    const hourlyStats = this.getHourlyTransactionStats(entityId);

    // 시간당 거래 횟수 체크
    if (hourlyStats.count >= this.config.maxTransactionsPerHour) {
      return {
        step: VALIDATION_STEPS.ANOMALY,
        passed: false,
        message: `1시간 내 거래 횟수(${this.config.maxTransactionsPerHour}건)를 초과했습니다.`,
        details: { 
          hourlyCount: hourlyStats.count, 
          maxAllowed: this.config.maxTransactionsPerHour,
          anomalyType: 'FREQUENCY',
        },
      };
    }

    // 시간당 거래 금액 체크
    if (hourlyStats.totalAmount + amount > this.config.maxAmountPerHour) {
      return {
        step: VALIDATION_STEPS.ANOMALY,
        passed: false,
        message: `1시간 내 거래 금액(${this.config.maxAmountPerHour}T)을 초과합니다.`,
        details: { 
          hourlyAmount: hourlyStats.totalAmount, 
          newAmount: amount,
          maxAllowed: this.config.maxAmountPerHour,
          anomalyType: 'VOLUME',
        },
      };
    }

    // 급격한 금액 변화 체크 (평균의 5배 이상)
    const avgAmount = hourlyStats.count > 0 ? hourlyStats.totalAmount / hourlyStats.count : 0;
    if (avgAmount > 0 && amount > avgAmount * 5) {
      return {
        step: VALIDATION_STEPS.ANOMALY,
        passed: false,
        message: '비정상적으로 큰 거래 금액입니다.',
        details: { 
          amount, 
          averageAmount: avgAmount,
          ratio: amount / avgAmount,
          anomalyType: 'SPIKE',
        },
      };
    }

    return {
      step: VALIDATION_STEPS.ANOMALY,
      passed: true,
      message: '이상 탐지 통과',
      details: { 
        hourlyCount: hourlyStats.count, 
        hourlyAmount: hourlyStats.totalAmount,
      },
    };
  }

  /**
   * 5단계: 규정 준수
   */
  private async checkCompliance(
    fromEntityId: string,
    toEntityId: string,
    amount: number
  ): Promise<StepResult> {
    const violations: string[] = [];

    // 블랙리스트 체크
    if (this.isBlacklisted(fromEntityId) || this.isBlacklisted(toEntityId)) {
      violations.push('블랙리스트 등록 엔티티와의 거래 금지');
    }

    // 제재 대상 체크 (국제 제재 등)
    if (this.isSanctioned(toEntityId)) {
      violations.push('제재 대상과의 거래 금지');
    }

    // 고액 거래 보고 대상 체크 (1000T 이상)
    const requiresCTR = amount >= 1000;

    if (violations.length > 0) {
      return {
        step: VALIDATION_STEPS.COMPLIANCE,
        passed: false,
        message: '규정 준수 위반: ' + violations.join(', '),
        details: { violations },
      };
    }

    return {
      step: VALIDATION_STEPS.COMPLIANCE,
      passed: true,
      message: '규정 준수 확인 완료',
      details: { 
        requiresCTR,
        ctrThreshold: 1000,
      },
    };
  }

  /**
   * 엔티티 잔액 조회
   */
  getEntityBalance(entityId: string): EntityBalance | null {
    const row = db.prepare(`
      SELECT * FROM entity_balances WHERE entity_id = ?
    `).get(entityId) as any;

    if (!row) return null;

    return {
      entityId: row.entity_id,
      balance: row.balance,
      currency: row.currency,
      verified: row.verified === 1,
      kycLevel: row.kyc_level,
    };
  }

  /**
   * 엔티티 잔액 설정/업데이트
   */
  setEntityBalance(
    entityId: string, 
    balance: number, 
    verified: boolean = false,
    kycLevel: number = 0,
    dailyLimit: number = 100
  ): EntityBalance {
    const now = new Date().toISOString();
    
    db.prepare(`
      INSERT INTO entity_balances (entity_id, balance, verified, kyc_level, daily_limit, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(entity_id) DO UPDATE SET
        balance = ?, verified = ?, kyc_level = ?, daily_limit = ?, updated_at = ?
    `).run(
      entityId, balance, verified ? 1 : 0, kycLevel, dailyLimit, now, now,
      balance, verified ? 1 : 0, kycLevel, dailyLimit, now
    );

    return this.getEntityBalance(entityId)!;
  }

  /**
   * 오늘 거래 총액 조회
   */
  private getTodayTransactionTotal(entityId: string): number {
    const today = new Date().toISOString().split('T')[0];
    const row = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total 
      FROM transactions 
      WHERE from_address = ? 
        AND status = 'COMPLETED'
        AND DATE(created_at) = ?
    `).get(entityId, today) as any;

    return row?.total || 0;
  }

  /**
   * 1시간 내 거래 통계
   */
  private getHourlyTransactionStats(entityId: string): { count: number; totalAmount: number } {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const row = db.prepare(`
      SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total 
      FROM transactions 
      WHERE from_address = ? 
        AND created_at >= ?
    `).get(entityId, oneHourAgo) as any;

    return {
      count: row?.count || 0,
      totalAmount: row?.total || 0,
    };
  }

  /**
   * 블랙리스트 체크 (간단한 구현)
   */
  private isBlacklisted(entityId: string): boolean {
    // 실제로는 별도 테이블에서 조회
    const blacklist = ['BLOCKED_USER', 'FRAUD_ACCOUNT'];
    return blacklist.includes(entityId);
  }

  /**
   * 제재 대상 체크 (간단한 구현)
   */
  private isSanctioned(entityId: string): boolean {
    // 실제로는 외부 API 또는 별도 테이블에서 조회
    const sanctioned = ['SANCTIONED_ENTITY'];
    return sanctioned.includes(entityId);
  }
}

export const transactionValidator = new TransactionValidatorService();
