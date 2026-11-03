import { describe, expect, it } from "vitest";
import { fetchAllPages } from "./paging";

describe("fetchAllPages", () => {
  it("reads 2500 rows across 3 pages of 1000", async () => {
    const all = Array.from({ length: 2500 }, (_, i) => i + 1);
    const calls: [number, number][] = [];
    const rows = await fetchAllPages(async (from, to) => {
      calls.push([from, to]);
      return all.slice(from, to + 1);
    });
    expect(rows).toHaveLength(2500);
    expect(rows.at(-1)).toBe(2500);
    expect(calls).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
  });

  it("asks once more when the last page is exactly full", async () => {
    const all = Array.from({ length: 2000 }, (_, i) => i);
    let n = 0;
    const rows = await fetchAllPages(async (from, to) => {
      n++;
      return all.slice(from, to + 1);
    });
    expect(rows).toHaveLength(2000);
    expect(n).toBe(3);
  });
});
