const fetch = require('node-fetch');
const fs = require('fs');
const FormData = require('form-data');

module.exports = class VirusCheck {
    constructor(client) {
        this.client = client;

        // ★ 実際のキーは必ずプレースホルダに置き換えてください
        this.apiKey = '9a3d5444ef30d9a7b0f26f9247de50f21aac43a12bb31bfe018a53dc5b7f3a5e';

        // スキャン対象となる拡張子の一覧
        this.suspiciousExtensions = [
            'zip', 'rar', 'exe', 'dll', 'apk', 'js', 'bat', 'cmd',
            'py', 'java', 'kt', 'kts', 'vbs', 'ps1', 'psm1', 'psd1',
            'msi', 'reg', 'scr', 'com', 'pif', 'jar', 'jse', 'vbe',
            'wsf', 'wsh', 'ps1xml', 'rdp', 'hta', 'msc', 'cpl',
            'gadget', 'inf1', 'ins', 'inx', 'isu', 'job', 'msp',
            'paf', 'rgs', 'mst', 'app', 'deb', 'rpm', 'pkg'
        ];

        // タイムアウトの長さ (ミリ秒)
        this.timeoutValue = 5 * 60 * 1000; // 5分

        // VirusTotalのスキャン結果(検出数)がこの値以上ならブロック
        this.blockThreshold = 5;

        this.setupListener();
    }

    setupListener() {
        this.client.on('messageCreate', async (message) => {
            if (!message.guild) return;
            if (message.author.bot) return;

            const attachments = message.attachments;
            if (!attachments || attachments.size === 0) return;

            for (const [, attachment] of attachments) {
                const fileUrl = attachment.url;
                const fileName = attachment.name || '';

                const fileExt = this.getExtension(fileName).toLowerCase();
                console.log(`[VirusCheck] File: ${fileName}, : ${fileExt}`);

                if (!this.suspiciousExtensions.includes(fileExt)) {
                    console.log('[VirusCheck] Skipped');
                    continue;
                }

                try {
                    console.log('[VirusCheck] Downloading ->', fileUrl);
                    const response = await fetch(fileUrl);
                    const buffer = await response.buffer();

                    const tempFilePath = `./${fileName}`;
                    fs.writeFileSync(tempFilePath, buffer);

                    console.log('[VirusCheck] Scanning ->', tempFilePath);

                    const analysisId = await this.uploadFile(tempFilePath);
                    await new Promise(resolve => setTimeout(resolve, 0));
                    const score = await this.getAnalysisResult(analysisId);

                    fs.unlinkSync(tempFilePath);

                    console.log(`[VirusCheck] Scan analysis: ${score}`);
                    if (score >= this.blockThreshold) {
                        // 危険度が高いと判断 → タイムアウト + メッセージ削除
                        const guildId = message.guild.id;
                        const userId = message.author.id;
                        const reason = `Dangerous FILE detected - VirusTotal Score: ${score})`;

                        await this.client.notifications
                            .timeoutUser(guildId, userId, this.timeoutValue, reason)
                            .catch(console.error);

                        await message.delete().catch((err) => {
                            console.log('[VirusCheck] Failed to Delete message:', err?.message || err);
                        });
                        console.log('[VirusCheck] Deleted Dangerous File Message');

                        break;
                    }
                } catch (error) {
                    console.error('[VirusCheck] Scanning Failed:', error.message);
                }
            }
        });
    }


    getExtension(filename) {
        const lastDotIndex = filename.lastIndexOf('.');
        if (lastDotIndex < 0) return '';
        return filename.substring(lastDotIndex + 1);
    }


    async uploadFile(filePath) {
        const formData = new FormData();
        formData.append('file', fs.createReadStream(filePath));

        const response = await fetch('https://www.virustotal.com/api/v3/files', {
            method: 'POST',
            headers: {
                'x-apikey': this.apiKey
            },
            body: formData
        });

        if (!response.ok) {
            throw new Error(`File Sends Error: ${response.statusText}`);
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
            throw new Error(`Analysis get Error: ${response.statusText}`);
        }

        const analysisResult = await response.json();
        const stats = analysisResult?.data?.attributes?.stats;
        if (!stats) {
            throw new Error('Analysis result is not found. Please check your API key and try again. If the problem persists, please contact the developer.');
        }

        const malicious = stats.malicious || 0;
        const suspicious = stats.suspicious || 0;
        return malicious + suspicious;
    }
};