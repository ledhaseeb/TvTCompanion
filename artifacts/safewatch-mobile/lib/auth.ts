import AsyncStorage from "@react-native-async-storage/async-storage";
import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithCredential,
  GoogleAuthProvider,
  onIdTokenChanged,
  signOut as firebaseSignOut,
  type Auth,
  type User,
} from "firebase/auth";

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

export function getFirebaseAuth(): Auth {
  if (firebaseAuth) return firebaseAuth;

  const apps = getApps();
  const app = apps.length > 0 ? getApp() : initializeApp(getFirebaseConfig());
  firebaseAuth = getAuth(app);
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

export function onTokenRefresh(
  callback: (token: string | null) => void,
): () => void {
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
