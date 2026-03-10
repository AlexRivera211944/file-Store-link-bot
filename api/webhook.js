const { handleUpdate } = require('../bot');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).json({ status: 'Bot is running! 🤖' });
  }

  try {
    await handleUpdate(req.body);
    res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Error handling update:', error);
    res.status(200).json({ ok: false, error: error.message });
  }
                       }
