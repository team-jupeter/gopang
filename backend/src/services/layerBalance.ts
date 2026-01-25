/**
 * Layer Balance Service
 * Day 18: 계층별 잔액 불변성 검증 (한국 행정체계 기준)
 * 
 * Layer 구조 (5단계):
 * - Layer 5: 글로벌 (최상위, 항상 불변)
 * - Layer 4: 국가 (예: 대한민국, 일본)
 * - Layer 3: 광역시도 (예: 제주특별자치도, 서울특별시)
 * - Layer 2: 시군구 (예: 서귀포시, 제주시, 강남구)
 * - Layer 1: 읍면동 (예: 중문동, 연동, 역삼동)
 * - Layer 0: 개인/기관 (거래 당사자)
 */

import db from '../db';

// Layer 레벨 정의
export const LAYER_LEVEL = {
  GLOBAL: 5,      // 글로벌
  COUNTRY: 4,     // 국가
  PROVINCE: 3,    // 광역시도
  CITY: 2,        // 시군구
  DISTRICT: 1,    // 읍면동
  ENTITY: 0,      // 개인/기관
} as const;

export type LayerLevel = typeof LAYER_LEVEL[keyof typeof LAYER_LEVEL];

export const LAYER_NAMES: Record<LayerLevel, string> = {
  [LAYER_LEVEL.GLOBAL]: '글로벌',
  [LAYER_LEVEL.COUNTRY]: '국가',
  [LAYER_LEVEL.PROVINCE]: '광역시도',
  [LAYER_LEVEL.CITY]: '시군구',
  [LAYER_LEVEL.DISTRICT]: '읍면동',
  [LAYER_LEVEL.ENTITY]: '개인/기관',
};

// Layer 노드 인터페이스
export interface LayerNode {
  id: string;
  level: LayerLevel;
  name: string;
  parent_id: string | null;
  balance: number;
  currency: string;
  created_at: string;
  updated_at: string;
}

// 거래 당사자 계층 정보
export interface EntityLayerInfo {
  entityId: string;
  layer1Id: string;  // 읍면동
  layer2Id: string;  // 시군구
  layer3Id: string;  // 광역시도
  layer4Id: string;  // 국가
  layer5Id: string;  // 글로벌
}

// 잔액 변동 검증 결과
export interface BalanceVerificationResult {
  valid: boolean;
  commonLayer: LayerLevel;
  commonLayerId: string;
  commonLayerName: string;
  changedLayers: { level: LayerLevel; levelName: string; id: string; name: string; delta: number }[];
  invariantLayers: { level: LayerLevel; levelName: string; id: string; name: string; balance: number }[];
  error?: string;
}

class LayerBalanceService {
  /**
   * Layer 테이블 초기화
   */
  initializeTables(): void {
    // Layer 노드 테이블
    db.exec(`
      CREATE TABLE IF NOT EXISTS layer_nodes (
        id TEXT PRIMARY KEY,
        level INTEGER NOT NULL,
        name TEXT NOT NULL,
        parent_id TEXT,
        balance REAL DEFAULT 0,
        currency TEXT DEFAULT 'T',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (parent_id) REFERENCES layer_nodes(id)
      )
    `);

    // 엔티티-Layer 매핑 테이블
    db.exec(`
      CREATE TABLE IF NOT EXISTS entity_layer_mapping (
        entity_id TEXT PRIMARY KEY,
        layer1_id TEXT NOT NULL,
        layer2_id TEXT NOT NULL,
        layer3_id TEXT NOT NULL,
        layer4_id TEXT NOT NULL,
        layer5_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (layer1_id) REFERENCES layer_nodes(id),
        FOREIGN KEY (layer2_id) REFERENCES layer_nodes(id),
        FOREIGN KEY (layer3_id) REFERENCES layer_nodes(id),
        FOREIGN KEY (layer4_id) REFERENCES layer_nodes(id),
        FOREIGN KEY (layer5_id) REFERENCES layer_nodes(id)
      )
    `);

    // 기본 계층 구조 생성
    this.ensureDefaultHierarchy();
  }

