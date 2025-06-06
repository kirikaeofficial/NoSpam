const fs = require('fs');
const path = require('path');


module.exports = class Badwords {
    constructor(client) {
        this.client = client;

        this.badwordsList = this.loadBadwords();
        this.timeoutValue = 60 * 1000;

        this.setupMessageListener();
    }

    loadBadwords() {
        try {
            const filePath = path.join(__dirname, '..', 'badwords.txt');
            const content = fs.readFileSync(filePath, 'utf8');
            const lines = content
                .split(/\r?\n/)
                .map((line) => line.trim())
                .filter((line) => line.length > 0);

            return lines;
        } catch (err) {
            console.error('Failed to Load badwords.txt:', err.message);
            return [];
        }
    }


    setupMessageListener() {
        this.client.on('messageCreate', (message) => {
            if (message.author.bot) return;
            if (!message.guild) return;

            const guildId = message.guild.id;
            const userId = message.author.id;
            const originalContent = message.content;

            for (const badword of this.badwordsList) {
                if (originalContent.includes(badword)) {
                    const reason = `Bad words"${badword}"`;
                    this.client.notifications
                        .timeoutUser(guildId, userId, this.timeoutValue, reason)
                        .catch(console.error);

                    message.delete().catch(() => {
                    });
                    break;
                }
            }
        });
    }
};