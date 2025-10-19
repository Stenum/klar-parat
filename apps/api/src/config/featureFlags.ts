import { defaultFeatureFlags, FeatureFlagConfig } from "@klar-parat/shared";

export type FeatureFlags = FeatureFlagConfig;

const toBoolean = (value: string | undefined, fallback: boolean) => {
  if (value === undefined) return fallback;
  return value.toLowerCase() === "true";
};

export const featureFlags: FeatureFlags = {
  useFakeLLM: toBoolean(process.env.USE_FAKE_LLM, defaultFeatureFlags.useFakeLLM),
  useFakeTTS: toBoolean(process.env.USE_FAKE_TTS, defaultFeatureFlags.useFakeTTS),
  enableUrgency: toBoolean(process.env.ENABLE_URGENCY, defaultFeatureFlags.enableUrgency),
  enableMedals: toBoolean(process.env.ENABLE_MEDALS, defaultFeatureFlags.enableMedals)
};
