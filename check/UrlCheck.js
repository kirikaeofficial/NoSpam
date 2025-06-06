const fetch = require('node-fetch');

module.exports = class UrlCheck {
    constructor(client) {
        this.client = client;

        this.apiKey = '9a3d5444ef30d9a7b0f26f9247de50f21aac43a12bb31bfe018a53dc5b7f3a5e';

        this.timeoutValue = 5 * 60 * 1000;

        this.blockThreshold = 1;

        this.setupListener();
    }

    /**
     * MessageCreate イベントを監視し、メッセージ内に含まれるURLをスキャン
     */
    setupListener() {
        this.client.on('messageCreate', async (message) => {
            if (!message.guild) return;
            if (message.author.bot) return;

            const normalizedContent = message.content.replace(/\s+/g, '').toLowerCase();
            const urls = this.extractUrlsFromText(normalizedContent);
            if (!urls || urls.length === 0) return;

            for (const url of urls) {
                try {
                    console.log('[UrlCheck] Url scan started ->', url);

                    const cleanUrl = this.cleanUrl(url);

                    const analysisId = await this.uploadUrl(cleanUrl);

                    const score = await this.getAnalysisResult(analysisId);
                    console.log(`[UrlCheck] Scan score(${cleanUrl}): ${score}`);

                    if (score >= this.blockThreshold) {
                        const guildId = message.guild.id;
                        const userId = message.author.id;
                        const reason = `Dangerous URL detected - VirusTotal Score: ${score})`;

                        await this.client.notifications
                            .timeoutUser(guildId, userId, this.timeoutValue, reason)
                            .catch(console.error);

                        await message.delete().catch((err) => {
                            console.log('[UrlCheck] Failed to delete url message:', err?.message || err);
                        });
                        console.log('[UrlCheck] Deleted Dangerous Url Message');

                        break;
                    }
                } catch (error) {
                    console.error('[UrlCheck] Scanning error:', error?.message || error);
                }
            }
        });
    }


    extractUrlsFromText(text) {
        const urlRegex = /https?:\/\/[-_.!~*\'()a-zA-Z0-9;\/?:\@&=+\$,%#]+/g;
        return text.match(urlRegex) || [];
    }


    cleanUrl(url) {
        return url.replace(/^(https?:\/\/)+(.*?)$/, '$1$2');
    }


    async uploadUrl(targetUrl) {
        const params = new URLSearchParams();
        params.append('url', targetUrl);

        const response = await fetch('https://www.virustotal.com/api/v3/urls', {
            method: 'POST',
            headers: {
                'x-apikey': this.apiKey,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: params
        });

        if (!response.ok) {
            throw new Error(`URL Send error: ${response.statusText}`);
        }

        const result = await response.json();
        const analysisId = result?.data?.id;
        if (!analysisId) {
            throw new Error('Cannot get analysis ID. Please check your API key and try again. If the problem persists, please contact the developer.');
        }

        return analysisId;
    }

    async getAnalysisResult(analysisId) {
        const response = await fetch(`https://www.virustotal.com/api/v3/analyses/${analysisId}`, {
            method: 'GET',
            headers: {
                'x-apikey': this.apiKey
            }
        });

        if (!response.ok) {
            throw new Error(`Analysis get error: ${response.statusText}`);
        }

        const analysisResult = await response.json();
        const stats = analysisResult?.data?.attributes?.stats;
        if (!stats) {
            throw new Error('Analysis is not found. Please check your API key and try again. If the problem persists, please contact the developer.');
        }

        const malicious = stats.malicious || 0;
        const suspicious = stats.suspicious || 0;
        return malicious + suspicious;
    }
};