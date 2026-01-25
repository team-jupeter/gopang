// 인증 API
const AuthAPI = {
    async login(identifier, password) {
        return API.post('/auth-unified/login/phone', { identifier, password });
    },
    
    async verify(token) {
        return API.get('/auth-unified/verify');
    },
    
    async getStats() {
        return API.get('/auth-unified/stats');
    },
    
    async getUser(userId) {
        return API.get(`/auth-unified/user/${userId}`);
    }
};
