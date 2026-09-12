#!/usr/bin/env node
/**
 * Standalone CLI tool to trigger FCM Push Notifications
 * Usage:
 *   node send-notification-cli.js
 *   node send-notification-cli.js --token <FCM_TOKEN> --title "Message" --body "Hello"
 */

const http = require('http');

const args = process.argv.slice(2);
function getArg(key, defaultValue = null) {
  const index = args.indexOf(key);
  if (index !== -1 && args[index + 1]) {
    return args[index + 1];
  }
  return defaultValue;
}

const token = getArg('--token');
const title = getArg('--title', '💬 WhatsApp Style Alert');
const body = getArg('--body', 'New message received via Firebase Cloud Messaging!');
const priority = getArg('--priority', 'high');
const port = getArg('--port', 3000);

async function run() {
  console.log('\n📡 --- FCM Push Notification CLI Dispatcher ---');

  let targetToken = token;

  // If no token passed, try to fetch the first registered device from the local server
  if (!targetToken) {
    console.log('Fetching active devices from http://localhost:' + port + '/api/devices ...');
    try {
      const devices = await new Promise((resolve, reject) => {
        http.get(`http://localhost:${port}/api/devices`, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            try {
              resolve(JSON.parse(data).devices || []);
            } catch (e) {
              reject(e);
            }
          });
        }).on('error', reject);
      });

      if (devices.length > 0) {
        targetToken = devices[devices.length - 1].token;
        console.log(`✅ Automatically selected latest registered device: [${devices[devices.length - 1].alias}]`);
      } else {
        console.log('⚠️ No devices currently registered. Using fallback test token.');
        targetToken = 'test_device_token_sample';
      }
    } catch (err) {
      console.warn('⚠️ Server not responding or unreachable at port', port);
      targetToken = 'test_device_token_sample';
    }
  }

  console.log(`🎯 Target Token: ${targetToken.substring(0, 20)}...`);
  console.log(`✉️  Title:        "${title}"`);
  console.log(`📝 Body:         "${body}"`);
  console.log(`⚡ Priority:     ${priority}\n`);

  const payload = JSON.stringify({
    token: targetToken,
    title,
    body,
    priority
  });

  const req = http.request({
    hostname: 'localhost',
    port: port,
    path: '/api/send-push',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    }
  }, (res) => {
    let responseData = '';
    res.on('data', chunk => responseData += chunk);
    res.on('end', () => {
      console.log('-------------------------------------------');
      try {
        const json = JSON.parse(responseData);
        if (json.success) {
          console.log(`✅ Success! [Mode: ${json.mode}]`);
          if (json.messageId) console.log(`   Message ID: ${json.messageId}`);
          if (json.note) console.log(`   Note: ${json.note}`);
        } else {
          console.log(`❌ Error: ${json.error}`);
        }
      } catch (e) {
        console.log('Response:', responseData);
      }
      console.log('-------------------------------------------\n');
    });
  });

  req.on('error', (err) => {
    console.error('❌ Request failed:', err.message);
  });

  req.write(payload);
  req.end();
}

run();
