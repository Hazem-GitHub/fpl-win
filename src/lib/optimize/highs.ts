import { createRequire } from "node:module";
import { dirname, join } from "node:path";

type Highs = {
  solve: (
    problem: string,
    options?: Record<string, unknown>,
  ) => {
    Status: string;
    ObjectiveValue: number;
    Columns: Record<string, { Primal: number }>;
  };
};

let highsPromise: Promise<Highs> | null = null;

export async function getHighs(): Promise<Highs> {
  if (!highsPromise) {
    const require = createRequire(import.meta.url);
    const loadHighs = require("highs") as (opts?: {
      locateFile?: (file: string) => string;
    }) => Promise<Highs>;
    const wasmDir = dirname(require.resolve("highs"));
    highsPromise = loadHighs({
      locateFile: (file) => join(wasmDir, file),
    });
  }
  return highsPromise;
}

export function selectedIds(
  columns: Record<string, { Primal: number }>,
  prefix: string,
): number[] {
  const ids: number[] = [];
  for (const [name, col] of Object.entries(columns)) {
    if (!name.startsWith(prefix)) continue;
    if ((col.Primal ?? 0) > 0.5) {
      ids.push(Number.parseInt(name.slice(prefix.length), 10));
    }
  }
  return ids;
}
