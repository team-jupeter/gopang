const crypto = require('crypto');
const fs = require('fs');

// SHA-256 해시 생성
function generateHash(text) {
    return crypto.createHash('sha256').update(text).digest('hex');
}

// 확률적 계층 선택 (OpenHash 300 모듈)
function selectLayer() {
    const rand = Math.random();
    if (rand < 0.60) return { layer: 1, name: '읍면동', code: 'KR-JEJU-SEOGWIPO-JM' };
    if (rand < 0.90) return { layer: 2, name: '시군구', code: 'KR-JEJU-SEOGWIPO' };
    if (rand < 0.99) return { layer: 3, name: '광역시도', code: 'KR-JEJU' };
    return { layer: 4, name: '국가', code: 'KR' };
}

// 대화 내용 기반 자동 태그 추천
function suggestTags(messages, institutionId) {
    const tagsByInstitution = {
        court: ['민사소송', '형사소송', '가사소송', '소장작성', '판례'],
        tax: ['종합소득세', '부가가치세', '세무조사', '공제'],
        hospital: ['진료예약', '증상상담', '건강검진'],
        police: ['범죄신고', '수사', '교통사고']
    };
    
    const baseTag = tagsByInstitution[institutionId] || ['일반상담'];
    const content = messages.map(m => m.content).join(' ');
    
    // 키워드 기반 태그 추가
    const selectedTags = [];
    if (content.includes('소송') || content.includes('소장')) selectedTags.push('민사소송');
    if (content.includes('세금') || content.includes('신고')) selectedTags.push('세금신고');
    if (content.includes('예약') || content.includes('진료')) selectedTags.push('진료예약');
    
    return selectedTags.length > 0 ? selectedTags : [baseTag[0]];
}

// 대화 저장 및 Hash Chain 갱신
function saveConversation(userId, conversation, tags) {
    const chainFile = `/tmp/hashchain_${userId}.json`;
    
    // 기존 체인 로드
    let chain = { entries: [], latestHash: null };
    if (fs.existsSync(chainFile)) {
        chain = JSON.parse(fs.readFileSync(chainFile, 'utf8'));
    }
    
    // 1. 대화 문서 해시 생성
    const docHash = generateHash(JSON.stringify(conversation));
    
    // 2. 이전 해시와 연결하여 새 Chain Hash 생성
    const chainInput = chain.latestHash ? chain.latestHash + docHash : docHash;
    const newChainHash = generateHash(chainInput);
    
    // 3. 계층 선택
    const layerInfo = selectLayer();
    
    // 4. Entry 생성
    const entry = {
        index: chain.entries.length + 1,
        docHash: docHash,
        chainHash: newChainHash,
        prevHash: chain.latestHash,
        tags: tags,
        layer: layerInfo.layer,
        layerName: layerInfo.name,
        layerCode: layerInfo.code,
        partnerId: conversation.partnerId,
        partnerName: conversation.partnerName,
        messageCount: conversation.messages.length,
        timestamp: new Date().toISOString()
    };
    
    // 5. 체인 갱신
    chain.entries.push(entry);
    chain.latestHash = newChainHash;
    
    // 6. 저장
    fs.writeFileSync(chainFile, JSON.stringify(chain, null, 2));
    
    return { entry, chain };
}

// ============ 테스트 실행 ============
console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║        OpenHash 저장 메커니즘 테스트                       ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

const userId = 'test-user-1';

// 테스트 대화 1: 법원 - 민사소송 상담
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('【대화 1】 법원 AI - 민사소송 상담');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

const conversation1 = {
    partnerId: 'court',
    partnerName: '법원',
    userId: userId,
    startTime: new Date().toISOString(),
    endTime: new Date().toISOString(),
    messages: [
        { role: 'assistant', content: '안녕하세요. 법원 AI 법률 상담사입니다.', timestamp: new Date().toISOString() },
        { role: 'user', content: '민사소송 절차가 어떻게 되나요?', timestamp: new Date().toISOString() },
        { role: 'assistant', content: '민사소송은 1) 소장 제출, 2) 소장 심사, 3) 피고 송달, 4) 변론기일, 5) 판결 순서로 진행됩니다.', timestamp: new Date().toISOString() },
        { role: 'user', content: '소장 작성 방법도 알려주세요', timestamp: new Date().toISOString() },
        { role: 'assistant', content: '소장에는 당사자 표시, 청구취지, 청구원인, 입증방법, 첨부서류를 기재해야 합니다.', timestamp: new Date().toISOString() }
    ]
};

