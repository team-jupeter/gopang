/**
 * AWS Secrets Manager 연동 유틸리티
 * Day 7: 하드코딩된 시크릿 제거, Secrets Manager에서 로드
 */

import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';

// 캐시 (5분 TTL)
const CACHE_TTL = 5 * 60 * 1000;
const secretCache = new Map<string, { value: string; expiresAt: number }>();

const client = new SecretsManagerClient({
  region: process.env.AWS_REGION || 'us-east-1',
});

/**
 * Secrets Manager에서 시크릿 값 조회
 */
export async function getSecret(secretName: string): Promise<string> {
  // 캐시 확인
  const cached = secretCache.get(secretName);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  try {
    const command = new GetSecretValueCommand({ SecretId: secretName });
    const response = await client.send(command);

    let secretValue: string;
    if (response.SecretString) {
      const parsed = JSON.parse(response.SecretString);
      secretValue = parsed.value || response.SecretString;
    } else {
      throw new Error(`Secret ${secretName} has no value`);
    }

    // 캐시 저장
    secretCache.set(secretName, {
      value: secretValue,
      expiresAt: Date.now() + CACHE_TTL,
    });

    console.log(`[Secrets] Loaded: ${secretName}`);
    return secretValue;
  } catch (error) {
    console.error(`[Secrets] Failed to get ${secretName}:`, error);
    throw error;
  }
}

/**
 * 시크릿 이름 상수
 */
export const SECRET_NAMES = {
  JWT_SECRET: 'gopang/jwt-secret',
  DB_ENCRYPTION_KEY: 'gopang/db-encryption-key',
} as const;
