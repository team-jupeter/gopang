// OpenHash API Client - Real Mode
const MOCK_MODE = false;

const OpenHashAPI = {
    async getNodeHealth(layerId) {
        const node = CONFIG.OPENHASH_NODES[layerId];
        if (!node) return { status: 'error', error: 'Unknown node' };
        try {
            const response = await fetch(node.url + '/health', { signal: AbortSignal.timeout(5000) });
            const data = await response.json();
            return { ...data, status: 'healthy' };
        } catch (error) {
            return { status: 'error', error: error.message };
        }
    },

    async getAllNodesHealth() {
        const results = {};
        for (const layerId of Object.keys(CONFIG.OPENHASH_NODES)) {
            results[layerId] = await this.getNodeHealth(layerId);
        }
        return results;
    },

    async sendTransaction(layerId, sender, receiver, amount) {
        const node = CONFIG.OPENHASH_NODES[layerId];
        const response = await fetch(node.url + '/transaction', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sender, receiver, amount })
        });
        return response.json();
    },

    async getBalance(layerId, address) {
        const node = CONFIG.OPENHASH_NODES[layerId];
        const response = await fetch(node.url + '/balance/' + address);
        return response.json();
    },

    async setBalance(layerId, address, amount) {
        const node = CONFIG.OPENHASH_NODES[layerId];
        const response = await fetch(node.url + '/balance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ address, amount })
        });
        return response.json();
    },

    async getChain(layerId) {
        const node = CONFIG.OPENHASH_NODES[layerId];
        const response = await fetch(node.url + '/chain');
        return response.json();
    },

    async selectLayer(layerId, documentHash, importance) {
        const node = CONFIG.OPENHASH_NODES[layerId];
        const response = await fetch(node.url + '/select-layer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ documentHash, timestamp: Date.now(), importance })
        });
        return response.json();
    },

    async topDownVerify(layerId) {
        const node = CONFIG.OPENHASH_NODES[layerId];
        const response = await fetch(node.url + '/verify/top-down', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
        return response.json();
    },

    async triggerLPBFT(layerId, reason) {
        const node = CONFIG.OPENHASH_NODES[layerId];
        const response = await fetch(node.url + '/lpbft/trigger', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason })
        });
        return response.json();
    }
};

console.log('OpenHash API loaded - Real Mode (connecting to recovery-temp nodes)');
