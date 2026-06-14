export async function runPoolDynamic<T>(
  tasks: Array<() => Promise<T>>,
  getConcurrency: () => number,
  pollMs = 200,
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let nextIndex = 0;
  let inFlight = 0;
  let failed: unknown = null;

  function pump(): void {
    while (!failed && inFlight < getConcurrency() && nextIndex < tasks.length) {
      const idx = nextIndex++;
      inFlight++;
      tasks[idx]()
        .then((r) => {
          results[idx] = r;
        })
        .catch((err) => {
          failed = err;
        })
        .finally(() => {
          inFlight--;
        });
    }
  }

  return new Promise((resolve, reject) => {
    const timer = setInterval(() => {
      pump();
      if (failed) {
        clearInterval(timer);
        reject(failed);
        return;
      }
      if (nextIndex >= tasks.length && inFlight === 0) {
        clearInterval(timer);
        resolve(results);
      }
    }, pollMs);
    pump();
  });
}
