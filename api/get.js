// api/get.js
// Serves the beautiful web download page for a file
const fs = require('fs');
const path = require('path');

module.exports = function handler(req, res) {
  const { id } = req.query;

  // Read the HTML template
  const htmlPath = path.join(process.cwd(), 'public', 'download.html');
  let html = fs.readFileSync(htmlPath, 'utf-8');

  // Inject the file ID if needed
  if (id) {
    html = html.replace('</head>', `<script>window.__FILE_ID__ = "${id}";</script></head>`);
  }

  res.setHeader('Content-Type', 'text/html');
  res.status(200).send(html);
}
