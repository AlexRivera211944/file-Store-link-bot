const TelegramBot = require('node-telegram-bot-api');
const { fileStore, autoDeleteTimers } = require('./store');

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = parseInt(process.env.ADMIN_ID);
const BOT_USERNAME = process.env.BOT_USERNAME;
const BASE_URL = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : process.env.BASE_URL || 'https://your-project.vercel.app';

const bot = new TelegramBot(BOT_TOKEN);

// ─── HELPERS ────────────────────────────────────────────────────────────────

function isAdmin(userId) { return userId === ADMIN_ID; }

function generateFileId() {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

function formatFileSize(bytes) {
  if (!bytes) return 'Unknown';
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
}

function formatDate(timestamp) {
  return new Date(timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
}

function getWebLink(fileId) {
  return `${BASE_URL}/api/get?id=${fileId}`;
}

function getTelegramLink(fileId) {
  return `https://t.me/${BOT_USERNAME}?start=get_${fileId}`;
}

function scheduleAutoDelete(fileId, seconds) {
  if (autoDeleteTimers[fileId]) clearTimeout(autoDeleteTimers[fileId]);
  autoDeleteTimers[fileId] = setTimeout(() => {
    if (fileStore[fileId]) {
      delete fileStore[fileId];
      delete autoDeleteTimers[fileId];
      bot.sendMessage(ADMIN_ID,
        `🗑️ *Auto-deleted*\nFile \`${fileId}\` has been removed.`,
        { parse_mode: 'Markdown' }
      );
    }
  }, seconds * 1000);
}

// ─── COMMANDS ────────────────────────────────────────────────────────────────

async function handleStart(msg) {
  const chatId = msg.chat.id;
  if (!isAdmin(msg.from.id)) {
    return bot.sendMessage(chatId, '⛔ Access Denied. This is a private bot.');
  }

  const welcome = `
🗂️ *File Store Bot — Admin Panel*

Welcome back, Admin! Here are all commands:

📤 *Upload* — Send any file, photo, video, or audio
📋 /list — All stored files
🔍 /search \`<n>\` — Search by filename
🔗 /links \`<fileId>\` — Get Web + Telegram links
🌐 /weblink \`<fileId>\` — Browser download link only
🔒 /private \`<fileId>\` — Toggle private/public
⏰ /autodelete \`<id> <seconds>\` — Set auto-delete
🗑️ /delete \`<fileId>\` — Delete a file
📊 /stats — Storage stats
❓ /help — This menu
  `;

  bot.sendMessage(chatId, welcome, { parse_mode: 'Markdown' });
}

async function handleHelp(msg) {
  if (!isAdmin(msg.from.id)) return bot.sendMessage(msg.chat.id, '⛔ Access Denied.');
  handleStart(msg);
}

async function handleList(msg) {
  const chatId = msg.chat.id;
  if (!isAdmin(msg.from.id)) return bot.sendMessage(chatId, '⛔ Access Denied.');

  const files = Object.values(fileStore);
  if (files.length === 0) {
    return bot.sendMessage(chatId, '📭 No files stored yet. Send me any file!');
  }

  let text = `📁 *Stored Files (${files.length})*\n\n`;
  files.forEach((f, i) => {
    const icon = { photo:'🖼️', video:'🎬', audio:'🎵', voice:'🎤' }[f.type] || '📄';
    const status = f.isPublic ? '🌐' : '🔒';
    text += `${i + 1}. ${icon} ${status} \`${f.fileId}\` — *${f.name}*\n`;
    text += `   💾 ${formatFileSize(f.size)} | 📅 ${formatDate(f.uploadedAt)}\n`;
    if (f.autoDeleteAt) text += `   ⏰ Expires: ${formatDate(f.autoDeleteAt)}\n`;
    text += '\n';
  });

  bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
}

async function handleSearch(msg, match) {
  const chatId = msg.chat.id;
  if (!isAdmin(msg.from.id)) return bot.sendMessage(chatId, '⛔ Access Denied.');

  const query = match[1]?.trim().toLowerCase();
  if (!query) return bot.sendMessage(chatId, '❗ Usage: /search <filename>');

  const results = Object.values(fileStore).filter(f =>
    f.name.toLowerCase().includes(query)
  );

  if (results.length === 0) {
    return bot.sendMessage(chatId, `🔍 No files found for: *${query}*`, { parse_mode: 'Markdown' });
  }

  let text = `🔍 *Results for "${query}"* (${results.length} found)\n\n`;
  results.forEach((f, i) => {
    text += `${i + 1}. *${f.name}*\n`;
    text += `   🆔 \`${f.fileId}\` | ${f.isPublic ? '🌐 Public' : '🔒 Private'} | 💾 ${formatFileSize(f.size)}\n\n`;
  });

  bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
}

// /links - show BOTH web link and telegram link
async function handleLinks(msg, match) {
  const chatId = msg.chat.id;
  if (!isAdmin(msg.from.id)) return bot.sendMessage(chatId, '⛔ Access Denied.');

  const fileId = match[1]?.trim().toUpperCase();
  if (!fileId) return bot.sendMessage(chatId, '❗ Usage: /links <fileId>');

  const file = fileStore[fileId];
  if (!file) return bot.sendMessage(chatId, `❌ File \`${fileId}\` not found.`, { parse_mode: 'Markdown' });

  const status = file.isPublic ? '🌐 Public' : '🔒 Private';
  const webLink = getWebLink(fileId);
  const tgLink = getTelegramLink(fileId);

  bot.sendMessage(chatId,
    `🔗 *Share Links*\n\n` +
    `📄 *${file.name}*\n` +
    `Status: ${status}\n\n` +
    `🌐 *Web Download Link:*\n\`${webLink}\`\n\n` +
    `✈️ *Telegram Link:*\n\`${tgLink}\`\n\n` +
    `${!file.isPublic ? '⚠️ Run /private ' + fileId + ' to enable web access.' : '✅ Ready to share!'}`,
    { parse_mode: 'Markdown' }
  );
}

// /weblink - just web download link
async function handleWebLink(msg, match) {
  const chatId = msg.chat.id;
  if (!isAdmin(msg.from.id)) return bot.sendMessage(chatId, '⛔ Access Denied.');

  const fileId = match[1]?.trim().toUpperCase();
  if (!fileId) return bot.sendMessage(chatId, '❗ Usage: /weblink <fileId>');

  const file = fileStore[fileId];
  if (!file) return bot.sendMessage(chatId, `❌ File \`${fileId}\` not found.`, { parse_mode: 'Markdown' });

  if (!file.isPublic) {
    return bot.sendMessage(chatId,
      `🔒 File is *Private*\n\nUse /private \`${fileId}\` to make it public first.`,
      { parse_mode: 'Markdown' }
    );
  }

  bot.sendMessage(chatId,
    `🌐 *Browser Download Link:*\n\n\`${getWebLink(fileId)}\`\n\n` +
    `📄 *${file.name}* | 💾 ${formatFileSize(file.size)}\n\n` +
    `✅ Anyone with this link can download from browser!`,
    { parse_mode: 'Markdown' }
  );
}

async function handlePrivate(msg, match) {
  const chatId = msg.chat.id;
  if (!isAdmin(msg.from.id)) return bot.sendMessage(chatId, '⛔ Access Denied.');

  const fileId = match[1]?.trim().toUpperCase();
  if (!fileId) return bot.sendMessage(chatId, '❗ Usage: /private <fileId>');

  const file = fileStore[fileId];
  if (!file) return bot.sendMessage(chatId, `❌ File \`${fileId}\` not found.`, { parse_mode: 'Markdown' });

  file.isPublic = !file.isPublic;
  const newStatus = file.isPublic ? '🌐 Public' : '🔒 Private';

  let extra = '';
  if (file.isPublic) {
    extra = `\n\n🌐 *Web Link (share this):*\n\`${getWebLink(fileId)}\``;
  }

  bot.sendMessage(chatId,
    `✅ *${file.name}*\nStatus changed to: ${newStatus}${extra}`,
    { parse_mode: 'Markdown' }
  );
}

async function handleAutoDelete(msg, match) {
  const chatId = msg.chat.id;
  if (!isAdmin(msg.from.id)) return bot.sendMessage(chatId, '⛔ Access Denied.');

  const parts = match[1]?.trim().split(' ');
  if (!parts || parts.length < 2) {
    return bot.sendMessage(chatId, '❗ Usage: /autodelete <fileId> <seconds>\nExample: /autodelete ABC123 3600');
  }

  const fileId = parts[0].toUpperCase();
  const seconds = parseInt(parts[1]);

  if (isNaN(seconds) || seconds < 1) {
    return bot.sendMessage(chatId, '❗ Please provide valid seconds (minimum 1)');
  }

  const file = fileStore[fileId];
  if (!file) return bot.sendMessage(chatId, `❌ File \`${fileId}\` not found.`, { parse_mode: 'Markdown' });

  file.autoDeleteAt = Date.now() + seconds * 1000;
  scheduleAutoDelete(fileId, seconds);

  const timeText = seconds >= 3600
    ? `${(seconds / 3600).toFixed(1)} hours`
    : seconds >= 60 ? `${Math.floor(seconds / 60)} minutes`
    : `${seconds} seconds`;

  bot.sendMessage(chatId,
    `⏰ *Auto-delete set!*\n\n📄 *${file.name}*\nExpires in: *${timeText}*\nAt: ${formatDate(file.autoDeleteAt)}`,
    { parse_mode: 'Markdown' }
  );
}

async function handleDelete(msg, match) {
  const chatId = msg.chat.id;
  if (!isAdmin(msg.from.id)) return bot.sendMessage(chatId, '⛔ Access Denied.');

  const fileId = match[1]?.trim().toUpperCase();
  if (!fileId) return bot.sendMessage(chatId, '❗ Usage: /delete <fileId>');

  const file = fileStore[fileId];
  if (!file) return bot.sendMessage(chatId, `❌ File \`${fileId}\` not found.`, { parse_mode: 'Markdown' });

  const name = file.name;
  delete fileStore[fileId];
  if (autoDeleteTimers[fileId]) {
    clearTimeout(autoDeleteTimers[fileId]);
    delete autoDeleteTimers[fileId];
  }

  bot.sendMessage(chatId, `🗑️ Deleted: *${name}* (\`${fileId}\`)`, { parse_mode: 'Markdown' });
}

async function handleStats(msg) {
  const chatId = msg.chat.id;
  if (!isAdmin(msg.from.id)) return bot.sendMessage(chatId, '⛔ Access Denied.');

  const files = Object.values(fileStore);
  const totalSize = files.reduce((acc, f) => acc + (f.size || 0), 0);
  const publicFiles = files.filter(f => f.isPublic).length;
  const privateFiles = files.filter(f => !f.isPublic).length;
  const byType = files.reduce((acc, f) => { acc[f.type] = (acc[f.type]||0)+1; return acc; }, {});

  let text = `📊 *Storage Statistics*\n\n`;
  text += `📁 Total: *${files.length}* files\n`;
  text += `💾 Size: *${formatFileSize(totalSize)}*\n`;
  text += `🌐 Public: *${publicFiles}* | 🔒 Private: *${privateFiles}*\n\n`;
  text += `*By Type:*\n`;
  if (byType.document) text += `  📄 Documents: ${byType.document}\n`;
  if (byType.photo)    text += `  🖼️ Photos: ${byType.photo}\n`;
  if (byType.video)    text += `  🎬 Videos: ${byType.video}\n`;
  if (byType.audio)    text += `  🎵 Audio: ${byType.audio}\n`;
  if (byType.voice)    text += `  🎤 Voice: ${byType.voice}\n`;

  bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
}

async function handleFile(msg) {
  const chatId = msg.chat.id;
  if (!isAdmin(msg.from.id)) return bot.sendMessage(chatId, '⛔ Access Denied.');

  let fileData, fileType, fileName, fileSize;

  if (msg.document) {
    fileData = msg.document; fileType = 'document';
    fileName = fileData.file_name || 'Document'; fileSize = fileData.file_size;
  } else if (msg.photo) {
    fileData = msg.photo[msg.photo.length - 1]; fileType = 'photo';
    fileName = `Photo_${Date.now()}.jpg`; fileSize = fileData.file_size;
  } else if (msg.video) {
    fileData = msg.video; fileType = 'video';
    fileName = fileData.file_name || `Video_${Date.now()}.mp4`; fileSize = fileData.file_size;
  } else if (msg.audio) {
    fileData = msg.audio; fileType = 'audio';
    fileName = fileData.file_name || fileData.title || `Audio_${Date.now()}.mp3`; fileSize = fileData.file_size;
  } else if (msg.voice) {
    fileData = msg.voice; fileType = 'voice';
    fileName = `Voice_${Date.now()}.ogg`; fileSize = fileData.file_size;
  } else return;

  const fileId = generateFileId();
  fileStore[fileId] = {
    fileId,
    telegramFileId: fileData.file_id,
    name: fileName,
    size: fileSize,
    type: fileType,
    isPublic: false,
    uploadedAt: Date.now(),
    autoDeleteAt: null,
    uploadedBy: msg.from.id
  };

  const tgLink = getTelegramLink(fileId);
  const webLink = getWebLink(fileId);

  bot.sendMessage(chatId,
    `✅ *File Stored!*\n\n` +
    `📄 *${fileName}*\n` +
    `🆔 \`${fileId}\` | 💾 ${formatFileSize(fileSize)}\n` +
    `🔒 Status: Private\n\n` +
    `✈️ *Telegram Link:*\n\`${tgLink}\`\n\n` +
    `🌐 *Web Download Link* _(make public first)_:\n\`${webLink}\`\n\n` +
    `💡 Quick Actions:\n` +
    `• /private \`${fileId}\` — Make public (enables web link)\n` +
    `• /links \`${fileId}\` — Get all share links\n` +
    `• /autodelete \`${fileId} 3600\` — Delete in 1hr`,
    { parse_mode: 'Markdown' }
  );
}

async function handleGetFile(msg, fileId) {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  const file = fileStore[fileId];
  if (!file) return bot.sendMessage(chatId, '❌ File not found or deleted.');

  if (!file.isPublic && !isAdmin(userId)) {
    return bot.sendMessage(chatId, '🔒 This file is private. Ask admin to share it.');
  }

  const caption = `📄 *${file.name}*\n💾 ${formatFileSize(file.size)}\n📅 ${formatDate(file.uploadedAt)}`;

  try {
    if (file.type === 'document') await bot.sendDocument(chatId, file.telegramFileId, { caption, parse_mode: 'Markdown' });
    else if (file.type === 'photo') await bot.sendPhoto(chatId, file.telegramFileId, { caption, parse_mode: 'Markdown' });
    else if (file.type === 'video') await bot.sendVideo(chatId, file.telegramFileId, { caption, parse_mode: 'Markdown' });
    else if (file.type === 'audio') await bot.sendAudio(chatId, file.telegramFileId, { caption, parse_mode: 'Markdown' });
    else if (file.type === 'voice') await bot.sendVoice(chatId, file.telegramFileId, { caption, parse_mode: 'Markdown' });
  } catch (e) {
    bot.sendMessage(chatId, '❌ Could not send file. It may have expired.');
  }
}

// ─── MAIN ROUTER ─────────────────────────────────────────────────────────────

async function handleUpdate(update) {
  const msg = update.message || update.edited_message;
  if (!msg) return;

  const text = msg.text || '';

  if (text.startsWith('/start get_')) {
    const fileId = text.replace('/start get_', '').trim().toUpperCase();
    return handleGetFile(msg, fileId);
  }

  if (text === '/start') return handleStart(msg);
  if (text === '/help')  return handleHelp(msg);
  if (text === '/list')  return handleList(msg);
  if (text === '/stats') return handleStats(msg);

  const m = (p) => text.match(p);

  if (m(/^\/search (.+)/))     return handleSearch(msg, m(/^\/search (.+)/));
  if (m(/^\/links (.+)/))      return handleLinks(msg, m(/^\/links (.+)/));
  if (m(/^\/weblink (.+)/))    return handleWebLink(msg, m(/^\/weblink (.+)/));
  if (m(/^\/private (.+)/))    return handlePrivate(msg, m(/^\/private (.+)/));
  if (m(/^\/autodelete (.+)/)) return handleAutoDelete(msg, m(/^\/autodelete (.+)/));
  if (m(/^\/delete (.+)/))     return handleDelete(msg, m(/^\/delete (.+)/));

  if (msg.document || msg.photo || msg.video || msg.audio || msg.voice) {
    return handleFile(msg);
  }
}

module.exports = { handleUpdate, bot };
