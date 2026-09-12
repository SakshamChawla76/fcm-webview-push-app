# PushHub FCM: Fullstack WebView App with Firebase Cloud Messaging (FCM)

A production-ready fullstack implementation demonstrating how to bridge an Express backend with an Android Capacitor WebView app to deliver high-priority Firebase Cloud Messaging (FCM) push notifications with WhatsApp-style heads-up alerts.

---

## 🌟 Key Features

- **Fullstack Localhost Architecture**: Express server hosting the API, device registry, and live glassmorphic web dashboard simultaneously on port `3000`.
- **Capacitor Mobile Layer**: Native Android WebView container powered by `@capacitor/core` and `@capacitor/push-notifications`.
- **Google FCM v1 Integration**: Dispatches genuine high-priority push notifications using `firebase-admin`.
- **Heads-Up Banner Support**: Configured with Android `IMPORTANCE_HIGH` (Notification Channel Level 5) to display floating alert banners with sound and vibration.
- **Real-Time Live Feed**: Server-Sent Events (SSE) stream delivering instant delivery status updates and registration logs to the console.
- **Multi-Environment Ready**: Operates on Android Emulators (`10.0.2.2`), Local Wi-Fi (`192.168.x.x`), and Standalone APK offline modes.

---

## 🏗️ Architecture & Network Flow

```
+──────────────────────────────────────────────────────────────────────────+
|                    HOST MACHINE (EXPRESS SERVER)                         |
|                                                                          |
|  http://localhost:3000 (binds to 0.0.0.0:3000)                           |
|   ├── Glassmorphic Web Dashboard (Device Token Registry & Dispatch Hub)  |
|   ├── Device Token Registration API (POST /api/devices/register)         |
|   ├── Push Dispatcher API (POST /api/send-push)                          |
|   └── Real-time SSE Stream (GET /api/events)                             |
|                         │                                                |
|                         ▼ Calls Google FCM v1 API                        |
|        [ Google Firebase Cloud Messaging Servers ]                       |
+─────────────────────────┼────────────────────────────────────────────────+
                          │ Delivered over Internet (Cellular / Wi-Fi)
                          ▼
+──────────────────────────────────────────────────────────────────────────+
|                    CAPACITOR ANDROID RUNTIME                             |
|                                                                          |
|  Android Native WebView:                                                 |
|   ├── Bundled Web Assets (Standalone APK) or Remote Host URL             |
|   ├── Plugin: @capacitor/push-notifications                             |
|   ├── Notification Channel: fcm_default_channel (High Priority)          |
|   ├── Registers with Google Play Services on boot                        |
|   ├── Generates Real 160-character FCM Device Token                      |
|   └── Receives System Tray & Heads-Up Banner Notifications               |
+──────────────────────────────────────────────────────────────────────────+
```

---

## 📋 Prerequisites

- **Node.js**: v18 or later
- **Java Development Kit (JDK)**: JDK 17 or JDK 21
- **Android Studio / Android SDK**: For native compilation (optional if using pre-built APK)
- **Firebase Account**: A standard Firebase project with Cloud Messaging enabled

---

## 🚀 Quick Start Guide

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/SakshamChawla76/fcm-webview-push-app.git
cd fcm-webview-push-app
npm install
```

### 2. Configure Firebase Credentials
1. In your Firebase Console, navigate to **Project Settings > Service Accounts**.
2. Click **Generate new private key** to download your service account JSON file.
3. Place the file in the project root directory and name it:
   ```
   firebase-service-account.json
   ```
4. In **Project Settings > General**, add an Android app with package name `com.pushapp.fcmwebview`, download `google-services.json`, and place it in:
   ```
   android/app/google-services.json
   ```

*(Note: The server includes a fallback simulation mode for local development if credentials are not yet present).*

### 3. Start the Backend Server
```bash
npm start
```
The server will be available at:
- **Local Dashboard:** `http://localhost:3000`
- **Android Emulator Address:** `http://10.0.2.2:3000`
- **LAN Physical Device Address:** `http://<YOUR_LOCAL_IP>:3000`

---

## 📱 Physical Android Device Testing Guide

Follow these steps to test push notifications on a physical Android smartphone:

### Step 1: Install the Android APK
Download and install the APK on your Android device:
- **Latest Release**: Download from the [GitHub Releases](https://github.com/SakshamChawla76/fcm-webview-push-app/releases) tab.

### Step 2: Grant Permissions & Obtain Real FCM Token
1. Launch **PushHub FCM** on your Android device.
2. Confirm the top status badge displays **`Capacitor Android Native`**.
3. When prompted by Android (*"Allow FCM WebView Push to send notifications?"*), tap **Allow**.
   - If not automatically prompted, tap the purple **"Request Permission"** button.
4. Google Play Services will return a genuine **FCM Registration Token** (~160 characters long).
5. Tap **"Copy"** next to the token field.

> [!NOTE]
> **Real Device Token vs. Simulated Token:**
> - A **Real FCM Device Token** is a long cryptographic string issued by Google Play Services.
> - A **Simulated Token** (prefixed with `fcm_test_`) is only generated when clicking "Generate Test Token" for local browser mocking. Real push notifications require a genuine device token.

### Step 3: Dispatch Notification to the Device

#### Method A: Web Console (Recommended)
1. Open `http://localhost:3000` on your computer.
2. Paste the copied device token into the **"Or Custom Token"** field.
3. Select a preset message or enter your custom title and body.
4. Click **"Dispatch Push via Backend"**.

#### Method B: Terminal CLI
Execute the provided CLI script from your terminal:
```bash
node send-notification-cli.js --token "<PASTE_DEVICE_TOKEN>" --title "Priority Alert" --body "Real push notification received in status bar!"
```

#### Method C: REST API (cURL)
```bash
curl -X POST http://localhost:3000/api/send-push \
  -H "Content-Type: application/json" \
  -d '{
    "token": "<PASTE_DEVICE_TOKEN>",
    "title": "Delivery Update",
    "body": "Your package is arriving shortly.",
    "priority": "high"
  }'
```

### Step 4: Verify Delivery
1. **Minimize the app** on your phone (return to the Home screen or lock the screen).
2. Within seconds, your device will sound, vibrate, and display the **heads-up banner in the Android notification drawer**.

---

## 🛠️ Building the APK from Source

To compile a new debug APK using Gradle:

```powershell
# 1. Sync web assets with Capacitor Android
npx cap sync

# 2. Build the Android debug APK
cd android
.\gradlew.bat assembleDebug
```
The compiled APK will be located at:
`android/app/build/outputs/apk/debug/app-debug.apk`

---

## ❓ Troubleshooting & FAQs

### Why does setting `http://localhost:3000` on the mobile device fail?
- `localhost` always resolves to the device on which the code is currently running (127.0.0.1). On a mobile phone, `localhost` refers to the phone itself rather than your development machine.
- To connect a mobile phone directly to your development server on the same network, use your computer's local Wi-Fi IP address (e.g. `http://192.168.1.x:3000`).
- If the mobile phone is on a separate cellular connection, dispatch notifications directly from your host machine to the phone's FCM device token via Google's servers.

### Why did a notification not appear in the system status bar?
- Ensure the token used does not begin with `fcm_test_` (which triggers simulation mode).
- Ensure notification permissions are granted in Android Settings for the application.
- On Android, background notifications are rendered by Google Play Services in the system drawer automatically. In the foreground, `@capacitor/push-notifications` delivers the message to the app runtime, where the notification channel `fcm_default_channel` triggers heads-up presentation.

---

## 📂 Project Structure

```
fcm-webview-app/
├── package.json                   # Project dependencies and operational scripts
├── capacitor.config.json          # Capacitor runtime configuration
├── server.js                      # Express application, FCM v1 dispatcher, SSE server
├── send-notification-cli.js       # Standalone CLI notification dispatch utility
├── firebase-service-account.json  # Firebase Admin credentials (local only)
├── android/
│   ├── app/
│   │   ├── google-services.json   # Google Services client configuration
│   │   ├── build.gradle           # Android application build configuration
│   │   └── src/main/
│   │       ├── AndroidManifest.xml # Android permissions (POST_NOTIFICATIONS, INTERNET)
│   │       └── java/com/pushapp/fcmwebview/MainActivity.java
└── public/
    ├── index.html                 # Glassmorphic web management console
    ├── styles.css                 # Styling, dark mode variables, and animations
    └── client.js                  # Capacitor push notification registration & event handlers
```

---

## 📄 License

This project is licensed under the [ISC License](LICENSE).
