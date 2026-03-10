// api/download.js
// Proxies file download from Telegram servers to the browser
const https = require('https');
const { fileStore } = require('../store');

export default async function handler(req, res) {
  const { id } = req.query;

  if (!id) {
    return res.status(400).send('File ID required');
  }

  const file = fileStore[id.toUpperCase()];

  if (!file) {
    return res.status(404).send('File not found or deleted.');
  }

  if (!file.isPublic) {
    return res.status(403).send('This file is private.');
  }

  try {
    // Step 1: Get file path from Telegram
    const BOT_TOKEN = process.env.BOT_TOKEN;
    const fileInfoUrl = `https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${file.telegramFileId}`;

    const telegramFileInfo = await fetchJson(fileInfoUrl);

    if (!telegramFileInfo.ok) {
      return res.status(500).send('Could not get file from Telegram.');
    }

    const filePath = telegramFileInfo.result.file_path;
    const downloadUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`;

    // Step 2: Stream file to browser
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.name)}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    if (file.size) res.setHeader('Content-Length', file.size);

    https.get(downloadUrl, (fileRes) => {
      fileRes.pipe(res);
    }).on('error', (err) => {
      console.error('Download error:', err);
      res.status(500).send('Download failed.');
    });

  } catch (err) {
    console.error('Handler error:', err);
    res.status(500).send('Internal server error.');
  }
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}
