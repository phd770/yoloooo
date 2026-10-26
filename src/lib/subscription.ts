// Firestore retries transient network failures itself. A listener error, however,
// ends that subscription: recreate it, keeping the last visible data intact.
export function subscribeWithRecovery(
  start: (ready: () => void, failed: (error: unknown) => void) => () => void,
  onError: (error: unknown) => void,
  onRecovered: () => void,
) {
  let stopped = false;
  let failed = false;
  let retryCount = 0;
  let generation = 0;
  let unsubscribe: (() => void) | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const connect = () => {
    if (stopped) return;
    clearTimeout(timer);
    unsubscribe?.();
    const current = ++generation;
    unsubscribe = start(() => {
      if (stopped || current !== generation) return;
      failed = false;
      retryCount = 0;
      clearTimeout(timer);
      onRecovered();
    }, error => {
      if (stopped || current !== generation) return;
      failed = true;
      onError(error);
      clearTimeout(timer);
      timer = setTimeout(connect, Math.min(2000 * 2 ** retryCount++, 60000));
    });
  };
  const reconnect = () => {
    if (failed && navigator.onLine && document.visibilityState !== 'hidden') connect();
  };
  window.addEventListener('online', reconnect);
  document.addEventListener('visibilitychange', reconnect);
  connect();
  return () => {
    stopped = true;
    clearTimeout(timer);
    unsubscribe?.();
    window.removeEventListener('online', reconnect);
    document.removeEventListener('visibilitychange', reconnect);
  };
}
