// 메인 앱 컨트롤러
const App = {
    init() {
        // 저장된 세션 확인
        Store.loadFromLocal();
        
        if (Store.getState('isLoggedIn')) {
            this.showMain();
        } else {
            this.showLogin();
        }
    },
    
    showLogin() {
        const app = DOM.$('#app');
        app.innerHTML = LoginScreen.render();
        LoginScreen.init();
    },
    
    showMain() {
        const app = DOM.$('#app');
        app.innerHTML = ConversationList.render();
        ConversationList.loadConversations();
        PersonalAI.init();
    },
    
    goBack() {
        if (Store.getState('currentChat')) {
            ChatWindow.close();
        }
    },
    
    openSearch() {
        Toast.info('검색 기능 준비 중');
    },
    
    logout() {
        Store.clearLocal();
        this.showLogin();
        Toast.info('로그아웃 되었습니다');
    }
};

// DOM 로드 시 앱 시작
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
