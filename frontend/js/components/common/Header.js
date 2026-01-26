// Header 컴포넌트
const Header = {
    render(options = {}) {
        const { title = '고팡', showBack = false, balance = 0 } = options;
        return `
            <header class="header">
                ${showBack ? `
                    <button class="header-btn" onclick="App.goBack()">
                        <span class="material-icons">arrow_back</span>
                    </button>
                ` : ''}
                <div class="header-title" onclick="PersonalAI.open()" style="cursor:pointer">${title}</div>
                ${balance > 0 ? `<div class="header-balance">${Format.egct(balance)}</div>` : ''}
                <button class="header-btn" onclick="App.openSearch()">
                    <span class="material-icons">search</span>
                </button>
            </header>
        `;
    }
};
