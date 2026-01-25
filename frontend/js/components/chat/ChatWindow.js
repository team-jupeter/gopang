// 채팅 창 컴포넌트
const ChatWindow = {
    currentPartner: null,
    
    render(partner) {
        return `
            <div class="chat-screen" id="chatScreen">
                <header class="chat-header">
                    <button class="header-btn" onclick="ChatWindow.close()">
                        <span class="material-icons">arrow_back</span>
                    </button>
                    <div class="chat-header-avatar">
                        <span class="material-icons">${partner.icon}</span>
                    </div>
                    <div class="chat-header-info">
                        <div class="chat-header-name">
                            ${partner.name}
                            ${partner.type === 'institution' ? '<span class="conv-badge">기관</span>' : ''}
                        </div>
                        <div class="chat-header-status">
                            ${partner.type === 'institution' ? '24시간 운영' : '온라인'}
                        </div>
                    </div>
                    <div class="chat-header-actions">
                        <button class="header-btn" onclick="ChatWindow.showProfile()">
                            <span class="material-icons">info</span>
                        </button>
                    </div>
                </header>
                <div class="messages" id="chatMessages"></div>
                <div class="chat-input-area">
                    <div class="chat-input-wrapper">
                        <textarea class="chat-input" id="chatInput" rows="1" 
                            placeholder="메시지 입력..."></textarea>
                    </div>
                    <button class="chat-send-btn" onclick="ChatWindow.send()">
                        <span class="material-icons">send</span>
                    </button>
                </div>
            </div>
        `;
    },
    
    open(partnerId) {
        const conversations = Store.getState('conversations') || [];
        const partner = conversations.find(c => c.id === partnerId);
        if (!partner) return;
        
        this.currentPartner = partner;
        Store.setState('currentChat', partner);
        
        const app = DOM.$('#app');
        app.innerHTML = this.render(partner);
        
        this.initInput();
        this.loadMessages();
    },
    
    close() {
        this.currentPartner = null;
        Store.setState('currentChat', null);
        App.showMain();
    },
    
    initInput() {
        const input = DOM.$('#chatInput');
        if (!input) return;
        
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.send();
            }
        });
        
        input.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 100) + 'px';
        });
    },
    
    loadMessages() {
        const container = DOM.$('#chatMessages');
        if (!container || !this.currentPartner) return;
        
        container.innerHTML = `
            <div class="message received">
                <div class="message-avatar">
                    <span class="material-icons">${this.currentPartner.icon}</span>
                </div>
                <div class="message-body">
                    <div class="message-bubble">안녕하세요! 무엇을 도와드릴까요?</div>
                    <div class="message-time">${Format.time(new Date())}</div>
                </div>
            </div>
        `;
    },
    
    async send() {
        const input = DOM.$('#chatInput');
        const message = input?.value?.trim();
        if (!message || !this.currentPartner) return;
        
        input.value = '';
        input.style.height = 'auto';
        
        this.addMessage(message, true);
        
        if (this.currentPartner.type === 'institution') {
            const user = Store.getState('user');
            const data = await ChatAPI.sendMessage(message, user?.loginId, this.currentPartner.id);
            
            const layer = this.selectLayer();
            const openhash = { layer, hash: Math.random().toString(36).substring(2, 10) };
            
            this.addMessage(data.message || '응답을 받지 못했습니다.', false, openhash);
        }
    },
    
    addMessage(text, isSent, openhash = null) {
        const container = DOM.$('#chatMessages');
        if (!container) return;
        
        const icon = isSent ? 'person' : this.currentPartner?.icon || 'smart_toy';
        
        const html = `
            <div class="message ${isSent ? 'sent' : 'received'}">
                <div class="message-avatar">
                    <span class="material-icons">${icon}</span>
                </div>
                <div class="message-body">
                    <div class="message-bubble">${text}</div>
                    ${openhash ? `
                        <div class="openhash-badge">
                            <span class="material-icons">verified</span>
                            <span>Layer ${openhash.layer} (${CONFIG.OPENHASH_LAYERS[openhash.layer].name}) 저장</span>
                        </div>
                    ` : ''}
                    <div class="message-time">${Format.time(new Date())}</div>
                </div>
            </div>
        `;
        
        container.insertAdjacentHTML('beforeend', html);
        container.scrollTop = container.scrollHeight;
    },
    
    selectLayer() {
        const rand = Math.random();
        if (rand < 0.6) return 1;
        if (rand < 0.9) return 2;
        if (rand < 0.99) return 3;
        return 4;
    },
    
    showProfile() {
        Toast.info('프로필 기능 준비 중');
    }
};
