// store.js
// Shared in-memory file store (all Vercel functions in same process share this)
// For persistent storage, replace with Upstash Redis or MongoDB Atlas

const fileStore = global.__fileStore || (global.__fileStore = {});
const autoDeleteTimers = global.__autoDeleteTimers || (global.__autoDeleteTimers = {});

module.exports = { fileStore, autoDeleteTimers };
