const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    AttachmentBuilder,
    Events,
    Collection
} = require('discord.js');
const {createCanvas} = require('canvas');

const captchaMap = new Collection();

let lastPanelMessageId = null;

const CAPTCHA_EXPIRY = 5 * 60 * 1000;

function generateCaptchaText(length = 6) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

async function generateCaptchaImage(text) {
    const width = 200;
    const height = 70;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    for (let i = 0; i < 100; i++) {
        ctx.fillStyle = `rgba(${Math.random() * 255},${Math.random() * 255},${Math.random() * 255},0.1)`;
        ctx.fillRect(Math.random() * width, Math.random() * height, 2, 2);
    }

    ctx.font = '32px sans-serif';
    ctx.fillStyle = '#000000';
    const textWidth = ctx.measureText(text).width;
    const textX = (width - textWidth) / 2;
    const textY = height / 2 + 10;

    for (let i = 0; i < text.length; i++) {
        ctx.save();
        const x = textX + (textWidth / text.length) * i;
        const y = textY + Math.sin(i) * 5;
        ctx.translate(x, y);
        ctx.rotate((Math.random() - 0.5) * 0.5);
        ctx.fillText(text[i], 0, 0);
        ctx.restore();
    }

    ctx.strokeStyle = '#888888';
    for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.moveTo(0, Math.random() * height);
        for (let x = 0; x < width; x += 10) {
            ctx.lineTo(x, Math.sin(x * 0.05) * 10 + Math.random() * height / 2 + height / 4);
        }
        ctx.stroke();
    }

    const buffer = canvas.toBuffer();
    return new AttachmentBuilder(buffer, {name: 'captcha.png'});
}

module.exports = {
    async postVerificationPanel(client) {
        const channelId = '1380127838962712756';
        const channel = client.channels.cache.get(channelId);
        if (!channel) {
            console.warn(`Channel ${channelId} not found.`);
            return;
        }

        try {
            const messages = await channel.messages.fetch();
            const botMessages = messages.filter(msg => msg.author.id === client.user.id);
            if (botMessages.size > 0) {
                await channel.bulkDelete(botMessages).catch(() => null);
            }
        } catch (e) {
            console.error('Failed to delete old messages:', e);
        }

        const embed = new EmbedBuilder()
            .setTitle('Verification Panel')
            .setDescription('Press the button below to start verification.\nYou will receive a CAPTCHA to complete.')
            .setColor('#00AAFF');
        const button = new ButtonBuilder()
            .setCustomId('startVerification')
            .setLabel('Verify')
            .setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder().addComponents(button);

        const sentMsg = await channel.send({
            embeds: [embed],
            components: [row]
        });

        lastPanelMessageId = sentMsg.id;
    },

    registerEvents(client) {
        client.on(Events.InteractionCreate, async (interaction) => {
            if (!interaction.isButton()) return;
            if (interaction.customId !== 'startVerification') return;

            try {
                const captchaText = generateCaptchaText(6);
                const attachment = await generateCaptchaImage(captchaText);
                const userId = interaction.user.id;

                captchaMap.set(userId, {
                    text: captchaText,
                    expires: Date.now() + CAPTCHA_EXPIRY
                });

                const submitButton = new ButtonBuilder()
                    .setCustomId(`submit_${userId}`)
                    .setLabel('Submit Answer')
                    .setStyle(ButtonStyle.Primary);

                const retryButton = new ButtonBuilder()
                    .setCustomId(`retry_${userId}`)
                    .setLabel('Get New CAPTCHA')
                    .setStyle(ButtonStyle.Secondary);

                const row = new ActionRowBuilder()
                    .addComponents(submitButton, retryButton);

                await interaction.reply({
                    content: 'Please type the characters you see in this image, then click Submit Answer.\nIf you need a new CAPTCHA, click Get New CAPTCHA.',
                    files: [attachment],
                    components: [row],
                    ephemeral: true
                });
            } catch (error) {
                console.error(error);
            }
        });

        client.on(Events.InteractionCreate, async (interaction) => {
            if (!interaction.isButton()) return;
            const [action, targetUserId] = interaction.customId.split('_');
            if (action !== 'retry') return;
            if (interaction.user.id !== targetUserId) {
                return interaction.reply({
                    content: 'This CAPTCHA is not for you.',
                    ephemeral: true
                });
            }

            try {
                const captchaText = generateCaptchaText(6);
                const attachment = await generateCaptchaImage(captchaText);

                captchaMap.set(targetUserId, {
                    text: captchaText,
                    expires: Date.now() + CAPTCHA_EXPIRY
                });

                const submitButton = new ButtonBuilder()
                    .setCustomId(`submit_${targetUserId}`)
                    .setLabel('Submit Answer')
                    .setStyle(ButtonStyle.Primary);

                const retryButton = new ButtonBuilder()
                    .setCustomId(`retry_${targetUserId}`)
                    .setLabel('Get New CAPTCHA')
                    .setStyle(ButtonStyle.Secondary);

                const row = new ActionRowBuilder()
                    .addComponents(submitButton, retryButton);

                await interaction.update({
                    content: 'Here is your new CAPTCHA. Please type the characters you see in this image.',
                    files: [attachment],
                    components: [row]
                });
            } catch (error) {
                console.error(error);
            }
        });

        client.on(Events.InteractionCreate, async (interaction) => {
            if (!interaction.isButton()) return;
            const [action, targetUserId] = interaction.customId.split('_');
            if (action !== 'submit') return;
            if (interaction.user.id !== targetUserId) {
                return interaction.reply({
                    content: 'This CAPTCHA is not for you.',
                    ephemeral: true
                });
            }

            const modal = new ModalBuilder()
                .setCustomId(`captchaModal_${targetUserId}`)
                .setTitle('CAPTCHA Verification');

            const input = new TextInputBuilder()
                .setCustomId('captchaInput')
                .setLabel('Enter the CAPTCHA shown in the image above.')
                .setStyle(TextInputStyle.Short);

            const modalRow = new ActionRowBuilder().addComponents(input);
            modal.addComponents(modalRow);

            await interaction.showModal(modal);
        });

        client.on(Events.InteractionCreate, async (interaction) => {
            if (!interaction.isModalSubmit()) return;
            const [modalType, targetUserId] = interaction.customId.split('_');
            if (modalType !== 'captchaModal') return;
            if (interaction.user.id !== targetUserId) {
                return interaction.reply({
                    content: 'This CAPTCHA is not for you.',
                    ephemeral: true
                });
            }

            const userId = interaction.user.id;
            const captchaData = captchaMap.get(userId);

            if (!captchaData) {
                return interaction.reply({
                    content: 'Failed to verify. Please try again.',
                    ephemeral: true
                });
            }

            if (Date.now() > captchaData.expires) {
                captchaMap.delete(userId);
                return interaction.reply({
                    content: 'CAPTCHA has expired. Please try again.',
                    ephemeral: true
                });
            }

            const answer = interaction.fields.getTextInputValue('captchaInput')?.trim();
            if (answer && answer.toLowerCase() === captchaData.text.toLowerCase()) {
                captchaMap.delete(userId);

                const roleId = '1380122128472342620';
                const guild = interaction.guild;

                if (guild) {
                    const member = await guild.members.fetch(userId).catch(() => null);
                    if (member) {
                        await member.roles.add(roleId).catch(() => null);
                    }
                }

                return interaction.reply({
                    content: 'Verification successful! You have been granted the role.',
                    ephemeral: true
                });
            } else {
                return interaction.reply({
                    content: 'Incorrect CAPTCHA. Please try again.',
                    ephemeral: true
                });
            }
        });
    }
};