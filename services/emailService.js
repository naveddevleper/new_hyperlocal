const nodemailer = require('nodemailer');
const config = require('../config');

const transporter = nodemailer.createTransport({
  host: config.smtp.host,
  port: config.smtp.port,
  secure: config.smtp.secure, // true for port 465, false for 587/25
  auth: {
    user: config.smtp.user,
    pass: config.smtp.pass,
  },
});

/**
 * Checks the SMTP connection on startup so problems show up immediately
 * in the logs instead of silently failing on the first real order.
 */
async function verifyEmailConnection() {
  try {
    await transporter.verify();
    console.log('[email] SMTP connection verified successfully.');
    return true;
  } catch (err) {
    console.error('[email] SMTP verification failed:', err.message);
    console.error('[email] Check SMTP_HOST, SMTP_PORT, SMTP_USER and SMTP_PASS in your .env file.');
    return false;
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildItemsTable(lineItems) {
  if (!Array.isArray(lineItems) || lineItems.length === 0) {
    return '<tr><td colspan="3" style="padding:8px;border:1px solid #ddd;">No line items</td></tr>';
  }

  return lineItems
    .map(
      (item) => `
        <tr>
          <td style="padding:8px;border:1px solid #ddd;">${escapeHtml(item.title)}</td>
          <td style="padding:8px;border:1px solid #ddd;text-align:center;">${escapeHtml(item.quantity)}</td>
          <td style="padding:8px;border:1px solid #ddd;text-align:right;">${escapeHtml(item.price)}</td>
        </tr>`
    )
    .join('');
}

function formatOrderEmail(order, matchedTags) {
  const customerName = order.customer
    ? `${order.customer.first_name || ''} ${order.customer.last_name || ''}`.trim() || 'Guest'
    : 'Guest';

  const shipping = order.shipping_address || {};
  const orderLabel = order.name || `#${order.order_number || order.id}`;
  const adminOrderUrl = `https://${config.shopDomain}/admin/orders/${order.id}`;

  const subject = `New Hyperlocal Order ${orderLabel} - Action Needed`;

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:620px;margin:0 auto;color:#222;">
      <h2 style="color:#1a73e8;margin-bottom:4px;">New Hyperlocal Order Received</h2>
      <p style="margin-top:0;">Order <strong>${escapeHtml(orderLabel)}</strong> was just placed and matched your hyperlocal tag rule.</p>
      <p><strong>Matched tag(s):</strong> ${escapeHtml(matchedTags.join(', '))}</p>

      <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">
        <tr style="background:#f7f7f7;">
          <td style="padding:8px;border:1px solid #ddd;width:35%;"><strong>Customer</strong></td>
          <td style="padding:8px;border:1px solid #ddd;">${escapeHtml(customerName)} (${escapeHtml(order.email || 'no email')})</td>
        </tr>
        <tr>
          <td style="padding:8px;border:1px solid #ddd;"><strong>Phone</strong></td>
          <td style="padding:8px;border:1px solid #ddd;">${escapeHtml(order.phone || shipping.phone || 'N/A')}</td>
        </tr>
        <tr style="background:#f7f7f7;">
          <td style="padding:8px;border:1px solid #ddd;"><strong>Shipping Address</strong></td>
          <td style="padding:8px;border:1px solid #ddd;">
            ${escapeHtml(shipping.address1 || '')} ${escapeHtml(shipping.address2 || '')}<br/>
            ${escapeHtml(shipping.city || '')}, ${escapeHtml(shipping.province || '')} ${escapeHtml(shipping.zip || '')}<br/>
            ${escapeHtml(shipping.country || '')}
          </td>
        </tr>
        <tr>
          <td style="padding:8px;border:1px solid #ddd;"><strong>Total</strong></td>
          <td style="padding:8px;border:1px solid #ddd;">${escapeHtml(order.currency || '')} ${escapeHtml(order.total_price || '')}</td>
        </tr>
      </table>

      <h3 style="margin-bottom:6px;">Items</h3>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead>
          <tr style="background:#1a73e8;color:#fff;">
            <th style="padding:8px;border:1px solid #ddd;text-align:left;">Item</th>
            <th style="padding:8px;border:1px solid #ddd;">Qty</th>
            <th style="padding:8px;border:1px solid #ddd;text-align:right;">Price</th>
          </tr>
        </thead>
        <tbody>${buildItemsTable(order.line_items)}</tbody>
      </table>

      <p style="margin-top:24px;">
        <a href="${adminOrderUrl}" style="background:#1a73e8;color:#fff;padding:10px 20px;border-radius:4px;text-decoration:none;display:inline-block;">
          View Order in Shopify Admin
        </a>
      </p>

      <p style="color:#888;font-size:12px;margin-top:24px;">
        This is an automated message from your Hyperlocal Order Notifier app.
      </p>
    </div>
  `;

  return { subject, html };
}

/**
 * Sends the hyperlocal-order notification email.
 *
 * @param {object} order Shopify order payload
 * @param {string[]} matchedTags the hyperlocal tag(s) that matched
 */
async function sendHyperlocalOrderEmail(order, matchedTags) {
  if (!config.notify.to) {
    throw new Error('NOTIFY_EMAIL_TO is not set in your .env file.');
  }

  const { subject, html } = formatOrderEmail(order, matchedTags);

  return transporter.sendMail({
    from: config.notify.from,
    to: config.notify.to,
    subject,
    html,
  });
}

module.exports = { sendHyperlocalOrderEmail, verifyEmailConnection, formatOrderEmail };
