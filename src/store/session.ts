// Global session store (PRD §6). Persisted locally to AsyncStorage so pet mode,
// questionnaire answers, tags and the last result survive navigation and reloads.
// Frame base64 (heavy) is deliberately NOT persisted — only frame URIs are.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  Assessment,
  Frame,
  Mode,
  Pet,
  Questionnaire,
  Session,
  Tag,
} from '../types';

function uuid(): string {
  // RFC4122-ish v4, good enough for a demo session id.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export const defaultQuestionnaire: Questionnaire = {
  dwelling: 'apartment',
  rental: true,
  floor_level: 8,
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

function freshSession(): Session {
  return {
    session_id: uuid(),
    created_at: new Date().toISOString(),
    capture: { frames: [], panorama: null },
    mode: null,
    pet: null,
    questionnaire: { ...defaultQuestionnaire },
    tags: [],
    result: null,
  };
}

interface SessionState extends Session {
  // actions
  reset: () => void;
  setFrames: (frames: Frame[]) => void;
  setMode: (mode: Mode) => void;
  setPet: (pet: Pet | null) => void;
  setQuestionnaire: (patch: Partial<Questionnaire>) => void;
  addTag: (tag: Omit<Tag, 'id'>) => void;
  updateTag: (id: string, patch: Partial<Tag>) => void;
  removeTag: (id: string) => void;
  setResult: (result: Assessment | null) => void;
}

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      ...freshSession(),

      reset: () => set({ ...freshSession() }),

      setFrames: (frames) =>
        set((s) => ({ capture: { ...s.capture, frames } })),

      setMode: (mode) => set({ mode }),

      setPet: (pet) => set({ pet }),

      setQuestionnaire: (patch) =>
        set((s) => ({ questionnaire: { ...s.questionnaire, ...patch } })),

      addTag: (tag) =>
        set((s) => ({
          tags: [
            ...s.tags,
            { ...tag, id: uuid() },
          ],
        })),

      updateTag: (id, patch) =>
        set((s) => ({
          tags: s.tags.map((t) => (t.id === id ? { ...t, ...patch } : t)),
        })),

      removeTag: (id) =>
        set((s) => ({ tags: s.tags.filter((t) => t.id !== id) })),

      setResult: (result) => set({ result }),
    }),
    {
      name: 'pawspace-session',
      storage: createJSONStorage(() => AsyncStorage),
      // Persist everything except the heavy per-frame base64 bytes.
      partialize: (state) => ({
        session_id: state.session_id,
        created_at: state.created_at,
        capture: {
          frames: state.capture.frames.map((f) => ({ uri: f.uri })),
          panorama: state.capture.panorama,
        },
        mode: state.mode,
        pet: state.pet,
        questionnaire: state.questionnaire,
        tags: state.tags,
        result: state.result,
      }),
    }
  )
);