  /**
   * 기본 계층 구조 생성 (제주도 예시)
   */
  private ensureDefaultHierarchy(): void {
    const now = new Date().toISOString();
    
    const insertNode = (id: string, level: number, name: string, parentId: string | null) => {
      const exists = db.prepare(`SELECT id FROM layer_nodes WHERE id = ?`).get(id);
      if (!exists) {
        db.prepare(`
          INSERT INTO layer_nodes (id, level, name, parent_id, balance, currency, created_at, updated_at)
          VALUES (?, ?, ?, ?, 0, 'T', ?, ?)
        `).run(id, level, name, parentId, now, now);
      }
    };

    // Layer 5: 글로벌
    insertNode('GLOBAL', 5, '글로벌', null);

    // Layer 4: 국가
    insertNode('KR', 4, '대한민국', 'GLOBAL');

    // Layer 3: 광역시도 (제주특별자치도)
    insertNode('KR-JEJU', 3, '제주특별자치도', 'KR');

    // Layer 2: 시군구 (제주시, 서귀포시)
    insertNode('KR-JEJU-JEJU', 2, '제주시', 'KR-JEJU');
    insertNode('KR-JEJU-SEOGWIPO', 2, '서귀포시', 'KR-JEJU');

    // Layer 1: 읍면동 (제주시 하위)
    insertNode('KR-JEJU-JEJU-YEON', 1, '연동', 'KR-JEJU-JEJU');
    insertNode('KR-JEJU-JEJU-NOHYUNG', 1, '노형동', 'KR-JEJU-JEJU');
    insertNode('KR-JEJU-JEJU-ILDOIL', 1, '일도일동', 'KR-JEJU-JEJU');
    insertNode('KR-JEJU-JEJU-ILDOI', 1, '일도이동', 'KR-JEJU-JEJU');
    insertNode('KR-JEJU-JEJU-IDOIL', 1, '이도일동', 'KR-JEJU-JEJU');
    insertNode('KR-JEJU-JEJU-IDOI', 1, '이도이동', 'KR-JEJU-JEJU');

    // Layer 1: 읍면동 (서귀포시 하위)
    insertNode('KR-JEJU-SEOGWIPO-JUNGMUN', 1, '중문동', 'KR-JEJU-SEOGWIPO');
    insertNode('KR-JEJU-SEOGWIPO-SEOGWI', 1, '서귀동', 'KR-JEJU-SEOGWIPO');
    insertNode('KR-JEJU-SEOGWIPO-DONGHONG', 1, '동홍동', 'KR-JEJU-SEOGWIPO');
    insertNode('KR-JEJU-SEOGWIPO-SEOHONG', 1, '서홍동', 'KR-JEJU-SEOGWIPO');
    insertNode('KR-JEJU-SEOGWIPO-DAEJEONG', 1, '대정읍', 'KR-JEJU-SEOGWIPO');
    insertNode('KR-JEJU-SEOGWIPO-NAMWON', 1, '남원읍', 'KR-JEJU-SEOGWIPO');
  }

  /**
   * 엔티티의 Layer 정보 조회
   */
  getEntityLayerInfo(entityId: string): EntityLayerInfo | null {
    const stmt = db.prepare(`
      SELECT * FROM entity_layer_mapping WHERE entity_id = ?
    `);
    const row = stmt.get(entityId) as any;
    
    if (!row) return null;
    
    return {
      entityId: row.entity_id,
      layer1Id: row.layer1_id,
      layer2Id: row.layer2_id,
      layer3Id: row.layer3_id,
      layer4Id: row.layer4_id,
      layer5Id: row.layer5_id,
    };
  }

