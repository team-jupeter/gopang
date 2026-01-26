// 로그인 화면 컴포넌트
const LoginScreen = {
    render() {
        return `
            <div class="login-screen" id="loginScreen">
                <div class="login-logo">
                    <h1>고팡</h1>
                    <p>OpenHash 기반 AI 채팅 플랫폼</p>
                </div>
                <form class="login-form" id="loginForm">
                    <div class="input-group">
                        <label>사용자 ID</label>
                        <input type="text" class="login-input" id="loginId"
                            placeholder="예: 1, 2, 3" required>
                    </div>
                    <div class="input-group">
                        <label>비밀번호</label>
                        <input type="password" class="login-input" id="loginPw"
                            placeholder="비밀번호" required>
                    </div>
                    <button type="submit" class="login-btn">로그인</button>
                </form>
                <div class="login-footer">
                    <p>테스트 계정: 1 / 1</p>
                </div>
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
