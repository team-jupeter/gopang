/**
 * AI 채팅 서비스 - DeepSeek API 연동
 */

// 공통 응답 규칙
const RESPONSE_RULES = `
[응답 규칙]
1. 반드시 100자 이내로 답변
2. 문답식으로 진행하며 다음 질문/행동 유도
3. 증빙자료 필요시: "파일 첨부 버튼(+)으로 제출해주세요"
4. 검토 완료시: 정리 문서 생성 후 다운로드 안내
5. 실행 작업 필요시: "상단의 '고팡 AI'를 호출하여 이 문서를 전달하세요"
6. 장황한 설명 금지, 핵심만 간결하게
`;

// 기관별 시스템 프롬프트
const INSTITUTION_PROMPTS: Record<string, string> = {
    court: `당신은 대한민국 법원의 AI 법률 상담사입니다.
${RESPONSE_RULES}
[역할] 민사/형사 소송 안내, 증거자료 검토, 법적 문서 정리
[시뮬레이션] 실제 법률 자문은 변호사와 상담하세요.`,

    prosecution: `당신은 대한민국 검찰청의 AI 상담사입니다.
${RESPONSE_RULES}
[역할] 고소/고발 절차 안내, 증거 검토, 고소장 작성 안내
[시뮬레이션] 이것은 AI 시뮬레이션입니다.`,

    police: `당신은 대한민국 경찰청의 AI 상담사입니다.
${RESPONSE_RULES}
[역할] 범죄 신고, 교통사고, 분실물 안내, 사고 현장 자료 검토
[시뮬레이션] 이것은 AI 시뮬레이션입니다.`,

    tax: `당신은 대한민국 국세청의 AI 세무 상담사입니다.
${RESPONSE_RULES}
[역할] 세금 신고, 공제, 환급 안내, 소득자료 검토
[시뮬레이션] 이것은 AI 시뮬레이션입니다.`,

    hospital: `당신은 병원의 AI 의료 상담사입니다.
${RESPONSE_RULES}
[역할] 증상 분석, 진료과 안내, 의무기록 검토
[시뮬레이션] 실제 진료는 의사와 상담하세요.`,

    patent: `당신은 대한민국 특허청의 AI 상담사입니다.
${RESPONSE_RULES}
[역할] 특허/상표/디자인 출원 안내, 발명 자료 검토
[시뮬레이션] 이것은 AI 시뮬레이션입니다.`,

    assembly: `당신은 대한민국 국회의 AI 입법 상담사입니다.
${RESPONSE_RULES}
[역할] 청원, 입법예고, 의원 면담 안내
[시뮬레이션] 이것은 AI 시뮬레이션입니다.`,

    province: `당신은 광역시/도청의 AI 행정 상담사입니다.
${RESPONSE_RULES}
[역할] 인허가, 보조금, 지원사업 안내, 신청서류 검토
[시뮬레이션] 이것은 AI 시뮬레이션입니다.`,

    city: `당신은 시/군/구청의 AI 행정 상담사입니다.
${RESPONSE_RULES}
[역할] 건축, 지방세, 복지 서비스 안내
[시뮬레이션] 이것은 AI 시뮬레이션입니다.`,

    community: `당신은 읍/면/동 주민센터의 AI 상담사입니다.
${RESPONSE_RULES}
[역할] 주민등록, 증명서 발급, 복지 신청 안내
[시뮬레이션] 이것은 AI 시뮬레이션입니다.`,

    school: `당신은 학교의 AI 교육 상담사입니다.
${RESPONSE_RULES}
[역할] 입학, 전학, 장학금, 진로 안내
[시뮬레이션] 이것은 AI 시뮬레이션입니다.`,

    market: `당신은 시장의 AI 상거래 상담사입니다.
${RESPONSE_RULES}
[역할] 소비자 피해, 거래 분쟁 안내, 계약서/영수증 검토
[시뮬레이션] 이것은 AI 시뮬레이션입니다.`
};

const DEFAULT_PROMPT = `당신은 고팡 플랫폼의 AI 비서입니다.
${RESPONSE_RULES}
사용자의 질문에 간결하게 답하고, 적절한 기관 AI를 안내하세요.`;

interface ChatParams {
    message: string;
    userId?: string;
    aiType?: string;
    history?: Array<{ role: string; content: string }>;
}

interface ChatResult {
    success: boolean;
    message: string;
    aiType: string;
    timestamp: string;
}

class AIChatService {
    private apiKey: string;
    private baseUrl: string = 'https://api.deepseek.com/v1';

    constructor() {
        this.apiKey = process.env.DEEPSEEK_API_KEY || '';
    }

    async chat(params: ChatParams): Promise<ChatResult> {
        const { message, userId, aiType = 'default', history = [] } = params;
        const systemPrompt = INSTITUTION_PROMPTS[aiType] || DEFAULT_PROMPT;

        // DeepSeek API 사용 가능 여부 확인
        if (!this.apiKey) {
            return this.fallbackResponse(message, aiType);
        }

        try {
            const messages = [
                { role: 'system', content: systemPrompt },
                ...history.map(h => ({ role: h.role, content: h.content })),
                { role: 'user', content: message }
            ];

            const response = await fetch(`${this.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    model: 'deepseek-chat',
                    messages,
                    max_tokens: 200,  // 짧은 응답
                    temperature: 0.7
                })
            });

            if (!response.ok) {
                console.error('DeepSeek API Error:', response.status);
                return this.fallbackResponse(message, aiType);
            }

            const data = await response.json();
            const reply = data.choices?.[0]?.message?.content || '응답을 생성할 수 없습니다.';

            return {
                success: true,
                message: reply,
                aiType,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('AI Chat Error:', error);
            return this.fallbackResponse(message, aiType);
        }
    }

    private fallbackResponse(message: string, aiType: string): ChatResult {
        // 규칙 기반 응답 (API 없을 때)
        const responses: Record<string, string> = {
            court: '어떤 소송 유형인가요? (민사/형사/가사) 관련 자료가 있으면 첨부해주세요.',
            prosecution: '고소/고발 중 어떤 절차가 필요한가요? 증거자료를 첨부해주세요.',
            police: '어떤 사건인가요? 현장 사진이나 목격자 정보가 있으면 첨부해주세요.',
            tax: '어떤 세금 관련 문의인가요? 소득자료가 있으면 첨부해주세요.',
            hospital: '어떤 증상이 있으신가요? 검사 결과가 있으면 첨부해주세요.',
            patent: '어떤 출원(특허/상표/디자인)을 원하시나요? 발명 설명서를 첨부해주세요.',
            assembly: '어떤 청원을 원하시나요? 관련 자료를 첨부해주세요.',
            province: '어떤 행정 서비스가 필요하신가요? 신청서류를 첨부해주세요.',
            city: '어떤 민원인가요? (건축/세금/복지) 관련 서류를 첨부해주세요.',
            community: '어떤 서비스가 필요하신가요? (주민등록/증명서/복지)',
            school: '어떤 교육 상담이 필요하신가요? (입학/장학금/진로)',
            market: '어떤 거래 문제인가요? 계약서나 영수증을 첨부해주세요.'
        };

        return {
            success: true,
            message: responses[aiType] || '무엇을 도와드릴까요? 구체적으로 말씀해주세요.',
            aiType,
            timestamp: new Date().toISOString()
        };
    }

    async searchProducts(query: string): Promise<any[]> {
        // 간단한 상품 검색 (향후 구현)
        return [];
    }
}

export default new AIChatService();
