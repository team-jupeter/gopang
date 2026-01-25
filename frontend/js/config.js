// 고팡 설정
const CONFIG = {
    API_BASE: '/api',
    WS_URL: 'ws://' + window.location.host,
    EGCT_RATE: 1000,  // 1T = 1000원
    OPENHASH_LAYERS: {
        1: { name: '읍면동', probability: 0.6 },
        2: { name: '시군구', probability: 0.3 },
        3: { name: '광역시도', probability: 0.09 },
        4: { name: '국가', probability: 0.01 }
    }
};
