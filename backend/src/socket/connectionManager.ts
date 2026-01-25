/**
 * 연결 관리자
 * Day 15: 사용자별 다중 연결 관리 (최대 3개), 미수신 메시지 동기화
 */

import { Server } from 'socket.io';
import { AuthenticatedSocket } from './authMiddleware';
import { getDatabase } from '../services/database';

const MAX_CONNECTIONS_PER_USER = 3;

interface UserConnection {
  socketId: string;
  connectedAt: Date;
}

class ConnectionManager {
  private userConnections: Map<string, UserConnection[]> = new Map();
  private socketToUser: Map<string, string> = new Map();

  /**
   * 새 연결 등록
   */
  addConnection(socket: AuthenticatedSocket, io: Server): void {
    const userId = socket.data.user!.userId;
    const connections = this.userConnections.get(userId) || [];

    // 최대 연결 수 초과 시 가장 오래된 연결 종료
    if (connections.length >= MAX_CONNECTIONS_PER_USER) {
      const oldest = connections.shift()!;
      const oldSocket = io.sockets.sockets.get(oldest.socketId);
      if (oldSocket) {
        oldSocket.emit('connection:replaced', { message: '다른 기기에서 접속하여 연결이 종료됩니다.' });
        oldSocket.disconnect(true);
        console.log(`[ConnMgr] Oldest connection closed: ${oldest.socketId}`);
      }
      this.socketToUser.delete(oldest.socketId);
    }

    // 새 연결 추가
    connections.push({ socketId: socket.id, connectedAt: new Date() });
    this.userConnections.set(userId, connections);
    this.socketToUser.set(socket.id, userId);

    console.log(`[ConnMgr] Added: ${userId} - ${socket.id} (${connections.length}/${MAX_CONNECTIONS_PER_USER})`);
  }

  /**
   * 연결 해제
   */
  removeConnection(socketId: string): void {
    const userId = this.socketToUser.get(socketId);
    if (!userId) return;

    const connections = this.userConnections.get(userId) || [];
    const filtered = connections.filter(c => c.socketId !== socketId);

    if (filtered.length > 0) {
      this.userConnections.set(userId, filtered);
    } else {
      this.userConnections.delete(userId);
    }

    this.socketToUser.delete(socketId);
    console.log(`[ConnMgr] Removed: ${userId} - ${socketId} (${filtered.length}/${MAX_CONNECTIONS_PER_USER})`);
  }

  /**
   * 사용자의 모든 소켓 ID 조회
   */
  getUserSockets(userId: string): string[] {
    const connections = this.userConnections.get(userId) || [];
    return connections.map(c => c.socketId);
  }

  /**
   * 사용자 연결 수 조회
   */
  getUserConnectionCount(userId: string): number {
    return (this.userConnections.get(userId) || []).length;
  }

  /**
   * 재연결 시 미수신 메시지 동기화
   */
  async syncMissedMessages(socket: AuthenticatedSocket, lastMessageId?: string): Promise<void> {
    const userId = socket.data.user!.userId;
    const db = getDatabase();

    try {
      let messages;
      if (lastMessageId) {
        // 특정 메시지 이후의 메시지 조회
        const lastMessage = db.prepare('SELECT created_at FROM messages WHERE id = ?').get(lastMessageId) as any;
        if (lastMessage) {
          messages = db.prepare(`
            SELECT m.*, c.participants 
            FROM messages m
            JOIN conversations c ON m.conversation_id = c.id
            WHERE m.created_at > ? 
            AND c.participants LIKE ?
            ORDER BY m.created_at ASC
            LIMIT 100
          `).all(lastMessage.created_at, `%${userId}%`);
        }
      } else {
        // 최근 24시간 미수신 메시지
        messages = db.prepare(`
          SELECT m.*, c.participants 
          FROM messages m
          JOIN conversations c ON m.conversation_id = c.id
          WHERE m.created_at > datetime('now', '-1 day')
          AND m.sender_id != ?
          AND c.participants LIKE ?
          AND m.status != 'read'
          ORDER BY m.created_at ASC
          LIMIT 100
        `).all(userId, `%${userId}%`);
      }

      if (messages && messages.length > 0) {
        socket.emit('messages:sync', {
          count: messages.length,
          messages: messages.map((m: any) => ({
            messageId: m.id,
            conversationId: m.conversation_id,
            senderId: m.sender_id,
            content: m.content,
            messageType: m.message_type,
            timestamp: m.created_at,
          })),
        });
        console.log(`[ConnMgr] Synced ${messages.length} messages to ${userId}`);
      }
    } catch (error) {
      console.error(`[ConnMgr] Sync error for ${userId}:`, error);
    }
  }

  /**
   * 전체 연결 통계
   */
  getStats(): { totalUsers: number; totalConnections: number } {
    let totalConnections = 0;
    this.userConnections.forEach(conns => totalConnections += conns.length);
    return {
      totalUsers: this.userConnections.size,
      totalConnections,
    };
  }
}

export const connectionManager = new ConnectionManager();
export default connectionManager;
