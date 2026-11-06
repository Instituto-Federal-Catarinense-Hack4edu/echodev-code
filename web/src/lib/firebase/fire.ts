/** Runs a write without awaiting it; failures are only logged (non-critical writes). */
export function fire(work: Promise<unknown>, label: string): void {
  work.catch((e: unknown) => console.warn(`[echodev] ${label}:`, e));
}
