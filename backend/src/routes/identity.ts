/**
 * 오픈해시 기반 신원 증명 API
 * 
 * 【인증 흐름】
 * 1. 등록: POST /api/identity/register - 신분증 등록 (발행 기관)
 * 2. 검증: POST /api/identity/verify - 신원 검증 (서비스 제공자)
 * 3. 간편인증: POST /api/identity/quick-auth - 해시 기반 빠른 로그인
 * 4. 조회: GET /api/identity/issuers - 신뢰된 발행 기관 목록
 */

import { Router, Request, Response } from 'express';
import identityService from '../services/auth-identity';

const router = Router();

// 신분증 등록 (발행 기관용)
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { document, issuerId, issuerPrivateKey } = req.body;
    
    if (!document || !issuerId) {
      res.status(400).json({ 
        success: false, 
        error: 'document와 issuerId는 필수입니다.' 
      });
      return;
    }

    const result = await identityService.registerIdentity(
      document,
      issuerId,
      issuerPrivateKey || 'test-private-key'
    );

    res.status(result.success ? 201 : 400).json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 신원 검증 (서비스 제공자용)
router.post('/verify', async (req: Request, res: Response) => {
  try {
    const { proof } = req.body;
    
    if (!proof) {
      res.status(400).json({ 
        success: false, 
        error: '신원 증명(proof)이 필요합니다.' 
      });
      return;
    }

    const result = await identityService.verifyIdentity(proof);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ verified: false, message: error.message });
  }
});

// 간편 인증 (로그인용)
router.post('/quick-auth', async (req: Request, res: Response) => {
  try {
    const { documentHash, layerId, timestamp, signature } = req.body;
    
    if (!documentHash || !layerId || !timestamp || !signature) {
      res.status(400).json({ 
        success: false, 
        error: 'documentHash, layerId, timestamp, signature가 필요합니다.' 
      });
      return;
    }

    const result = await identityService.quickAuth(
      documentHash,
      layerId,
      timestamp,
      signature
    );

    res.status(result.success ? 200 : 401).json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 신뢰된 발행 기관 목록
router.get('/issuers', (req: Request, res: Response) => {
  const issuers = identityService.getTrustedIssuers();
  res.json({
    success: true,
    count: issuers.length,
    issuers: issuers.map(i => ({
      id: i.id,
      name: i.name,
      country: i.country
    }))
  });
});

// 신원 증명 생성 도우미 (테스트용)
router.post('/create-proof', async (req: Request, res: Response) => {
  try {
    const { 
      name, 
      documentId, 
      birthDate, 
      documentType = 'RESIDENT_ID',
      issuerId = 'KR-MOIS' 
    } = req.body;

    if (!name || !documentId || !birthDate) {
      res.status(400).json({ 
        success: false, 
        error: 'name, documentId, birthDate가 필요합니다.' 
      });
      return;
    }

    const document = {
      type: documentType,
      documentId,
      holderName: name,
      birthDate,
      issuedAt: new Date().toISOString()
    };

    const result = await identityService.registerIdentity(
      document,
      issuerId,
      'test-private-key'
    );

    if (result.success && result.proof) {
      // 사용자가 저장해야 할 간략 정보
      const userStorage = {
        documentHash: result.proof.openHashProof.documentHash,
        layer: result.proof.openHashProof.layer,
        layerId: result.proof.openHashProof.layerId,
        nodeUrl: result.proof.openHashProof.nodeUrl,
        storedAt: result.proof.openHashProof.storedAt,
        issuer: result.proof.issuer.name
      };

      res.status(201).json({
        success: true,
        message: '신원 증명 생성 완료',
        proof: result.proof,
        userStorage,
        quickAuthExample: {
          endpoint: 'POST /api/identity/quick-auth',
          body: {
            documentHash: userStorage.documentHash,
            layerId: userStorage.layerId,
            timestamp: '<현재시각>',
            signature: 'SHA256(documentHash + ":" + timestamp)'
          }
        }
      });
    } else {
      res.status(400).json(result);
    }
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
