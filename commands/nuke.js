const {SlashCommandBuilder} = require('discord.js');

module.exports = {
    // Slashコマンドの定義
    data: new SlashCommandBuilder()
        .setName('nuke')
        .setDescription('このチャンネルを複製して元チャンネルを削除します。'),

    // コマンド実行時の処理
    async execute(interaction) {
        try {
            // 実行メッセージ
            await interaction.reply({content: 'チャンネルをNUKEしています...', ephemeral: false});

            const originalChannel = interaction.channel;
            // チャンネルをClone
            const clonedChannel = await originalChannel.clone({
                reason: '/nuke コマンドによる複製'
            });

            // 元チャンネルと同じ位置に配置後、元チャンネルを削除
            await clonedChannel.setPosition(originalChannel.position);
            await originalChannel.delete('/nuke コマンドによる削除');

            // 新しいチャンネルにメッセージを送信
            await clonedChannel.send('チャンネルをNUKEしました！');
        } catch (error) {
            console.error(error);
            if (!interaction.replied) {
                await interaction.reply({content: 'エラーが発生しました。', ephemeral: true});
            }
        }
    }
};