# 🚀 PushHub FCM: Fullstack WebView App with Firebase Cloud Messaging (FCM)

> **Created specifically for Aakash Bhaiya's exact architectural flow:**
> 1. Fullstack Localhost Web App (Frontend + Backend ek saath on `http://localhost:3000`).
> 2. Capacitor Android App wrapping `localhost:3000` via WebView.
> 3. Native Firebase Cloud Messaging (FCM) push notification layer with WhatsApp-style heads-up alerts.
>
> 🌐 **GitHub Repository:** [https://github.com/SakshamChawla76/fcm-webview-push-app](https://github.com/SakshamChawla76/fcm-webview-push-app)

---

## 🌟 Pre-Configured Firebase Project Details

A brand new dedicated Google Firebase project has already been provisioned for this workspace:

| Parameter | Value |
| :--- | :--- |
| **Firebase Project ID** | `pushhub-fcm-8586` |
| **Project Name** | PushHub FCM |
| **Android App Package Name** | `com.pushapp.fcmwebview` |
| **Firebase App ID** | `1:524560368513:android:5758176858561ad89cde80` |
| **Firebase Console URL** | [https://console.firebase.google.com/project/pushhub-fcm-8586/overview](https://console.firebase.google.com/project/pushhub-fcm-8586/overview) |
| **Google Services Config** | Already saved in `android/app/google-services.json` ✅ |

---

## 🏗️ Architecture & Network Flow

```
+──────────────────────────────────────────────────────────────────────────+
|                    PC / LOCAL MACHINE (EXPRESS SERVER)                   |
|                                                                          |
|  http://localhost:3000 (binds to 0.0.0.0:3000)                           |
|   ├── Static Glassmorphic UI Dashboard (Device Token Manager & Push Hub) |
|   ├── Device Token Registry API (POST /api/devices/register)             |
|   └── Firebase Admin Dispatcher (POST /api/send-push)                    |
|                         │                                                |
|                         ▼ Calls Google FCM v1 API                        |
|        [ Google Firebase Cloud Messaging Servers ]                       |
+─────────────────────────┼────────────────────────────────────────────────+
                          │ (Delivered over Internet)
                          ▼
+──────────────────────────────────────────────────────────────────────────+
|                    CAPACITOR ANDROID RUNTIME                             |
|                                                                          |
|  Android Native WebView:                                                 |
|   ├── Points to: http://10.0.2.2:3000 (Emulator) OR Wi-Fi IP (Phone)     |
|   ├── Plugin: @capacitor/push-notifications                             |
|   ├── Android High-Priority Channel: fcm_default_channel (Sound + Pop)   |
|   ├── Registers with Google Play Services on boot                        |
|   ├── Posts FCM Device Token to Backend                                  |
|   └── Receives WhatsApp-style Heads-Up Banner notification               |
+──────────────────────────────────────────────────────────────────────────+
```

---

## 📋 Quick Setup in 3 Minutes

### Step 1: Start the Fullstack Server
Terminal me command run karein:
```powershell
cd c:\Users\HP\app\fcm-webview-app
npm install
npm start
```
Server live ho jayega:
- **Browser Dashboard:** [http://localhost:3000](http://localhost:3000)
- **Android Emulator Address:** `http://10.0.2.2:3000`
- **Real Phone Wi-Fi Address:** `http://192.168.1.77:3000` *(Aapke network ka local IP terminal par display hoga)*

---

### Step 2: Download Firebase Admin Private Key (1-Click)
Real Android phone par Google servers se push bhejne ke liye Firebase Admin key chahiye:
1. Is direct link par click karein:
   👉 **[Download PushHub Service Account Key](https://console.firebase.google.com/project/pushhub-fcm-8586/settings/serviceaccounts/adminsdk)**
2. **"Generate new private key"** button dabayein aur **"Generate key"** confirm karein.
3. Downloaded file ka naam rename karke `firebase-service-account.json` rakhein aur yahan save kar dein:
   ```
   c:\Users\HP\app\fcm-webview-app\firebase-service-account.json
   ```
4. Server ko restart karein (`npm start`). Console me print hoga:
   ```
   ✅ Firebase Admin SDK successfully initialized with service account.
   ```
*(Note: Agar key nahi bhi lagayenge, tab bhi server automatically simulation mode me test push deliver karega!)*

---

### Step 3: Open in Android Studio & Run

```powershell
cd c:\Users\HP\app\fcm-webview-app
npx cap open android
```
Android Studio open hone ke baad:
1. Upper right corner me **Run (Green Play Button ▶️)** dabayein.
2. Select karein apna **Android Emulator** ya **USB Connected Physical Phone**.
3. App boot hote hi:
   - Screen par `http://10.0.2.2:3000` load hoga.
   - Android 13+ permission pop-up aayega: **"Allow PushHub FCM to send notifications?"** -> Click **Allow**.
   - App automatic Google Play Services se real FCM token generate karke backend par register kar degi!

---

## 🧪 How to Test Push Notifications

### Method 1: Web Dashboard (UI Visual Test)
1. Apne browser me [http://localhost:3000](http://localhost:3000) open karein.
2. **"Active Devices"** table me aapka Android phone display ho jayega.
3. Target device select karein.
4. Quick preset click karein (e.g. `WhatsApp Chat`).
5. **"Dispatch Push via Backend"** button dabayein!
6. **Result:**
   - Agar phone foreground me hai: App ke top se **WhatsApp-style heads-up banner** slide down hoga.
   - Agar phone locked ya background me hai: System tray me sound aur notification pop hoga!

### Method 2: Terminal / CLI Test Script
Ek simple command se notification fire karein:
```powershell
cd c:\Users\HP\app\fcm-webview-app
npm run test:push
```
Ya custom message ke sath:
```powershell
node send-notification-cli.js --title "💬 Aakash Bhaiya" --body "Bhai push test 100% working!"
```

### Method 3: REST API (cURL / Postman)
```bash
curl -X POST http://localhost:3000/api/send-push \
  -H "Content-Type: application/json" \
  -d '{
    "token": "<YOUR_DEVICE_FCM_TOKEN>",
    "title": "💬 Aakash Bhaiya",
    "body": "Hello from backend API!",
    "priority": "high"
  }'
```

---

## 📱 Physical Android Device (Real Phone) Testing Guide

Agar aap Emulator ki jagah **apne haath wale Android phone** par test karna chahte hain:
1. Make sure aapka **Laptop/PC** aur **Mobile Phone** dono **ek hi Wi-Fi router** se connected hain.
2. PC ka Wi-Fi IP check karein (Server start hone par print hota hai, e.g. `192.168.1.77`).
3. `capacitor.config.json` me `server.url` ko update karein:
   ```json
   {
     "appId": "com.pushapp.fcmwebview",
     "appName": "FCM WebView Push",
     "webDir": "public",
     "server": {
       "url": "http://192.168.1.77:3000",
       "cleartext": true
     }
   }
   ```
4. Terminal me sync karein:
   ```powershell
   npx cap sync
   ```
5. Phone par app chalayein — app directly aapke PC ke `localhost:3000` ko load karegi!

---

## 🛠️ File Structure Reference

```
fcm-webview-app/
├── package.json                          # Express, Capacitor, Firebase Admin dependencies
├── capacitor.config.json                 # Capacitor config (server.url, PushNotifications)
├── server.js                             # Express server, FCM v1 dispatcher, SSE events
├── send-notification-cli.js              # Standalone CLI notification sender
├── firebase-service-account.json         # (Downloaded from Firebase Console)
├── android/
│   ├── app/
│   │   ├── google-services.json          # Official Google config (pushhub-fcm-8586)
│   │   ├── build.gradle                  # Applies com.google.gms.google-services plugin
│   │   └── src/main/AndroidManifest.xml  # POST_NOTIFICATIONS, INTERNET permissions
└── public/
    ├── index.html                        # Glassmorphic UI Dashboard & WhatsApp banner
    ├── styles.css                        # Modern dark slate theme & animations
    └── client.js                         # Capacitor push notification registration & listeners
```

---

## 💡 Key Android Push Notification Technical Notes

1. **Android 13+ (API 33+) Requirement:**
   Android 13 se notifications by default blocked hoti hain jab tak user runtime permission grant na kare. Hamari app me `AndroidManifest.xml` me `POST_NOTIFICATIONS` permission aur `client.js` me automatic `PushNotifications.requestPermissions()` pre-configured hai.

2. **WhatsApp-Style Heads-Up Banner (Channel Configuration):**
   Android Oreo (8.0+) me banner dikhane ke liye Notification Channel ka **Importance Level 5 (`IMPORTANCE_HIGH`)** hona zaroori hota hai. Hamne `client.js` aur `server.js` me `fcm_default_channel` configure kiya hai taaki screen ke top par WhatsApp jaisa alert aapse miss na ho!
