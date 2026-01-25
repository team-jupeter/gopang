/**
 * 메시지 핸들러
 * Day 13: message:send, message:status, gopang:status, 30초 타임아웃
 */

import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../services/database';
import { AuthenticatedSocket } from './authMiddleware';
import { getIO } from './index';

const MESSAGE_TIMEOUT = 30000; // 30초

interface SendMessageData {
  conversationId: string;
  content: string;
  messageType?: string;
  metadata?: Record<string, any>;
}

interface MessageResponse {
  success: boolean;
  messageId?: string;
  error?: string;
  status?: string;
}

/**
 * 메시지 핸들러 등록
 */
export function registerMessageHandlers(socket: AuthenticatedSocket): void {
  const user = socket.data.user!;

  // message:send 이벤트
  socket.on('message:send', async (data: SendMessageData, callback?: (res: MessageResponse) => void) => {
    const timeoutId = setTimeout(() => {
      if (callback) {
        callback({ success: false, error: '메시지 처리 시간 초과', status: 'timeout' });
      }
      socket.emit('gopang:status', { status: 'timeout', conversationId: data.conversationId });
    }, MESSAGE_TIMEOUT);

    try {
      // 처리 시작 알림
      socket.emit('gopang:status', { status: 'processing', conversationId: data.conversationId });

      const db = getDatabase();
      const messageId = uuidv4();

      // 메시지 저장
      db.prepare(`
        INSERT INTO messages (id, conversation_id, sender_id, content, message_type, metadata, status)
        VALUES (?, ?, ?, ?, ?, ?, 'sent')
      `).run(
        messageId,
        data.conversationId,
        user.userId,
        data.content,
        data.messageType || 'text',
        data.metadata ? JSON.stringify(data.metadata) : null
      );

      // 대화 업데이트
      db.prepare(`UPDATE conversations SET updated_at = datetime('now') WHERE id = ?`)
        .run(data.conversationId);

      clearTimeout(timeoutId);

      console.log(`[Message] Saved: ${messageId} by ${user.email}`);

      // 수신 확인
      socket.emit('message:status', { messageId, status: 'sent', timestamp: new Date().toISOString() });

      // 대화 참여자들에게 브로드캐스트
      const io = getIO();
      socket.to(`conversation:${data.conversationId}`).emit('message:new', {
        messageId,
        conversationId: data.conversationId,
        senderId: user.userId,
        senderEmail: user.email,
        content: data.content,
        messageType: data.messageType || 'text',
        timestamp: new Date().toISOString(),
      });

      // 처리 완료 알림
      socket.emit('gopang:status', { status: 'completed', conversationId: data.conversationId });

      if (callback) {
        callback({ success: true, messageId, status: 'sent' });
      }
    } catch (error) {
      clearTimeout(timeoutId);
      console.error(`[Message] Error:`, error);

      socket.emit('gopang:status', { status: 'error', conversationId: data.conversationId });

      if (callback) {
        callback({ success: false, error: '메시지 저장 실패', status: 'error' });
      }
    }
  });

  // 대화방 참가
  socket.on('conversation:join', (conversationId: string) => {
    socket.join(`conversation:${conversationId}`);
    console.log(`[Message] ${user.email} joined conversation:${conversationId}`);
  });

  // 대화방 나가기
  socket.on('conversation:leave', (conversationId: string) => {
    socket.leave(`conversation:${conversationId}`);
    console.log(`[Message] ${user.email} left conversation:${conversationId}`);
  });

  // 메시지 읽음 처리
  socket.on('message:read', (messageId: string) => {
    const db = getDatabase();
    db.prepare(`UPDATE messages SET status = 'read' WHERE id = ?`).run(messageId);
    console.log(`[Message] Read: ${messageId}`);
  });
}

export default { registerMessageHandlers };
