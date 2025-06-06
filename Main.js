const { Client, GatewayIntentBits, Partials, REST, Routes } = require('discord.js');
const DoubleSends = require('./activity/DoubleSends.js');
const Antispam = require('./check/Spam.js');
const Notifications = require('./utils/Notification.js');
const Badwords = require('./check/Badwords.js');
const MultiActions = require('./activity/MultiActions.js');
const VirusCheck = require('./check/VirusCheck.js');
const VerifyPanel = require('./verifypanel/CaptchaPanel.js');
const UrlCheck = require('./check/UrlCheck.js');
const Reaction = require('./check/Reaction.js');
const BadName = require('./user/BadName.js');

// nuke.jsを読み込む
const nukeCommand = require('./commands/nuke.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ],
    partials: [
        Partials.Message,
        Partials.Channel,
        Partials.GuildMember
    ]
});

client.doubleSends = new DoubleSends(client);
client.antispam = new Antispam(client);
client.badwords = new Badwords(client);
client.notifications = new Notifications(client);
client.urlcheck = new UrlCheck(client);
client.reactioncheck = new Reaction(client);
client.viruscheck = new VirusCheck(client);
client.multiActions = new MultiActions(client);
client.badname = new BadName(client);

VerifyPanel.registerEvents(client);

client.login('').catch(console.error);

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}`);

    const commands = [
        nukeCommand.data
    ].map(cmd => cmd.toJSON());

    const rest = new REST({ version: '10' }).setToken('');
    await rest.put(
        Routes.applicationCommands(client.user.id),
        { body: commands }
    );

    console.log('Slash commands registered.');

    await VerifyPanel.postVerificationPanel(client);
    console.log('Verification panel posted automatically.');
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === nukeCommand.data.name) {
        await nukeCommand.execute(interaction);
    }
});