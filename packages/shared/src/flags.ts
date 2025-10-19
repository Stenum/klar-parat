export type FeatureFlags = {
  useFakeLLM: boolean;
  useFakeTTS: boolean;
  enableUrgency: boolean;
  enableMedals: boolean;
};

export const defaultFeatureFlags: FeatureFlags = {
  useFakeLLM: true,
  useFakeTTS: true,
  enableUrgency: false,
  enableMedals: false
};
