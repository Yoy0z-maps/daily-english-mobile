// A snapshot fetched before/during a write must never replace optimistic state.
let revision = 0;
const pending = new Set<symbol>();
const listeners = new Set<() => void>();
export const mutationRevision = () => revision;
export const beginLearningMutation = () => {
  const token = Symbol();
  pending.add(token);
  revision += 1;
  return () => {
    if (!pending.delete(token)) return;
    revision += 1;
    if (!pending.size) listeners.forEach((resolve) => resolve());
  };
};
export const waitForLearningMutations = () => pending.size === 0
  ? Promise.resolve()
  : new Promise<void>((resolve) => {
      const done = () => { listeners.delete(done); resolve(); };
      listeners.add(done);
    });
