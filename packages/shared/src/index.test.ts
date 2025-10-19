import { describe, expect, it } from "vitest";
import { defaultFeatureFlags } from "./index";

describe("defaultFeatureFlags", () => {
  it("enables fake providers and disables advanced flows", () => {
    expect(defaultFeatureFlags.useFakeLLM).toBe(true);
    expect(defaultFeatureFlags.useFakeTTS).toBe(true);
    expect(defaultFeatureFlags.enableUrgency).toBe(false);
    expect(defaultFeatureFlags.enableMedals).toBe(false);
  });
});
