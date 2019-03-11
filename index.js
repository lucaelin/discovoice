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

const filters = {
  emoteFilter: {
    regex: /<a?:(\w*):[0-9]*>/,
    run: (message, tag) => {
      return message.content.replace(tag[0], tag[1]);
    },
  },
  tagFilter: {
    regex: /<#([0-9]*)>/,
    run: (message, tag) => {
      let channel = client.channels.get(tag[1]);
      return message.content.replace(tag[0], '# '+channel.name);
    }
  },
  userFilter: {
    regex: /<@!?([0-9]*)>/,
    run: (message, tag) => {
      let user = message.guild.members.get(tag[1]).user;
      return message.content.replace(tag[0], '@ '+user.username);
    }
  },
  rolesFilter: {
    regex: /<@&([0-9]*)>/,
    run: (message, tag) => {
      let role = message.guild.roles.get(tag[1]);
      return message.content.replace(tag[0], '@ '+role.name);
    }
  },
  linkFilter: {
    regex: /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)/,
    run: (message, tag) => {
      return message.content.replace(/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)/, 'url');
    }
  },
  blockqoteCodeFilter: {
    regex: /`{3}((?!`{3}).)+`{3}/,
    run: (message, tag) => {
      return message.content.replace(/`{3}((?!`{3}).)+`{3}/, 'code');
    }
  },
  CodeFilter: {
    regex: /`((?!`).)+`/,
    run: (message, tag) => {
      return message.content.replace(/`((?!`).)+`/, 'code');
    }
  }
}

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
  let currentlySpeaking = {};
  let speakCbs = [];

  const processCurrentlySpeaking = () => {
    let timeout = (new Date()).getTime() - 1*60*1000;
    for (const id of Object.keys(currentlySpeaking)) {
      if (currentlySpeaking[id].lastSeen < timeout) delete currentlySpeaking[id];
    }
    if (!Object.keys(currentlySpeaking).length && speakCbs.length) speakCbs.shift(1)();
  }


  voice.on('speaking', (user, {bitfield})=>{
    if (!user) user = {};
    user.speaking = !!bitfield;
    let timeout = (new Date()).getTime() - 1*60*1000;

    currentlySpeaking[user.id] = {
      lastSeen: new Date().getTime(),
    };

    if(!user.speaking) delete currentlySpeaking[user.id];

    processCurrentlySpeaking();
  });

  const playVoice = clip => {
    const dispatcher = voice.play(clip);
    return new Promise((res, rej) => {
      dispatcher.on('end', () => {
        dispatcher.destroy();
        return res();
      });
    });
  }

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
      if (parts[0] === '>_ignore') {
        if (!parts[1]) return;
        const [, id] = filters.userFilter.regex.exec(parts[1]) || [];
        if (id) {
          delete currentlySpeaking[id];
          message.reply('I\'m going to ignore '+parts[1]);
          processCurrentlySpeaking();
        }
        message.delete().catch(e=>{});
      } else {
        const cmd = parts[0]+'  ';
        lang = cmd[2] + cmd[3];
        users[message.author.id].lang = lang;
        message.reply('I\'ve set your language to '+lang);
        message.delete().catch(e=>{});

      }
      return;
    }

    for (const filter of Object.values(filters)) {
      while (filter.regex.test(message.content)) {
        message.content = filter.run(message, filter.regex.exec(message.content));
      }
    }

    const text = `${message.author.username.replace(/([A-Z][a-z])/g,' $1').replace(/(\d)/g,' $1')} says: ${message.content}`;
    console.log(text);

    if (!settings.prefix) settings.prefix = await googleTTS(`${message.author.username.replace(/([A-Z][a-z])/g,' $1').replace(/(\d)/g,' $1')} says:`, 'en', 1);
    const url = await googleTTS(`${message.content}`, settings.lang||'en', 1);

    const oldpending = pending;
    pending = new Promise(async (res)=>{
      await oldpending;

      speakCbs.push(async ()=>{
        let say = settings.prefix;
        if (lastUser === message.author.id) {
          say = url;
        }
        await playVoice(say);
        if (lastUser === message.author.id) return res();
        await playVoice(url);
        res();
      });

      processCurrentlySpeaking();
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
