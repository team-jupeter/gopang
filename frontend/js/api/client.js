// API 클라이언트
const API = {
    async request(endpoint, options = {}) {
        const url = CONFIG.API_BASE + endpoint;
        const config = {
            headers: { 'Content-Type': 'application/json' },
            ...options
        };
        
        if (config.body && typeof config.body === 'object') {
            config.body = JSON.stringify(config.body);
        }
        
        try {
            const res = await fetch(url, config);
            const data = await res.json();
            return data;
        } catch (err) {
            console.error('API Error:', err);
            return { success: false, error: err.message };
        }
    },
    
    get(endpoint) {
        return this.request(endpoint, { method: 'GET' });
    },
    
    post(endpoint, body) {
        return this.request(endpoint, { method: 'POST', body });
    },
    
    put(endpoint, body) {
        return this.request(endpoint, { method: 'PUT', body });
    },
    
    delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    }
};
