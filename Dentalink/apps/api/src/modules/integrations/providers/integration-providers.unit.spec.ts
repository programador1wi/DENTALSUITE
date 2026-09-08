import { ManualPaymentProvider } from "./integration-providers";

describe("ManualPaymentProvider webhook secret validation", () => {
  const provider = new ManualPaymentProvider();

  it.each([
    [undefined, undefined],
    ["configured-secret", undefined],
    [undefined, "provided-secret"],
    ["configured-secret", "short"],
    ["configured-secret", "configured-secreu"]
  ])("fails closed for absent or incorrect secrets", (expected, provided) => {
    expect(provider.validateWebhookSecret(expected, provided)).toBe(false);
  });

  it("accepts only an exact secret", () => {
    expect(provider.validateWebhookSecret("configured-secret", "configured-secret")).toBe(true);
  });
});
