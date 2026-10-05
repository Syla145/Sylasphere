/**
 * Firebase web configuration for online progress (optional).
 *
 * Firebase console → Project settings → General → "Your apps" → Web app →
 * "SDK setup and configuration" → Config. These values are public by design;
 * access is protected by Firestore rules (see README, "Online-Speicherung").
 *
 * Leave it at `null` and the app works exactly as before, without sync.
 */
export const FIREBASE_CONFIG: FirebaseWebConfig | null = {
  apiKey: 'AIzaSyCQabD4iyS2xfZAn-N7YHQGWheswrNebck',
  authDomain: 'jh-sylareads.firebaseapp.com',
  projectId: 'jh-sylareads',
  storageBucket: 'jh-sylareads.firebasestorage.app',
  messagingSenderId: '257677691895',
  appId: '1:257677691895:web:4ad6deb19f0930b3773cf2',
};

export interface FirebaseWebConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
  storageBucket?: string;
  messagingSenderId?: string;
}

/** Alternatively the config can come from the build (GitHub Actions variable VITE_FIREBASE_CONFIG, JSON). */
export function firebaseConfig(): FirebaseWebConfig | null {
  const fromEnv = import.meta.env.VITE_FIREBASE_CONFIG as string | undefined;
  if (fromEnv) {
    try {
      return JSON.parse(fromEnv) as FirebaseWebConfig;
    } catch {
      return FIREBASE_CONFIG;
    }
  }
  return FIREBASE_CONFIG;
}
