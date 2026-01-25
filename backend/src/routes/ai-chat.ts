/**
 * GOPANG AI 채팅 API
 *
 * POST /api/ai-chat/chat     - 채팅 메시지 전송
 * POST /api/ai-chat/search   - 상품 검색 (자연어)
 * GET  /api/ai-chat/status   - AI 서비스 상태
 */
import { Router, Request, Response } from 'express';
import aiChatService from '../services/ai-chat';

const router = Router();

// 채팅
router.post('/chat', async (req: Request, res: Response) => {
  try {
    const { message, userId, aiType, history } = req.body;
    
    if (!message) {
      res.status(400).json({ success: false, error: '메시지를 입력하세요.' });
      return;
    }
    
    // aiType에 따라 해당 기관 System Prompt 적용
    const result = await aiChatService.chat({
      message,
      userId,
      aiType,  // 사용자가 선택한 기관
      history: history || []
    });
    
    res.json(result);
  } catch (error: any) {
    console.error('AI Chat Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 상품 검색 (자연어)
router.post('/search', async (req: Request, res: Response) => {
  try {
    const { query } = req.body;
    if (!query) {
      res.status(400).json({ success: false, error: '검색어를 입력하세요.' });
      return;
    }
    const products = await aiChatService.searchProducts(query);
    res.json({
      success: true,
      query,
      count: products.length,
      products
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// AI 서비스 상태
router.get('/status', (req: Request, res: Response) => {
  const hasDeepSeekKey = !!process.env.DEEPSEEK_API_KEY;
  res.json({
    success: true,
    services: {
      deepseek: hasDeepSeekKey ? 'configured' : 'not_configured',
      ruleBased: 'active'
    },
    institutions: [
      'court', 'prosecution', 'police', 'assembly',
      'province', 'city', 'community', 'tax',
      'patent', 'hospital', 'school', 'market'
    ]
  });
});

export default router;
