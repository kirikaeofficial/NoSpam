module.exports = class Antispam {
    constructor(client) {
        this.client = client;

        this.userDataMap = new Map();
        this.typingMap = new Map();

        this.maxMessagesWithinTime = 5;
        this.timeFrame = 3000;
        this.timeoutValue = 10 * 60 * 1000;

        this.duplicateLimit = 3;

        this.setupTypingListener();
        this.setupMessageListener();
    }


    setupTypingListener() {
        this.client.on('typingStart', (typing) => {
            if (typing.user.bot) return;
            this.typingMap.set(typing.user.id, Date.now());
        });
    }


    setupMessageListener() {
        this.client.on('messageCreate', async (message) => {
            if (message.author.bot) return;

            const userId = message.author.id;
            const guildId = message.guild?.id;
            if (!guildId) return;

            if (!this.userDataMap.has(userId)) {
                this.userDataMap.set(userId, {
                    messages: [],
                    lastMessages: [],
                    warnCount: 0
                });
            }
            const userData = this.userDataMap.get(userId);

            const now = Date.now();

            userData.messages.push(now);
            userData.messages = userData.messages.filter((t) => t > now - this.timeFrame);

            if (userData.messages.length >= this.maxMessagesWithinTime) {
                const messages = await message.channel.messages.fetch({limit: 10});
                const userMessages = messages.filter(m => m.author.id === userId);
                try {
                    await Promise.all(userMessages.map(m => m.delete()));
                } catch (err) {
                    console.error('Failed to delete messages:', err);
                }
                this.applyTimeout(guildId, userId, 'Excessive posts detected in a short period');
                return;
            }

            const currentContent = message.content.trim();
            if (userData.lastMessages.includes(currentContent)) {
                userData.warnCount++;
                if (userData.warnCount >= this.duplicateLimit) {
                    const messages = await message.channel.messages.fetch({limit: 10});
                    const userMessages = messages.filter(m => m.author.id === userId);
                    try {
                        await Promise.all(userMessages.map(m => m.delete()));
                    } catch (err) {
                        console.error('Failed to delete messages:', err);
                    }
                    this.applyTimeout(guildId, userId, 'Multiple identical or similar messages');
                    return;
                }
            } else {
                userData.warnCount = 0;
            }
            userData.lastMessages.push(currentContent);
            if (userData.lastMessages.length > 5) {
                userData.lastMessages.shift();
            }


            const zalgoRegex = /[\u0300-\u036f\u0489]+/;
            if (zalgoRegex.test(currentContent)) {
                const messages = await message.channel.messages.fetch({limit: 10});
                const userMessages = messages.filter(m => m.author.id === userId);
                try {
                    await Promise.all(userMessages.map(m => m.delete()));
                } catch (err) {
                    console.error('Failed to delete messages:', err);
                }
                this.applyTimeout(guildId, userId, 'Zalgo');
                return;
            }


            const emojiRegex = /<a?:.+?:\d+>|[\u{1F300}-\u{1FAFF}]/u;
            const matchAllEmojis = currentContent.match(new RegExp(emojiRegex, 'gu'));
            if (matchAllEmojis && matchAllEmojis.length > 10) {
                const messages = await message.channel.messages.fetch({limit: 10});
                const userMessages = messages.filter(m => m.author.id === userId);
                try {
                    await Promise.all(userMessages.map(m => m.delete()));
                } catch (err) {
                    console.error('Failed to delete messages:', err);
                }
                this.applyTimeout(guildId, userId, 'Emoji Spam');
                return;
            }

            const randomRegex = /^[A-Za-z0-9]{30,}$/;
            if (randomRegex.test(currentContent)) {
                const messages = await message.channel.messages.fetch({limit: 10});
                const userMessages = messages.filter(m => m.author.id === userId);
                try {
                    await Promise.all(userMessages.map(m => m.delete()));
                } catch (err) {
                    console.error('Failed to delete messages:', err);
                }
                this.applyTimeout(guildId, userId, 'Random String');
                return;
            }

            const typingStartTime = this.typingMap.get(userId);
            if (typingStartTime && now - typingStartTime < 300) {
                userData.warnCount++;
                if (userData.warnCount >= 2) {
                    const messages = await message.channel.messages.fetch({limit: 10});
                    const userMessages = messages.filter(m => m.author.id === userId);
                    try {
                        await Promise.all(userMessages.map(m => m.delete()));
                    } catch (err) {
                        console.error('Failed to delete messages:', err);
                    }
                    this.applyTimeout(guildId, userId, 'Copy and paste spam');
                    return;
                }
            }
        });
    }


    applyTimeout(serverId, userId, reasonMessage) {
        this.client.notifications
            .timeoutUser(serverId, userId, this.timeoutValue, reasonMessage)
            .catch((err) => console.error(err));

        this.userDataMap.delete(userId);
        this.typingMap.delete(userId);
    }
};