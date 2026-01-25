/**
 * 서랍 자동 분류기
 * Day 17: 키워드 분석, 가중치 시스템
 */

import { DrawerType } from './vault';

// 키워드 가중치 맵
interface KeywordWeight {
  keyword: string;
  weight: number;
}

const DRAWER_KEYWORDS: Record<DrawerType, KeywordWeight[]> = {
  FINANCE: [
    { keyword: '급여', weight: 10 },
    { keyword: '월급', weight: 10 },
    { keyword: '송금', weight: 9 },
    { keyword: '입금', weight: 9 },
    { keyword: '출금', weight: 9 },
    { keyword: '계좌', weight: 8 },
    { keyword: '은행', weight: 8 },
    { keyword: '대출', weight: 8 },
    { keyword: '이자', weight: 7 },
    { keyword: '세금', weight: 7 },
    { keyword: '연말정산', weight: 9 },
    { keyword: '카드', weight: 6 },
    { keyword: '결제', weight: 7 },
    { keyword: '투자', weight: 8 },
    { keyword: '주식', weight: 8 },
    { keyword: '보험료', weight: 7 },
    { keyword: '적금', weight: 8 },
    { keyword: '예금', weight: 8 },
    { keyword: 'T', weight: 5 },
    { keyword: 'EGCT', weight: 6 },
  ],
  MEDICAL: [
    { keyword: '진료', weight: 10 },
    { keyword: '병원', weight: 9 },
    { keyword: '약국', weight: 9 },
    { keyword: '처방', weight: 9 },
    { keyword: '건강', weight: 7 },
    { keyword: '검진', weight: 9 },
    { keyword: '수술', weight: 10 },
    { keyword: '입원', weight: 10 },
    { keyword: '의사', weight: 8 },
    { keyword: '간호', weight: 8 },
    { keyword: '치료', weight: 9 },
    { keyword: '진단', weight: 9 },
    { keyword: '예방접종', weight: 9 },
    { keyword: '백신', weight: 8 },
    { keyword: '의료', weight: 8 },
    { keyword: '약', weight: 6 },
    { keyword: '증상', weight: 7 },
    { keyword: '질병', weight: 8 },
  ],
  EDUCATION: [
    { keyword: '학교', weight: 10 },
    { keyword: '대학', weight: 9 },
    { keyword: '수업', weight: 9 },
    { keyword: '강의', weight: 9 },
    { keyword: '학습', weight: 8 },
    { keyword: '교육', weight: 9 },
    { keyword: '시험', weight: 8 },
    { keyword: '성적', weight: 9 },
    { keyword: '졸업', weight: 9 },
    { keyword: '입학', weight: 9 },
    { keyword: '학원', weight: 8 },
    { keyword: '과외', weight: 8 },
    { keyword: '자격증', weight: 8 },
    { keyword: '수강', weight: 8 },
    { keyword: '등록금', weight: 9 },
    { keyword: '장학금', weight: 9 },
    { keyword: '학위', weight: 9 },
    { keyword: '논문', weight: 8 },
  ],
  ADMIN: [
    { keyword: '주민등록', weight: 10 },
    { keyword: '등본', weight: 10 },
    { keyword: '초본', weight: 10 },
    { keyword: '인감', weight: 9 },
    { keyword: '증명서', weight: 8 },
    { keyword: '신청', weight: 6 },
    { keyword: '민원', weight: 9 },
    { keyword: '관공서', weight: 9 },
    { keyword: '구청', weight: 9 },
    { keyword: '시청', weight: 9 },
    { keyword: '동사무소', weight: 9 },
    { keyword: '주민센터', weight: 9 },
    { keyword: '여권', weight: 9 },
    { keyword: '운전면허', weight: 8 },
    { keyword: '등기', weight: 8 },
    { keyword: '공증', weight: 8 },
    { keyword: '행정', weight: 7 },
    { keyword: '정부', weight: 7 },
  ],
  TRANSPORT: [
    { keyword: '버스', weight: 9 },
    { keyword: '지하철', weight: 9 },
    { keyword: '택시', weight: 9 },
    { keyword: '기차', weight: 9 },
    { keyword: 'KTX', weight: 9 },
    { keyword: '비행기', weight: 9 },
    { keyword: '항공', weight: 9 },
    { keyword: '교통', weight: 8 },
    { keyword: '주차', weight: 8 },
    { keyword: '통행료', weight: 8 },
    { keyword: '고속도로', weight: 8 },
    { keyword: '렌트', weight: 7 },
    { keyword: '자동차', weight: 7 },
    { keyword: '운행', weight: 7 },
    { keyword: '노선', weight: 7 },
    { keyword: '배', weight: 6 },
    { keyword: '선박', weight: 7 },
    { keyword: '터미널', weight: 7 },
  ],
  GENERAL: [
    { keyword: '메모', weight: 5 },
    { keyword: '기타', weight: 5 },
    { keyword: '일반', weight: 5 },
  ],
};

export interface ClassificationResult {
  drawerType: DrawerType;
  confidence: number;
  scores: Record<DrawerType, number>;
  matchedKeywords: string[];
}

export class DrawerClassifier {
  /**
   * 콘텐츠 분류
   */
  classify(content: string): ClassificationResult {
    const scores: Record<DrawerType, number> = {
      FINANCE: 0,
      MEDICAL: 0,
      EDUCATION: 0,
      ADMIN: 0,
      TRANSPORT: 0,
      GENERAL: 0,
    };

    const matchedKeywords: string[] = [];
    const normalizedContent = content.toLowerCase();

    // 각 서랍별 점수 계산
    for (const [drawer, keywords] of Object.entries(DRAWER_KEYWORDS)) {
      for (const { keyword, weight } of keywords) {
        if (normalizedContent.includes(keyword.toLowerCase())) {
          scores[drawer as DrawerType] += weight;
          if (!matchedKeywords.includes(keyword)) {
            matchedKeywords.push(keyword);
          }
        }
      }
    }

    // 최고 점수 서랍 찾기
    let maxScore = 0;
    let bestDrawer: DrawerType = 'GENERAL';

    for (const [drawer, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score;
        bestDrawer = drawer as DrawerType;
      }
    }

    // 신뢰도 계산 (최고 점수 / 전체 점수 합)
    const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
    const confidence = totalScore > 0 ? Math.round((maxScore / totalScore) * 100) : 0;

    return {
      drawerType: bestDrawer,
      confidence,
      scores,
      matchedKeywords,
    };
  }

  /**
   * 제목과 데이터 기반 분류
   */
  classifyItem(title: string, data?: Record<string, any>): ClassificationResult {
    let content = title;

    // 데이터 값들도 분석에 포함
    if (data) {
      content += ' ' + Object.values(data).join(' ');
    }

    return this.classify(content);
  }

  /**
   * 키워드 추가
   */
  addKeyword(drawer: DrawerType, keyword: string, weight: number = 5): void {
    DRAWER_KEYWORDS[drawer].push({ keyword, weight });
  }

  /**
   * 서랍별 키워드 조회
   */
  getKeywords(drawer: DrawerType): KeywordWeight[] {
    return DRAWER_KEYWORDS[drawer];
  }
}

export const drawerClassifier = new DrawerClassifier();
export default drawerClassifier;
