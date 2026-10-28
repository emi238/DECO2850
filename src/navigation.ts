import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { TodoNeed } from './logic/recommend';

// App flow: Welcome → Create Account / Log In (no real auth yet) → first time:
// Onboarding ("Getting Started", one or two questions per step) → Home. From Home: Capture → Tagging → Space
// Saved → Analysis (⇄ Select breed). Profile edits details + household answers.
export type RootStackParamList = {
  Welcome: undefined;
  CreateAccount: undefined;
  Login: undefined;
  ResetPassword: undefined;
  Onboarding: undefined; // first-time questionnaire, step by step
  Household: undefined;
  Profile: { editHousehold?: boolean; focus?: 'routine' } | undefined; // true = open with the household section unlocked
  Home: { tour?: boolean } | undefined; // true = start the walkthrough (after onboarding)
  Capture: { fresh?: boolean; recheck?: boolean } | undefined; // recheck: new photos for this space, then compare
  Tagging: undefined;
  SpaceSaved: undefined;
  // place = mark this area off-limits; recheck = open the Re-check sheet; compare = re-run and show What changed
  Analysis: { run?: boolean; report?: boolean; place?: string; recheck?: boolean; compare?: boolean } | undefined;
  WhatChanged: undefined; // after a re-check (Results guide step 4)
  // Results screens 2–4 (Results guide step 2). `need` filters to one of the 5 needs (or setup).
  Todo: { need?: TodoNeed } | undefined;
  ItemDetail: { id: string; need?: TodoNeed };
  ResultsMap: { id?: string; need?: TodoNeed } | undefined;
  SelectBreed: { mode?: 'explore' | 'in_mind' } | undefined; // explore = suggestions (B2)
};

export type ScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  T
>;
