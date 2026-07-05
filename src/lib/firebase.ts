/**
 * @module lib/firebase
 * @description Firebase client SDK initialization.
 *
 * Initializes Firebase App, Auth, and Firestore using environment variables.
 * Handles the SSR case where Firebase may already be initialized by checking
 * `getApps()` before calling `initializeApp()`.
 */

import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

/**
 * Firebase configuration sourced from NEXT_PUBLIC_FIREBASE_* env vars.
 * All values are required at runtime — missing keys will cause Firebase
 * initialization to fail with a descriptive error.
 */
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/**
 * Validate that all required Firebase config values are present.
 * Throws early with a clear message rather than letting Firebase fail cryptically.
 */
function validateConfig(): void {
  const requiredKeys: (keyof typeof firebaseConfig)[] = [
    'apiKey',
    'authDomain',
    'projectId',
    'storageBucket',
    'messagingSenderId',
    'appId',
  ];

  const missing = requiredKeys.filter((key) => !firebaseConfig[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required Firebase configuration: ${missing.join(', ')}. ` +
        'Ensure all NEXT_PUBLIC_FIREBASE_* environment variables are set.'
    );
  }
}

validateConfig();

/**
 * Firebase App instance.
 * Re-uses an existing app if one is already initialized (handles SSR hot-reload).
 */
export const app: FirebaseApp =
  getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

/** Firebase Auth instance bound to the app */
export const auth: Auth = getAuth(app);

/** Cloud Firestore instance bound to the app */
export const db: Firestore = getFirestore(app);