const tags1 = suggestTags(conversation1.messages, 'court');
console.log('대화 내용:');
conversation1.messages.forEach(m => {
    const role = m.role === 'user' ? '👤 사용자' : '🤖 법원AI';
    console.log(`  ${role}: ${m.content.substring(0, 50)}...`);
});
console.log(`\n자동 추천 태그: [${tags1.join(', ')}]`);

const result1 = saveConversation(userId, conversation1, tags1);
console.log('\n📦 OpenHash 저장 결과:');
console.log(`  ├─ 문서 Hash: ${result1.entry.docHash.substring(0, 32)}...`);
console.log(`  ├─ Chain Hash: ${result1.entry.chainHash.substring(0, 32)}...`);
console.log(`  ├─ 이전 Hash: ${result1.entry.prevHash || '(없음 - 최초 기록)'}`);
console.log(`  ├─ 저장 계층: Layer ${result1.entry.layer} (${result1.entry.layerName})`);
console.log(`  ├─ 계층 코드: ${result1.entry.layerCode}`);
console.log(`  └─ Chain #: ${result1.entry.index}`);


// 테스트 대화 2: 국세청 - 세금 상담
console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('【대화 2】 국세청 AI - 세금 신고 상담');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

const conversation2 = {
    partnerId: 'tax',
    partnerName: '국세청',
    userId: userId,
    startTime: new Date().toISOString(),
    endTime: new Date().toISOString(),
    messages: [
        { role: 'assistant', content: '안녕하세요. 국세청 AI 세무 상담사입니다.', timestamp: new Date().toISOString() },
        { role: 'user', content: '종합소득세 신고 기간이 언제인가요?', timestamp: new Date().toISOString() },
        { role: 'assistant', content: '종합소득세는 매년 5월 1일부터 5월 31일까지 신고합니다.', timestamp: new Date().toISOString() },
        { role: 'user', content: '세금 공제 항목에는 뭐가 있나요?', timestamp: new Date().toISOString() },
        { role: 'assistant', content: '근로소득공제, 인적공제, 연금보험료공제, 의료비공제 등이 있습니다.', timestamp: new Date().toISOString() }
    ]
};

const tags2 = suggestTags(conversation2.messages, 'tax');
console.log('대화 내용:');
conversation2.messages.forEach(m => {
    const role = m.role === 'user' ? '👤 사용자' : '🤖 국세청AI';
    console.log(`  ${role}: ${m.content.substring(0, 50)}...`);
});
console.log(`\n자동 추천 태그: [${tags2.join(', ')}]`);

const result2 = saveConversation(userId, conversation2, tags2);
console.log('\n📦 OpenHash 저장 결과:');
console.log(`  ├─ 문서 Hash: ${result2.entry.docHash.substring(0, 32)}...`);
console.log(`  ├─ Chain Hash: ${result2.entry.chainHash.substring(0, 32)}...`);
console.log(`  ├─ 이전 Hash: ${result2.entry.prevHash.substring(0, 32)}...`);
console.log(`  ├─ 저장 계층: Layer ${result2.entry.layer} (${result2.entry.layerName})`);
console.log(`  ├─ 계층 코드: ${result2.entry.layerCode}`);
console.log(`  └─ Chain #: ${result2.entry.index}`);


// 테스트 대화 3: 병원 - 진료 예약
console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('【대화 3】 병원 AI - 진료 예약 상담');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

