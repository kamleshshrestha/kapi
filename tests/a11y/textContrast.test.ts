import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Secondary text uses `text-foreground/NN`. Below 60% the contrast on both the
 * light and the dark background falls under the 4.5:1 that small text needs
 * (measured: 40% is about 2.6:1 light and 3.4:1 dark, 50% about 3.4:1), so 60
 * is the floor. Backgrounds and borders (`bg-foreground/5`) are unaffected.
 */
const MIN_TEXT_OPACITY = 60;

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

describe("secondary text contrast", () => {
  it("never uses text-foreground below 60% opacity", () => {
    const offenders: string[] = [];
    for (const file of [...sources("app"), ...sources("components")]) {
      readFileSync(file, "utf8")
        .split("\n")
        .forEach((line, i) => {
          for (const [, opacity] of line.matchAll(/(?<![\w-])text-foreground\/(\d+)/g)) {
            if (Number(opacity) < MIN_TEXT_OPACITY) offenders.push(`${file}:${i + 1} text-foreground/${opacity}`);
          }
        });
    }
    expect(offenders).toEqual([]);
  });
});
