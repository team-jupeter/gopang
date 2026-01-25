// Header 컴포넌트
const Header = {
    render(options = {}) {
        const { title = '고팡', showBack = false, showAI = true, balance = 0 } = options;
        
        return `
            <header class="header">
                ${showBack ? `
                    <button class="header-btn" onclick="App.goBack()">
                        <span class="material-icons">arrow_back</span>
                    </button>
                ` : ''}
                <div class="header-title">${title}</div>
                ${balance > 0 ? `<div class="header-balance">${Format.egct(balance)}</div>` : ''}
                <button class="header-btn" onclick="App.openSearch()">
                    <span class="material-icons">search</span>
                </button>
                ${showAI ? `
                    <button class="header-btn ai-btn" onclick="PersonalAI.open()" title="내 AI 비서">
                        <span class="material-icons">smart_toy</span>
                    </button>
                ` : ''}
            </header>
        `;
    }
};
