import { AsyncLocalStorage } from "node:async_hooks";

type UsageStore = { userId: number | null; feature: string | null; workId: number | null; platform: string | null; sample: boolean };

const empty: UsageStore = { userId: null, feature: null, workId: null, platform: null, sample: true };
const storage = new AsyncLocalStorage<UsageStore>();

function bind<T>(partial: Partial<UsageStore>, fn: () => T) {
  const current = storage.getStore() ?? empty;
  return storage.run({ ...current, ...partial }, fn);
}

export function runWithUser<T>(userId: number, fn: () => T) {
  return bind({ userId }, fn);
}

export function runWithWork<T>(workId: number, fn: () => T) {
  return bind({ workId }, fn);
}

export function runWithFeature<T>(feature: string, fn: () => T) {
  return bind({ feature }, fn);
}

export function runWithPlatform<T>(platform: string, fn: () => T) {
  return bind({ platform }, fn);
}

export function runWithoutSample<T>(fn: () => T) {
  return bind({ sample: false }, fn);
}

export function currentUsage() {
  return storage.getStore() ?? empty;
}
