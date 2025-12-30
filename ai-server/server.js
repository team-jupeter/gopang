/**
 * Gopang Socket.IO Server
 * 실시간 WebSocket 통신 및 FastAPI 연동
 */
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const axios = require('axios');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

// FastAPI AI 서버 URL
const AI_SERVER_URL = 'http://127.0.0.1:8000';

// 헬스체크
app.get('/', (req, res) => {
  res.json({
    service: 'Gopang Socket.IO Server',
    status: 'running',
    connections: io.engine.clientsCount
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

// Socket.IO 연결 관리
io.on('connection', (socket) => {
  console.log(`[${new Date().toISOString()}] Client connected: ${socket.id}`);
  
  // 메시지 수신 및 AI 응답
  socket.on('send_message', async (data) => {
    console.log(`[${socket.id}] Message received:`, data);
    
    try {
      const { user_id, message, ai_type = 'personal' } = data;
      
      // FastAPI AI 서버 호출
      const response = await axios.post(`${AI_SERVER_URL}/chat`, {
        user_id,
        message,
        ai_type
      }, {
        timeout: 30000
      });
      
      // AI 응답 전송
      socket.emit('receive_message', {
        success: true,
        ai_response: response.data.response,
        ai_type: response.data.ai_type,
        model_used: response.data.model_used,
        timestamp: new Date().toISOString()
      });
      
      console.log(`[${socket.id}] AI response sent`);
      
    } catch (error) {
      console.error(`[${socket.id}] Error:`, error.message);
      
      socket.emit('receive_message', {
        success: false,
        error: error.message || 'AI 응답 생성 실패',
        timestamp: new Date().toISOString()
      });
    }
  });
  
  // 연결 해제
  socket.on('disconnect', () => {
    console.log(`[${new Date().toISOString()}] Client disconnected: ${socket.id}`);
  });
});

// 서버 시작
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║  Gopang Socket.IO Server                                   ║
║  Port: ${PORT}                                                  ║
║  Status: Running                                           ║
║  AI Server: ${AI_SERVER_URL}                      ║
╚════════════════════════════════════════════════════════════╝
  `);
});

// 에러 핸들링
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
