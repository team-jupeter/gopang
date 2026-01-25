/**
 * Vault 서비스
 * Day 16-17: Vault 및 자동 분류 기능
 */

import { v4 as uuidv4 } from 'uuid';
import db from '../db';

export type DrawerType = 'FINANCE' | 'MEDICAL' | 'EDUCATION' | 'ADMIN' | 'TRANSPORT' | 'GENERAL';
export const DRAWER_TYPES: DrawerType[] = ['FINANCE', 'MEDICAL', 'EDUCATION', 'ADMIN', 'TRANSPORT', 'GENERAL'];
export const DRAWER_LABELS: Record<DrawerType, string> = {
  FINANCE: '금융',
  MEDICAL: '의료',
  EDUCATION: '교육',
  ADMIN: '행정',
  TRANSPORT: '교통',
  GENERAL: '일반',
};

// 키워드 기반 분류 규칙
const CLASSIFICATION_KEYWORDS: Record<DrawerType, string[]> = {
  FINANCE: ['은행', '계좌', '송금', '입금', '출금', '대출', '이자', '주식', '투자', '보험', '연금', '세금', '급여', '월급', 'T', '토큰'],
  MEDICAL: ['병원', '의원', '약국', '진료', '처방', '건강', '검진', '수술', '치료', '의사', '간호', '약', '보험', '진단'],
  EDUCATION: ['학교', '대학', '학원', '교육', '수업', '강의', '등록금', '장학금', '졸업', '입학', '시험', '성적', '학위'],
  ADMIN: ['주민센터', '구청', '시청', '관공서', '민원', '증명서', '등본', '인감', '여권', '면허', '등록', '신고', '허가'],
  TRANSPORT: ['버스', '지하철', '택시', '기차', 'KTX', '비행기', '항공', '주유', '톨게이트', '주차', '렌트', '교통카드'],
  GENERAL: [],
};

interface VaultDrawer {
  id: string;
  user_id: string;
  drawer_type: DrawerType;
  created_at: string;
  updated_at: string;
}

interface VaultItem {
  id: string;
  drawer_id: string;
  title: string;
  data: string;
  created_at: string;
  updated_at: string;
}

interface DrawerItem {
  id: string;
  title: string;
  data: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

interface ClassificationResult {
  drawerType: DrawerType;
  confidence: number;
  matchedKeywords: string[];
  scores: Record<DrawerType, number>;
}

class VaultService {
  /**
   * Vault 요약 조회
   */
  async getVaultSummary(userId: string): Promise<{ drawerType: DrawerType; label: string; itemCount: number }[]> {
    const summary = DRAWER_TYPES.map(type => {
      const drawer = this.getOrCreateDrawer(userId, type);
      const count = db.prepare(`
        SELECT COUNT(*) as count FROM vault_items WHERE drawer_id = ?
      `).get(drawer.id) as { count: number };
      
      return {
        drawerType: type,
        label: DRAWER_LABELS[type],
        itemCount: count.count,
      };
    });
    
    return summary;
  }

  /**
   * 모든 서랍 조회
   */
  async getDrawers(userId: string): Promise<VaultDrawer[]> {
    // 모든 서랍 유형에 대해 생성 보장
    DRAWER_TYPES.forEach(type => this.getOrCreateDrawer(userId, type));
    
    const drawers = db.prepare(`
      SELECT * FROM vault_drawers WHERE user_id = ? ORDER BY drawer_type
    `).all(userId) as VaultDrawer[];
    
    return drawers;
  }

