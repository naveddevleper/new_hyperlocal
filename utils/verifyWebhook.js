const crypto = require('crypto');

const generatedHash = crypto
  .createHmac('sha256', config.apiSecret)
  .update(rawBody)
  .digest('base64');

console.log("========== DEBUG ==========");
console.log("Secret:", config.apiSecret);
console.log("Header HMAC:", hmacHeader);
console.log("Generated HMAC:", generatedHash);
console.log("Equal:", generatedHash === hmacHeader);
console.log("Body Length:", rawBody.length);
console.log("Is Buffer:", Buffer.isBuffer(rawBody));
console.log("==========================");

const isValid = verifyShopifyWebhook(
  rawBody,
  hmacHeader,
  config.apiSecret
);