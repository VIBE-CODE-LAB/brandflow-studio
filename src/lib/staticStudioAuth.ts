const ACCESS_PASSWORD = "Studio@5678";
const USAGE_KEY = "studioflow.freePlanUsed";
const AUTH_KEY = "studioflow.staticUnlocked";
const GEMINI_KEY = "studioflow.geminiApiKey";

export interface StudioAuthState {
  unlocked: boolean;
  hasGeminiKey: boolean;
  used: number;
}

export const emptyAuth: StudioAuthState = {
  unlocked: false,
  hasGeminiKey: false,
  used: 0,
};

function storageAvailable() {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

function localStorageAvailable() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function loadStudioUsage(): number {
  if (!localStorageAvailable()) return 0;
  return Number(window.localStorage.getItem(USAGE_KEY) ?? "0") || 0;
}

export function incrementStudioUsage(): number {
  if (!localStorageAvailable()) return 0;

  const next = loadStudioUsage() + 1;
  window.localStorage.setItem(USAGE_KEY, String(next));
  return next;
}

export async function getStudioAuth(): Promise<StudioAuthState> {
  const unlocked =
    storageAvailable() &&
    window.sessionStorage.getItem(AUTH_KEY) === "true" &&
    Boolean(window.sessionStorage.getItem(GEMINI_KEY));
  return {
    unlocked,
    hasGeminiKey: unlocked,
    used: loadStudioUsage(),
  };
}

export async function unlockStudio({
  data,
}: {
  data: { password: string; geminiApiKey: string };
}): Promise<StudioAuthState | (StudioAuthState & { error: string })> {
  const geminiApiKey = data.geminiApiKey.trim();

  if (data.password !== ACCESS_PASSWORD) {
    return { ...emptyAuth, error: "Access password is incorrect." };
  }

  if (!geminiApiKey) {
    return { ...emptyAuth, error: "Paste your Gemini API key to continue." };
  }

  // GitHub Pages is static, so there is no secure backend session.
  // Keep only a browser-session unlock flag and never persist the API key.
  if (storageAvailable()) {
    window.sessionStorage.setItem(AUTH_KEY, "true");
    window.sessionStorage.setItem(GEMINI_KEY, geminiApiKey);
  }

  return {
    unlocked: true,
    hasGeminiKey: true,
    used: loadStudioUsage(),
  };
}

export async function logoutStudio(): Promise<StudioAuthState> {
  if (storageAvailable()) {
    window.sessionStorage.removeItem(AUTH_KEY);
    window.sessionStorage.removeItem(GEMINI_KEY);
  }

  return {
    ...emptyAuth,
    used: loadStudioUsage(),
  };
}

export function getGeminiApiKey(): string | null {
  if (!storageAvailable()) return null;
  return window.sessionStorage.getItem(GEMINI_KEY);
}
