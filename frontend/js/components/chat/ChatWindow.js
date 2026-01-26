// 채팅 창 컴포넌트
const ChatWindow = {
    currentPartner: null,
    conversationHistory: [],
    isRecording: false,
    userHashChain: null,
    selectedModel: 'deepseek',
    
    // 외부 LLM 모델
    models: {
        deepseek: { name: 'DeepSeek', desc: '무료 크레딧' },
        groq: { name: 'Groq', desc: '14,400/일' },
        gemini: { name: 'Gemini', desc: 'Google 무료' },
        openrouter: { name: 'OpenRouter', desc: '다중모델' },
        mistral: { name: 'Mistral', desc: '무료 tier' }
    },
    
    render(partner) {
        return `
            <div class="slide-menu-overlay" id="menuOverlay" onclick="ChatWindow.closeMenu()"></div>
            
            <aside class="slide-menu" id="slideMenu">
                <div class="slide-menu-header">
                    <span class="material-icons">settings</span>
                    <span>설정</span>
                </div>
                
                <nav class="slide-menu-nav">
                    <!-- 상담 AI 선택 -->
                    <div class="menu-section-title">상담 AI 선택</div>
                    <div class="model-list">
                        ${Object.entries(this.models).map(([key, m]) => `
                            <label class="model-radio ${this.selectedModel === key ? 'selected' : ''}">
                                <input type="radio" name="llm" value="${key}" 
                                    ${this.selectedModel === key ? 'checked' : ''} 
                                    onchange="ChatWindow.selectModel('${key}')">
                                <span class="radio-dot"></span>
                                <span class="model-name">${m.name}</span>
                                <span class="model-desc">${m.desc}</span>
                            </label>
                        `).join('')}
                    </div>
                    
                    <!-- 실행 AI -->
                    <div class="menu-section-title">실행 AI</div>
                    <div class="gopang-ai-box">
                        <span class="material-icons">smart_toy</span>
                        <div class="gopang-info">
                            <div class="gopang-name">고팡 AI</div>
                            <div class="gopang-desc">Exaone 7.8B · 작업 실행 전용</div>
                        </div>
                    </div>
                    
                    <!-- 내 기록 -->
                    <div class="menu-section-title">내 기록</div>
                    <a class="menu-item" onclick="ChatWindow.showHashChain()">
                        <span class="material-icons">link</span>
                        <span class="menu-text">Hash Chain</span>
                        <span class="menu-badge" id="chainLength">0</span>
                    </a>
                    <a class="menu-item" onclick="ChatWindow.showConversationHistory()">
                        <span class="material-icons">history</span>
                        <span class="menu-text">대화 기록</span>
                    </a>
                    <a class="menu-item" onclick="ChatWindow.showTags()">
                        <span class="material-icons">label</span>
                        <span class="menu-text">태그 검색</span>
                    </a>
                    
                    <!-- OpenHash -->
                    <div class="menu-section-title">OpenHash 네트워크</div>
                    <a class="menu-item" onclick="ChatWindow.showLayerStatus()">
                        <span class="material-icons">layers</span>
                        <span class="menu-text">계층 현황</span>
                    </a>
                    <a class="menu-item" onclick="ChatWindow.showNodeInfo()">
                        <span class="material-icons">hub</span>
                        <span class="menu-text">노드 정보</span>
                    </a>
                    <a class="menu-item" onclick="ChatWindow.verifyHash()">
                        <span class="material-icons">verified</span>
                        <span class="menu-text">Hash 검증</span>
                    </a>
                </nav>
                
                <div class="slide-menu-footer">
                    <div class="footer-status">
                        <div class="status-line">
                            <span>상담:</span>
                            <strong id="currentModelName">${this.models[this.selectedModel]?.name}</strong>
                        </div>
                        <div class="status-line">
                            <span>실행:</span>
                            <strong>고팡 AI</strong>
                        </div>
                    </div>
                </div>
            </aside>
            
            <div class="chat-screen" id="chatScreen">
                <header class="chat-header">
                    <button class="header-btn" onclick="ChatWindow.openMenu()">
                        <span class="material-icons">menu</span>
                    </button>
                    <div class="chat-header-avatar">
                        <span class="material-icons">${partner.icon}</span>
                    </div>
                    <div class="chat-header-info">
                        <div class="chat-header-name">
                            ${partner.name}
                            <span class="conv-badge">AI</span>
                        </div>
                        <div class="chat-header-status" id="headerModel">${this.models[this.selectedModel]?.name} · 24시간</div>
                    </div>
                    <div class="chat-header-actions">
                        <button class="header-btn" onclick="ChatWindow.close()">
                            <span class="material-icons">close</span>
                        </button>
                    </div>
                </header>
                
                <div class="messages" id="chatMessages"></div>
                
                <div class="chat-input-area">
                    <button class="input-action-btn" onclick="ChatWindow.attachFile()" title="파일 첨부">
                        <span class="material-icons">add</span>
                    </button>
                    <div class="chat-input-wrapper">
                        <textarea class="chat-input" id="chatInput" rows="1" placeholder="메시지 입력..."></textarea>
                    </div>
                    <button class="input-action-btn" id="voiceBtn" onclick="ChatWindow.toggleVoice()" title="음성 입력">
                        <span class="material-icons">mic</span>
                    </button>
                    <button class="send-btn" onclick="ChatWindow.send()">
                        <span class="material-icons">send</span>
                    </button>
                </div>
                <input type="file" id="fileInput" style="display:none" onchange="ChatWindow.handleFile(event)">
            </div>
            
            <!-- 태그 모달 -->
            <div class="tag-modal" id="tagModal">
                <div class="tag-modal-content">
                    <h3>대화 주제 태그 선택</h3>
                    <div class="tag-options" id="tagOptions"></div>
                    <input type="text" id="customTag" class="custom-tag-input" placeholder="직접 입력...">
                    <div class="tag-modal-actions">
                        <button class="tag-btn cancel" onclick="ChatWindow.cancelSave()">취소</button>
                        <button class="tag-btn confirm" onclick="ChatWindow.confirmSave()">저장</button>
                    </div>
                </div>
            </div>
        `;
    },
    
    selectModel(model) {
        this.selectedModel = model;
        document.querySelectorAll('.model-radio').forEach(el => el.classList.remove('selected'));
        document.querySelector(`input[value="${model}"]`)?.closest('.model-radio')?.classList.add('selected');
        
        const name = this.models[model]?.name || 'DeepSeek';
        const nameEl = document.getElementById('currentModelName');
        const headerEl = document.getElementById('headerModel');
        if (nameEl) nameEl.textContent = name;
        if (headerEl) headerEl.textContent = `${name} · 24시간`;
        Toast.info(`${name} 선택됨`);
    },
    
    openMenu() {
        document.getElementById('slideMenu')?.classList.add('open');
        document.getElementById('menuOverlay')?.classList.add('open');
        this.updateHashDisplay();
    },
    
    closeMenu() {
        document.getElementById('slideMenu')?.classList.remove('open');
        document.getElementById('menuOverlay')?.classList.remove('open');
    },
    
    async updateHashDisplay() {
        const user = Store.getState('user');
        if (!user) return;
        const chainKey = `hashChain_${user.loginId}`;
        const chain = JSON.parse(localStorage.getItem(chainKey) || '{"entries":[]}');
        const el = document.getElementById('chainLength');
        if (el) el.textContent = chain.entries.length;
    },
    
    showHashChain() {
        this.closeMenu();
        const user = Store.getState('user');
        const chain = JSON.parse(localStorage.getItem(`hashChain_${user?.loginId}`) || '{"entries":[]}');
        
        if (chain.entries.length === 0) {
            Toast.info('저장된 Hash Chain이 없습니다');
            return;
        }
        
        let html = '<div class="chain-list">';
        chain.entries.slice(-10).reverse().forEach((e, i) => {
            html += `
                <div class="chain-item">
                    <div class="chain-index">#${chain.entries.length - i}</div>
                    <div class="chain-info">
                        <div class="chain-tags">${e.tags?.join(', ') || '태그 없음'}</div>
                        <div class="chain-hash">${(e.hash || '').substring(0, 20)}...</div>
                        <div class="chain-meta">Layer ${e.layer} · ${new Date(e.timestamp).toLocaleString()}</div>
                    </div>
                </div>
            `;
        });
        html += '</div>';
        this.showModal('Hash Chain', html);
    },
    
    showConversationHistory() {
        this.closeMenu();
        Toast.info('대화 기록 기능 준비 중');
    },
    
    showTags() {
        this.closeMenu();
        Toast.info('태그 검색 기능 준비 중');
    },
    
    showLayerStatus() {
        this.closeMenu();
        this.showModal('OpenHash 계층 현황', `
            <div class="layer-list">
                <div class="layer-row"><span class="layer-name">Layer 1 (읍면동)</span><span class="layer-percent">60%</span></div>
                <div class="layer-row"><span class="layer-name">Layer 2 (시군구)</span><span class="layer-percent">30%</span></div>
                <div class="layer-row"><span class="layer-name">Layer 3 (광역시도)</span><span class="layer-percent">9%</span></div>
                <div class="layer-row"><span class="layer-name">Layer 4 (국가)</span><span class="layer-percent">1%</span></div>
            </div>
        `);
    },
    
    showNodeInfo() {
        this.closeMenu();
        const user = Store.getState('user');
        this.showModal('노드 정보', `
            <div class="node-info-list">
                <div class="node-row"><span>소속 노드</span><strong>${user?.location?.districtName || '중문동'}</strong></div>
                <div class="node-row"><span>계층</span><strong>Layer 1 (읍면동)</strong></div>
                <div class="node-row"><span>상위 노드</span><strong>서귀포시</strong></div>
                <div class="node-row"><span>연결 상태</span><strong style="color:#4CAF50">● 정상</strong></div>
            </div>
        `);
    },
    
    verifyHash() {
        this.closeMenu();
        Toast.info('Hash 검증 기능 준비 중');
    },
    
    showModal(title, content) {
        document.getElementById('infoModal')?.remove();
        const modal = document.createElement('div');
        modal.id = 'infoModal';
        modal.className = 'info-modal';
        modal.innerHTML = `
            <div class="info-modal-backdrop" onclick="document.getElementById('infoModal').remove()"></div>
            <div class="info-modal-content">
                <div class="info-modal-header">
                    <h3>${title}</h3>
                    <button class="modal-close" onclick="document.getElementById('infoModal').remove()">
                        <span class="material-icons">close</span>
                    </button>
                </div>
                <div class="info-modal-body">${content}</div>
            </div>
        `;
        document.body.appendChild(modal);
    },
    
    open(partnerId) {
        const conversations = Store.getState('conversations') || [];
        const partner = conversations.find(c => c.id === partnerId);
        if (!partner) return;
        
        this.currentPartner = partner;
        this.conversationHistory = [];
        Store.setState('currentChat', partner);
        document.getElementById('app').innerHTML = this.render(partner);
        this.initInput();
        this.loadMessages();
    },
    
    close() {
        if (this.conversationHistory.length > 1) {
            this.showTagModal();
        } else {
            this.exitChat();
        }
    },
    
    exitChat() {
        this.currentPartner = null;
        this.conversationHistory = [];
        Store.setState('currentChat', null);
        App.showMain();
    },
    
    showTagModal() {
        const tagsByType = {
            court: ['민사소송', '형사소송', '가사소송', '소장작성', '판례검색'],
            prosecution: ['고소', '고발', '형사사건', '피해자보호'],
            police: ['범죄신고', '수사', '교통사고', '분실물'],
            tax: ['종합소득세', '부가가치세', '세무조사', '공제'],
            hospital: ['진료예약', '증상상담', '건강검진', '의무기록'],
            patent: ['특허출원', '상표등록', '디자인', '분쟁'],
            assembly: ['청원', '입법', '의원면담'],
            province: ['인허가', '보조금', '지원사업'],
            city: ['건축', '지방세', '복지', '문화'],
            community: ['주민등록', '증명서', '전입신고', '복지신청'],
            school: ['입학', '장학금', '진로'],
            market: ['소비자피해', '거래분쟁', '환불']
        };
        
        const tags = tagsByType[this.currentPartner?.id] || ['일반상담', '문의', '기타'];
        const options = document.getElementById('tagOptions');
        options.innerHTML = tags.map(tag => 
            `<button class="tag-option" onclick="this.classList.toggle('selected')">${tag}</button>`
        ).join('');
        
        document.getElementById('tagModal').classList.add('open');
    },
    
    cancelSave() {
        document.getElementById('tagModal')?.classList.remove('open');
        this.exitChat();
    },
    
    async confirmSave() {
        const selected = Array.from(document.querySelectorAll('.tag-option.selected')).map(e => e.textContent);
        const custom = document.getElementById('customTag')?.value?.trim();
        if (custom) selected.push(custom);
        if (selected.length === 0) selected.push('일반');
        
        document.getElementById('tagModal')?.classList.remove('open');
        
        const result = await this.saveToOpenHash(selected);
        if (result) {
            Toast.success(`Layer ${result.layer}에 저장됨`);
        }
        
        setTimeout(() => this.exitChat(), 1500);
    },
    
    async saveToOpenHash(tags) {
        const user = Store.getState('user');
        const doc = {
            partnerId: this.currentPartner?.id,
            partnerName: this.currentPartner?.name,
            model: this.selectedModel,
            tags,
            messageCount: this.conversationHistory.length,
            messages: this.conversationHistory,
            timestamp: new Date().toISOString()
        };
        
        const hash = await this.generateHash(JSON.stringify(doc));
        const chainKey = `hashChain_${user?.loginId}`;
        const chain = JSON.parse(localStorage.getItem(chainKey) || '{"entries":[],"latestHash":null}');
        
        const rand = Math.random();
        const layer = rand < 0.6 ? 1 : rand < 0.9 ? 2 : rand < 0.99 ? 3 : 4;
        
        const entry = {
            hash,
            tags,
            layer,
            partnerId: this.currentPartner?.id,
            model: this.selectedModel,
            messageCount: this.conversationHistory.length,
            timestamp: doc.timestamp
        };
        
        chain.entries.push(entry);
        chain.latestHash = hash;
        localStorage.setItem(chainKey, JSON.stringify(chain));
        
        return { layer, hash };
    },
    
    async generateHash(text) {
        const data = new TextEncoder().encode(text);
        const buf = await crypto.subtle.digest('SHA-256', data);
        return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    },
    
    initInput() {
        const input = document.getElementById('chatInput');
        if (!input) return;
        
        input.addEventListener('keydown', e => {
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
        const container = document.getElementById('chatMessages');
        if (!container || !this.currentPartner) return;
        
        const greetings = {
            court: '안녕하세요. 법원 AI 상담사입니다. 무엇을 도와드릴까요?',
            prosecution: '안녕하세요. 검찰청 AI 상담사입니다.',
            police: '안녕하세요. 경찰청 AI 상담사입니다.',
            tax: '안녕하세요. 국세청 AI 세무 상담사입니다.',
            hospital: '안녕하세요. 병원 AI 의료 상담사입니다.',
            patent: '안녕하세요. 특허청 AI 상담사입니다.',
            assembly: '안녕하세요. 국회 AI 입법 상담사입니다.',
            province: '안녕하세요. 도청 AI 행정 상담사입니다.',
            city: '안녕하세요. 시청 AI 행정 상담사입니다.',
            community: '안녕하세요. 주민센터 AI 상담사입니다.',
            school: '안녕하세요. 학교 AI 교육 상담사입니다.',
            market: '안녕하세요. 시장 AI 상거래 상담사입니다.'
        };
        
        const greeting = greetings[this.currentPartner.id] || '안녕하세요. 무엇을 도와드릴까요?';
        
        container.innerHTML = `
            <div class="message received">
                <div class="message-avatar"><span class="material-icons">${this.currentPartner.icon}</span></div>
                <div class="message-body">
                    <div class="message-bubble">${greeting}</div>
                    <div class="message-time">${Format.time(new Date())}</div>
                </div>
            </div>
        `;
        
        this.conversationHistory.push({
            role: 'assistant',
            content: greeting,
            timestamp: new Date().toISOString()
        });
    },
    
    async send() {
        const input = document.getElementById('chatInput');
        const message = input?.value?.trim();
        if (!message || !this.currentPartner) return;
        
        input.value = '';
        input.style.height = 'auto';
        
        this.addMessage(message, true);
        this.conversationHistory.push({
            role: 'user',
            content: message,
            timestamp: new Date().toISOString()
        });
        
        this.showTyping();
        
        const user = Store.getState('user');
        const data = await ChatAPI.sendMessage(message, user?.loginId, this.currentPartner.id, this.selectedModel);
        
        this.hideTyping();
        
        const response = data.message || '응답을 받지 못했습니다.';
        this.addMessage(response, false);
        this.conversationHistory.push({
            role: 'assistant',
            content: response,
            timestamp: new Date().toISOString()
        });
        
        // 고팡 AI 작업 표시
        if (data.gopangTask) {
            this.showGopangTask(data.gopangTask);
        }
    },
    
    showGopangTask(task) {
        const container = document.getElementById('chatMessages');
        if (!container) return;
        
        container.insertAdjacentHTML('beforeend', `
            <div class="gopang-task">
                <span class="material-icons">smart_toy</span>
                <div>
                    <div class="task-label">고팡 AI 작업</div>
                    <div class="task-type">${task.type}</div>
                </div>
            </div>
        `);
        container.scrollTop = container.scrollHeight;
    },
    
    showTyping() {
        const container = document.getElementById('chatMessages');
        if (!container) return;
        
        container.insertAdjacentHTML('beforeend', `
            <div class="message received" id="typingIndicator">
                <div class="message-avatar"><span class="material-icons">${this.currentPartner?.icon}</span></div>
                <div class="message-body">
                    <div class="message-bubble typing"><span></span><span></span><span></span></div>
                </div>
            </div>
        `);
        container.scrollTop = container.scrollHeight;
    },
    
    hideTyping() {
        document.getElementById('typingIndicator')?.remove();
    },
    
    addMessage(text, isSent) {
        const container = document.getElementById('chatMessages');
        if (!container) return;
        
        const icon = isSent ? 'person' : this.currentPartner?.icon || 'smart_toy';
        
        container.insertAdjacentHTML('beforeend', `
            <div class="message ${isSent ? 'sent' : 'received'}">
                <div class="message-avatar"><span class="material-icons">${icon}</span></div>
                <div class="message-body">
                    <div class="message-bubble">${text}</div>
                    <div class="message-time">${Format.time(new Date())}</div>
                </div>
            </div>
        `);
        container.scrollTop = container.scrollHeight;
    },
    
    attachFile() {
        document.getElementById('fileInput')?.click();
    },
    
    handleFile(e) {
        const file = e.target.files[0];
        if (file) {
            Toast.info(`파일 첨부: ${file.name}`);
        }
        e.target.value = '';
    },
    
    toggleVoice() {
        Toast.info('음성 입력 기능 준비 중');
    }
};
