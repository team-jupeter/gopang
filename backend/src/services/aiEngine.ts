/**
 * AI Engine Service
 * 로컬 EXAONE 모델과 통신
 */
import axios from 'axios';

const AI_ENGINE_URL = process.env.AI_ENGINE_URL || 'http://localhost:8000';

interface ChatResponse {
  response: string;
  processing_time: number;
}

interface HealthResponse {
  status: string;
  model_loaded: boolean;
  llama_server_status: string;
  memory_info: {
    ram_total_mb: number;
    ram_used_mb: number;
    ram_available_mb: number;
    swap_total_mb: number;
    swap_used_mb: number;
  };
}

class AIEngineService {
  
  async health(): Promise<HealthResponse> {
    try {
      const response = await axios.get(`${AI_ENGINE_URL}/health`, { timeout: 5000 });
      return response.data;
    } catch (error) {
      return {
        status: 'unavailable',
        model_loaded: false,
        llama_server_status: 'not_running',
        memory_info: { ram_total_mb: 0, ram_used_mb: 0, ram_available_mb: 0, swap_total_mb: 0, swap_used_mb: 0 }
      };
    }
  }

  async chat(message: string, systemPrompt?: string, maxTokens: number = 150): Promise<ChatResponse> {
    try {
      const response = await axios.post(
        `${AI_ENGINE_URL}/inference`,
        {
          message,
          system_prompt: systemPrompt || '당신은 고팡 AI 어시스턴트입니다. 정확하고 친절하게 답변하세요.',
          max_tokens: maxTokens
        },
        { timeout: 300000 } // 5분 타임아웃
      );
      return response.data;
    } catch (error: any) {
      throw new Error(`AI 추론 실패: ${error.message}`);
    }
  }

  async classifyDocument(content: string): Promise<string> {
    const systemPrompt = `당신은 문서 분류 전문가입니다. 
다음 문서를 분석하여 카테고리를 하나만 선택하세요:
- FINANCE: 금융, 은행, 세금, 보험 관련
- MEDICAL: 의료, 건강, 병원 관련
- EDUCATION: 교육, 학교, 자격증 관련
- ADMIN: 행정, 공공기관, 민원 관련
- TRANSPORT: 교통, 운전, 차량 관련
- GENERAL: 기타

카테고리명만 출력하세요.`;

    const response = await this.chat(content.substring(0, 500), systemPrompt, 20);
    const category = response.response.trim().toUpperCase();
    
    const validCategories = ['FINANCE', 'MEDICAL', 'EDUCATION', 'ADMIN', 'TRANSPORT', 'GENERAL'];
    return validCategories.includes(category) ? category : 'GENERAL';
  }
}

export const aiEngineService = new AIEngineService();
