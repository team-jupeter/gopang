// Toast 알림 컴포넌트
const Toast = {
    show(message, duration = 3000) {
        const toast = DOM.$('#toast');
        if (!toast) return;
        
        toast.textContent = message;
        toast.classList.add('show');
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, duration);
    },
    
    success(message) {
        this.show('✅ ' + message);
    },
    
    error(message) {
        this.show('❌ ' + message);
    },
    
    info(message) {
        this.show('ℹ️ ' + message);
    }
};
