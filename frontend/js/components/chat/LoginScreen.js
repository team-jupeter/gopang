// 로그인 화면 컴포넌트
const LoginScreen = {
    render() {
        return `
            <div class="login-screen" id="loginScreen">
                <div class="login-logo">💬</div>
                <div class="login-title">고팡</div>
                <div class="login-subtitle">OpenHash 기반 AI 채팅 플랫폼</div>
                <form class="login-form" id="loginForm">
                    <input type="text" class="login-input" id="loginId" 
                        placeholder="사용자 ID (예: SGP-JM-01)" required>
                    <input type="password" class="login-input" id="loginPw" 
                        placeholder="비밀번호" required>
                    <button type="submit" class="login-btn">로그인</button>
                </form>
                <div class="login-hint">테스트: SGP-JM-01 / 1</div>
            </div>
        `;
    },
    
    init() {
        const form = DOM.$('#loginForm');
        if (form) {
            form.onsubmit = (e) => this.handleLogin(e);
        }
    },
    
    async handleLogin(e) {
        e.preventDefault();
        
        const id = DOM.$('#loginId').value;
        const pw = DOM.$('#loginPw').value;
        
        const data = await AuthAPI.login(id, pw);
        
        if (data.success) {
            Store.setState('user', data.user);
            Store.setState('isLoggedIn', true);
            Store.saveToLocal();
            Toast.success('로그인 성공');
            App.showMain();
        } else {
            Toast.error('로그인 실패: ' + (data.error || '인증 오류'));
        }
    }
};
