// 고팡 채팅 애플리케이션
class GopangChat {
    constructor() {
        this.currentUser = null;
        this.currentTarget = null;  // 현재 대화 상대
        this.socket = null;
        this.allUsers = [];
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

        // 검색 버튼
        const searchBtn = document.getElementById('searchBtn');
        if (searchBtn) {
            searchBtn.addEventListener('click', () => this.openSearchModal());
        }

        // 검색 모달 닫기
        const closeModal = document.getElementById('closeModal');
        if (closeModal) {
            closeModal.addEventListener('click', () => this.closeSearchModal());
        }

        // 검색 입력
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));
        }

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

        // 모달 외부 클릭 시 닫기
        const searchModal = document.getElementById('searchModal');
        if (searchModal) {
            searchModal.addEventListener('click', (e) => {
                if (e.target === searchModal) this.closeSearchModal();
            });
        }
    }

    checkLoginStatus() {
        const savedUser = localStorage.getItem('gopang_user');
        if (savedUser) {
            this.currentUser = JSON.parse(savedUser);
            this.showChatScreen();
            this.loadUsers();
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
            // 사용자 생성
            await fetch(`${APP_CONFIG.API_URL}/users`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    user_id: userId,
                    user_type: 'personal',
                    name: userName
                })
            }).catch(() => null);

            this.currentUser = { userId, userName };
            localStorage.setItem('gopang_user', JSON.stringify(this.currentUser));
            
            this.showChatScreen();
            this.loadUsers();
            
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
            this.currentUser = null;
            this.currentTarget = null;
            this.allUsers = [];
            this.showLoginScreen();
        }
    }

    async loadUsers() {
        try {
            const response = await fetch(`${APP_CONFIG.API_URL}/users/list`);
            if (!response.ok) throw new Error('사용자 목록 로드 실패');
            
            this.allUsers = await response.json();
            this.renderUserList(this.allUsers);
            
        } catch (error) {
            console.error('사용자 목록 로드 실패:', error);
        }
    }

    openSearchModal() {
        const modal = document.getElementById('searchModal');
        if (modal) {
            modal.style.display = 'flex';
            document.getElementById('searchInput').focus();
        }
    }

    closeSearchModal() {
        const modal = document.getElementById('searchModal');
        if (modal) {
            modal.style.display = 'none';
            document.getElementById('searchInput').value = '';
            this.renderUserList(this.allUsers);
        }
    }

    handleSearch(query) {
        if (!query.trim()) {
            this.renderUserList(this.allUsers);
            return;
        }

        const filtered = this.allUsers.filter(user => 
            user.name.includes(query) || user.user_id.includes(query)
        );
        this.renderUserList(filtered);
    }

    renderUserList(users) {
        const userList = document.getElementById('userList');
        if (!userList) return;

        if (users.length === 0) {
            userList.innerHTML = '<div class="no-results">검색 결과가 없습니다.</div>';
            return;
        }

        userList.innerHTML = users.map(user => `
            <div class="user-item" data-user-id="${user.user_id}">
                <div class="user-avatar">${user.user_type === '사람' ? '👤' : '🏛️'}</div>
                <div class="user-info">
                    <div class="user-name">${user.name}</div>
                    <div class="user-type">${user.user_type}</div>
                </div>
                ${user.is_online ? '<span class="online-badge">●</span>' : ''}
            </div>
        `).join('');

        // 사용자 클릭 이벤트
        userList.querySelectorAll('.user-item').forEach(item => {
            item.addEventListener('click', () => {
                const userId = item.dataset.userId;
                this.selectTarget(userId);
            });
        });
    }

    selectTarget(userId) {
        const user = this.allUsers.find(u => u.user_id === userId);
        if (!user) return;

        // 자기 자신은 선택 불가
        if (userId === this.currentUser.userId) {
            alert('자기 자신과는 대화할 수 없습니다.');
            return;
        }

        this.currentTarget = user;
        this.closeSearchModal();
        this.updateTargetDisplay();
        this.addMessage('system', `${user.name}와(과) 대화를 시작합니다.`);
    }

    updateTargetDisplay() {
        const targetName = document.getElementById('targetName');
        if (targetName) {
            if (this.currentTarget) {
                const icon = this.currentTarget.user_type === '사람' ? '👤' : '🏛️';
                targetName.textContent = `${icon} ${this.currentTarget.name}`;
            } else {
                targetName.textContent = '🤖 내 AI 비서';
            }
        }
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
            const requestData = {
                user_id: this.currentUser.userId,
                message: message,
                ai_type: this.currentTarget ? 'institution' : 'personal'
            };

            // 대화 상대가 있으면 target_user 추가
            if (this.currentTarget) {
                requestData.target_user = this.currentTarget.user_id;
            }

            const response = await fetch(`${APP_CONFIG.API_URL}/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData)
            });

            if (!response.ok) {
                throw new Error('API 요청 실패');
            }

            const data = await response.json();
            
            this.showTyping(false);
            this.addMessage('ai', data.response, data.model_used);

            // OpenHash 정보 표시 (개발 모드)
            if (data.hash_info && console) {
                console.log('OpenHash:', data.hash_info);
            }

        } catch (error) {
            console.error('메시지 전송 실패:', error);
            this.showTyping(false);
            this.addMessage('system', '메시지 전송에 실패했습니다. 다시 시도해주세요.');
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

        // 대화 상대 표시 업데이트
        this.updateTargetDisplay();

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
