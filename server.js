const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const os = require('os');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// In-memory token storage
const registeredDevices = new Map();
const sseClients = new Set();

// Firebase Admin SDK Initialization
let firebaseAdmin = null;
let firebaseInitialized = false;
let firebaseInitError = null;

const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(__dirname, 'firebase-service-account.json');

try {
  if (fs.existsSync(serviceAccountPath)) {
    const admin = require('firebase-admin');
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    firebaseAdmin = admin;
    firebaseInitialized = true;
    console.log('✅ Firebase Admin SDK successfully initialized with service account.');
  } else {
    console.log('ℹ️  No firebase-service-account.json found. Running in simulation/dev mode.');
    console.log('   Add firebase-service-account.json to dispatch real push notifications to devices.');
  }
} catch (err) {
  firebaseInitError = err.message;
  console.warn('⚠️ Firebase Admin initialization failed:', err.message);
}

// Broadcast SSE event to connected dashboard clients
function broadcastEvent(eventType, data) {
  const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    client.write(payload);
  }
}

// Helper to get local IP addresses for convenience
function getLocalIpAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const k in interfaces) {
    for (const k2 in interfaces[k]) {
      const address = interfaces[k][k2];
      if (address.family === 'IPv4' && !address.internal) {
        addresses.push(address.address);
      }
    }
  }
  return addresses;
}

// -------------------------------------------------------------
// REST API Endpoints
// -------------------------------------------------------------

// 1. Server Status & Diagnostics
app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    port: PORT,
    localIps: getLocalIpAddresses(),
    emulatorUrl: `http://10.0.2.2:${PORT}`,
    firebase: {
      initialized: firebaseInitialized,
      error: firebaseInitError,
      credentialsPath: serviceAccountPath,
      exists: fs.existsSync(serviceAccountPath)
    },
    deviceCount: registeredDevices.size,
    serverTime: new Date().toISOString()
  });
});

// 2. Real-time Event Stream (SSE)
app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  sseClients.add(res);

  // Send initial state
  res.write(`event: init\ndata: ${JSON.stringify({
    devices: Array.from(registeredDevices.values()),
    firebaseInitialized
  })}\n\n`);

  req.on('close', () => {
    sseClients.delete(res);
  });
});

// 3. Register Device FCM Token
app.post('/api/devices/register', (req, res) => {
  const { token, platform, alias, model } = req.body;

  if (!token) {
    return res.status(400).json({ error: 'FCM token is required' });
  }

  const device = {
    token,
    platform: platform || 'android',
    alias: alias || `Device-${token.substring(0, 6)}`,
    model: model || 'Unknown Device',
    registeredAt: registeredDevices.has(token) 
      ? registeredDevices.get(token).registeredAt 
      : new Date().toISOString(),
    lastSeen: new Date().toISOString(),
    ip: req.ip || req.connection.remoteAddress
  };

  registeredDevices.set(token, device);
  console.log(`📱 Device registered: [${device.alias}] (${device.platform})`);

  broadcastEvent('device_registered', device);

  res.json({
    success: true,
    message: 'Device token registered successfully',
    device
  });
});

// 4. List Registered Devices
app.get('/api/devices', (req, res) => {
  res.json({
    count: registeredDevices.size,
    devices: Array.from(registeredDevices.values())
  });
});

// 5. Delete a Registered Device
app.delete('/api/devices/:token', (req, res) => {
  const token = req.params.token;
  if (registeredDevices.has(token)) {
    const deleted = registeredDevices.get(token);
    registeredDevices.delete(token);
    broadcastEvent('device_removed', { token });
    return res.json({ success: true, message: 'Device removed', device: deleted });
  }
  res.status(404).json({ error: 'Device token not found' });
});

// 6. Send Push Notification via FCM
app.post('/api/send-push', async (req, res) => {
  const { token, title, body, data, sound, priority } = req.body;

  if (!token) {
    return res.status(400).json({ error: 'Target device token is required' });
  }

  const notificationPayload = {
    title: title || 'New Notification',
    body: body || 'You received a message via Capacitor FCM!',
  };

  const extraData = data || {
    click_action: 'FLUTTER_NOTIFICATION_CLICK',
    timestamp: Date.now().toString(),
    type: 'fcm_webview_alert'
  };

  // Broadcast log to dashboard regardless
  const dispatchRecord = {
    targetToken: token,
    title: notificationPayload.title,
    body: notificationPayload.body,
    timestamp: new Date().toISOString(),
    status: 'pending'
  };

  if (firebaseInitialized && firebaseAdmin) {
    try {
      // Build Android High Priority Message for WhatsApp-like heads-up banner
      const message = {
        token: token,
        notification: notificationPayload,
        data: extraData,
        android: {
          priority: priority === 'normal' ? 'normal' : 'high',
          notification: {
            channelId: 'fcm_default_channel',
            sound: sound || 'default',
            defaultSound: true,
            defaultVibrateTimings: true,
            notificationPriority: 'PRIORITY_HIGH',
            visibility: 'PUBLIC'
          }
        },
        apns: {
          payload: {
            aps: {
              sound: sound || 'default',
              badge: 1
            }
          }
        }
      };

      const response = await firebaseAdmin.messaging().send(message);
      console.log('🚀 FCM notification sent successfully:', response);

      dispatchRecord.status = 'delivered';
      dispatchRecord.fcmMessageId = response;
      broadcastEvent('notification_dispatched', dispatchRecord);

      return res.json({
        success: true,
        mode: 'fcm_live',
        messageId: response,
        details: notificationPayload
      });
    } catch (error) {
      console.error('❌ Error dispatching FCM message:', error);
      dispatchRecord.status = 'failed';
      dispatchRecord.error = error.message;
      broadcastEvent('notification_dispatched', dispatchRecord);

      return res.status(500).json({
        success: false,
        error: error.message,
        code: error.code
      });
    }
  } else {
    // Simulated Dispatch (when credentials are not yet configured)
    console.log(`📡 [SIMULATED FCM PUSH] Target: ${token.substring(0, 15)}... | Title: "${notificationPayload.title}" | Body: "${notificationPayload.body}"`);
    dispatchRecord.status = 'simulated';
    dispatchRecord.note = 'No firebase-service-account.json found. Simulated locally.';
    broadcastEvent('notification_dispatched', dispatchRecord);

    return res.json({
      success: true,
      mode: 'simulation',
      note: 'Simulation mode active. Place firebase-service-account.json in the project root to send actual FCM alerts to your device.',
      notification: notificationPayload,
      targetToken: token
    });
  }
});

// Fallback to index.html for SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server binding to 0.0.0.0 (all network interfaces)
app.listen(PORT, '0.0.0.0', () => {
  const ips = getLocalIpAddresses();
  console.log('====================================================');
  console.log(`🚀 FCM WebView Server running at: http://localhost:${PORT}`);
  console.log(`📱 Android Emulator URL:        http://10.0.2.2:${PORT}`);
  ips.forEach(ip => {
    console.log(`🌐 Physical Device (Wi-Fi) URL:  http://${ip}:${PORT}`);
  });
  console.log('====================================================');
});
