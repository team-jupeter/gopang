// 고팡 채팅 애플리케이션
class GopangChat {
    constructor() {
        this.currentUser = null;
        this.currentAI = 'personal';
        this.socket = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.checkLoginStatus();
    }

    setupEventListeners() {
        // 로그인 폼
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }

        // 로그아웃
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.handleLogout());
        }

        // AI 선택
        document.querySelectorAll('.ai-tab').forEach(tab => {
            tab.addEventListener('click', (e) => this.handleAISwitch(e));
        });

        // 메시지 전송
        const sendBtn = document.getElementById('sendBtn');
        const messageInput = document.getElementById('messageInput');
        
        if (sendBtn) {
            sendBtn.addEventListener('click', () => this.sendMessage());
        }
        
        if (messageInput) {
            messageInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.sendMessage();
            });
        }
    }

    checkLoginStatus() {
        const savedUser = localStorage.getItem('gopang_user');
        if (savedUser) {
            this.currentUser = JSON.parse(savedUser);
            this.showChatScreen();
            this.connectSocket();
        }
    }

    async handleLogin(e) {
        e.preventDefault();
        
        const userId = document.getElementById('userId').value.trim();
        const userName = document.getElementById('userName').value.trim();

        if (!userId || !userName) {
            alert('사용자 ID와 이름을 입력하세요.');
            return;
        }

        this.showLoading(true);

        try {
            // 사용자 생성 (없으면)
            const response = await fetch(`${APP_CONFIG.API_URL}/users`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    user_id: userId,
                    user_type: 'personal',
                    name: userName
                })
            }).catch(() => null); // 이미 존재하면 무시

            this.currentUser = { userId, userName };
            localStorage.setItem('gopang_user', JSON.stringify(this.currentUser));
            
            this.showChatScreen();
            this.connectSocket();
            
        } catch (error) {
            console.error('로그인 실패:', error);
            alert('로그인 중 오류가 발생했습니다.');
        } finally {
            this.showLoading(false);
        }
    }

    handleLogout() {
        if (confirm('로그아웃 하시겠습니까?')) {
            localStorage.removeItem('gopang_user');
            if (this.socket) {
                this.socket.disconnect();
            }
            this.currentUser = null;
            this.showLoginScreen();
        }
    }

    handleAISwitch(e) {
        const aiType = e.currentTarget.dataset.ai;
        
        // 탭 활성화
        document.querySelectorAll('.ai-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        e.currentTarget.classList.add('active');
        
        this.currentAI = aiType;
        
        // 시스템 메시지 추가
        const aiName = aiType === 'personal' ? '개인 AI (0.5B)' : '기관 AI (3B)';
        this.addMessage('system', `${aiName}로 전환되었습니다.`);
    }

    connectSocket() {
        this.socket = io(APP_CONFIG.SOCKET_URL);

        this.socket.on('connect', () => {
            console.log('Socket.IO 연결됨');
            this.addMessage('system', '서버에 연결되었습니다.');
        });

        this.socket.on('disconnect', () => {
            console.log('Socket.IO 연결 끊김');
            this.addMessage('system', '서버와의 연결이 끊어졌습니다.');
        });

        this.socket.on('receive_message', (data) => {
            this.handleAIResponse(data);
        });
    }

    async sendMessage() {
        const input = document.getElementById('messageInput');
        const message = input.value.trim();

        if (!message) return;

        // 사용자 메시지 표시
        this.addMessage('user', message);
        input.value = '';

        // 타이핑 인디케이터
        this.showTyping(true);

        try {
            // REST API 방식
            const response = await fetch(`${APP_CONFIG.API_URL}/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    user_id: this.currentUser.userId,
                    message: message,
                    ai_type: this.currentAI
                })
            });

            if (!response.ok) {
                throw new Error('API 요청 실패');
            }

            const data = await response.json();
            
            this.showTyping(false);
            this.addMessage('ai', data.response, data.model_used);

        } catch (error) {
            console.error('메시지 전송 실패:', error);
            this.showTyping(false);
            this.addMessage('system', '메시지 전송에 실패했습니다. 다시 시도해주세요.');
        }
    }

    handleAIResponse(data) {
        this.showTyping(false);
        
        if (data.success) {
            this.addMessage('ai', data.ai_response, data.model_used);
        } else {
            this.addMessage('system', 'AI 응답 생성에 실패했습니다.');
        }
    }

    addMessage(type, content, modelName = null) {
        const messagesDiv = document.getElementById('messages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;

        const bubble = document.createElement('div');
        bubble.className = 'message-bubble';
        bubble.textContent = content;

        messageDiv.appendChild(bubble);

        // AI 응답에 모델명 표시
        if (type === 'ai' && modelName) {
            const time = document.createElement('div');
            time.className = 'message-time';
            time.textContent = modelName;
            messageDiv.appendChild(time);
        }

        messagesDiv.appendChild(messageDiv);
        
        // 자동 스크롤
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }

    showTyping(show) {
        const messagesDiv = document.getElementById('messages');
        let typingDiv = document.querySelector('.typing-indicator');

        if (show && !typingDiv) {
            typingDiv = document.createElement('div');
            typingDiv.className = 'message ai';
            typingDiv.innerHTML = `
                <div class="message-bubble typing-indicator">
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                </div>
            `;
            messagesDiv.appendChild(typingDiv);
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
        } else if (!show && typingDiv) {
            typingDiv.remove();
        }
    }

    showLoading(show) {
        const indicator = document.getElementById('loadingIndicator');
        if (indicator) {
            indicator.classList.toggle('active', show);
        }
    }

    showLoginScreen() {
        document.getElementById('loginScreen').classList.add('active');
        document.getElementById('chatScreen').classList.remove('active');
    }

    showChatScreen() {
        document.getElementById('loginScreen').classList.remove('active');
        document.getElementById('chatScreen').classList.add('active');
        
        // 사용자 이름 표시
        const usernameSpan = document.getElementById('username');
        if (usernameSpan && this.currentUser) {
            usernameSpan.textContent = this.currentUser.userName;
        }

        // 메시지 입력창 포커스
        setTimeout(() => {
            document.getElementById('messageInput').focus();
        }, 100);
    }
}

// 앱 초기화
document.addEventListener('DOMContentLoaded', () => {
    window.gopangChat = new GopangChat();
});
