/** Reject if a game write does not settle in time, so move locks never stick. */
export async function withMoveTimeout<T>(
  request: Promise<T>,
  timeoutMs = 15000,
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout>;
  try {
    return await Promise.race([
      request,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error("החיבור איטי")), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timeout!);
  }
}

/** True when a snapshot only changed metadata (same document data). */
export function sameData(previous: unknown, next: unknown): boolean {
  if (previous === next) return true;
  if (!previous || !next) return false;
  try {
    return JSON.stringify(previous) === JSON.stringify(next);
  } catch {
    return false;
  }
}
