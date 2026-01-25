import { initConfig } from './src/config';
import { initDatabase, closeDatabase } from './src/services/database';
import { AuthService } from './src/services/auth';

async function test() {
  console.log('=== Day 9 인증 테스트 ===\n');

  // 초기화
  await initConfig();
  initDatabase('/gopang/data/db/gopang.db');
  const auth = new AuthService();

  // 1. 회원가입
  console.log('1. 회원가입 테스트');
  const regResult = await auth.register('test@gopang.kr', 'password123', '테스트유저');
  console.log(`   → ${regResult.message}\n`);

  // 2. 로그인 성공
  console.log('2. 로그인 성공 테스트');
  const loginResult = await auth.login('test@gopang.kr', 'password123');
  console.log(`   → ${loginResult.message}`);
  console.log(`   → AccessToken: ${loginResult.accessToken?.substring(0, 30)}...`);
  console.log(`   → RefreshToken: ${loginResult.refreshToken?.substring(0, 30)}...\n`);

  // 3. 토큰 검증
  console.log('3. 토큰 검증 테스트');
  const payload = auth.verifyToken(loginResult.accessToken!);
  console.log(`   → userId: ${payload?.userId}`);
  console.log(`   → email: ${payload?.email}\n`);

  // 4. 토큰 갱신
  console.log('4. Refresh Token 갱신 테스트');
  const refreshResult = await auth.refreshAccessToken(loginResult.refreshToken!);
  console.log(`   → ${refreshResult.message}\n`);

  // 5. 로그인 실패 (계정 잠금)
  console.log('5. 계정 잠금 테스트 (5회 실패)');
  for (let i = 1; i <= 5; i++) {
    const failResult = await auth.login('test@gopang.kr', 'wrongpassword');
    console.log(`   → 시도 ${i}: ${failResult.message}`);
  }

  // 6. 잠금 후 로그인 시도
  console.log('\n6. 잠금 후 로그인 시도');
  const lockedResult = await auth.login('test@gopang.kr', 'password123');
  console.log(`   → ${lockedResult.message}`);

  closeDatabase();
  console.log('\n✓ 테스트 완료');
}

test().catch(console.error);
