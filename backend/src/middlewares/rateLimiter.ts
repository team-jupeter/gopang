/**
 * Rate Limiting 미들웨어
 * Day 10: 분당 100회 제한
 */

import rateLimit from 'express-rate-limit';

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1분
  max: 100,            // 분당 100회
  message: {
    error: 'Too many requests',
    message: '요청 한도를 초과했습니다. 1분 후 다시 시도하세요.',
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// 인증 API용 (더 엄격: 분당 10회)
export const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: {
    error: 'Too many auth attempts',
    message: '인증 시도 한도를 초과했습니다. 1분 후 다시 시도하세요.',
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export default { apiLimiter, authLimiter };
