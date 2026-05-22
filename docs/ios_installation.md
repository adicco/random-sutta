# iOS Installation Guide (AltStore & Sideloading)

This guide provides instructions on how to install and update **Random Sutta** on your iPhone or iPad using AltStore.

## 1. What is AltStore?
AltStore is an alternative app store for iOS that allows you to install apps (Sideloading) without using the official App Store. It is widely used by developers and enthusiasts to share apps directly.

## 2. Prerequisites
- An iPhone or iPad running iOS 12.2 or later.
- A Mac or Windows PC (for the initial setup of AltServer).
- An Apple ID (we recommend using a secondary/burner Apple ID for safety).

---

## 3. Installation Steps

### Step 1: Install AltStore on your Device
If you haven't installed AltStore yet, follow the official guide:
- **Official Website:** [altstore.io](https://altstore.io)
- **Basic Steps:**
  1. Download AltServer for Mac or Windows.
  2. Connect your iPhone to your computer via USB.
  3. Click the AltServer icon in the menu bar/system tray and select **"Install AltStore"**.
  4. Enter your Apple ID and password to sign the app.

### Step 2: Add Random Sutta Source
Adding our official source allows you to receive update notifications and install the app with a single tap.

1. Open the **AltStore** app on your iPhone.
2. Go to the **"Sources"** tab.
3. Tap the **"+"** button in the top right corner.
4. Copy and paste the following URL (GitHub Raw is most reliable):
   ```text
   https://raw.githubusercontent.com/vjjda/random-sutta/main/altstore.json
   ```
   *Alternative link (GitHub Pages):*
   ```text
   https://vjjda.github.io/random-sutta/altstore.json
   ```
5. Tap **"Add Source"**. You should now see **"Random Sutta Source"** in your list.

### Step 3: Install the App
1. Go to the **"Browse"** tab in AltStore.
2. Locate **"Random Sutta"** under the newly added source.
3. Tap the **"FREE"** or **"GET"** button to download and install.
4. Once installed, the app will appear on your Home Screen.

---

## 4. How to Update
One of the best features of using the AltStore Source is easy updates:
1. When a new version is released (and we've deployed it), you will see an **"Update"** badge in AltStore.
2. Go to the **"My Apps"** tab.
3. Tap **"Update All"** or the update button next to Random Sutta.
4. *Note: You must be on the same Wi-Fi as your computer running AltServer to refresh or update apps.*

---

## 5. Important Notes (7-Day Limit)
- **App Refreshing:** Apps installed via AltStore expire every **7 days** due to Apple's free developer account limitations.
- **Auto-Refresh:** AltStore will attempt to refresh your apps automatically in the background when you are on the same Wi-Fi as AltServer.
- **Manual Refresh:** You can manually refresh anytime by going to the "My Apps" tab in AltStore and tapping **"Refresh All"**.

## 6. Troubleshooting
- **"App Not Available":** Ensure your iPhone and PC are on the same Wi-Fi network and AltServer is running.
- **Untrusted Developer:** After first install, go to *Settings > General > VPN & Device Management* on your iPhone and tap **"Trust"** on your Apple ID.

---
*May you be happy, may you be free from suffering.*
