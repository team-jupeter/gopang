/**
 * 환경 설정
 * Day 7: Secrets Manager 통합, 환경변수 중앙화
 */

import { getSecret, SECRET_NAMES } from '../utils/secrets';

interface AppConfig {
  port: number;
  nodeEnv: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  dbPath: string;
  dbEncryptionKey: string;
  awsRegion: string;
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;
  bcryptRounds: number;
  maxLoginAttempts: number;
  lockoutDurationMs: number;
}

let configInstance: AppConfig | null = null;

/**
 * 환경 설정 초기화 (Secrets Manager 로드)
 */
export async function initConfig(): Promise<AppConfig> {
  if (configInstance) return configInstance;

  console.log('[Config] Initializing...');

  // Secrets Manager에서 로드
  const jwtSecret = await getSecret(SECRET_NAMES.JWT_SECRET);
  const dbEncryptionKey = await getSecret(SECRET_NAMES.DB_ENCRYPTION_KEY);

  configInstance = {
    port: parseInt(process.env.PORT || '3000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    jwtSecret,
    jwtExpiresIn: '24h',
    dbPath: process.env.DB_PATH || '/gopang/data/db/gopang.db',
    dbEncryptionKey,
    awsRegion: process.env.AWS_REGION || 'us-east-1',
    rateLimitWindowMs: 60000,
    rateLimitMaxRequests: 100,
    bcryptRounds: 12,
    maxLoginAttempts: 5,
    lockoutDurationMs: 15 * 60 * 1000, // 15분
  };

  console.log('[Config] Initialized successfully');
  return configInstance;
}

/**
 * 설정 조회 (초기화 후 사용)
 */
export function getConfig(): AppConfig {
  if (!configInstance) {
    throw new Error('Config not initialized. Call initConfig() first.');
  }
  return configInstance;
}

export default { initConfig, getConfig };
