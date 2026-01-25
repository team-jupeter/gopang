// 대화 목록 컴포넌트
const ConversationList = {
    render() {
        const user = Store.getState('user');
        const balance = user?.wallet?.balance || 0;
        
        return `
            <div class="main-screen" id="mainScreen">
                ${Header.render({ balance, showAI: true })}
                <div class="conv-list" id="convList">
                    <div class="loading">대화 목록 로딩 중...</div>
                </div>
                ${this.renderBottomNav()}
            </div>
        `;
    },
    
    renderBottomNav() {
        return `
            <nav class="bottom-nav">
                <button class="nav-item active" data-view="chat">
                    <span class="material-icons">chat</span>
                    <span>채팅</span>
                </button>
                <button class="nav-item" data-view="contacts">
                    <span class="material-icons">people</span>
                    <span>연락처</span>
                </button>
                <button class="nav-item" data-view="finance" onclick="location.href='/financial-statement.html'">
                    <span class="material-icons">account_balance</span>
                    <span>재무</span>
                </button>
                <button class="nav-item" data-view="settings">
                    <span class="material-icons">settings</span>
                    <span>설정</span>
                </button>
            </nav>
        `;
    },
    
    async loadConversations() {
        // 데모용 대화 목록 - Material Icons 사용
        const conversations = [
            { id: 'ai-legal', name: '법률 AI', type: 'institution', icon: 'gavel', preview: '법률 상담을 도와드립니다', unread: 0 },
            { id: 'ai-tax', name: '국세청 AI', type: 'institution', icon: 'account_balance', preview: '세금 관련 문의', unread: 1 },
            { id: 'ai-hospital', name: '제주대병원 AI', type: 'institution', icon: 'local_hospital', preview: '의료 상담', unread: 0 },
            { id: 'SGP-DJ-01', name: '대정읍주민1', type: 'human', icon: 'person', preview: '안녕하세요', unread: 2 },
            { id: 'JJU-IL-01', name: '일도1동주민1', type: 'human', icon: 'person', preview: '감사합니다', unread: 0 },
        ];
        
        Store.setState('conversations', conversations);
        this.renderList();
    },
    
    renderList() {
        const conversations = Store.getState('conversations') || [];
        const container = DOM.$('#convList');
        if (!container) return;
        
        const institutions = conversations.filter(c => c.type === 'institution');
        const humans = conversations.filter(c => c.type === 'human');
        
        let html = '';
        
        if (institutions.length > 0) {
            html += '<div class="conv-section-title">기관 AI</div>';
            html += institutions.map(c => this.renderItem(c)).join('');
        }
        
        if (humans.length > 0) {
            html += '<div class="conv-section-title">대화</div>';
            html += humans.map(c => this.renderItem(c)).join('');
        }
        
        container.innerHTML = html;
    },
    
    renderItem(conv) {
        return `
            <div class="conv-item" onclick="ChatWindow.open('${conv.id}')">
                <div class="conv-avatar">
                    <span class="material-icons">${conv.icon}</span>
                </div>
                <div class="conv-info">
                    <div class="conv-name">
                        <span>${conv.name}</span>
                        ${conv.type === 'institution' ? '<span class="conv-badge">기관</span>' : ''}
                    </div>
                    <div class="conv-preview">${conv.preview}</div>
                </div>
                <div class="conv-meta">
                    <div class="conv-time">방금</div>
                    ${conv.unread > 0 ? `<div class="conv-unread">${conv.unread}</div>` : ''}
                </div>
            </div>
        `;
    }
};
