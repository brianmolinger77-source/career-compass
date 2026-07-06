const ErrorLog = require('../models/ErrorLog');

async function logError(route, method, err, menteeId) {
  try {
    await ErrorLog.create({
      route,
      method,
      errorMessage: err.message || String(err),
      stackExcerpt: err.stack ? err.stack.split('\n').slice(0, 5).join('\n') : '',
      menteeId: menteeId || '',
      createdAt: new Date()
    });
  } catch (logErr) {
    console.error('Error log write failed:', logErr);
  }
}

module.exports = { logError };
