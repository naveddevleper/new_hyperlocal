const axios = require('axios');
const config = require('../config');

const adminApi = axios.create({
  baseURL: `https://${config.shopDomain}/admin/api/${config.apiVersion}`,
  headers: {
    'X-Shopify-Access-Token': config.accessToken,
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

/**
 * Lists every webhook currently registered for this app/store.
 */
async function listWebhooks() {
  const res = await adminApi.get('/webhooks.json');
  return res.data.webhooks || [];
}

/**
 * Registers the order webhook this app needs, pointing at
 * `${APP_BASE_URL}/webhooks/orders-create`.
 *
 * Safe to call repeatedly — it first checks for an existing webhook with
 * the same topic + address and skips creation if one is already there,
 * so it will never create duplicates.
 */
async function registerOrderWebhook() {
  if (!config.appBaseUrl) {
    throw new Error(
      'APP_BASE_URL is not set in your .env file. It must be a public HTTPS URL ' +
        'where this app is reachable (use ngrok for local testing).'
    );
  }

  const address = `${config.appBaseUrl}/webhooks/orders-create`;
  const existing = await listWebhooks();

  const already = existing.find(
    (w) => w.topic === config.webhookTopic && w.address === address
  );

  if (already) {
    return {
      created: false,
      webhook: already,
      message: `Webhook already registered for ${config.webhookTopic} -> ${address}`,
    };
  }

  const res = await adminApi.post('/webhooks.json', {
    webhook: {
      topic: config.webhookTopic,
      address,
      format: 'json',
    },
  });

  return {
    created: true,
    webhook: res.data.webhook,
    message: `Webhook registered for ${config.webhookTopic} -> ${address}`,
  };
}

/**
 * Removes every webhook this app previously registered at the current
 * APP_BASE_URL. Handy when moving to a new domain/ngrok URL.
 */
async function deleteOwnWebhooks() {
  const address = `${config.appBaseUrl}/webhooks/orders-create`;
  const existing = await listWebhooks();
  const mine = existing.filter((w) => w.address === address);

  for (const webhook of mine) {
    await adminApi.delete(`/webhooks/${webhook.id}.json`);
  }

  return mine;
}

module.exports = { adminApi, listWebhooks, registerOrderWebhook, deleteOwnWebhooks };
