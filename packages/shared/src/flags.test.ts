import { describe, expect, it } from 'vitest';

import { defaultFeatureFlags } from './flags';

describe('defaultFeatureFlags', () => {
  it('enables fake services by default', () => {
    expect(defaultFeatureFlags.useFakeLLM).toBe(true);
    expect(defaultFeatureFlags.useFakeTTS).toBe(true);
  });
});
