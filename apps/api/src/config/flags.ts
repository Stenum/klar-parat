import { defaultFeatureFlags, type FeatureFlags } from '@klar-parat/shared';

type BooleanFlagKey = keyof FeatureFlags;

const FLAG_ENV_MAP: Record<BooleanFlagKey, string> = {
  useFakeLLM: 'FLAG_USE_FAKE_LLM',
  useFakeTTS: 'FLAG_USE_FAKE_TTS',
  enableUrgency: 'FLAG_ENABLE_URGENCY',
  enableMedals: 'FLAG_ENABLE_MEDALS'
};

const parseBoolean = (value: string | undefined): boolean | undefined => {
  if (value === undefined) return undefined;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
};

export const loadFeatureFlags = (): FeatureFlags => {
  const flags: Partial<FeatureFlags> = {};

  (Object.keys(FLAG_ENV_MAP) as BooleanFlagKey[]).forEach((flag) => {
    const envVar = FLAG_ENV_MAP[flag];
    const parsed = parseBoolean(process.env[envVar]);
    if (parsed !== undefined) {
      flags[flag] = parsed;
    }
  });

  return { ...defaultFeatureFlags, ...flags };
};
