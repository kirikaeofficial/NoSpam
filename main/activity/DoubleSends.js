module.exports = class DoubleSends {
    constructor(client) {
        this.client = client;
        this.userDataMap = new Map();

        this.setupListeners();
    }

    setupListeners() {
        this.client.on('messageCreate', (message) => {
            // BOTのメッセージは無視
            if (message.author.bot) return;

            const userId = message.author.id;
            const channelId = message.channel.id;
            const guildId = message.guild.id;

            const now = Date.now();
            const threshold = 3000;

            let userData = this.userDataMap.get(userId);
            if (!userData) {
                userData = {
                    violationCount: 0,
                    lastChannels: [],
                    lastTimestamp: now,
                };
                this.userDataMap.set(userId, userData);
            }

            const timeDiff = now - userData.lastTimestamp;

            if (timeDiff < threshold && !userData.lastChannels.includes(channelId)) {
                userData.violationCount++;
            } else {
                userData.violationCount = 0;
                userData.lastChannels = [];
            }

            userData.lastChannels.push(channelId);
            userData.lastTimestamp = now;

            if (userData.violationCount >= 2) {
                const timeoutValue = 10 * 60 * 1000;
                const reasonMessage = 'Duplication sends ';

                this.client.notifications
                    .timeoutUser(guildId, userId, timeoutValue, reasonMessage)
                    .catch((err) => console.error(err));

                userData.violationCount = 0;
                userData.lastChannels = [];
            }
        });
    }
};