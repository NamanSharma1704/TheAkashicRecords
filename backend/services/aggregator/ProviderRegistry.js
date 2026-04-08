const path = require('path');
const fs = require('fs');

class ProviderRegistry {
    constructor() {
        this.providers = [];
    }

    init() {
        const providersDir = path.join(__dirname, 'providers');
        const files = fs.readdirSync(providersDir);
        
        for (const file of files) {
            if (file === 'BaseProvider.js' || !file.endsWith('.js')) continue;
            
            try {
                const ProviderClass = require(path.join(providersDir, file));
                const providerInstance = new ProviderClass();
                this.providers.push(providerInstance);
                console.log(`[Aggregator] Registered provider: ${providerInstance.name}`);
            } catch (err) {
                console.error(`[Aggregator] Failed to register provider from ${file}:`, err.message);
            }
        }
    }

    getProviders() {
        if (this.providers.length === 0) {
            this.init();
        }
        return this.providers;
    }

    getProvider(name) {
        return this.getProviders().find(p => p.name.toLowerCase() === name.toLowerCase());
    }
}

module.exports = new ProviderRegistry();
