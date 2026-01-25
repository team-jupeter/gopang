/**
 * 전화번호 기반 인증 서비스
 * GOPANG 사용자 (제주시/서귀포시 주민) 전용
 */
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';

const JWT_SECRET = process.env.JWT_SECRET || 'gopang-dev-secret-key-2026';
const JWT_EXPIRES_IN = '24h';
const REFRESH_EXPIRES_IN = '7d';

interface UserLocation {
  global: string;
  country: string;
  province: string;
  city: string;
  district: string;
  districtName: string;
}

interface UserBusiness {
  corpName: string;
  bizNo: string;
  bizType: string;
  established: string;
}

interface PhoneUser {
  userId: string;
  loginId: string;
  password: string;
  name: string;
  phone: string;
  location: UserLocation;
  business: UserBusiness;
  wallet: { address: string; balance: number };
  financialStatement: any;
  createdAt: string;
}

interface AuthResult {
  success: boolean;
  message: string;
  accessToken?: string;
  refreshToken?: string;
  user?: {
    userId: string;
    loginId: string;
    name: string;
    phone: string;
    location: UserLocation;
    business: UserBusiness;
    wallet: { address: string; balance: number };
  };
}

class PhoneAuthService {
  private users: PhoneUser[] = [];
  private dataLoaded: boolean = false;

  constructor() {
    this.loadUsers();
  }

  private loadUsers(): void {
    try {
      const dataDir = '/gopang/frontend/data';
      
      // 서귀포시 사용자
      const seogwipoPath = path.join(dataDir, 'users-registry.json');
      if (fs.existsSync(seogwipoPath)) {
        const seogwipoData = JSON.parse(fs.readFileSync(seogwipoPath, 'utf-8'));
        this.users.push(...seogwipoData.users);
      }

      // 제주시 사용자
      const jejuPath = path.join(dataDir, 'users-jeju-city.json');
      if (fs.existsSync(jejuPath)) {
        const jejuData = JSON.parse(fs.readFileSync(jejuPath, 'utf-8'));
        this.users.push(...jejuData.users);
      }

      this.dataLoaded = true;
      console.log(`[PhoneAuth] Loaded ${this.users.length} users`);
    } catch (error) {
      console.error('[PhoneAuth] Failed to load users:', error);
    }
  }

  /**
   * 전화번호 또는 로그인ID로 로그인
   */
  async login(identifier: string, password: string): Promise<AuthResult> {
    if (!this.dataLoaded) {
      this.loadUsers();
    }

    // 전화번호 또는 로그인ID로 사용자 찾기
    const user = this.users.find(u => 
      u.userId === identifier || 
      u.loginId === identifier ||
      u.phone === identifier ||
      u.userId.replace(/-/g, '') === identifier.replace(/-/g, '')
    );

    if (!user) {
      return { success: false, message: '등록되지 않은 사용자입니다.' };
    }

    if (user.password !== password) {
      return { success: false, message: '비밀번호가 올바르지 않습니다.' };
    }

    // JWT 토큰 생성
    const tokenPayload = {
      userId: user.userId,
      loginId: user.loginId,
      name: user.name,
      district: user.location.district
    };

    const accessToken = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    const refreshToken = jwt.sign({ userId: user.userId }, JWT_SECRET, { expiresIn: REFRESH_EXPIRES_IN });

    console.log(`[PhoneAuth] Login success: ${user.loginId} (${user.name})`);

    return {
      success: true,
      message: '로그인 성공',
      accessToken,
      refreshToken,
      user: {
        userId: user.userId,
        loginId: user.loginId,
        name: user.name,
        phone: user.phone,
        location: user.location,
        business: user.business,
        wallet: user.wallet
      }
    };
  }

  /**
   * 토큰 검증
   */
  verifyToken(token: string): { valid: boolean; payload?: any; error?: string } {
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      return { valid: true, payload };
    } catch (error: any) {
      return { valid: false, error: error.message };
    }
  }

  /**
   * 토큰 갱신
   */
  async refreshAccessToken(refreshToken: string): Promise<AuthResult> {
    try {
      const decoded = jwt.verify(refreshToken, JWT_SECRET) as { userId: string };
      const user = this.users.find(u => u.userId === decoded.userId);

      if (!user) {
        return { success: false, message: '사용자를 찾을 수 없습니다.' };
      }

      const tokenPayload = {
        userId: user.userId,
        loginId: user.loginId,
        name: user.name,
        district: user.location.district
      };

      const newAccessToken = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

      return {
        success: true,
        message: '토큰 갱신 성공',
        accessToken: newAccessToken
      };
    } catch (error) {
      return { success: false, message: '유효하지 않은 리프레시 토큰입니다.' };
    }
  }

  /**
   * 사용자 조회
   */
  getUser(identifier: string): PhoneUser | undefined {
    return this.users.find(u => 
      u.userId === identifier || u.loginId === identifier
    );
  }

  /**
   * 지역별 사용자 목록
   */
  getUsersByDistrict(district: string): PhoneUser[] {
    return this.users.filter(u => u.location.district === district);
  }

  /**
   * 사용자 잔액 업데이트 (거래 후)
   */
  updateUserBalance(userId: string, newBalance: number): boolean {
    const user = this.users.find(u => u.userId === userId);
    if (user) {
      user.wallet.balance = newBalance;
      return true;
    }
    return false;
  }

  /**
   * 전체 사용자 수
   */
  getTotalUsers(): number {
    return this.users.length;
  }
}

export default new PhoneAuthService();
