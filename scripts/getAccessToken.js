/**
 * Since January 1, 2026 new custom apps are created from Shopify's
 * Dev Dashboard instead of the Shopify admin, and some setups only hand
 * you a Client ID + Client Secret rather than a ready-made access token.
 *
 * This script performs the one-time "client_credentials" token exchange
 * to turn those into an Admin API access token.
 *
 * If your app already gave you a token directly (the one-time "reveal"
 * token shown after install), you DON'T need this script — just put that
 * token straight into SHOPIFY_ACCESS_TOKEN in your .env file.
 *
 * Usage: npm run get-token
 */
const axios = require('axios');
const config = require('../config');

(async () => {
  if (!config.shopDomain || !config.apiKey || !config.apiSecret) {
    console.error(
      '❌ SHOPIFY_SHOP_DOMAIN, SHOPIFY_API_KEY and SHOPIFY_API_SECRET must all be set in .env first.'
    );
    process.exit(1);
  }

  const url = `https://${config.shopDomain}/admin/oauth/access_token`;

  try {
    const res = await axios.post(url, {
      grant_type: 'client_credentials',
      client_id: config.apiKey,
      client_secret: config.apiSecret,
    });

    console.log('✅ Access token generated successfully:\n');
    console.log(JSON.stringify(res.data, null, 2));
    console.log(
      '\nCopy the "access_token" value above into SHOPIFY_ACCESS_TOKEN in your .env file, then run "npm start".'
    );
    process.exit(0);
  } catch (err) {
    console.error('❌ Failed to generate access token:', err.response?.data || err.message);
    console.error(
      '\nIf this fails, your app may need the standard OAuth authorization-code flow ' +
        'instead of client_credentials — this depends on how your app was configured ' +
        'in the Dev Dashboard. See the "Getting your credentials" section of README.md.'
    );
    process.exit(1);
  }
})();