  /**
   * 엔티티를 Layer에 등록 (읍면동 ID로 등록)
   */
  registerEntity(entityId: string, layer1Id: string): EntityLayerInfo {
    // Layer 1 (읍면동) 정보 조회
    const layer1 = this.getLayerNode(layer1Id);
    if (!layer1 || layer1.level !== LAYER_LEVEL.DISTRICT) {
      throw new Error(`Invalid Layer 1 (읍면동): ${layer1Id}`);
    }

    // 상위 Layer 정보 조회
    const layer2 = this.getLayerNode(layer1.parent_id!);
    if (!layer2) throw new Error(`Layer 2 not found for ${layer1Id}`);
    
    const layer3 = this.getLayerNode(layer2.parent_id!);
    if (!layer3) throw new Error(`Layer 3 not found for ${layer2.id}`);
    
    const layer4 = this.getLayerNode(layer3.parent_id!);
    if (!layer4) throw new Error(`Layer 4 not found for ${layer3.id}`);
    
    const layer5 = this.getLayerNode(layer4.parent_id!);
    if (!layer5) throw new Error(`Layer 5 not found for ${layer4.id}`);

    const now = new Date().toISOString();
    
    db.prepare(`
      INSERT OR REPLACE INTO entity_layer_mapping 
      (entity_id, layer1_id, layer2_id, layer3_id, layer4_id, layer5_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(entityId, layer1Id, layer2.id, layer3.id, layer4.id, layer5.id, now);

    return {
      entityId,
      layer1Id,
      layer2Id: layer2.id,
      layer3Id: layer3.id,
      layer4Id: layer4.id,
      layer5Id: layer5.id,
    };
  }

  /**
   * Layer 노드 조회
   */
  getLayerNode(layerId: string): LayerNode | null {
    const stmt = db.prepare(`SELECT * FROM layer_nodes WHERE id = ?`);
    const row = stmt.get(layerId) as any;
    return row ? this.mapLayerNode(row) : null;
  }

  /**
   * 두 엔티티 간 공통 Layer 찾기
   */
  findCommonLayer(fromInfo: EntityLayerInfo, toInfo: EntityLayerInfo): { level: LayerLevel; id: string; name: string } {
    // 같은 읍면동 (Layer 1)
    if (fromInfo.layer1Id === toInfo.layer1Id) {
      const node = this.getLayerNode(fromInfo.layer1Id);
      return { level: LAYER_LEVEL.DISTRICT, id: fromInfo.layer1Id, name: node?.name || '' };
    }
    // 같은 시군구 (Layer 2)
    if (fromInfo.layer2Id === toInfo.layer2Id) {
      const node = this.getLayerNode(fromInfo.layer2Id);
      return { level: LAYER_LEVEL.CITY, id: fromInfo.layer2Id, name: node?.name || '' };
    }
    // 같은 광역시도 (Layer 3)
    if (fromInfo.layer3Id === toInfo.layer3Id) {
      const node = this.getLayerNode(fromInfo.layer3Id);
      return { level: LAYER_LEVEL.PROVINCE, id: fromInfo.layer3Id, name: node?.name || '' };
    }
    // 같은 국가 (Layer 4)
    if (fromInfo.layer4Id === toInfo.layer4Id) {
      const node = this.getLayerNode(fromInfo.layer4Id);
      return { level: LAYER_LEVEL.COUNTRY, id: fromInfo.layer4Id, name: node?.name || '' };
    }
    // 글로벌 (Layer 5)
    const node = this.getLayerNode(fromInfo.layer5Id);
    return { level: LAYER_LEVEL.GLOBAL, id: fromInfo.layer5Id, name: node?.name || '' };
  }

  /**
   * 거래 잔액 불변성 검증
   */
  verifyTransactionBalance(
    fromEntityId: string,
    toEntityId: string,
    amount: number
  ): BalanceVerificationResult {
    const fromInfo = this.getEntityLayerInfo(fromEntityId);
    const toInfo = this.getEntityLayerInfo(toEntityId);

    if (!fromInfo || !toInfo) {
      return {
        valid: false,
        commonLayer: LAYER_LEVEL.GLOBAL,
        commonLayerId: 'GLOBAL',
        commonLayerName: '글로벌',
        changedLayers: [],
        invariantLayers: [],
        error: `Entity layer info not found: ${!fromInfo ? fromEntityId : toEntityId}`,
      };
    }

    const common = this.findCommonLayer(fromInfo, toInfo);
    const changedLayers: BalanceVerificationResult['changedLayers'] = [];
    const invariantLayers: BalanceVerificationResult['invariantLayers'] = [];

    const addChange = (level: LayerLevel, id: string, delta: number) => {
      const node = this.getLayerNode(id);
      changedLayers.push({
        level,
        levelName: LAYER_NAMES[level],
        id,
        name: node?.name || '',
        delta,
      });
    };

    const addInvariant = (level: LayerLevel, id: string) => {
      const node = this.getLayerNode(id);
      if (node) {
        invariantLayers.push({
          level,
          levelName: LAYER_NAMES[level],
          id,
          name: node.name,
          balance: node.balance,
        });
      }
    };

    // 공통 Layer 아래의 모든 Layer는 변동
    // Layer 1 (읍면동) 변동
    if (common.level > LAYER_LEVEL.DISTRICT && fromInfo.layer1Id !== toInfo.layer1Id) {
      addChange(LAYER_LEVEL.DISTRICT, fromInfo.layer1Id, -amount);
      addChange(LAYER_LEVEL.DISTRICT, toInfo.layer1Id, amount);
    }

    // Layer 2 (시군구) 변동
    if (common.level > LAYER_LEVEL.CITY && fromInfo.layer2Id !== toInfo.layer2Id) {
      addChange(LAYER_LEVEL.CITY, fromInfo.layer2Id, -amount);
      addChange(LAYER_LEVEL.CITY, toInfo.layer2Id, amount);
    }

    // Layer 3 (광역시도) 변동
    if (common.level > LAYER_LEVEL.PROVINCE && fromInfo.layer3Id !== toInfo.layer3Id) {
      addChange(LAYER_LEVEL.PROVINCE, fromInfo.layer3Id, -amount);
      addChange(LAYER_LEVEL.PROVINCE, toInfo.layer3Id, amount);
    }

    // Layer 4 (국가) 변동
    if (common.level > LAYER_LEVEL.COUNTRY && fromInfo.layer4Id !== toInfo.layer4Id) {
      addChange(LAYER_LEVEL.COUNTRY, fromInfo.layer4Id, -amount);
      addChange(LAYER_LEVEL.COUNTRY, toInfo.layer4Id, amount);
    }

    // 공통 Layer 이상은 불변
    if (common.level <= LAYER_LEVEL.CITY) {
      addInvariant(LAYER_LEVEL.CITY, fromInfo.layer2Id);
    }
    if (common.level <= LAYER_LEVEL.PROVINCE) {
      addInvariant(LAYER_LEVEL.PROVINCE, fromInfo.layer3Id);
    }
    if (common.level <= LAYER_LEVEL.COUNTRY) {
      addInvariant(LAYER_LEVEL.COUNTRY, fromInfo.layer4Id);
    }
    addInvariant(LAYER_LEVEL.GLOBAL, fromInfo.layer5Id);

    // 변동의 합이 0인지 검증
    const totalDelta = changedLayers.reduce((sum, l) => sum + l.delta, 0);
    const valid = totalDelta === 0;

    return {
      valid,
      commonLayer: common.level,
      commonLayerId: common.id,
      commonLayerName: common.name,
      changedLayers,
      invariantLayers,
      error: valid ? undefined : `Balance invariant violated: delta sum = ${totalDelta}`,
    };
  }

  /**
   * 거래 실행 및 잔액 업데이트
   */
  executeTransfer(fromEntityId: string, toEntityId: string, amount: number): BalanceVerificationResult {
    const verification = this.verifyTransactionBalance(fromEntityId, toEntityId, amount);
    
    if (!verification.valid) {
      return verification;
    }

    const now = new Date().toISOString();
    const updateStmt = db.prepare(`
      UPDATE layer_nodes SET balance = balance + ?, updated_at = ? WHERE id = ?
    `);

    for (const change of verification.changedLayers) {
      updateStmt.run(change.delta, now, change.id);
    }

    return verification;
  }

  /**
   * Layer 노드 매핑
   */
  private mapLayerNode(row: any): LayerNode {
    return {
      id: row.id,
      level: row.level,
      name: row.name,
      parent_id: row.parent_id,
      balance: row.balance,
      currency: row.currency,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  /**
   * 계층 구조 조회
   */
  getHierarchy(): LayerNode[] {
    const stmt = db.prepare(`SELECT * FROM layer_nodes ORDER BY level DESC, name`);
    return (stmt.all() as any[]).map(row => this.mapLayerNode(row));
  }

  /**
   * 특정 레벨의 모든 노드 조회
   */
  getNodesByLevel(level: LayerLevel): LayerNode[] {
    const stmt = db.prepare(`SELECT * FROM layer_nodes WHERE level = ? ORDER BY name`);
    return (stmt.all(level) as any[]).map(row => this.mapLayerNode(row));
  }
}

export const layerBalanceService = new LayerBalanceService();
