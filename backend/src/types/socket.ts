/**
 * Socket.IO 이벤트 타입 정의
 * Day 14: 20개 이벤트 타입
 */

// ==================== 메시지 관련 (4개) ====================
export interface MessageSendData {
  conversationId: string;
  content: string;
  messageType?: 'text' | 'system' | 'ai_response' | 'transaction' | 'handshake';
  metadata?: Record<string, any>;
}

export interface MessageNewData {
  messageId: string;
  conversationId: string;
  senderId: string;
  senderEmail: string;
  content: string;
  messageType: string;
  timestamp: string;
}

export interface MessageStatusData {
  messageId: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
}

export interface MessageReadData {
  messageId: string;
}

// ==================== 고팡 상태 (3개) ====================
export interface GopangStatusData {
  status: 'processing' | 'completed' | 'error' | 'timeout';
  conversationId: string;
  details?: string;
}

export interface GopangAIResponseData {
  conversationId: string;
  aiId: string;
  aiName: string;
  response: string;
  handshake?: string;
  timestamp: string;
}

export interface GopangErrorData {
  code: string;
  message: string;
  conversationId?: string;
}

// ==================== 동의 관련 (3개) ====================
export interface ConsentRequestData {
  consentId: string;
  requesterId: string;
  requesterName: string;
  dataType: string;
  purpose: string;
  expiresAt: string;
}

export interface ConsentResponseData {
  consentId: string;
  approved: boolean;
  conditions?: string;
}

export interface ConsentStatusData {
  consentId: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  updatedAt: string;
}

// ==================== 거래 관련 (4개) ====================
export interface TransactionCreateData {
  receiverId: string;
  amount: number;
  description?: string;
  category?: string;
}

export interface TransactionStatusData {
  transactionId: string;
  status: 'pending' | 'verified' | 'completed' | 'failed' | 'cancelled';
  updatedAt: string;
}

export interface TransactionVerifyData {
  transactionId: string;
  step: number;
  result: 'pass' | 'fail';
  reason?: string;
}

export interface TransactionCompleteData {
  transactionId: string;
  amount: number;
  senderId: string;
  receiverId: string;
  blockchainHash?: string;
  completedAt: string;
}

// ==================== 오픈해시 관련 (3개) ====================
export interface OpenHashRecordData {
  documentId: string;
  hashValue: string;
  layer: 1 | 2 | 3 | 4;
  timestamp: string;
}

export interface OpenHashVerifyData {
  hashValue: string;
  verified: boolean;
  layer?: number;
  recordedAt?: string;
}

export interface OpenHashSyncData {
  batchId: string;
  recordCount: number;
  merkleRoot: string;
  status: 'syncing' | 'completed' | 'failed';
}

// ==================== 금고 관련 (3개) ====================
export interface VaultAccessData {
  vaultId: string;
  drawerId?: string;
  action: 'read' | 'write' | 'list';
}

export interface VaultContentData {
  vaultId: string;
  drawerId: string;
  drawerType: 'FINANCE' | 'MEDICAL' | 'EDUCATION' | 'ADMIN' | 'TRANSPORT' | 'GENERAL';
  content: any;
  updatedAt: string;
}

export interface VaultProofData {
  vaultId: string;
  drawerId: string;
  proof: string;
  verifiedAt: string;
}

// ==================== 서버 → 클라이언트 이벤트 ====================
export interface ServerToClientEvents {
  connected: (data: { socketId: string; user: any; serverTime: string }) => void;
  error: (data: { message: string }) => void;
  'token:refresh': (data: { message: string; expiresIn: number }) => void;
  
  'message:new': (data: MessageNewData) => void;
  'message:status': (data: MessageStatusData) => void;
  
  'gopang:status': (data: GopangStatusData) => void;
  'gopang:ai_response': (data: GopangAIResponseData) => void;
  'gopang:error': (data: GopangErrorData) => void;
  
  'consent:request': (data: ConsentRequestData) => void;
  'consent:status': (data: ConsentStatusData) => void;
  
  'transaction:status': (data: TransactionStatusData) => void;
  'transaction:verify': (data: TransactionVerifyData) => void;
  'transaction:complete': (data: TransactionCompleteData) => void;
  
  'openhash:record': (data: OpenHashRecordData) => void;
  'openhash:verify': (data: OpenHashVerifyData) => void;
  'openhash:sync': (data: OpenHashSyncData) => void;
  
  'vault:content': (data: VaultContentData) => void;
  'vault:proof': (data: VaultProofData) => void;
}

// ==================== 클라이언트 → 서버 이벤트 ====================
export interface ClientToServerEvents {
  ping: (callback: (data: { pong: boolean; time: number }) => void) => void;
  
  'message:send': (data: MessageSendData, callback?: (res: any) => void) => void;
  'message:read': (messageId: string) => void;
  
  'conversation:join': (conversationId: string) => void;
  'conversation:leave': (conversationId: string) => void;
  
  'consent:respond': (data: ConsentResponseData) => void;
  
  'transaction:create': (data: TransactionCreateData, callback?: (res: any) => void) => void;
  'transaction:cancel': (transactionId: string) => void;
  
  'openhash:verify': (hashValue: string, callback?: (res: OpenHashVerifyData) => void) => void;
  
  'vault:access': (data: VaultAccessData, callback?: (res: any) => void) => void;
}
