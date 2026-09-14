// Global store for MANY spaces (living room, garage, …). One space is "current";
// the onboarding screens read the current space and write to it through the
// same-named actions (setFrames, setMode, …). Persisted locally to AsyncStorage;
// heavy per-frame base64 is kept in memory only.

import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  Assessment,
  Frame,
  Mode,
  Pet,
  Questionnaire,
  Space,
  Tag,
} from '../types';

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export const defaultQuestionnaire: Questionnaire = {
  dwelling: 'apartment',
  rental: true,
  neighbours: 'attached',
  floor_level: null, // not asked in the redesigned questionnaire
  outdoor_access: 'balcony',
  adults: 1,
  children: 0,
  children_ages: '',
  infant_present: false,
  existing_pets: [],
  off_limit_zones: [],
  activity_level: 'medium',
  wants_apartment_friendly: true,
};

function freshSpace(name: string, baseQuestionnaire: Questionnaire): Space {
  return {
    id: uuid(),
    name: name.trim() || 'New space',
    created_at: new Date().toISOString(),
    capture: { frames: [], panorama: null },
    mode: null,
    pet: null,
    questionnaire: { ...baseQuestionnaire },
    tags: [],
    result: null,
  };
}

export interface Profile {
  name: string;
  email: string;
}

interface SessionState {
  spaces: Space[];
  currentSpaceId: string | null;
  onboarded: boolean;
  household: Questionnaire; // shared across spaces, set at onboarding, edited in Profile
  profile: Profile;

  setHousehold: (patch: Partial<Questionnaire>) => void;
  setProfile: (patch: Partial<Profile>) => void;
  resetAll: () => void;

  // ---- space management ----
  current: () => Space | null;
  addSpace: (name: string) => string; // creates a fresh space, makes it current
  renameSpace: (id: string, name: string) => void;
  removeSpace: (id: string) => void;
  setCurrentSpace: (id: string) => void;
  setOnboarded: (v: boolean) => void;

  // ---- current-space mutations (used by the onboarding screens) ----
  setFrames: (frames: Frame[]) => void;
  setMode: (mode: Mode) => void;
  setPet: (pet: Pet | null) => void;
  setQuestionnaire: (patch: Partial<Questionnaire>) => void;
  addTag: (tag: Omit<Tag, 'id'>) => void;
  updateTag: (id: string, patch: Partial<Tag>) => void;
  removeTag: (id: string) => void;
  setResult: (result: Assessment | null, source?: 'ai' | 'mock', note?: string) => void;
  patchSpace: (patch: Partial<Space>) => void; // label, name, saved flag…
  visitSpace: (id: string) => void; // make current + count the visit
}

type SetFn = (partial: Partial<SessionState> | ((s: SessionState) => Partial<SessionState>)) => void;
type GetFn = () => SessionState;

// Apply a patch to whichever space is current.
function patchCurrent(set: SetFn, get: GetFn, fn: (sp: Space) => Partial<Space>) {
  const id = get().currentSpaceId;
  if (!id) return;
  set((s) => ({
    spaces: s.spaces.map((sp) => (sp.id === id ? { ...sp, ...fn(sp) } : sp)),
  }));
}

