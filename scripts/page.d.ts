// What a web view's page sees beyond the DOM: the bridge the game adds to the page's window. Guide samples that
// run in the page are type-checked against this and lib.dom by check_samples.mjs, not against the contract.

/**
 * Sends an event from the page to the client script's `Web.on(view, eventName, handler)` handlers. Both arguments
 * are required: the payload is a string, such as `JSON.stringify(...)`, or null for none.
 */
declare function callEvent(eventName: string, payload: string | null): boolean;

interface Window {
  /**
   * `Web.emit(view, eventName, payload)` arrives as a CustomEvent on the page's window, with the payload in
   * `detail`. A DOM event's own name keeps its own event type.
   */
  addEventListener<K extends string>(
    type: K & (K extends keyof WindowEventMap ? never : unknown),
    listener: (this: Window, event: CustomEvent) => unknown,
    options?: boolean | AddEventListenerOptions,
  ): void;
}
