// 개인 AI 비서 컴포넌트
const PersonalAI = {
    isOpen: false,
    
    render() {
        return `
            <div class="ai-modal-overlay" id="aiModalOverlay">
                <div class="ai-modal" onclick="event.stopPropagation()">
                    <div class="ai-modal-header">
                        <div class="ai-modal-title">
                            <div class="icon"><span class="material-icons">smart_toy</span></div>
                            <span>내 AI 비서</span>
                        </div>
                        <button class="header-btn" onclick="PersonalAI.close()">
                            <span class="material-icons">close</span>
                        </button>
                    </div>
                    <div class="ai-modal-messages" id="aiMessages">
                        <div class="message received">
                            <div class="message-avatar">🤖</div>
                            <div>
                                <div class="message-bubble">안녕하세요! 저는 당신의 개인 AI 비서입니다. 무엇을 도와드릴까요?</div>
                            </div>
                        </div>
                    </div>
                    <div class="ai-modal-input-area">
                        <input type="text" class="ai-modal-input" id="aiInput" 
                            placeholder="AI에게 물어보세요...">
                        <button class="chat-send-btn" onclick="PersonalAI.send()">
                            <span class="material-icons">send</span>
                        </button>
                    </div>
                </div>
            </div>
        `;
    },
    
    init() {
        // 모달 HTML 추가
        const existing = DOM.$('#aiModalOverlay');
        if (!existing) {
            document.body.insertAdjacentHTML('beforeend', this.render());
        }
        
        // 오버레이 클릭 시 닫기
        DOM.$('#aiModalOverlay')?.addEventListener('click', () => this.close());
        
        // 입력 엔터키
        DOM.$('#aiInput')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.send();
        });
    },
    
    open() {
        this.init();
        DOM.$('#aiModalOverlay')?.classList.add('open');
        DOM.$('#aiInput')?.focus();
        this.isOpen = true;
    },
    
    close() {
        DOM.$('#aiModalOverlay')?.classList.remove('open');
        this.isOpen = false;
    },
    
    async send() {
        const input = DOM.$('#aiInput');
        const message = input?.value?.trim();
        if (!message) return;
        
        input.value = '';
        
        const container = DOM.$('#aiMessages');
        
        // 사용자 메시지
        container.insertAdjacentHTML('beforeend', `
            <div class="message sent">
                <div class="message-avatar">👤</div>
                <div><div class="message-bubble">${message}</div></div>
            </div>
        `);
        
        // AI 응답
        const user = Store.getState('user');
        const data = await ChatAPI.sendMessage(message, user?.loginId, 'personal');
        
        container.insertAdjacentHTML('beforeend', `
            <div class="message received">
                <div class="message-avatar">🤖</div>
                <div><div class="message-bubble">${data.message || '응답 오류'}</div></div>
            </div>
        `);
        
        container.scrollTop = container.scrollHeight;
    }
};
