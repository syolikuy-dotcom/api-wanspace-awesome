export const OPEN_PALETTE = "wanspace:open-palette";
export const emit = (name: string) => window.dispatchEvent(new Event(name));
