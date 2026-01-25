// 채팅 API
const ChatAPI = {
    async sendMessage(message, userId, aiType = null) {
        return API.post('/ai-chat/chat', { message, userId, aiType });
    },
    
    async searchProducts(query) {
        return API.post('/ai-chat/search', { query });
    },
    
    async getStatus() {
        return API.get('/ai-chat/status');
    }
};