export const useSession = create<SessionState>()(
  persist(
    (set, get) => ({
      spaces: [],
      currentSpaceId: null,
      onboarded: false,
      household: { ...defaultQuestionnaire },
      profile: { name: '', email: '' },

      setHousehold: (patch) => set((s) => ({ household: { ...s.household, ...patch } })),
      setProfile: (patch) => set((s) => ({ profile: { ...s.profile, ...patch } })),
      resetAll: () =>
        set({
          spaces: [],
          currentSpaceId: null,
          onboarded: false,
          household: { ...defaultQuestionnaire },
          profile: { name: '', email: '' },
        }),

      current: () => {
        const s = get();
        return s.spaces.find((sp) => sp.id === s.currentSpaceId) ?? null;
      },

      addSpace: (name) => {
        const base = get().household ?? defaultQuestionnaire;
        const sp = freshSpace(name, base);
        set((s) => ({ spaces: [...s.spaces, sp], currentSpaceId: sp.id }));
        return sp.id;
      },

      renameSpace: (id, name) =>
        set((s) => ({
          spaces: s.spaces.map((sp) => (sp.id === id ? { ...sp, name: name.trim() || sp.name } : sp)),
        })),

      removeSpace: (id) =>
        set((s) => {
          const spaces = s.spaces.filter((sp) => sp.id !== id);
          const currentSpaceId = s.currentSpaceId === id ? spaces[0]?.id ?? null : s.currentSpaceId;
          return { spaces, currentSpaceId };
        }),

      setCurrentSpace: (id) => set({ currentSpaceId: id }),
      setOnboarded: (v) => set({ onboarded: v }),

      setFrames: (frames) => patchCurrent(set, get, (sp) => ({ capture: { ...sp.capture, frames } })),
      setMode: (mode) => patchCurrent(set, get, () => ({ mode })),
      setPet: (pet) => patchCurrent(set, get, () => ({ pet })),
      setQuestionnaire: (patch) =>
        patchCurrent(set, get, (sp) => ({ questionnaire: { ...sp.questionnaire, ...patch } })),
      addTag: (tag) => patchCurrent(set, get, (sp) => ({ tags: [...sp.tags, { ...tag, id: uuid() }] })),
      updateTag: (id, patch) =>
        patchCurrent(set, get, (sp) => ({ tags: sp.tags.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
      removeTag: (id) => patchCurrent(set, get, (sp) => ({ tags: sp.tags.filter((t) => t.id !== id) })),
      setResult: (result, source, note) =>
        patchCurrent(set, get, () => ({ result, resultSource: source, resultNote: note })),
      patchSpace: (patch) => patchCurrent(set, get, () => patch),
      visitSpace: (id) =>
        set((s) => ({
          currentSpaceId: id,
          spaces: s.spaces.map((sp) => (sp.id === id ? { ...sp, visits: (sp.visits ?? 0) + 1 } : sp)),
        })),
    }),
    {
      name: 'pawspace-spaces',
      storage: createJSONStorage(() => AsyncStorage),
      // The built-in demo rooms were removed; drop any saved space that used one
      // (its photo no longer exists and would crash the image view).
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<SessionState>;
        const spaces = (p.spaces ?? []).filter(
          (sp) => !sp.capture.frames.some((f) => f.uri.startsWith('asset:') || f.uri.startsWith('demo:'))
        );
        const currentSpaceId = spaces.some((sp) => sp.id === p.currentSpaceId) ? p.currentSpaceId! : spaces[0]?.id ?? null;
        return { ...current, ...p, spaces, currentSpaceId };
      },
      // Persist everything except the heavy per-frame base64 bytes.
      partialize: (state) => ({
        spaces: state.spaces.map((sp) => ({
          ...sp,
          capture: {
            frames: sp.capture.frames.map((f) => ({ uri: f.uri })),
            panorama: sp.capture.panorama,
          },
        })),
        currentSpaceId: state.currentSpaceId,
        onboarded: state.onboarded,
        household: state.household,
        profile: state.profile,
      }),
    }
  )
);

// The current space, as a reactive hook for screens.
export function useCurrentSpace(): Space | null {
  return useSession((s) => s.spaces.find((sp) => sp.id === s.currentSpaceId) ?? null);
}

// True once the persisted state has loaded — gate the first render on this so we
// don't flash the onboarding screen before we know whether the user is onboarded.
export function useStoreHydrated(): boolean {
  const [hydrated, setHydrated] = useState<boolean>(useSession.persist.hasHydrated());
  useEffect(() => {
    const unsub = useSession.persist.onFinishHydration(() => setHydrated(true));
    if (useSession.persist.hasHydrated()) setHydrated(true);
    return unsub;
  }, []);
  return hydrated;
}
