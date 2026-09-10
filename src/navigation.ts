import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type RootStackParamList = {
  Capture: undefined;
  Mode: undefined;
  Questionnaire: undefined;
  Tagging: undefined;
  Results: undefined;
  Room3D: undefined;
};

export type ScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  T
>;
