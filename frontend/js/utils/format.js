// 포맷 유틸리티
const Format = {
    // EGCT 포맷
    egct(amount) {
        return `${amount.toLocaleString()} T`;
    },
    
    // 원화 포맷
    krw(amount) {
        return `₩${(amount * CONFIG.EGCT_RATE).toLocaleString()}`;
    },
    
    // 시간 포맷
    time(date) {
        if (typeof date === 'string') date = new Date(date);
        return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    },
    
    // 날짜 포맷
    date(date) {
        if (typeof date === 'string') date = new Date(date);
        return date.toLocaleDateString('ko-KR');
    },
    
    // 상대 시간
    relative(date) {
        if (typeof date === 'string') date = new Date(date);
        const now = new Date();
        const diff = Math.floor((now - date) / 1000);
        
        if (diff < 60) return '방금';
        if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
        return this.date(date);
    },
    
    // 해시 축약
    hash(hash, length = 8) {
        if (!hash) return '';
        return hash.substring(0, length) + '...';
    }
};
