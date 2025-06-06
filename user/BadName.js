const fs = require('fs');
const path = require('path');
const {Collection} = require('discord.js');

module.exports = class BadName {
    constructor(client) {
        this.client = client;
        this.blockedNames = new Collection();
        this.badWords = this.loadBadWords();
        this.nameCheckInterval = 1800000; // 30分ごと

        this.setupListeners();
        this.startPeriodicCheck();
    }

    loadBadWords() {
        try {
            const badWordsPath = path.join(process.cwd(), 'badwords.txt');
            const content = fs.readFileSync(badWordsPath, 'utf8');
            return content.split('\n').map(word => word.trim().toLowerCase()).filter(Boolean);
        } catch (error) {
            console.error('Error loading badwords file:', error);
            return [];
        }
    }

    setupListeners() {
        this.client.on('guildMemberAdd', this.handleMemberUpdate.bind(this));
        this.client.on('guildMemberUpdate', this.handleMemberUpdate.bind(this));
    }

    startPeriodicCheck() {
        setInterval(async () => {
            for (const [, guild] of this.client.guilds.cache) {
                try {
                    const members = await guild.members.fetch();
                    for (const [, member] of members) {
                        await this.handleMemberUpdate(null, member);
                    }
                } catch (error) {
                    console.error(`Failed to check names in guild ${guild.id}:`, error);
                }
            }
        }, this.nameCheckInterval);
    }

    checkName(text) {
        return this.containsBadWord(text);
    }

    containsBadWord(text) {
        if (!text) return false;
        if (this.badWords.length === 0) return false;
        const normalizedText = text.toLowerCase();
        return this.badWords.some(word => {
            const regex = new RegExp(`\\b${word}\\b`, 'i');
            return regex.test(normalizedText);
        });
    }

    generateBlockedName() {
        return `BlockedName_${Date.now().toString().slice(-6)}`;
    }

    async handleMemberUpdate(oldMember, newMember) {
        const member = newMember || oldMember;
        if (!member) return;

        const displayName = member.displayName;
        const nickname = member.nickname;

        if (this.containsBadWord(displayName) || this.containsBadWord(nickname)) {
            const existingBlockedName = this.blockedNames.get(member.id);
            if (existingBlockedName) {
                try {
                    await member.setNickname(existingBlockedName);
                } catch (error) {
                    console.error('Failed to set blocked name:', error);
                }
            } else {
                const newBlockedName = this.generateBlockedName();
                try {
                    await member.setNickname(newBlockedName);
                    this.blockedNames.set(member.id, newBlockedName);
                } catch (error) {
                    console.error('Failed to set blocked name:', error);
                }
            }
        }
    }

    async handleUserUpdate(oldUser, newUser) {
        if (!oldUser || !newUser) return;

        if (this.containsBadWord(newUser.username)) {
            const guilds = this.client.guilds.cache.filter(g => g.members.cache.has(newUser.id));
            for (const [, guild] of guilds) {
                const member = await guild.members.fetch(newUser.id);
                await this.handleMemberUpdate(null, member);
            }
        }
    }
}
