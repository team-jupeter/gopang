// Chat API
const ChatAPI = {
    async sendMessage(message, userId, aiType, model = 'deepseek') {
        try {
            const res = await fetch(`${CONFIG.API_BASE}/api/ai-chat/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message, userId, aiType, model })
            });
            return await res.json();
        } catch (err) {
            console.error('Chat API Error:', err);
            return { success: false, message: '서버 연결 오류' };
        }
    },
    
    async getModels() {
        try {
            const res = await fetch(`${CONFIG.API_BASE}/api/ai-chat/models`);
            return await res.json();
        } catch (err) {
            return { success: false, models: {} };
        }
    }
};
