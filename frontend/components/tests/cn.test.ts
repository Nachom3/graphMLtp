import { describe, expect, it } from "vitest";

import { cn } from "../../lib/utils";

describe("cn", () => {
  it("combines conditional classes and resolves conflicting Tailwind utilities", () => {
    expect(cn("p-2", false && "hidden", "p-4", "text-sm")).toBe("p-4 text-sm");
  });
});
