// FCM WebView Client Controller - PushHub v1.2
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
  const backendUrlInput = document.getElementById('backendUrlInput');
  const btnSaveBackendUrl = document.getElementById('btnSaveBackendUrl');

  let currentDeviceToken = null;
  let bannerTimer = null;
  let backendBaseUrl = localStorage.getItem('pushhub_backend_url') || '';
  let capacitorInitialized = false;

  if (backendUrlInput) {
    backendUrlInput.value = backendBaseUrl;
    btnSaveBackendUrl?.addEventListener('click', () => {
      backendBaseUrl = backendUrlInput.value.trim().replace(/\/$/, '');
      localStorage.setItem('pushhub_backend_url', backendBaseUrl);
      log('Backend Host updated: ' + (backendBaseUrl || 'Local / Relative'), 'success');
      checkServerStatus();
      fetchRegisteredDevices();
      if (currentDeviceToken) {
        registerDeviceOnBackend(currentDeviceToken, 'android', 'Android-Device');
      }
    });
  }

  function getApiUrl(endpoint) {
    if (backendBaseUrl) {
      return backendBaseUrl + endpoint;
    }
    return endpoint;
  }

  // -------------------------------------------------------------
  // Logging Utility
  // -------------------------------------------------------------
  function log(message, type = 'system') {
    if (!logsContainer) return;
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
    if (!headsUpBanner) return;
    if (bannerTimer) clearTimeout(bannerTimer);

    bannerTitle.textContent = title || 'Notification';
    bannerBody.textContent = body || '';
    headsUpBanner.classList.remove('hidden');

    // Auto dismiss after 6 seconds
    bannerTimer = setTimeout(() => {
      headsUpBanner.classList.add('hidden');
    }, 6000);
  }

  bannerDismiss?.addEventListener('click', () => {
    if (bannerTimer) clearTimeout(bannerTimer);
    headsUpBanner.classList.add('hidden');
  });

  // -------------------------------------------------------------
  // Server Diagnostic & Status Fetch
  // -------------------------------------------------------------
  async function checkServerStatus() {
    try {
      const res = await fetch(getApiUrl('/api/status'), { signal: AbortSignal.timeout(4000) });
      const data = await res.json();

      serverIpState.textContent = backendBaseUrl ? new URL(backendBaseUrl).host : (window.location.host || 'Connected');

      if (data.firebase?.initialized) {
        firebaseStatusText.textContent = 'Active & Connected';
        firebaseStatusText.style.color = '#34d399';
        firebaseHelperText.textContent = 'Firebase Admin SDK credentials active. Ready to dispatch real push notifications.';
      } else {
        firebaseStatusText.textContent = 'Simulation / Dev Mode';
        firebaseStatusText.style.color = '#f59e0b';
        firebaseHelperText.textContent = 'Credentials pending. Simulated pushes active.';
      }
    } catch (err) {
      // In standalone APK mode without backend URL, this is normal
      serverIpState.textContent = backendBaseUrl ? 'Connecting...' : 'Standalone APK';
      firebaseStatusText.textContent = 'Standalone Android Mode';
      firebaseStatusText.style.color = '#38bdf8';
      firebaseHelperText.textContent = 'Running locally on device. Native FCM push reception is active via Google Play Services.';
    }
  }

  // -------------------------------------------------------------
  // Devices Management
  // -------------------------------------------------------------
  async function fetchRegisteredDevices() {
    try {
      const res = await fetch(getApiUrl('/api/devices'), { signal: AbortSignal.timeout(4000) });
      const data = await res.json();
      renderDevicesTable(data.devices || []);
      populateTargetDropdown(data.devices || []);
    } catch (err) {
      // Silent fail in standalone mode
      console.warn('Devices fetch skipped (standalone or offline):', err.message);
    }
  }

  function populateTargetDropdown(devices) {
    if (!targetTokenSelect) return;
    targetTokenSelect.innerHTML = '<option value="">-- Select Registered Device --</option>';
    devices.forEach((dev) => {
      const opt = document.createElement('option');
      opt.value = dev.token;
      opt.textContent = `${dev.alias} (${dev.platform}) - ${dev.token.substring(0, 10)}...`;
      targetTokenSelect.appendChild(opt);
    });

    if (devices.length > 0 && !targetTokenSelect.value) {
      targetTokenSelect.selectedIndex = 1;
      if (manualTokenInput) manualTokenInput.value = targetTokenSelect.value;
    }
  }

  function renderDevicesTable(devices) {
    if (!devicesTableBody) return;
    if (deviceCountBadge) deviceCountBadge.textContent = devices.length;

    if (devices.length === 0) {
      devicesTableBody.innerHTML = `
        <tr>
          <td colspan="5" class="empty-state">No devices registered yet. FCM Token will appear above once Google registers this device.</td>
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
    if (targetTokenSelect) targetTokenSelect.value = token;
    if (manualTokenInput) manualTokenInput.value = token;
    pushTitle?.focus();
    log(`Selected target device: ${token.substring(0, 12)}...`, 'system');
  };

  targetTokenSelect?.addEventListener('change', (e) => {
    if (manualTokenInput) manualTokenInput.value = e.target.value;
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

      const res = await fetch(getApiUrl('/api/devices/register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(5000)
      });

      const result = await res.json();
      if (result.success) {
        log(`Registered device token on backend [${result.device.alias}]`, 'success');
        fetchRegisteredDevices();
      }
    } catch (err) {
      console.warn('Backend registration failed (standalone mode):', err.message);
    }
  }

  // -------------------------------------------------------------
  // Capacitor & Push Notifications Integration
  // -------------------------------------------------------------
  async function initCapacitor() {
    if (capacitorInitialized) return;

    const isCapacitor = typeof window.Capacitor !== 'undefined';
    const isNative = isCapacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform();

    if (isNative || isCapacitor) {
      capacitorInitialized = true;
      if (runtimeBadge) runtimeBadge.className = 'status-pill capacitor';
      if (runtimeText) runtimeText.textContent = 'Capacitor Android Native';
      if (platformState) {
        platformState.textContent = 'Android Native';
        platformState.className = 'badge granted';
      }
      log('🚀 Detected Capacitor Native Android environment! Initializing PushNotifications...', 'success');

      setupCapacitorPushListeners();
    } else {
      // Check if user agent is Android WebView even if bridge is mounting
      const isAndroidUserAgent = /Android/i.test(navigator.userAgent);
      if (isAndroidUserAgent) {
        if (runtimeBadge) runtimeBadge.className = 'status-pill capacitor';
        if (runtimeText) runtimeText.textContent = 'Android WebView';
        if (platformState) {
          platformState.textContent = 'Android Device';
          platformState.className = 'badge granted';
        }
      } else {
        if (runtimeBadge) runtimeBadge.className = 'status-pill browser';
        if (runtimeText) runtimeText.textContent = 'Web Browser (Preview)';
        if (platformState) {
          platformState.textContent = 'Desktop / Browser';
          platformState.className = 'badge';
        }
      }
      if (permState) {
        permState.textContent = 'Tap to Request';
        permState.className = 'badge';
      }
    }
  }

  async function setupCapacitorPushListeners(userInitiated = false) {
    const PushNotifications = window.Capacitor?.Plugins?.PushNotifications;

    if (!PushNotifications) {
      if (userInitiated) {
        alert('Capacitor PushNotifications plugin bridge is still connecting or not loaded.');
      }
      log('PushNotifications plugin bridge waiting for native registration...', 'system');
      if (permState) {
        permState.textContent = 'Connecting...';
        permState.className = 'badge';
      }
      return;
    }

    try {
      log('Checking push notification permissions...', 'system');
      // 1. Check existing permission status
      let permResult = await PushNotifications.checkPermissions();
      if (permState) {
        permState.textContent = permResult.receive || 'prompt';
        permState.className = `badge ${permResult.receive === 'granted' ? 'granted' : ''}`;
      }

      if (permResult.receive !== 'granted') {
        log('Prompting user for Android 13+ Notification Permission...', 'system');
        // Request Permission
        const reqResult = await PushNotifications.requestPermissions();
        if (permState) {
          permState.textContent = reqResult.receive || 'unknown';
          permState.className = `badge ${reqResult.receive === 'granted' ? 'granted' : 'denied'}`;
        }

        if (reqResult.receive !== 'granted') {
          log('Push Notification permission was denied or dismissed.', 'error');
          return;
        }
        log('Notification permission GRANTED by user!', 'success');
      } else {
        log('Notification permission already GRANTED.', 'success');
      }

      // 2. Setup Notification Channel for WhatsApp-style High Priority Heads-up Banners
      try {
        await PushNotifications.createChannel({
          id: 'fcm_default_channel',
          name: 'General Push Alerts',
          description: 'High priority heads-up notifications with sound and vibration',
          importance: 5, // IMPORTANCE_HIGH
          visibility: 1, // VISIBILITY_PUBLIC
          sound: 'default',
          vibration: true
        });
        log('Notification Channel (fcm_default_channel) configured with HIGH importance.', 'success');
      } catch (channelErr) {
        console.warn('Channel creation notice:', channelErr);
      }

      // 3. Register with Google FCM via Capacitor
      log('Calling PushNotifications.register()... Contacting Google FCM...', 'system');
      await PushNotifications.register();

      // 4. Token & Message Listeners
      PushNotifications.removeAllListeners();

      // On Token Generated
      PushNotifications.addListener('registration', (token) => {
        currentDeviceToken = token.value;
        if (fcmTokenDisplay) fcmTokenDisplay.value = token.value;
        if (manualTokenInput && !manualTokenInput.value) manualTokenInput.value = token.value;
        log(`🎉 REAL FCM TOKEN RECEIVED! ${token.value.substring(0, 20)}...`, 'success');

        // Register token with backend if connected
        registerDeviceOnBackend(token.value, 'android', 'Android-Device');
      });

      // On Registration Error
      PushNotifications.addListener('registrationError', (error) => {
        log('FCM Registration Error: ' + JSON.stringify(error), 'error');
        if (permState) {
          permState.textContent = 'FCM Error';
          permState.className = 'badge denied';
        }
      });

      // On Push Notification Received (App in Foreground)
      PushNotifications.addListener('pushNotificationReceived', (notification) => {
        log(`📥 Push Received: "${notification.title}" - "${notification.body}"`, 'push');
        showHeadsUpBanner(notification.title, notification.body);
      });

      // On Push Notification Action Performed (Tapped from system tray)
      PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        log(`👆 User tapped notification: "${action.notification.title}"`, 'push');
        showHeadsUpBanner(action.notification.title, action.notification.body);
      });

    } catch (err) {
      log('Capacitor push setup notice: ' + err.message, 'error');
    }
  }

  btnRequestPermission?.addEventListener('click', async () => {
    if (window.Capacitor?.Plugins?.PushNotifications) {
      setupCapacitorPushListeners(true);
    } else {
      initCapacitor();
      setTimeout(() => {
        if (window.Capacitor?.Plugins?.PushNotifications) {
          setupCapacitorPushListeners(true);
        } else {
          // If in browser or bridge delayed
          alert('Initializing Native Push Bridge... If on Android, ensure app has Google Play Services active.');
        }
      }, 500);
    }
  });

  // -------------------------------------------------------------
  // Simulated Registration (For Browser Testing)
  // -------------------------------------------------------------
  btnSimulateRegistration?.addEventListener('click', () => {
    const simToken = 'fcm_test_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    currentDeviceToken = simToken;
    if (fcmTokenDisplay) fcmTokenDisplay.value = simToken;
    if (manualTokenInput) manualTokenInput.value = simToken;
    registerDeviceOnBackend(simToken, 'browser_simulated', 'Simulated-Phone-' + Math.floor(Math.random() * 900 + 100));
    log('Simulated device token generated & registered.', 'success');
  });

  // -------------------------------------------------------------
  // Copy Token
  // -------------------------------------------------------------
  btnCopyToken?.addEventListener('click', async () => {
    const token = fcmTokenDisplay?.value.trim();
    if (!token || token.startsWith('Waiting')) {
      alert('No FCM token generated yet! Please grant notification permissions first.');
      return;
    }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(token);
      } else {
        fcmTokenDisplay.select();
        document.execCommand('copy');
      }
      if (copyText) copyText.textContent = 'Copied!';
      setTimeout(() => { if (copyText) copyText.textContent = 'Copy'; }, 2000);
      log('FCM Token copied to clipboard!', 'system');
    } catch (err) {
      fcmTokenDisplay.select();
      document.execCommand('copy');
      if (copyText) copyText.textContent = 'Copied!';
      setTimeout(() => { if (copyText) copyText.textContent = 'Copy'; }, 2000);
    }
  });

  // -------------------------------------------------------------
  // Quick Preset Chips
  // -------------------------------------------------------------
  document.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      if (pushTitle) pushTitle.value = chip.getAttribute('data-title');
      if (pushBody) pushBody.value = chip.getAttribute('data-body');
      log(`Applied preset: "${chip.getAttribute('data-title')}"`, 'system');
    });
  });

  // -------------------------------------------------------------
  // Send Push Notification Form Handler
  // -------------------------------------------------------------
  pushForm?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const targetToken = (manualTokenInput?.value || targetTokenSelect?.value || '').trim();

    if (!targetToken || targetToken.startsWith('Waiting')) {
      alert('Please wait for your FCM Token to generate, or enter a target device token.');
      manualTokenInput?.focus();
      return;
    }

    if (btnSendPush) {
      btnSendPush.disabled = true;
      btnSendPush.innerHTML = `<span>Dispatching...</span>`;
    }

    try {
      const payload = {
        token: targetToken,
        title: pushTitle?.value.trim() || 'Heads-up Notification',
        body: pushBody?.value.trim() || 'WhatsApp-style banner received!',
        priority: pushPriority?.value || 'high'
      };

      const res = await fetch(getApiUrl('/api/send-push'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(6000)
      });

      const data = await res.json();

      if (data.success) {
        if (data.mode === 'fcm_live') {
          log(`🚀 Real FCM Push sent via Firebase! Message ID: ${data.messageId}`, 'success');
        } else {
          log(`📡 Push dispatched: ${data.message || 'Success'}`, 'system');
        }
        // Show in-app banner for instant visual feedback
        showHeadsUpBanner(payload.title, payload.body);
      } else {
        log(`Failed to dispatch push: ${data.error || 'Unknown error'}`, 'error');
        // Still show banner if local
        showHeadsUpBanner(payload.title, payload.body);
      }
    } catch (err) {
      log('Server not reachable directly. Displaying local heads-up preview on screen.', 'system');
      // Even if phone is offline or cannot reach localhost:3000 on laptop, pop the heads-up banner!
      showHeadsUpBanner(pushTitle?.value || 'Test Notification', pushBody?.value || 'Heads-up banner preview');
    } finally {
      if (btnSendPush) {
        btnSendPush.disabled = false;
        btnSendPush.innerHTML = `
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
          <span>Dispatch Push via Backend</span>
        `;
      }
    }
  });

  // -------------------------------------------------------------
  // Real-Time SSE (Server-Sent Events) Stream
  // -------------------------------------------------------------
  function setupEventStream() {
    try {
      const eventSource = new EventSource(getApiUrl('/api/events'));

      eventSource.addEventListener('init', (e) => {
        try {
          const data = JSON.parse(e.data);
          renderDevicesTable(data.devices || []);
          populateTargetDropdown(data.devices || []);
        } catch (_) {}
      });

      eventSource.addEventListener('device_registered', (e) => {
        try {
          const dev = JSON.parse(e.data);
          log(`New device online: ${dev.alias} (${dev.platform})`, 'success');
          fetchRegisteredDevices();
        } catch (_) {}
      });

      eventSource.addEventListener('notification_dispatched', (e) => {
        try {
          const record = JSON.parse(e.data);
          log(`Dispatch Event: [${record.status}] "${record.title}" -> ${record.targetToken.substring(0, 10)}...`, record.status === 'failed' ? 'error' : 'push');
          
          if (record.status === 'delivered' || record.status === 'simulated') {
            if (!currentDeviceToken || record.targetToken === currentDeviceToken || record.targetToken.startsWith('fcm_test_')) {
              showHeadsUpBanner(record.title, record.body);
            }
          }
        } catch (_) {}
      });

      eventSource.onerror = () => {
        console.warn('SSE stream disconnected, will auto-reconnect...');
      };
    } catch (err) {
      console.warn('SSE setup error:', err);
    }
  }

  // Clear Logs
  btnClearLogs?.addEventListener('click', () => {
    if (logsContainer) logsContainer.innerHTML = '';
    log('Logs cleared.', 'system');
  });

  btnRefreshDevices?.addEventListener('click', () => {
    fetchRegisteredDevices();
    log('Refreshed device list.', 'system');
  });

  // -------------------------------------------------------------
  // Poll & Initialize
  // -------------------------------------------------------------
  function startInit() {
    // 1. Detect Capacitor / Native bridge immediately & poll for up to 3 seconds
    let attempts = 0;
    const pollInterval = setInterval(() => {
      attempts++;
      if (window.Capacitor || attempts > 20) {
        clearInterval(pollInterval);
        initCapacitor();
      }
    }, 100);

    // Also run immediate check
    initCapacitor();

    // 2. Non-blocking network checks
    checkServerStatus();
    fetchRegisteredDevices();
    setupEventStream();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startInit);
  } else {
    startInit();
  }

})();
