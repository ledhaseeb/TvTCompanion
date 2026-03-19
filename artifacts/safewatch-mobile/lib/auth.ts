import AsyncStorage from "@react-native-async-storage/async-storage";
import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithCredential,
  signInWithPopup,
  GoogleAuthProvider,
  onIdTokenChanged,
  signOut as firebaseSignOut,
  type Auth,
  type User,
} from "firebase/auth";
import { Platform } from "react-native";
import {
  GoogleSignin,
  statusCodes,
} from "@react-native-google-signin/google-signin";

const AUTH_TOKEN_KEY = "firebase_id_token";
const USER_ROLE_KEY = "user_role";

let cachedToken: string | null = null;
let firebaseAuth: Auth | null = null;

function getFirebaseConfig() {
  return {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  };
}

let firebaseConfigured = false;

export function isFirebaseConfigured(): boolean {
  return firebaseConfigured;
}

export function getFirebaseAuth(): Auth {
  if (firebaseAuth) return firebaseAuth;

  const config = getFirebaseConfig();
  if (!config.apiKey) {
    throw new Error(
      "Firebase is not configured. Set EXPO_PUBLIC_FIREBASE_API_KEY and other Firebase environment variables.",
    );
  }

  const apps = getApps();
  const app = apps.length > 0 ? getApp() : initializeApp(config);
  firebaseAuth = getAuth(app);
  firebaseConfigured = true;
  return firebaseAuth;
}

export async function signInWithEmail(
  email: string,
  password: string,
): Promise<string> {
  const auth = getFirebaseAuth();
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const idToken = await cred.user.getIdToken();
  await setAuthToken(idToken);
  return idToken;
}

export async function signUpWithEmail(
  email: string,
  password: string,
): Promise<string> {
  const auth = getFirebaseAuth();
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  const idToken = await cred.user.getIdToken();
  await setAuthToken(idToken);
  return idToken;
}

export async function signInWithGoogleToken(
  googleIdToken: string,
): Promise<string> {
  const auth = getFirebaseAuth();
  const credential = GoogleAuthProvider.credential(googleIdToken);
  const cred = await signInWithCredential(auth, credential);
  const idToken = await cred.user.getIdToken();
  await setAuthToken(idToken);
  return idToken;
}

let googleSignInConfigured = false;

// NOTE: Native Google Sign-In requires the EAS build signing key SHA-1
// fingerprint to be registered in Firebase Console → Android app settings.
// See GOOGLE_SIGNIN_SETUP.md for full instructions.
function ensureGoogleSignInConfigured() {
  if (googleSignInConfigured) return;
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  if (!webClientId) {
    throw new Error(
      "Google Sign-In is not configured. Set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID.",
    );
  }
  GoogleSignin.configure({ webClientId });
  googleSignInConfigured = true;
}

export { statusCodes as GoogleSignInStatusCodes };

class GoogleSignInError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = "GoogleSignInError";
    this.code = code;
  }
}

async function signInWithGoogleWeb(): Promise<string> {
  const auth = getFirebaseAuth();
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  const idToken = await result.user.getIdToken();
  await setAuthToken(idToken);
  return idToken;
}

async function signInWithGoogleNative(): Promise<string> {
  ensureGoogleSignInConfigured();
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const response = await GoogleSignin.signIn();
  if (response.type === "cancelled") {
    throw new GoogleSignInError(
      "Sign-in was cancelled",
      String(statusCodes.SIGN_IN_CANCELLED),
    );
  }
  const googleIdToken = response.data?.idToken;
  if (!googleIdToken) {
    throw new Error("No ID token returned from Google Sign-In");
  }
  return signInWithGoogleToken(googleIdToken);
}

export async function signInWithGoogle(): Promise<string> {
  if (Platform.OS === "web") {
    return signInWithGoogleWeb();
  }
  return signInWithGoogleNative();
}

export function onTokenRefresh(
  callback: (token: string | null) => void,
): () => void {
  if (!firebaseConfigured) return () => {};
  const auth = getFirebaseAuth();
  return onIdTokenChanged(auth, async (user: User | null) => {
    if (user) {
      const token = await user.getIdToken();
      await setAuthToken(token);
      callback(token);
    } else {
      await clearAuth();
      callback(null);
    }
  });
}

export async function refreshToken(): Promise<string | null> {
  const auth = getFirebaseAuth();
  const user = auth.currentUser;
  if (!user) return null;
  const token = await user.getIdToken(true);
  await setAuthToken(token);
  return token;
}

export async function getIdToken(): Promise<string | null> {
  if (!firebaseConfigured) {
    if (cachedToken) return cachedToken;
    const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
    cachedToken = token;
    return token;
  }
  const auth = getFirebaseAuth();
  const user = auth.currentUser;
  if (user) {
    const token = await user.getIdToken();
    await setAuthToken(token);
    return token;
  }
  if (cachedToken) return cachedToken;
  const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
  cachedToken = token;
  return token;
}

export async function setAuthToken(token: string): Promise<void> {
  cachedToken = token;
  await AsyncStorage.setItem(AUTH_TOKEN_KEY, token);
}

export async function clearAuth(): Promise<void> {
  cachedToken = null;
  await AsyncStorage.multiRemove([AUTH_TOKEN_KEY, USER_ROLE_KEY]);
  const auth = getFirebaseAuth();
  try {
    await firebaseSignOut(auth);
  } catch {}
}

export async function getUserRole(): Promise<string | null> {
  return AsyncStorage.getItem(USER_ROLE_KEY);
}

export async function setUserRole(role: string): Promise<void> {
  await AsyncStorage.setItem(USER_ROLE_KEY, role);
}
