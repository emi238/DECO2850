import type { NativeStackScreenProps } from '@react-navigation/native-stack';

// App flow: Welcome → Create Account / Log In (no real auth yet) → first time:
// Household "Getting Started" → Home. From Home: Capture → Tagging → Space
// Saved → Analysis (⇄ Select breed). Profile edits details + household answers.
export type RootStackParamList = {
  Welcome: undefined;
  CreateAccount: undefined;
  Login: undefined;
  ResetPassword: undefined;
  Household: { onboarding?: boolean } | undefined;
  Profile: { editHousehold?: boolean } | undefined; // true = open with the household section unlocked
  Home: undefined;
  Capture: { fresh?: boolean } | undefined;
  Tagging: undefined;
  SpaceSaved: undefined;
  Analysis: { run?: boolean; report?: boolean } | undefined;
  SelectBreed: undefined;
};

export type ScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  T
>;
