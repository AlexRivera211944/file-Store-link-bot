// api/file-info.js
// Returns file metadata for the web download page
const { fileStore } = require('../store');

export default function handler(req, res) {
  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ ok: false, error: 'File ID required' });
  }

  const file = fileStore[id.toUpperCase()];

  if (!file) {
    return res.status(404).json({ ok: false, error: 'File not found or has been deleted.' });
  }

  if (!file.isPublic) {
    return res.status(403).json({ ok: false, error: 'This file is private. Ask the admin for access.' });
  }

  // Return safe metadata only (not internal telegram IDs)
  return res.status(200).json({
    ok: true,
    file: {
      fileId: file.fileId,
      name: file.name,
      size: file.size,
      type: file.type,
      isPublic: file.isPublic,
      uploadedAt: file.uploadedAt,
      autoDeleteAt: file.autoDeleteAt || null,
      botUsername: process.env.BOT_USERNAME
    }
  });
}
