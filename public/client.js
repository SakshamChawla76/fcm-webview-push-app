// FCM WebView Client Controller
(function () {
  'use strict';

  // DOM Elements
  const runtimeBadge = document.getElementById('runtimeBadge');
  const runtimeText = document.getElementById('runtimeText');
  const firebaseStatusText = document.getElementById('firebaseStatusText');
  const firebaseHelperText = document.getElementById('firebaseHelperText');
  const permState = document.getElementById('permState');
  const platformState = document.getElementById('platformState');
  const serverIpState = document.getElementById('serverIpState');
  const fcmTokenDisplay = document.getElementById('fcmTokenDisplay');
  const btnCopyToken = document.getElementById('btnCopyToken');
  const copyText = document.getElementById('copyText');
  const btnRequestPermission = document.getElementById('btnRequestPermission');
  const btnSimulateRegistration = document.getElementById('btnSimulateRegistration');
  const pushForm = document.getElementById('pushForm');
  const targetTokenSelect = document.getElementById('targetTokenSelect');
  const manualTokenInput = document.getElementById('manualTokenInput');
  const pushTitle = document.getElementById('pushTitle');
  const pushBody = document.getElementById('pushBody');
  const pushPriority = document.getElementById('pushPriority');
  const btnSendPush = document.getElementById('btnSendPush');
  const devicesTableBody = document.getElementById('devicesTableBody');
  const deviceCountBadge = document.getElementById('deviceCountBadge');
  const btnRefreshDevices = document.getElementById('btnRefreshDevices');
  const logsContainer = document.getElementById('logsContainer');
  const btnClearLogs = document.getElementById('btnClearLogs');
  const headsUpBanner = document.getElementById('headsUpBanner');
  const bannerTitle = document.getElementById('bannerTitle');
  const bannerBody = document.getElementById('bannerBody');
  const bannerDismiss = document.getElementById('bannerDismiss');

  let currentDeviceToken = null;
  let bannerTimer = null;

  // -------------------------------------------------------------
  // Logging Utility
  // -------------------------------------------------------------
  function log(message, type = 'system') {
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;

    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0];

    entry.innerHTML = `
      <span class="log-time">${timeStr}</span>
      <span class="log-msg">${escapeHtml(message)}</span>
    `;

    logsContainer.appendChild(entry);
    logsContainer.scrollTop = logsContainer.scrollHeight;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // -------------------------------------------------------------
  // Heads-Up Banner (WhatsApp Style)
  // -------------------------------------------------------------
  function showHeadsUpBanner(title, body) {
    if (bannerTimer) clearTimeout(bannerTimer);

    bannerTitle.textContent = title || 'Notification';
    bannerBody.textContent = body || '';
    headsUpBanner.classList.remove('hidden');

    // Auto dismiss after 6 seconds
    bannerTimer = setTimeout(() => {
      headsUpBanner.classList.add('hidden');
    }, 6000);
  }

  bannerDismiss.addEventListener('click', () => {
    if (bannerTimer) clearTimeout(bannerTimer);
    headsUpBanner.classList.add('hidden');
  });

  // -------------------------------------------------------------
  // Server Diagnostic & Status Fetch
  // -------------------------------------------------------------
  async function checkServerStatus() {
    try {
      const res = await fetch('/api/status');
      const data = await res.json();

      serverIpState.textContent = window.location.host;

      if (data.firebase.initialized) {
        firebaseStatusText.textContent = 'Active & Connected';
        firebaseStatusText.style.color = '#34d399';
        firebaseHelperText.textContent = 'Firebase Admin SDK credentials loaded. Ready to dispatch real notifications to Google servers.';
      } else {
        firebaseStatusText.textContent = 'Simulation / Dev Mode';
        firebaseStatusText.style.color = '#f59e0b';
        firebaseHelperText.innerHTML = `To send real FCM pushes to Android phones, place <code>firebase-service-account.json</code> in the project root. (Simulated pushes will work right now!)`;
      }
    } catch (err) {
      console.warn('Status check failed:', err);
      log('Could not connect to backend server status API', 'error');
    }
  }

  // -------------------------------------------------------------
  // Devices Management
  // -------------------------------------------------------------
  async function fetchRegisteredDevices() {
    try {
      const res = await fetch('/api/devices');
      const data = await res.json();
      renderDevicesTable(data.devices || []);
      populateTargetDropdown(data.devices || []);
    } catch (err) {
      log('Error fetching registered devices: ' + err.message, 'error');
    }
  }

  function populateTargetDropdown(devices) {
    targetTokenSelect.innerHTML = '<option value="">-- Select Registered Device --</option>';
    devices.forEach((dev, idx) => {
      const opt = document.createElement('option');
      opt.value = dev.token;
      opt.textContent = `${dev.alias} (${dev.platform}) - ${dev.token.substring(0, 10)}...`;
      targetTokenSelect.appendChild(opt);
    });

    if (devices.length > 0 && !targetTokenSelect.value) {
      targetTokenSelect.selectedIndex = 1;
      manualTokenInput.value = targetTokenSelect.value;
    }
  }

  function renderDevicesTable(devices) {
    deviceCountBadge.textContent = devices.length;

    if (devices.length === 0) {
      devicesTableBody.innerHTML = `
        <tr>
          <td colspan="5" class="empty-state">No devices registered yet. Open this URL inside the Capacitor App or click "Generate Test Device Token".</td>
        </tr>
      `;
      return;
    }

    devicesTableBody.innerHTML = devices.map(dev => `
      <tr>
        <td><strong>${escapeHtml(dev.alias)}</strong><br><small style="color:var(--text-dim);">${escapeHtml(dev.model || '')}</small></td>
        <td><span class="badge ${dev.platform === 'android' ? 'granted' : 'badge-info'}">${escapeHtml(dev.platform)}</span></td>
        <td><code>${escapeHtml(dev.token.substring(0, 14))}...</code></td>
        <td>${new Date(dev.registeredAt).toLocaleTimeString()}</td>
        <td>
          <button class="btn-ghost btn-sm" onclick="window.selectDeviceForPush('${dev.token}')">Select</button>
        </td>
      </tr>
    `).join('');
  }

  window.selectDeviceForPush = function (token) {
    targetTokenSelect.value = token;
    manualTokenInput.value = token;
    pushTitle.focus();
    log(`Selected target device: ${token.substring(0, 12)}...`, 'system');
  };

  targetTokenSelect.addEventListener('change', (e) => {
    manualTokenInput.value = e.target.value;
  });

  // -------------------------------------------------------------
  // Device Registration via Backend
  // -------------------------------------------------------------
  async function registerDeviceOnBackend(token, platform = 'android', alias = null) {
    try {
      const payload = {
        token,
        platform,
        alias: alias || (platform === 'android' ? 'Android-Phone' : 'Browser-Client'),
        model: navigator.userAgent.substring(0, 50)
      };

      const res = await fetch('/api/devices/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await res.json();
      if (result.success) {
        log(`Registered device token on backend [${result.device.alias}]`, 'success');
        fetchRegisteredDevices();
      }
    } catch (err) {
      log('Failed to register device token on backend: ' + err.message, 'error');
    }
  }

  // -------------------------------------------------------------
  // Capacitor & Push Notifications Integration
  // -------------------------------------------------------------
  async function initCapacitor() {
    const isCapacitor = window.Capacitor !== undefined;
    const isNative = isCapacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform();

    if (isNative || isCapacitor) {
      runtimeBadge.className = 'status-pill capacitor';
      runtimeText.textContent = 'Capacitor Android WebView';
      platformState.textContent = 'Android Native';
      platformState.className = 'badge granted';
      log('Detected Capacitor Native environment! Initializing PushNotifications plugin...', 'success');

      setupCapacitorPushListeners();
    } else {
      runtimeBadge.className = 'status-pill browser';
      runtimeText.textContent = 'Web Browser (Preview)';
      platformState.textContent = 'Desktop / Browser';
      permState.textContent = 'N/A in Browser';
      log('Running inside standard web browser. Capacitor native features run when loaded in the Android app.', 'system');
    }
  }

  async function setupCapacitorPushListeners() {
    const PushNotifications = window.Capacitor?.Plugins?.PushNotifications;

    if (!PushNotifications) {
      log('PushNotifications plugin not found in window.Capacitor.Plugins.', 'error');
      permState.textContent = 'Plugin Missing';
      permState.className = 'badge denied';
      return;
    }

    try {
      // 1. Check existing permission status
      const permResult = await PushNotifications.checkPermissions();
      permState.textContent = permResult.receive || 'prompt';
      permState.className = `badge ${permResult.receive === 'granted' ? 'granted' : ''}`;

      if (permResult.receive !== 'granted') {
        // Request Permission
        const reqResult = await PushNotifications.requestPermissions();
        permState.textContent = reqResult.receive || 'unknown';
        permState.className = `badge ${reqResult.receive === 'granted' ? 'granted' : 'denied'}`;

        if (reqResult.receive !== 'granted') {
          log('Push Notification permission was denied by the user.', 'error');
          return;
        }
      }

      // 2. Setup Notification Channel for WhatsApp-style High Priority Banners
      try {
        await PushNotifications.createChannel({
          id: 'fcm_default_channel',
          name: 'General Push Alerts',
          description: 'High priority heads-up notifications with sound and vibration',
          importance: 5, // IMPORTANCE_HIGH (Heads up banner + sound)
          visibility: 1, // VISIBILITY_PUBLIC
          sound: 'default',
          vibration: true
        });
        log('Notification Channel (fcm_default_channel) configured with HIGH importance.', 'success');
      } catch (channelErr) {
        console.warn('Channel creation error (might be older Android):', channelErr);
      }

      // 3. Register with Google FCM via Capacitor
      log('Calling PushNotifications.register()...', 'system');
      await PushNotifications.register();

      // 4. Listeners
      // On Token Generated
      PushNotifications.addListener('registration', (token) => {
        currentDeviceToken = token.value;
        fcmTokenDisplay.value = token.value;
        log(`FCM Registration Token received: ${token.value.substring(0, 16)}...`, 'success');

        // Register token with our backend
        registerDeviceOnBackend(token.value, 'android', 'Capacitor-Device');
      });

      // On Registration Error
      PushNotifications.addListener('registrationError', (error) => {
        log('FCM Registration Error: ' + JSON.stringify(error), 'error');
        permState.textContent = 'FCM Error';
        permState.className = 'badge denied';
      });

      // On Push Notification Received (App in Foreground)
      PushNotifications.addListener('pushNotificationReceived', (notification) => {
        log(`📥 Push Notification Received: "${notification.title}" - "${notification.body}"`, 'push');
        showHeadsUpBanner(notification.title, notification.body);
      });

      // On Push Notification Action Performed (Tapped in system tray)
      PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        log(`👆 User tapped notification: "${action.notification.title}"`, 'push');
        showHeadsUpBanner(action.notification.title, action.notification.body);
      });

    } catch (err) {
      log('Error initializing Capacitor push: ' + err.message, 'error');
    }
  }

  btnRequestPermission.addEventListener('click', async () => {
    if (window.Capacitor?.Plugins?.PushNotifications) {
      setupCapacitorPushListeners();
    } else {
      alert('This button triggers native Android permission prompts when running inside the Capacitor Android App!');
    }
  });

  // -------------------------------------------------------------
  // Simulated Registration (For Browser Testing)
  // -------------------------------------------------------------
  btnSimulateRegistration.addEventListener('click', () => {
    const simToken = 'fcm_test_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    currentDeviceToken = simToken;
    fcmTokenDisplay.value = simToken;
    registerDeviceOnBackend(simToken, 'browser_simulated', 'Simulated-Phone-' + Math.floor(Math.random() * 900 + 100));
    log('Simulated device token generated & registered for local testing.', 'success');
  });

  // -------------------------------------------------------------
  // Copy Token
  // -------------------------------------------------------------
  btnCopyToken.addEventListener('click', async () => {
    const token = fcmTokenDisplay.value.trim();
    if (!token) {
      alert('No FCM token to copy yet!');
      return;
    }
    try {
      await navigator.clipboard.writeText(token);
      copyText.textContent = 'Copied!';
      setTimeout(() => { copyText.textContent = 'Copy'; }, 2000);
      log('Token copied to clipboard', 'system');
    } catch (err) {
      fcmTokenDisplay.select();
      document.execCommand('copy');
      copyText.textContent = 'Copied!';
      setTimeout(() => { copyText.textContent = 'Copy'; }, 2000);
    }
  });

  // -------------------------------------------------------------
  // Quick Preset Chips
  // -------------------------------------------------------------
  document.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      pushTitle.value = chip.getAttribute('data-title');
      pushBody.value = chip.getAttribute('data-body');
      log(`Applied template: "${chip.getAttribute('data-title')}"`, 'system');
    });
  });

  // -------------------------------------------------------------
  // Send Push Notification Form Handler
  // -------------------------------------------------------------
  pushForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const targetToken = manualTokenInput.value.trim() || targetTokenSelect.value.trim();

    if (!targetToken) {
      alert('Please select or paste a target device FCM token.');
      manualTokenInput.focus();
      return;
    }

    btnSendPush.disabled = true;
    btnSendPush.innerHTML = `<span>Dispatching...</span>`;

    try {
      const payload = {
        token: targetToken,
        title: pushTitle.value.trim(),
        body: pushBody.value.trim(),
        priority: pushPriority.value
      };

      const res = await fetch('/api/send-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (data.success) {
        if (data.mode === 'fcm_live') {
          log(`🚀 Real FCM Push sent via Firebase! Message ID: ${data.messageId}`, 'success');
        } else {
          log(`📡 Simulated Push dispatched to ${targetToken.substring(0, 10)}... (Simulation mode)`, 'system');
        }
        // Show in-app banner for feedback
        showHeadsUpBanner(payload.title, payload.body);
      } else {
        log(`Failed to dispatch push: ${data.error || 'Unknown error'}`, 'error');
      }
    } catch (err) {
      log('Network error sending push: ' + err.message, 'error');
    } finally {
      btnSendPush.disabled = false;
      btnSendPush.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
          <line x1="22" y1="2" x2="11" y2="13"></line>
          <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
        </svg>
        <span>Dispatch Push via Backend</span>
      `;
    }
  });

  // -------------------------------------------------------------
  // Real-Time SSE (Server-Sent Events) Stream
  // -------------------------------------------------------------
  function setupEventStream() {
    try {
      const eventSource = new EventSource('/api/events');

      eventSource.addEventListener('init', (e) => {
        const data = JSON.parse(e.data);
        renderDevicesTable(data.devices || []);
        populateTargetDropdown(data.devices || []);
      });

      eventSource.addEventListener('device_registered', (e) => {
        const dev = JSON.parse(e.data);
        log(`New device online: ${dev.alias} (${dev.platform})`, 'success');
        fetchRegisteredDevices();
      });

      eventSource.addEventListener('notification_dispatched', (e) => {
        const record = JSON.parse(e.data);
        log(`Dispatch Event: [${record.status}] "${record.title}" -> ${record.targetToken.substring(0, 10)}...`, 'push');
      });

      eventSource.onerror = () => {
        console.warn('SSE stream disconnected, will auto-reconnect...');
      };
    } catch (err) {
      console.warn('SSE setup error:', err);
    }
  }

  // Clear Logs
  btnClearLogs.addEventListener('click', () => {
    logsContainer.innerHTML = '';
    log('Logs cleared.', 'system');
  });

  btnRefreshDevices.addEventListener('click', () => {
    fetchRegisteredDevices();
    log('Refreshed device list.', 'system');
  });

  // -------------------------------------------------------------
  // Initialization
  // -------------------------------------------------------------
  checkServerStatus();
  fetchRegisteredDevices();
  initCapacitor();
  setupEventStream();

})();
