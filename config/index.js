require('dotenv').config();

function warnIfMissing(name, value) {
  if (!value) {
    console.warn(`[config] Warning: ${name} is not set in your .env file.`);
  }
  return value;
}

// Trims hidden whitespace/CR characters that can sneak in when .env files
// are edited through web-based file managers or saved with Windows line
// endings. A single trailing space or \r on a secret/token silently
// breaks HMAC verification and Admin API auth with no obvious error.
function clean(value) {
  return typeof value === 'string' ? value.trim() : value;
}

const config = {
  // Shopify credentials
  apiKey: clean(warnIfMissing('SHOPIFY_API_KEY', process.env.SHOPIFY_API_KEY)),
  // SHOPIFY_WEBHOOK_SECRET is accepted as a fallback name — some Shopify
  // screens (Settings > Notifications) call this value a "webhook secret"
  // rather than "API secret," which causes people to add it under that
  // name by mistake. Both env var names are honored here.
  apiSecret: clean(
    warnIfMissing(
      'SHOPIFY_API_SECRET',
      process.env.SHOPIFY_API_SECRET || process.env.SHOPIFY_WEBHOOK_SECRET
    )
  ),
  accessToken: clean(warnIfMissing('SHOPIFY_ACCESS_TOKEN', process.env.SHOPIFY_ACCESS_TOKEN)),
  shopDomain: clean(warnIfMissing('SHOPIFY_SHOP_DOMAIN', process.env.SHOPIFY_SHOP_DOMAIN)),
  apiVersion: process.env.SHOPIFY_API_VERSION || '2026-04',

  // Tag matching
  hyperlocalTags: (process.env.HYPERLOCAL_TAGS || 'hyperlocal')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean),

  // App / webhook
  port: parseInt(process.env.PORT, 10) || 3000,
  appBaseUrl: (process.env.APP_BASE_URL || '').trim().replace(/\/+$/, ''),
  webhookTopic: process.env.WEBHOOK_TOPIC || 'orders/create',
  autoRegisterWebhook: process.env.AUTO_REGISTER_WEBHOOK !== 'false',

  // SMTP / email
  smtp: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  notify: {
    from: process.env.NOTIFY_EMAIL_FROM || process.env.SMTP_USER,
    to: process.env.NOTIFY_EMAIL_TO,
  },
};

module.exports = config;
