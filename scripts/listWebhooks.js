const { listWebhooks } = require('../services/shopifyService');

(async () => {
  try {
    const webhooks = await listWebhooks();
    console.log(`Found ${webhooks.length} webhook(s):`);
    console.log(JSON.stringify(webhooks, null, 2));
    process.exit(0);
  } catch (err) {
    console.error('❌ Failed to list webhooks:', err.response?.data || err.message);
    process.exit(1);
  }
})();
