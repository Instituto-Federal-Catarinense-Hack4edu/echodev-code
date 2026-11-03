/**
 * Runs a supabase-js query without awaiting it. Query builders are lazy: `void query`
 * never sends the request, only `.then()`/`await` does.
 */
export function fire(query: PromiseLike<{ error: { message: string } | null }>, label: string): void {
  query.then(
    ({ error }) => {
      if (error) console.warn(`[echodev] ${label}: ${error.message}`);
    },
    (e: unknown) => console.warn(`[echodev] ${label}:`, e),
  );
}
