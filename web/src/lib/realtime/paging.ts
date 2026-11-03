export const PAGE_SIZE = 1000;

/**
 * Reads every page until a short page arrives (PostgREST caps responses at 1000 rows).
 * `fetchPage(from, to)` uses inclusive bounds, like supabase-js `.range()`.
 */
export async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => Promise<T[]>,
  pageSize = PAGE_SIZE,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const page = await fetchPage(from, from + pageSize - 1);
    out.push(...page);
    if (page.length < pageSize) return out;
  }
}
