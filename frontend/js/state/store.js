// 전역 상태 관리
const Store = {
    state: {
        user: null,
        conversations: [],
        currentChat: null,
        messages: {},
        isLoggedIn: false
    },
    
    listeners: [],
    
    setState(key, value) {
        this.state[key] = value;
        this.notify(key);
    },
    
    getState(key) {
        return this.state[key];
    },
    
    subscribe(callback) {
        this.listeners.push(callback);
    },
    
    notify(key) {
        this.listeners.forEach(cb => cb(key, this.state));
    },
    
    // 로컬 스토리지 연동
    saveToLocal() {
        if (this.state.user) {
            localStorage.setItem('gopangUser', JSON.stringify(this.state.user));
        }
    },
    
    loadFromLocal() {
        const saved = localStorage.getItem('gopangUser');
        if (saved) {
            this.state.user = JSON.parse(saved);
            this.state.isLoggedIn = true;
        }
    },
    
    clearLocal() {
        localStorage.removeItem('gopangUser');
        this.state.user = null;
        this.state.isLoggedIn = false;
    }
};