  /**
   * 서랍 조회 또는 생성
   */
  private getOrCreateDrawer(userId: string, drawerType: DrawerType): VaultDrawer {
    let drawer = db.prepare(`
      SELECT * FROM vault_drawers WHERE user_id = ? AND drawer_type = ?
    `).get(userId, drawerType) as VaultDrawer | undefined;
    
    if (!drawer) {
      const id = uuidv4();
      const now = new Date().toISOString();
      
      db.prepare(`
        INSERT INTO vault_drawers (id, user_id, drawer_type, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(id, userId, drawerType, now, now);
      
      drawer = db.prepare(`
        SELECT * FROM vault_drawers WHERE id = ?
      `).get(id) as VaultDrawer;
    }
    
    return drawer;
  }

  /**
   * 서랍 내용 조회
   */
  async getDrawerContent(userId: string, drawerType: DrawerType): Promise<DrawerItem[]> {
    const drawer = this.getOrCreateDrawer(userId, drawerType);
    
    const items = db.prepare(`
      SELECT * FROM vault_items WHERE drawer_id = ? ORDER BY created_at DESC
    `).all(drawer.id) as VaultItem[];
    
    return items.map(item => ({
      id: item.id,
      title: item.title,
      data: item.data ? JSON.parse(item.data) : {},
      createdAt: item.created_at,
      updatedAt: item.updated_at,
    }));
  }

  /**
   * 항목 추가
   */
  async addItem(userId: string, drawerType: DrawerType, title: string, data: Record<string, any>): Promise<DrawerItem> {
    const drawer = this.getOrCreateDrawer(userId, drawerType);
    const id = uuidv4();
    const now = new Date().toISOString();
    
    db.prepare(`
      INSERT INTO vault_items (id, drawer_id, title, data, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, drawer.id, title, JSON.stringify(data), now, now);
    
    return {
      id,
      title,
      data,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * 콘텐츠 자동 분류
   */
  classifyContent(content: string): ClassificationResult {
    const scores: Record<DrawerType, number> = {
      FINANCE: 0,
      MEDICAL: 0,
      EDUCATION: 0,
      ADMIN: 0,
      TRANSPORT: 0,
      GENERAL: 0,
    };
    
    const matchedKeywords: string[] = [];
    const contentLower = content.toLowerCase();
    
    // 각 카테고리별 키워드 매칭
    for (const [type, keywords] of Object.entries(CLASSIFICATION_KEYWORDS)) {
      for (const keyword of keywords) {
        if (contentLower.includes(keyword.toLowerCase())) {
          scores[type as DrawerType] += 8;
          matchedKeywords.push(keyword);
        }
      }
    }
    
    // 최고 점수 카테고리 찾기
    let maxScore = 0;
    let bestType: DrawerType = 'GENERAL';
    
    for (const [type, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score;
        bestType = type as DrawerType;
      }
    }
    
    // 신뢰도 계산
    const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
    const confidence = totalScore > 0 ? Math.min(100, Math.round((maxScore / totalScore) * 100 + maxScore)) : 0;
    
    return {
      drawerType: bestType,
      confidence: confidence || 50,
      matchedKeywords: [...new Set(matchedKeywords)],
      scores,
    };
  }

  /**
   * 자동 분류하여 항목 추가
   */
  async addItemAutoClassify(userId: string, title: string, data: Record<string, any>): Promise<{
    item: DrawerItem;
    classification: ClassificationResult;
  }> {
    // 제목과 데이터를 결합하여 분류
    const contentToClassify = `${title} ${JSON.stringify(data)}`;
    const classification = this.classifyContent(contentToClassify);
    
    const item = await this.addItem(userId, classification.drawerType, title, data);
    
    return { item, classification };
  }

  /**
   * 항목 수정
   */
  async updateItem(userId: string, drawerType: DrawerType, itemId: string, updates: { title?: string; data?: Record<string, any> }): Promise<DrawerItem | null> {
    const drawer = this.getOrCreateDrawer(userId, drawerType);
    const now = new Date().toISOString();
    
    const existing = db.prepare(`
      SELECT * FROM vault_items WHERE id = ? AND drawer_id = ?
    `).get(itemId, drawer.id) as VaultItem | undefined;
    
    if (!existing) return null;
    
    const newTitle = updates.title ?? existing.title;
    const newData = updates.data ? JSON.stringify(updates.data) : existing.data;
    
    db.prepare(`
      UPDATE vault_items SET title = ?, data = ?, updated_at = ? WHERE id = ?
    `).run(newTitle, newData, now, itemId);
    
    return {
      id: itemId,
      title: newTitle,
      data: updates.data ?? JSON.parse(existing.data || '{}'),
      createdAt: existing.created_at,
      updatedAt: now,
    };
  }

  /**
   * 항목 삭제
   */
  async deleteItem(userId: string, drawerType: DrawerType, itemId: string): Promise<boolean> {
    const drawer = this.getOrCreateDrawer(userId, drawerType);
    
    const result = db.prepare(`
      DELETE FROM vault_items WHERE id = ? AND drawer_id = ?
    `).run(itemId, drawer.id);
    
    return result.changes > 0;
  }
}

export const vaultService = new VaultService();
