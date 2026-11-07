import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("frontend root architecture", () => {
  it("keeps source at the approved roots and publishes component and feature APIs", () => {
    for (const directory of ["app", "components", "features", "public"]) {
      expect(existsSync(resolve(process.cwd(), directory)), directory).toBe(true);
    }
    expect(existsSync(resolve(process.cwd(), "src"))).toBe(false);

    const featureEntryPath = resolve(process.cwd(), "features/route-planning/index.ts");
    expect(existsSync(featureEntryPath)).toBe(true);

    const componentEntries = [
      { directory: "components/operation-status", component: "EstadoVista" },
      { directory: "components/ui/alert", component: "Alert" },
      { directory: "components/ui/badge", component: "Badge" },
      { directory: "components/ui/skeleton", component: "Skeleton" },
      {
        directory: "features/route-planning/components/map-view",
        component: "MapView",
      },
      {
        directory: "features/route-planning/components/map-view-client",
        component: "MapViewCliente",
      },
      {
        directory: "features/route-planning/components/priority-legend",
        component: "LeyendaPrioridades",
      },
      {
        directory: "features/route-planning/components/route-summary",
        component: "ResumenRecorrido",
      },
    ];
    for (const { directory, component } of componentEntries) {
      const entryPath = resolve(process.cwd(), directory, "index.ts");
      expect(existsSync(entryPath), `${component} has its own index.ts`).toBe(true);
      expect(readFileSync(entryPath, "utf8"), `${component} is exported from its folder`).toContain(
        component,
      );
    }

    for (const directory of ["app/tests", "components/tests", "features/route-planning/tests"]) {
      expect(existsSync(resolve(process.cwd(), directory)), directory).toBe(true);
    }

    const featureEntry = readFileSync(featureEntryPath, "utf8");
    const mapEntry = readFileSync(
      resolve(process.cwd(), "features/route-planning/components/map-view/index.ts"),
      "utf8",
    );
    const page = readFileSync(resolve(process.cwd(), "app/page.tsx"), "utf8");
    expect(featureEntry).toMatch(/export\s+\{[^}]*conRepeticiones/);
    expect(mapEntry).not.toContain("MapViewCliente");
    expect(featureEntry).not.toContain("MapViewCliente");
    expect(page).toContain('from "@/features/route-planning"');
  });
});
