// DOM 유틸리티
const DOM = {
    // 요소 선택
    $(selector) {
        return document.querySelector(selector);
    },
    
    $$(selector) {
        return document.querySelectorAll(selector);
    },
    
    // 요소 생성
    create(tag, attrs = {}, children = []) {
        const el = document.createElement(tag);
        Object.entries(attrs).forEach(([key, value]) => {
            if (key === 'className') el.className = value;
            else if (key === 'innerHTML') el.innerHTML = value;
            else if (key === 'onclick') el.onclick = value;
            else el.setAttribute(key, value);
        });
        children.forEach(child => {
            if (typeof child === 'string') {
                el.appendChild(document.createTextNode(child));
            } else {
                el.appendChild(child);
            }
        });
        return el;
    },
    
    // HTML 렌더링
    render(container, html) {
        if (typeof container === 'string') {
            container = this.$(container);
        }
        container.innerHTML = html;
    },
    
    // 클래스 토글
    toggleClass(el, className, force) {
        if (typeof el === 'string') el = this.$(el);
        if (force !== undefined) {
            el.classList.toggle(className, force);
        } else {
            el.classList.toggle(className);
        }
    },
    
    // 이벤트 바인딩
    on(el, event, handler) {
        if (typeof el === 'string') el = this.$(el);
        el?.addEventListener(event, handler);
    }
};
