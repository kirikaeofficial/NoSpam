const {EmbedBuilder} = require('discord.js');

module.exports = class Notifications {
    constructor(client) {
        this.client = client;
    }

    async timeoutUser(serverId, userId, timeoutValue, reasonMessage) {
        try {
            const guild = this.client.guilds.cache.get(serverId);
            if (!guild) {
                console.error(`Server not found: ${serverId}`);
                return;
            }

            const member = await guild.members.fetch(userId);
            if (!member) {
                console.error(`Member not found: ${userId}`);
                return;
            }

            await member.timeout(timeoutValue, reasonMessage);

            const embed = new EmbedBuilder()
                .setColor('#DD2E44')
                .setTitle('Notification')
                .setThumbnail(guild.iconURL({dynamic: true}) || null)
                .setDescription(
                    `You have been timed out in **${guild.name}**.\n` +
                    `Please check the following details.`
                )
                .addFields(
                    {
                        name: 'Reason',
                        value: reasonMessage || 'No reason provided',
                        inline: false,
                    },
                    {
                        name: 'Timeout Duration',
                        value: timeoutValue >= 60000
                            ? `${timeoutValue / 60000} minutes`
                            : `${timeoutValue / 1000} seconds`,
                        inline: false,
                    }
                )
                .setFooter({
                    text: 'If you believe this was done in error, please contact a server administrator'
                })
                .setTimestamp();

            try {
                await member.send({embeds: [embed]});
            } catch (dmError) {
                console.error(`Failed to send DM: ${dmError.message}`);
            }
        } catch (err) {
            console.error(`Failed to timeout user: ${err.message}`);
        }
    }
};