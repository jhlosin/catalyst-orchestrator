/**
 * Shared alert utilities
 * Discord, Telegram, etc.
 */

async function sendDiscordAlert(webhookUrl, message) {
  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: message })
  });
}

async function sendTelegramAlert(botToken, chatId, message) {
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: message })
  });
}

module.exports = { sendDiscordAlert, sendTelegramAlert };
