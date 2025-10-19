type Digit = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
type MinuteTens = 0 | 1 | 2 | 3 | 4 | 5;
type MinuteOnes = Digit;

type Hour = `${0 | 1}${Digit}` | `2${0 | 1 | 2 | 3}`;
type Minute = `${MinuteTens}${MinuteOnes}`;

export type TimeHM = `${Hour}:${Minute}`;

export type FeatureFlagKey = "useFakeLLM" | "useFakeTTS" | "enableUrgency" | "enableMedals";

export type FeatureFlagConfig = Record<FeatureFlagKey, boolean>;

export const defaultFeatureFlags: FeatureFlagConfig = {
  useFakeLLM: true,
  useFakeTTS: true,
  enableUrgency: false,
  enableMedals: false
};
