// 대화 목록 컴포넌트
const ConversationList = {
    render() {
        const user = Store.getState('user');
        const balance = user?.wallet?.balance || 0;
        
        return `
            <div class="main-screen" id="mainScreen">
                ${Header.render({ balance, showAI: true })}
                <div class="conv-list" id="convList">
                    <div class="loading">기관 목록 로딩 중...</div>
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
        // ID를 백엔드 INSTITUTION_PROMPTS 키와 일치시킴
        const conversations = [
            // 사법 기관
            { id: 'court', name: '법원', type: 'institution', icon: 'gavel', preview: '민사·형사 소송 상담', unread: 0, category: '사법' },
            { id: 'prosecution', name: '검찰청', type: 'institution', icon: 'shield', preview: '고소·고발 상담', unread: 0, category: '사법' },
            { id: 'police', name: '경찰청', type: 'institution', icon: 'local_police', preview: '신고·수사 상담', unread: 0, category: '사법' },
            
            // 행정 기관
            { id: 'assembly', name: '의회', type: 'institution', icon: 'account_balance', preview: '입법·청원 상담', unread: 0, category: '행정' },
            { id: 'province', name: '도청', type: 'institution', icon: 'domain', preview: '광역 행정 서비스', unread: 0, category: '행정' },
            { id: 'city', name: '시청', type: 'institution', icon: 'location_city', preview: '시 행정 서비스', unread: 0, category: '행정' },
            { id: 'community', name: '주민센터', type: 'institution', icon: 'home_work', preview: '주민 행정 서비스', unread: 0, category: '행정' },
            
            // 전문 기관
            { id: 'tax', name: '국세청', type: 'institution', icon: 'receipt_long', preview: '세금·신고 상담', unread: 0, category: '전문' },
            { id: 'patent', name: '특허청', type: 'institution', icon: 'lightbulb', preview: '지식재산권 상담', unread: 0, category: '전문' },
            
            // 생활 기관
            { id: 'hospital', name: '병원', type: 'institution', icon: 'local_hospital', preview: '의료·건강 상담', unread: 0, category: '생활' },
            { id: 'school', name: '학교', type: 'institution', icon: 'school', preview: '교육·입학 상담', unread: 0, category: '생활' },
            { id: 'market', name: '시장', type: 'institution', icon: 'storefront', preview: '상거래·소비자 상담', unread: 0, category: '생활' },
        ];
        
        Store.setState('conversations', conversations);
        this.renderList();
    },
    
    renderList() {
        const conversations = Store.getState('conversations') || [];
        const container = DOM.$('#convList');
        if (!container) return;
        
        // 카테고리별 그룹화
        const categories = {
            '사법': conversations.filter(c => c.category === '사법'),
            '행정': conversations.filter(c => c.category === '행정'),
            '전문': conversations.filter(c => c.category === '전문'),
            '생활': conversations.filter(c => c.category === '생활'),
        };
        
        let html = '';
        
        for (const [category, items] of Object.entries(categories)) {
            if (items.length > 0) {
                html += `<div class="conv-section-title">${category} 기관</div>`;
                html += items.map(c => this.renderItem(c)).join('');
            }
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
                        <span class="conv-badge">AI</span>
                    </div>
                    <div class="conv-preview">${conv.preview}</div>
                </div>
                <div class="conv-meta">
                    <div class="conv-time">24시간</div>
                    ${conv.unread > 0 ? `<div class="conv-unread">${conv.unread}</div>` : ''}
                </div>
            </div>
        `;
    }
};
