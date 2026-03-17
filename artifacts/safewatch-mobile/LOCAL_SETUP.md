# SafeWatch — Local Setup for EAS Development Build

## Step 1: Download the Project from Replit

1. Open your Replit project in a browser
2. Click the three-dot menu (⋮) in the top-left of the file sidebar
3. Select **"Download as ZIP"**
4. Unzip the downloaded file on your computer

## Step 2: Install Prerequisites

Make sure you have these installed on your machine:

- **Node.js** v18 or later — https://nodejs.org
- **pnpm** — Install with: `npm install -g pnpm`
- **EAS CLI** — Install with: `npm install -g eas-cli`
- **Expo account** — Sign up at https://expo.dev if you haven't already

## Step 3: Log in to Expo

```bash
eas login
```

Enter your Expo account credentials when prompted.

## Step 4: Install Dependencies

From the root of the unzipped project:

```bash
pnpm install
```

## Step 5: Navigate to the Mobile App

```bash
cd artifacts/safewatch-mobile
```

## Step 6: Build the Android Development APK

```bash
eas build --profile development --platform android
```

EAS will:
- Ask you to confirm the Android package name (`com.safewatch.mobile`) — press Enter
- Upload your project to Expo's build servers
- Build the APK in the cloud (usually takes 5-15 minutes)
- Give you a download link when complete

## Step 7: Install the APK

1. Download the APK from the link EAS provides
2. Transfer it to your Android phone (email it to yourself, Google Drive, USB cable, etc.)
3. Open the APK on your phone to install it
   - You may need to allow "Install from unknown sources" in your phone settings

## Step 8: Connect to the Dev Server

Once the development build is installed and opened:

1. It will show the Expo dev client screen
2. Enter your Replit Expo dev server URL:
   ```
   exp://5695f896-4ef8-48ce-9292-73578d94d4b4-00-emt8n6x0r1bl.expo.riker.replit.dev
   ```
3. The app will load with full native module support, including Chromecast

## Testing Chromecast

1. Make sure your Android phone and Chromecast are on the same Wi-Fi network
2. Open the app and start a viewing session
3. On the player screen, you should see a Cast icon in the control bar
4. Tap the Cast icon to connect to your Chromecast
5. The playlist will start playing on the TV!

## Troubleshooting

- **"eas: command not found"** — Run `npm install -g eas-cli` again
- **Build fails with signing errors** — EAS handles debug signing automatically for development builds; just re-run the build command
- **Can't connect to dev server** — Make sure the Expo workflow is running in Replit and your phone can reach the internet
- **Cast icon not showing** — Cast only works in the development build, not Expo Go. Make sure you installed the APK from Step 7, not the Expo Go app
