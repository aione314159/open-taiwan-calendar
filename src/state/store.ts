import { useSyncExternalStore } from "react";

type Listener = () => void;

/**
 * A minimal observable container.
 *
 * The plugin needs exactly two things from a state library: somewhere to keep a
 * value that both the React tree and the non-React callers (the settings page,
 * the one-click setup flow, the floating panel) can reach, and a way to tell
 * React that the value moved. `useSyncExternalStore` covers the second half,
 * which leaves so little for the first half that a dependency is not worth its
 * bundle size.
 *
 * `read` and `watch` are bound as fields rather than declared as methods
 * because `useSyncExternalStore` receives them as bare function references.
 */
export class Store<T> {
  private state: T;
  private readonly listeners = new Set<Listener>();

  constructor(initial: T) {
    this.state = initial;
  }

  read = (): T => this.state;

  /**
   * Replace the value and notify.
   *
   * Callers must hand over a fresh object rather than mutating the current one:
   * the selectors below compare by identity, so an in-place edit would leave
   * every subscriber convinced that nothing changed.
   */
  write(next: T): void {
    if (Object.is(next, this.state)) {
      return;
    }
    this.state = next;
    this.listeners.forEach((notify) => notify());
  }

  watch = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
}

/**
 * Subscribe a component to one slice of a store.
 *
 * `select` has to return something already held in the state — a primitive or
 * an existing reference. Building a new object inside it would hand
 * `useSyncExternalStore` a different snapshot on every call and spin the render
 * loop forever.
 */
export function useStoreValue<T, S>(store: Store<T>, select: (state: T) => S): S {
  return useSyncExternalStore(store.watch, () => select(store.read()));
}
