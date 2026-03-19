# Google Sign-In Setup for Android

## Prerequisites

Native Google Sign-In on Android requires the EAS build signing key's SHA-1 fingerprint to be registered in the Firebase console.

## Steps

### 1. Get the SHA-1 fingerprint from EAS

Run the following command to retrieve the signing credentials for your build profile:

```bash
eas credentials -p android
```

Select the keystore for your build profile (e.g., `preview`). The output will include the SHA-1 fingerprint.

Alternatively, if you have the keystore file locally:

```bash
keytool -list -v -keystore ./your-keystore.jks
```

### 2. Add SHA-1 to Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com/) → Project Settings → Your Apps → Android app (`com.safewatch.mobile`).
2. Under "SHA certificate fingerprints", click "Add fingerprint".
3. Paste the SHA-1 fingerprint from step 1.
4. Save.

If there is no Android app registered yet, add one with package name `com.safewatch.mobile`.

### 3. Download google-services.json (optional)

After adding the SHA-1, download the updated `google-services.json` and place it in `artifacts/safewatch-mobile/`. This is optional when using `@react-native-google-signin/google-signin` with the `webClientId` configuration approach, but recommended for completeness.

### 4. Verify webClientId

The `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` environment variable in `eas.json` must match the **Web client ID** from your Firebase project's OAuth 2.0 credentials (found in Google Cloud Console → APIs & Services → Credentials). This is the OAuth client of type "Web application", not the Android client.

## Troubleshooting

- **DEVELOPER_ERROR**: SHA-1 is not registered in Firebase, or `webClientId` is wrong.
- **SIGN_IN_CANCELLED**: User dismissed the account picker (handled gracefully in the app).
- **PLAY_SERVICES_NOT_AVAILABLE**: Device does not have Google Play Services (e.g., some emulators, Huawei devices).
