import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type RootStackParamList = {
  Home: undefined;
  NewSpace: { first?: boolean } | undefined;
  Capture: undefined;
  Mode: undefined;
  Questionnaire: { editing?: boolean } | undefined;
  Tagging: undefined;
  Results: undefined;
  Room3D: undefined;
};

export type ScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  T
>;
