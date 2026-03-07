// backend/utils/deviceFingerprint.js
const crypto = require('crypto');

exports.generateFingerprint = (deviceInfo) => {
  const data = JSON.stringify({
    userAgent: deviceInfo?.userAgent || '',
    platform: deviceInfo?.platform || '',
    language: deviceInfo?.language || '',
    timezone: deviceInfo?.timezone || '',
  });
  return crypto.createHash('sha256').update(data).digest('hex');
};
