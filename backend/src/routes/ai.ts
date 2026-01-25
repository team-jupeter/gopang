/**
 * AI Engine Routes
 */
import { Router, Request, Response } from 'express';
import { aiEngineService } from '../services/aiEngine';

const router = Router();

// AI 엔진 상태 확인
router.get('/health', async (req: Request, res: Response) => {
  try {
    const health = await aiEngineService.health();
    res.json(health);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 채팅 API
router.post('/chat', async (req: Request, res: Response) => {
  try {
    const { message, system_prompt, max_tokens } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'message 필드가 필요합니다.' });
    }

    const response = await aiEngineService.chat(message, system_prompt, max_tokens || 150);
    res.json(response);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 문서 분류 API
router.post('/classify', async (req: Request, res: Response) => {
  try {
    const { content } = req.body;
    
    if (!content) {
      return res.status(400).json({ error: 'content 필드가 필요합니다.' });
    }

    const category = await aiEngineService.classifyDocument(content);
    res.json({ category });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
