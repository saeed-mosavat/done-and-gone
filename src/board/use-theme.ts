import { useSyncExternalStore } from "react";

type Theme = "light" | "dark";
const key = "done-and-gone-theme";
const changeEvent = "done-and-gone-theme-change";
let temporaryPreference: Theme | undefined;

function readPreference(): Theme | undefined {
  if (temporaryPreference) return temporaryPreference;
  try {
    const value = localStorage.getItem(key);
    return value === "light" || value === "dark" ? value : undefined;
  } catch {
    return undefined;
  }
}

function subscribe(notify: () => void) {
  window.addEventListener("storage", notify);
  window.addEventListener(changeEvent, notify);
  return () => {
    window.removeEventListener("storage", notify);
    window.removeEventListener(changeEvent, notify);
  };
}

function setTheme(theme: Theme) {
  // Storage may be blocked or full. The toggle must still work for this visit.
  temporaryPreference = theme;
  try {
    localStorage.setItem(key, theme);
    temporaryPreference = undefined;
  } catch {
    // Retain the in-memory preference for this visit.
  }
  window.dispatchEvent(new Event(changeEvent));
}

export function useTheme() {
  const theme = useSyncExternalStore(
    subscribe,
    readPreference,
    () => undefined
  );
  return [theme, setTheme] as const;
}
