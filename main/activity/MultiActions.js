module.exports = class MultiActions {
    constructor(client) {
        this.client = client;

        // あり得ない短時間での「連続プロフィール更新 → メッセージ送信」などを追跡
        // (想定: 3回 以上繰り返されたらアウト)
        this.violationThreshold = 3;

        // 短時間の判定用(3秒以内)
        this.timeFrame = 3000;

        // タイムアウトの時間(30分)
        this.timeoutValue = 30 * 60 * 1000;

        // ユーザーごとに「直近の複数操作」を記録するMap
        // キー: userId, 値: [{timestamp, type}, ...]
        this.userEventsMap = new Map();

        // 連続イベントの最大許容回数
        this.maxConsecutiveSameEvents = 2;

        this.setupListeners();
    }

    setupListeners() {
        this.client.on('messageCreate', async (message) => {
            if (!message.guild || message.author.bot) return;
            if (message.content.length > 500) {
                const reason = 'Long message';
                this.applyTimeout(message.guild.id, message.author.id, reason);
                return;
            }

            this.addUserEvent(message.author.id, 'message');
            this.checkMultiActions(message.guild.id, message.author.id);
        });

        this.client.on('guildMemberUpdate', (oldMember, newMember) => {
            if (oldMember.user.bot) return;

            if (oldMember.nickname !== newMember.nickname) {
                this.addUserEvent(newMember.id, 'nicknameUpdate');
                this.checkMultiActions(newMember.guild.id, newMember.id);
            }

            if (oldMember.roles.cache.size !== newMember.roles.cache.size) {
                this.addUserEvent(newMember.id, 'rolesUpdate');
                this.checkMultiActions(newMember.guild.id, newMember.id);
            }
        });

        this.client.on('userUpdate', (oldUser, newUser) => {
            if (newUser.bot) return;

            if (oldUser.avatar !== newUser.avatar) {
                this.addUserEvent(newUser.id, 'avatarUpdate');
                const firstGuild = this.client.guilds.cache.find((g) => g.members.cache.has(newUser.id));
                if (firstGuild) {
                    this.checkMultiActions(firstGuild.id, newUser.id);
                }
            }

            if (oldUser.username !== newUser.username) {
                this.addUserEvent(newUser.id, 'usernameUpdate');
                const firstGuild = this.client.guilds.cache.find((g) => g.members.cache.has(newUser.id));
                if (firstGuild) {
                    this.checkMultiActions(firstGuild.id, newUser.id);
                }
            }
        });
    }

    addUserEvent(userId, type) {
        const now = Date.now();
        if (!this.userEventsMap.has(userId)) {
            this.userEventsMap.set(userId, []);
        }
        const events = this.userEventsMap.get(userId);

        events.push({timestamp: now, type});

        const filtered = events.filter((e) => now - e.timestamp <= this.timeFrame);
        this.userEventsMap.set(userId, filtered);
    }

    checkMultiActions(guildId, userId) {
        const events = this.userEventsMap.get(userId);
        if (!events || events.length < this.violationThreshold) return;

        // 同一イベントの連続回数をチェック
        const consecutiveCounts = new Map();
        events.forEach(event => {
            consecutiveCounts.set(event.type, (consecutiveCounts.get(event.type) || 0) + 1);
        });

        // プロフィール更新系イベントの総数
        const profileEvents = events.filter(e =>
            ['nicknameUpdate', 'avatarUpdate', 'usernameUpdate', 'rolesUpdate'].includes(e.type)
        ).length;

        // メッセージイベントの数
        const messageEvents = events.filter(e => e.type === 'message').length;

        let reason = '';
        if (profileEvents >= 2 && messageEvents >= 1) {
            reason = 'profile update too faster or multi actions ';
        } else if ([...consecutiveCounts.values()].some(count => count > this.maxConsecutiveSameEvents)) {
            reason = 'faster changes other multi actions ';
        } else if (events.length >= this.violationThreshold) {
            reason = 'duplicate multi actions ';
        }

        if (reason) {
            this.applyTimeout(guildId, userId, reason);
        }
    }

    applyTimeout(serverId, userId, reasonMessage) {
        this.client.notifications
            .timeoutUser(serverId, userId, this.timeoutValue, reasonMessage)
            .catch(console.error);

        this.userEventsMap.delete(userId);
    }
};