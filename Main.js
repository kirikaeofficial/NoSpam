const { Client, GatewayIntentBits, Partials } = require('discord.js');
const DoubleSends = require('./activity/DoubleSends.js');
const Antispam = require('./check/Spam.js');
const Notifications = require('./utils/Notification.js');
const Badwords = require('./check/Badwords.js');
const MultiActions = require('./activity/MultiActions.js');
const VirusCheck = require('./check/VirusCheck.js');
const VerifyPanel = require('./verifypanel/CaptchaPanel.js');
const UrlCheck = require('./check/UrlCheck.js');
const Reaction = require('./check/Reaction.js');

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

VerifyPanel.registerEvents(client);

client.login('Ur bot token here').catch(console.error);

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}`);


    await VerifyPanel.postVerificationPanel(client);

    console.log('Verification panel posted automatically.');
});