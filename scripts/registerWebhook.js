const { registerOrderWebhook } = require('../services/shopifyService');

(async () => {
  try {
    console.log('Checking existing webhooks...');
    const result = await registerOrderWebhook();
    console.log(result.created ? '✅ Webhook registered successfully:' : 'ℹ️  Webhook already exists:');
    console.log(JSON.stringify(result.webhook, null, 2));
    process.exit(0);
  } catch (err) {
    console.error('❌ Failed to register webhook:', err.response?.data || err.message);
    process.exit(1);
  }
})();
