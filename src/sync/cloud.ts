import type { FirebaseWebConfig } from './firebaseConfig';

/** Firestore collection with one document per user (document id = user id). */
const COLLECTION = 'sylareads';

export interface CloudUser {
  uid: string;
  name: string | null;
  email: string | null;
}

export interface Cloud {
  onUser: (cb: (user: CloudUser | null) => void) => () => void;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  /** The stored progress JSON, or null if this user has none yet. */
  pull: (uid: string) => Promise<string | null>;
  push: (uid: string, data: string) => Promise<void>;
}

let loading: Promise<Cloud> | null = null;

/** Loads Firebase on first use only, so the app stays small for everyone without sync. */
export function loadCloud(config: FirebaseWebConfig): Promise<Cloud> {
  loading ??= (async () => {
    const [{ initializeApp }, auth, fs] = await Promise.all([import('firebase/app'), import('firebase/auth'), import('firebase/firestore')]);
    const app = initializeApp(config, 'sylareads');
    const a = auth.getAuth(app);
    const db = fs.getFirestore(app);
    const toUser = (u: { uid: string; displayName: string | null; email: string | null } | null): CloudUser | null =>
      u ? { uid: u.uid, name: u.displayName, email: u.email } : null;
    return {
      onUser: (cb) => auth.onAuthStateChanged(a, (u) => cb(toUser(u))),
      signIn: async () => {
        const provider = new auth.GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        await auth.signInWithPopup(a, provider);
      },
      signOut: () => auth.signOut(a),
      pull: async (uid) => {
        const snap = await fs.getDoc(fs.doc(db, COLLECTION, uid));
        const data = snap.exists() ? snap.data().data : null;
        return typeof data === 'string' ? data : null;
      },
      push: async (uid, data) => {
        await fs.setDoc(fs.doc(db, COLLECTION, uid), { data, updatedAt: fs.serverTimestamp(), schema: 1 });
      },
    };
  })();
  loading.catch(() => {
    loading = null;
  });
  return loading;
}
