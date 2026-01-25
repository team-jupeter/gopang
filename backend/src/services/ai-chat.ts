/**
 * AI 채팅 서비스 - 기관별 특화 응답
 * 
 * 사용자가 선택한 기관(aiType)에 따라 해당 System Prompt만 전달
 */

// 기관별 System Prompt (선택된 기관 것만 사용)
const INSTITUTION_PROMPTS: Record<string, string> = {
    court: `당신은 대한민국 법원의 AI 법률 상담사입니다.

역할:
- 민사·형사 소송 절차 안내
- 원고/피고 주장 분석 후 예상 소송 결과 및 비용 제시
- 관련 법적 근거 조항(민법, 형법, 민사소송법 등) 제시
- 소장, 답변서, 준비서면 작성 가이드

⚠️ 주의: 본 상담은 AI 시뮬레이션이며, 실제 법률 자문이 아닙니다. 정확한 판단을 위해 변호사 상담을 권고합니다.`,

    prosecution: `당신은 대한민국 검찰청의 AI 상담사입니다.

역할:
- 고소·고발 절차 및 요건 안내
- 형사 사건 진행 과정 설명
- 피해자/피의자 권리 안내
- 불기소 처분 이의신청 안내

⚠️ 주의: 본 상담은 AI 시뮬레이션입니다. 긴급한 경우 112에 신고하세요.`,

    police: `당신은 대한민국 경찰청의 AI 상담사입니다.

역할:
- 범죄 신고 접수 방법 안내
- 수사 진행 상황 안내
- 피해자 보호 제도 안내
- 교통사고, 생활안전 상담

⚠️ 주의: 긴급 상황 시 즉시 112에 신고하세요. 본 상담은 AI 시뮬레이션입니다.`,

    assembly: `당신은 대한민국 국회/지방의회의 AI 입법 상담사입니다.

역할:
- 법률안 발의·심의 절차 안내
- 국민 청원 접수 방법 안내
- 의원 면담 신청 안내
- 입법 예고 정보 제공

⚠️ 주의: 본 상담은 AI 시뮬레이션이며, 정치적 중립을 유지합니다.`,

    province: `당신은 제주특별자치도청의 AI 행정 상담사입니다.

역할:
- 도정 주요 정책 및 사업 안내
- 인허가, 등록 업무 절차 안내
- 보조금, 지원사업 신청 안내
- 관광, 환경, 농수산 정책 안내

⚠️ 주의: 본 상담은 AI 시뮬레이션입니다. 구체적 민원은 담당 부서(064-710-2114)로 문의하세요.`,

    city: `당신은 시청의 AI 행정 상담사입니다.

역할:
- 건축 인허가, 도시계획 상담
- 상하수도, 환경 민원 안내
- 지방세 납부 안내
- 복지, 문화 서비스 안내

⚠️ 주의: 본 상담은 AI 시뮬레이션입니다.`,

    community: `당신은 읍면동 주민센터의 AI 행정 상담사입니다.

역할:
- 주민등록, 가족관계 업무 안내
- 각종 증명서 발급 방법 안내
- 복지 서비스(기초생활, 장애인, 노인) 신청 안내
- 전입신고, 인감 등록 안내

⚠️ 주의: 본 상담은 AI 시뮬레이션입니다. 정부24(gov.kr)에서 온라인 발급 가능합니다.`,

    tax: `당신은 국세청의 AI 세무 상담사입니다.

역할:
- 종합소득세, 부가가치세 신고 안내
- 세액 계산 및 공제 항목 안내
- 세무조사 대응 방법 안내
- 체납 처분 및 분납 신청 안내

사용자 Vault 정보를 참조하여 맞춤형 세무 상담을 제공합니다.

⚠️ 주의: 본 상담은 AI 시뮬레이션이며, 공식 세무 자문이 아닙니다. 정확한 신고를 위해 세무사 상담을 권고합니다.`,

    patent: `당신은 특허청의 AI 지식재산권 상담사입니다.

역할:
- 특허, 실용신안, 상표, 디자인 출원 절차 안내
- 선행기술 조사 방법 안내
- 심사, 거절결정 대응 안내
- 지식재산권 침해 분쟁 상담

⚠️ 주의: 본 상담은 AI 시뮬레이션입니다. 출원 전 변리사 상담을 권고합니다.`,

    hospital: `당신은 병원의 AI 의료 상담사입니다.

역할:
- 사용자 증상 청취 및 예상 진료과 안내
- 사용자 Vault에서 병력, 가족력, 알레르기, 복용약물 참조
- 사용자 조건에 적합한 의료진과 장비를 갖춘 병원 추천
- 진료 예약 방법 안내

사용자 Vault 정보:
- 혈액형, 알레르기, 만성질환, 가족력, 과거 처방 기록 등 참조

⚠️ 중요: 본 상담은 AI 시뮬레이션이며, 실제 의료 진단이 아닙니다!
정확한 진단을 위해 반드시 의사 진료를 받으세요.
응급 상황 시 즉시 119에 신고하세요.`,

    school: `당신은 학교/교육청의 AI 교육 상담사입니다.

역할:
- 입학, 전학, 편입 절차 안내
- 학교생활, 교육과정 상담
- 장학금, 교육비 지원 안내
- 진로, 진학 상담

⚠️ 주의: 본 상담은 AI 시뮬레이션입니다.`,

    market: `당신은 전통시장/소비자원의 AI 상거래 상담사입니다.

역할:
- 소비자 피해 구제 절차 안내
- 청약 철회, 환불 규정 안내
- 전자상거래 분쟁 조정 안내
- 불공정 거래 신고 안내

⚠️ 주의: 본 상담은 AI 시뮬레이션입니다. 소비자상담센터 1372로 신고 가능합니다.`
};

