const Discord = require('discord.js');
const fs = require('fs');
const googleTTS = require('google-tts-api');
const config = require('./config.json');

const client = new Discord.Client();

client.login(config.token);
const channelId = config.voiceChannelId;
const ttsChannelId = config.textChannelId;
const selectiveMode = true;

const users = {};

client.on('ready', async () => {
  const ttsChannel = await client.channels.get(ttsChannelId);
  setInterval(async ()=>{
    const messages = await ttsChannel.messages.fetch({limit:100});
    let date = (new Date()).getTime() - 5*60*1000;
    messages.each((m)=>{if (m.createdAt.getTime() < date) m.delete()});
  }, 1*60*1000);

  const voiceCh = await client.channels.get(channelId);
  const voice = await voiceCh.join();

  let pending = Promise.resolve();
  let lastUser = 0;
  let currentlySpeaking = [];
  let speakCbs = [];

  voice.on('speaking', (user, {bitfield})=>{
    if (!user) user = {};
    user.speaking = !!bitfield;
    let timeout = (new Date()).getTime() - 1*60*1000;

    currentlySpeaking = currentlySpeaking.filter(({id, lastSeen})=>id!==user.id || lastSeen < timeout);
    if (user.speaking) currentlySpeaking.push({id: user.id, lastSeen: new Date().getTime()});

    if (!currentlySpeaking.length && speakCbs.length) speakCbs.shift(1)();
  });

  client.on('message', async message => {
    if (!message.guild) return;
    //console.log(message);
    if (message.author.bot) return;
    if (message.channel.id != ttsChannelId) return;
    if (!message.content) return message.delete().catch(e=>{});
    if (selectiveMode && (!message.member || !message.member.voice.channel || message.member.voice.channel.id != channelId)) return message.delete().catch(e=>{});

    if (!users[message.author.id]) users[message.author.id] = {};

    const settings = users[message.author.id];
    if (message.content.startsWith('>_')) {
      const parts = message.content.split(' ');
      const cmd = parts[0]+'  ';
      lang = cmd[2] + cmd[3];
      users[message.author.id].lang = lang;
      message.reply('I\'ve set your language to '+lang);
      message.delete().catch(e=>{});
      return;
    }

    const emoteFilter = /<a?:(\w*):[0-9]*>/;
    while (emoteFilter.test(message.content)) {
      let emote = emoteFilter.exec(message.content);
      message.content = message.content.replace(emote[0], emote[1]);
    }

    const tagFilter = /<#([0-9]*)>/;
    while (tagFilter.test(message.content)) {
      let tag = tagFilter.exec(message.content);
      let channel = client.channels.get(tag[1]);
      message.content = message.content.replace(tag[0], '# '+channel.name);
    }

    const userFilter = /<@([0-9]*)>/;
    while (userFilter.test(message.content)) {
      let userId = userFilter.exec(message.content);
      let user = message.guild.members.get(userId[1]).user;
      message.content = message.content.replace(userId[0], '@ '+user.username);
    }

    const rolesFilter = /<@&([0-9]*)>/;
    while (rolesFilter.test(message.content)) {
      let roleId = rolesFilter.exec(message.content);
      let role = message.guild.roles.get(roleId[1]);
      message.content = message.content.replace(roleId[0], '@ '+role.name);
    }

    const text = `${message.author.username.replace(/([A-Z][a-z])/g,' $1').replace(/(\d)/g,' $1')} says: ${message.content}`;
    console.log(text);

    if (!settings.prefix) settings.prefix = await googleTTS(`${message.author.username.replace(/([A-Z][a-z])/g,' $1').replace(/(\d)/g,' $1')} says:`, 'en', 1);
    const url = await googleTTS(`${message.content}`, settings.lang||'en', 1);

    const oldpending = pending;
    pending = new Promise(async (res)=>{
      await oldpending;

      speakCbs.push(()=>{
        let say = settings.prefix;
        if (lastUser === message.author.id) {
          say = url;
        }
        const dispatcher1 = voice.play(say);

        dispatcher1.on('end', () => {
          //console.log('Finished playing!');
          dispatcher1.destroy();
          if (lastUser === message.author.id) return res();
          const dispatcher2 = voice.play(url);
          dispatcher2.on('end', ()=>{
            dispatcher2.destroy();
            res();
          })
        });
      });

      let timeout = (new Date()).getTime() - 1*60*1000;
      currentlySpeaking = currentlySpeaking.filter(({lastSeen})=>lastSeen < timeout);
      if (!currentlySpeaking.length) speakCbs.shift(1)();
    }).then(()=>{
      lastUser = message.author.id;
      message.react('✅').catch(e=>{});
      setTimeout(()=>message.delete().catch(e=>{}), 60*1000);
    });
  });
});

process
  .on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', reason.stack || reason);
    process.exit(1);
  }).on('uncaughtException', err => {
    console.error('Uncaught Exception:', err);
    process.exit(1);
  });