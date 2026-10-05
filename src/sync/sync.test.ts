import { beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyCourse, emptyRoot } from '../domain/progress';
import { useProgress } from '../store/progressStore';

// A fake cloud: one stored document per user, sign-in calls the auth listener.
const db = new Map<string, string>();
let listener: ((u: { uid: string; name: string; email: string } | null) => void) | null = null;
const pushes: string[] = [];
vi.mock('./firebaseConfig', () => ({ firebaseConfig: () => ({ apiKey: 'k', authDomain: 'd', projectId: 'p', appId: 'a' }) }));
vi.mock('./cloud', () => ({
  loadCloud: async () => ({
    onUser: (cb: typeof listener) => {
      listener = cb;
      return () => {};
    },
    signIn: async () => listener?.({ uid: 'u1', name: 'Syla', email: 's@example.org' }),
    signOut: async () => listener?.(null),
    pull: async (uid: string) => db.get(uid) ?? null,
    push: async (uid: string, data: string) => {
      pushes.push(data);
      db.set(uid, data);
    },
  }),
}));

const { useSync } = await import('./syncStore');
const settle = () => new Promise((r) => setTimeout(r, 20));

describe('online progress', () => {
  beforeEach(() => {
    db.clear();
    pushes.length = 0;
  });

  it('merges the online copy into this device on sign-in and uploads the result', async () => {
    const online = emptyRoot('de', 1);
    online.courses.bn = emptyCourse(1);
    online.courses.bn.lessons['bn-l01'] = { completedAt: 5, times: 1, bestCorrect: 20, bestTotal: 24 };
    online.profile.xp = 300;
    db.set('u1', JSON.stringify(online));

    const local = emptyRoot('de', 2);
    local.courses.ru = emptyCourse(2);
    local.profile.xp = 40;
    useProgress.getState().applyMerged(local);

    await useSync.getState().signIn();
    await settle();
    await useSync.getState().syncNow();

    const root = useProgress.getState().root;
    expect(Object.keys(root.courses).sort()).toEqual(['bn', 'ru']);
    expect(root.profile.xp).toBe(300);
    expect(useSync.getState().status).toBe('synced');
    expect(JSON.parse(db.get('u1')!).courses.ru).toBeDefined();
  });

  it('does not upload when nothing changed', async () => {
    await useSync.getState().syncNow();
    const before = pushes.length;
    await useSync.getState().syncNow();
    expect(pushes.length).toBe(before);
  });

  it('replaces the online copy after a reset instead of merging it back', async () => {
    useProgress.getState().reset();
    await useSync.getState().overwriteCloud();
    expect(Object.keys(JSON.parse(db.get('u1')!).courses)).toEqual([]);
    await useSync.getState().syncNow();
    expect(Object.keys(useProgress.getState().root.courses)).toEqual([]);
  });
});