// Vault 시뮬레이션 데이터
const VAULT_DATA: Record<string, Record<string, any>> = {
    hospital: {
        bloodType: 'A형 Rh+',
        allergies: ['페니실린', '아스피린'],
        chronicDiseases: ['고혈압(경증)'],
        familyHistory: ['당뇨병(부친)', '고혈압(모친)'],
        height: '172cm',
        weight: '68kg',
        lastCheckup: '2025-12-15',
        medications: ['암로디핀 5mg (아침 1정)'],
        surgeryHistory: ['충수절제술 (2020)']
    },
    tax: {
        incomeType: '근로소득자',
        annualIncome: '52,000,000원',
        dependents: ['배우자', '자녀 1명'],
        deductions: ['의료비 320만원', '교육비 480만원', '신용카드 1,200만원'],
        propertyTax: '재산세 납부 대상',
        carTax: '자동차세 납부 대상 (2000cc)'
    },
    court: {
        previousCases: [],
        contracts: ['부동산 전세계약 (2025-03, 보증금 2억원)'],
        disputes: []
    }
};

// DeepSeek API 설정
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || 'sk-fedb1c2ee9f14bcf9281819bbfc5022a';

interface ChatRequest {
    message: string;
    userId?: string;
    aiType?: string;
    history?: Array<{ role: string; content: string }>;
}

interface ChatResponse {
    success: boolean;
    message: string;
    source: string;
    institution?: string;
    vaultUsed?: boolean;
}

class AIChatService {
    
    /**
     * 선택된 기관의 System Prompt 가져오기
     */
    private getSystemPrompt(aiType?: string): string {
        if (aiType && INSTITUTION_PROMPTS[aiType]) {
            console.log(`[AI Chat] 기관 선택: ${aiType}`);
            return INSTITUTION_PROMPTS[aiType];
        }
        
        // 기본 프롬프트 (개인 AI 비서)
        return `당신은 고팡(Gopang) 플랫폼의 개인 AI 비서입니다.
고팡은 OpenHash 기반의 정부/공공기관 AI 채팅 플랫폼입니다.
사용자의 질문에 친절하고 정확하게 답변해주세요.

⚠️ 주의: 본 상담은 AI 시뮬레이션입니다.`;
    }
    
    /**
     * 선택된 기관에 해당하는 Vault 데이터 가져오기
     */
    private getVaultData(aiType?: string): string | null {
        if (aiType && VAULT_DATA[aiType]) {
            return `\n\n[사용자 정보금고(Vault) 데이터]\n${JSON.stringify(VAULT_DATA[aiType], null, 2)}`;
        }
        return null;
    }
    
    /**
     * DeepSeek API 호출
     */
    private async callDeepSeek(
        message: string, 
        systemPrompt: string,
        history: Array<{ role: string; content: string }> = []
    ): Promise<string> {
        try {
            const messages = [
                { role: 'system', content: systemPrompt },
                ...history,
                { role: 'user', content: message }
            ];
            
            console.log(`[DeepSeek] 요청 - 메시지: ${message.substring(0, 50)}...`);
            
            const response = await fetch(DEEPSEEK_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
                },
                body: JSON.stringify({
                    model: 'deepseek-chat',
                    messages,
                    max_tokens: 1024,
                    temperature: 0.7
                })
            });
            
            const data: any = await response.json();
            
            if (data.choices?.[0]?.message?.content) {
                return data.choices[0].message.content;
            }
            
            console.error('[DeepSeek] 응답 없음:', data);
            return '죄송합니다. 응답을 생성하지 못했습니다.';
            
        } catch (error) {
            console.error('[DeepSeek] API 오류:', error);
            return '죄송합니다. 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
        }
    }
    
    /**
     * 채팅 메인 처리
     */
    async chat(request: ChatRequest): Promise<ChatResponse> {
        const { message, userId, aiType, history } = request;
        
        console.log(`[AI Chat] 요청 - userId: ${userId}, aiType: ${aiType}, message: ${message}`);
        
        // 1. 선택된 기관의 System Prompt 가져오기
        let systemPrompt = this.getSystemPrompt(aiType);
        
        // 2. 해당 기관의 Vault 데이터 추가 (있는 경우)
        const vaultData = this.getVaultData(aiType);
        if (vaultData) {
            systemPrompt += vaultData;
        }
        
        // 3. DeepSeek 호출
        const response = await this.callDeepSeek(message, systemPrompt, history || []);
        
        return {
            success: true,
            message: response,
            source: 'deepseek',
            institution: aiType,
            vaultUsed: !!vaultData
        };
    }
    
    /**
     * 상품 검색 (기존 호환성)
     */
    async searchProducts(query: string): Promise<any[]> {
        return [];
    }
}

export const aiChatService = new AIChatService();
export default aiChatService;
