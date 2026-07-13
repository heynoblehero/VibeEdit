import { describe, expect, it } from "bun:test";
import { resolveRightsBasis, RightsError } from "./rights";

describe("resolveRightsBasis", () => {
  it("always allows recreate (reference-only, no rights needed)", () => {
    expect(resolveRightsBasis({ action: "recreate" })).toBe("reference-only");
    expect(resolveRightsBasis({ action: "recreate", license: null })).toBe("reference-only");
  });

  it("blocks reuse/save without attestation or a CC license", () => {
    expect(() => resolveRightsBasis({ action: "reuse" })).toThrow(RightsError);
    expect(() =>
      resolveRightsBasis({ action: "save", license: "Standard YouTube License" }),
    ).toThrow(RightsError);
  });

  it("allows reuse when the user attests ownership", () => {
    expect(resolveRightsBasis({ action: "reuse", attested: true })).toBe("owner-attested");
    expect(resolveRightsBasis({ action: "save", attested: true })).toBe("owner-attested");
  });

  it("allows reuse for Creative Commons sources", () => {
    expect(resolveRightsBasis({ action: "reuse", license: "Creative Commons Attribution" })).toBe(
      "cc",
    );
    expect(resolveRightsBasis({ action: "save", license: "CC-BY" })).toBe("cc");
  });

  it("throws a 403-coded RightsError", () => {
    try {
      resolveRightsBasis({ action: "reuse" });
      throw new Error("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(RightsError);
      expect((error as RightsError).status).toBe(403);
    }
  });
});
