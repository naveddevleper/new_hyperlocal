const express = require('express');
const config = require('./config');
const { verifyShopifyWebhook } = require('./utils/verifyWebhook');
const { getMatchedTags } = require('./utils/tagMatcher');
const { sendHyperlocalOrderEmail, verifyEmailConnection } = require('./services/emailService');
const { registerOrderWebhook } = require('./services/shopifyService');

const app = express();

// Keeps the last 20 webhook attempts in memory so you can check what
// happened even on hosts where you can't easily tail console logs.
// Visit GET /debug/recent in a browser to view it.
const recentActivity = [];
function logActivity(entry) {
  recentActivity.unshift({ time: new Date().toISOString(), ...entry });
  if (recentActivity.length > 20) recentActivity.pop();
}

// Simple status page — useful to confirm the app is alive and to see
// which tags it is currently watching for.
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    app: 'shopify-hyperlocal-notifier',
    shop: config.shopDomain || null,
    watchingTags: config.hyperlocalTags,
    webhookTopic: config.webhookTopic,
  });
});

app.get('/health', (req, res) => res.status(200).send('OK'));

// Debug view — shows the last 20 webhook hits this app received, with
// whether HMAC passed, whether tags matched, and whether email was sent.
// Useful for diagnosing on shared hosting without console log access.
app.get('/debug/recent', (req, res) => {
  res.json({ count: recentActivity.length, recentActivity });
});

// Debug view — NEVER exposes the actual secret, but confirms how it was
// loaded so you can catch hidden whitespace/newline issues from editing
// .env via a web file manager (a very common cause of HMAC mismatches).
app.get('/debug/secret-check', (req, res) => {
  const raw = config.apiSecret || '';
  res.json({
    secretIsSet: !!raw,
    secretLength: raw.length,
    startsWithWhitespace: /^\s/.test(raw),
    endsWithWhitespace: /\s$/.test(raw),
    containsCarriageReturn: raw.includes('\r'),
    containsNewline: raw.includes('\n'),
    firstTwoChars: raw.slice(0, 2),
    lastTwoChars: raw.slice(-2),
  });
});

/**
 * Shopify order webhook endpoint.
 *
 * Uses express.raw() (NOT express.json()) so we keep the exact original
 * bytes Shopify sent — required for HMAC verification to succeed.
 */
app.post(
  '/webhooks/orders-create',
  express.raw({ type: '*/*', limit: '5mb' }),
  async (req, res) => {
    const hmacHeader = req.get('X-Shopify-Hmac-Sha256');
    const rawBody = req.body; // Buffer, thanks to express.raw()
    const topic = req.get('X-Shopify-Topic') || 'unknown';
    const shopHeader = req.get('X-Shopify-Shop-Domain') || 'unknown';

    // Log immediately, before any verification, so we know Shopify (or
    // anything else) actually reached this server at all.
    const bodyPreview = rawBody ? rawBody.toString('utf8').slice(0, 30) : '';
    const bodyTail = rawBody ? rawBody.toString('utf8').slice(-30) : '';
    console.log(
      `[webhook] Incoming request — topic=${topic} shop=${shopHeader} hasHmac=${!!hmacHeader} bodyBytes=${rawBody ? rawBody.length : 0}`
    );
    console.log(`[webhook] Body starts: "${bodyPreview}" | ends: "${bodyTail}"`);

    const isValid = verifyShopifyWebhook(rawBody, hmacHeader, config.apiSecret);
    if (!isValid) {
      console.warn('[webhook] Rejected request with invalid HMAC signature.');
      logActivity({
        topic,
        shopHeader,
        hmacValid: false,
        note: 'Invalid HMAC signature',
        bodyBytes: rawBody ? rawBody.length : 0,
        bodyStarts: bodyPreview,
        bodyEnds: bodyTail,
      });
      return res.status(401).send('Invalid signature');
    }

    // Acknowledge immediately. Shopify expects a fast 200 response and
    // will retry (creating duplicate emails) if we take too long.
    res.status(200).send('OK');

    let order;
    try {
      order = JSON.parse(rawBody.toString('utf8'));
    } catch (err) {
      console.error('[webhook] Could not parse order JSON:', err.message);
      logActivity({ topic, hmacValid: true, note: `JSON parse failed: ${err.message}` });
      return;
    }

    try {
      const matchedTags = getMatchedTags(order, config.hyperlocalTags);
      const orderLabel = order.name || `#${order.order_number || order.id}`;
      const orderTags = order.tags || '';

      if (matchedTags.length > 0) {
        console.log(`[webhook] Hyperlocal order ${orderLabel} detected (tags: ${matchedTags.join(', ')}).`);
        try {
          await sendHyperlocalOrderEmail(order, matchedTags);
          console.log(`[email] Notification sent for order ${orderLabel}.`);
          logActivity({
            topic,
            hmacValid: true,
            order: orderLabel,
            orderTags,
            matchedTags,
            emailSent: true,
          });
        } catch (emailErr) {
          console.error(`[email] FAILED to send for order ${orderLabel}:`, emailErr.message);
          logActivity({
            topic,
            hmacValid: true,
            order: orderLabel,
            orderTags,
            matchedTags,
            emailSent: false,
            emailError: emailErr.message,
          });
        }
      } else {
        console.log(`[webhook] Order ${orderLabel} is not hyperlocal. Skipped. (tags: "${orderTags}")`);
        logActivity({
          topic,
          hmacValid: true,
          order: orderLabel,
          orderTags,
          matchedTags: [],
          emailSent: false,
          note: 'No matching hyperlocal tag',
        });
      }
    } catch (err) {
      console.error('[webhook] Error while processing order:', err.message);
      logActivity({ topic, hmacValid: true, note: `Processing error: ${err.message}` });
    }
  }
);

app.listen(config.port, async () => {
  console.log(`Shopify Hyperlocal Notifier listening on port ${config.port}`);

  await verifyEmailConnection();

  if (config.autoRegisterWebhook) {
    try {
      const result = await registerOrderWebhook();
      console.log(`[webhook] ${result.message}`);
    } catch (err) {
      console.error(
        '[webhook] Auto-registration failed:',
        err.response?.data || err.message
      );
      console.error(
        '[webhook] Fix the issue above, then run "npm run setup-webhook" manually, or restart the app.'
      );
    }
  } else {
    console.log('[webhook] AUTO_REGISTER_WEBHOOK is false — run "npm run setup-webhook" manually.');
  }
});