const conversation3 = {
    partnerId: 'hospital',
    partnerName: '병원',
    userId: userId,
    startTime: new Date().toISOString(),
    endTime: new Date().toISOString(),
    messages: [
        { role: 'assistant', content: '안녕하세요. 병원 AI 의료 상담사입니다.', timestamp: new Date().toISOString() },
        { role: 'user', content: '내과 진료 예약하고 싶어요', timestamp: new Date().toISOString() },
        { role: 'assistant', content: '내과 진료 예약 가능합니다. 원하시는 날짜와 시간을 알려주세요.', timestamp: new Date().toISOString() },
        { role: 'user', content: '내일 오전 10시요', timestamp: new Date().toISOString() },
        { role: 'assistant', content: '내일 오전 10시 내과 진료 예약 완료되었습니다.', timestamp: new Date().toISOString() }
    ]
};

const tags3 = suggestTags(conversation3.messages, 'hospital');
console.log('대화 내용:');
conversation3.messages.forEach(m => {
    const role = m.role === 'user' ? '👤 사용자' : '🤖 병원AI';
    console.log(`  ${role}: ${m.content.substring(0, 50)}...`);
});
console.log(`\n자동 추천 태그: [${tags3.join(', ')}]`);

const result3 = saveConversation(userId, conversation3, tags3);
console.log('\n📦 OpenHash 저장 결과:');
console.log(`  ├─ 문서 Hash: ${result3.entry.docHash.substring(0, 32)}...`);
console.log(`  ├─ Chain Hash: ${result3.entry.chainHash.substring(0, 32)}...`);
console.log(`  ├─ 이전 Hash: ${result3.entry.prevHash.substring(0, 32)}...`);
console.log(`  ├─ 저장 계층: Layer ${result3.entry.layer} (${result3.entry.layerName})`);
console.log(`  ├─ 계층 코드: ${result3.entry.layerCode}`);
console.log(`  └─ Chain #: ${result3.entry.index}`);


// 최종 Hash Chain 상태 출력
console.log('\n\n╔════════════════════════════════════════════════════════════╗');
console.log('║        사용자 Hash Chain 최종 상태                         ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

console.log(`사용자 ID: ${userId}`);
console.log(`총 기록 수: ${result3.chain.entries.length}`);
console.log(`최종 Hash: ${result3.chain.latestHash}\n`);

console.log('┌────┬──────────┬──────────────┬─────────────────────────────────┐');
console.log('│ #  │ 기관     │ 태그         │ Chain Hash                      │');
console.log('├────┼──────────┼──────────────┼─────────────────────────────────┤');
result3.chain.entries.forEach(e => {
    const tags = e.tags.join(', ').padEnd(12).substring(0, 12);
    const hash = e.chainHash.substring(0, 32);
    console.log(`│ ${String(e.index).padStart(2)} │ ${e.partnerName.padEnd(8)} │ ${tags} │ ${hash}│`);
});
console.log('└────┴──────────┴──────────────┴─────────────────────────────────┘');

// Hash Chain 무결성 검증
console.log('\n\n╔════════════════════════════════════════════════════════════╗');
console.log('║        Hash Chain 무결성 검증                               ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

let isValid = true;
let prevHash = null;

result3.chain.entries.forEach((entry, i) => {
    const expectedPrev = i === 0 ? null : result3.chain.entries[i-1].chainHash;
    const prevMatch = entry.prevHash === expectedPrev;
    
    // Chain Hash 재계산
    const chainInput = entry.prevHash ? entry.prevHash + entry.docHash : entry.docHash;
    const recalculatedHash = generateHash(chainInput);
    const hashMatch = recalculatedHash === entry.chainHash;
    
    const status = prevMatch && hashMatch ? '✅ 정상' : '❌ 오류';
    console.log(`Entry #${entry.index}: ${status}`);
    console.log(`  ├─ prevHash 일치: ${prevMatch ? '✓' : '✗'}`);
    console.log(`  └─ chainHash 검증: ${hashMatch ? '✓' : '✗'}`);
    
    if (!prevMatch || !hashMatch) isValid = false;
});

console.log(`\n전체 Chain 무결성: ${isValid ? '✅ 검증 완료' : '❌ 오류 발견'}`);

// 저장된 파일 확인
console.log('\n\n저장된 파일:');
console.log(`  /tmp/hashchain_${userId}.json`);
