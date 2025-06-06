module.exports = class ReactionCheck {
    constructor(client) {
        this.client = client;

        this.userReactionMap = new Map();

        this.reactionTimeFrame = 2000;
        this.reactionLimit = 3;

        this.simultaneousReactionsThreshold = 4;

        this.timeoutValue = 10 * 60 * 1000;

        this.setupListener();
    }

    setupListener() {
        this.client.on('messageReactionAdd', async (reaction, user) => {
            if (user.bot) return;
            if (!reaction.message.guild) return;

            const guildId = reaction.message.guild.id;
            const userId = user.id;
            const messageId = reaction.message.id;
            const now = Date.now();

            if (!this.userReactionMap.has(userId)) {
                this.userReactionMap.set(userId, {
                    timestamps: [],
                    messages: {}
                });
            }
            const userData = this.userReactionMap.get(userId);

            userData.timestamps.push(now);
            userData.timestamps = userData.timestamps.filter(t => now - t <= this.reactionTimeFrame);

            if (userData.timestamps.length >= this.reactionLimit) {
                this.applyTimeout(guildId, userId, 'Reaction Spam');
                this.userReactionMap.delete(userId);
                return;
            }

            if (!userData.messages[messageId]) {
                userData.messages[messageId] = new Set();
            }
            userData.messages[messageId].add(reaction.emoji.identifier);

            if (userData.messages[messageId].size >= this.simultaneousReactionsThreshold) {
                this.applyTimeout(guildId, userId, 'Multi interactions ( Reactions )' );
                this.userReactionMap.delete(userId);
            }
        });
    }


    applyTimeout(serverId, userId, reasonMessage) {
        this.client.notifications
            .timeoutUser(serverId, userId, this.timeoutValue, reasonMessage)
            .catch(err => console.error(err));
    }
};