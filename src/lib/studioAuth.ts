import { createServerFn } from "@tanstack/react-start";
import { clearSession, updateSession, useSession } from "@tanstack/react-start/server";

const ACCESS_PASSWORD = "Studio@5678";
const USAGE_KEY = "studioflow.freePlanUsed";
const SESSION_SECRET =
  process.env.STUDIO_SESSION_SECRET ||
  (process.env.NODE_ENV === "production"
    ? undefined
    : "studio-flow-development-session-secret-change-before-production");

function getSessionConfig() {
  if (!SESSION_SECRET) {
    throw new Error("STUDIO_SESSION_SECRET is required in production.");
  }

  return {
    password: SESSION_SECRET,
    name: "studioflow-session",
    maxAge: 60 * 60 * 24 * 7,
    cookie: {
      httpOnly: true,
      sameSite: "lax" as const,
      secure: process.env.NODE_ENV === "production",
      path: "/",
    },
  };
}

interface StudioSessionData {
  unlocked?: boolean;
  geminiApiKey?: string;
}

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

function publicAuth(data: StudioSessionData | undefined, used = 0): StudioAuthState {
  return {
    unlocked: data?.unlocked === true && Boolean(data.geminiApiKey),
    hasGeminiKey: Boolean(data?.geminiApiKey),
    used,
  };
}

function storageAvailable() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function loadStudioUsage(): number {
  if (!storageAvailable()) return 0;
  return Number(window.localStorage.getItem(USAGE_KEY) ?? "0") || 0;
}

export function incrementStudioUsage(): number {
  if (!storageAvailable()) return 0;

  const next = loadStudioUsage() + 1;
  window.localStorage.setItem(USAGE_KEY, String(next));
  return next;
}

export const getStudioAuth = createServerFn({ method: "GET" }).handler(async () => {
  const session = await useSession<StudioSessionData>(getSessionConfig());
  return publicAuth(session.data);
});

export const unlockStudio = createServerFn({ method: "POST" })
  .validator((data: { password: string; geminiApiKey: string }) => data)
  .handler(async ({ data }) => {
    const geminiApiKey = data.geminiApiKey.trim();

    if (data.password !== ACCESS_PASSWORD) {
      return { ...emptyAuth, error: "Access password is incorrect." };
    }

    if (!geminiApiKey) {
      return { ...emptyAuth, error: "Paste your Gemini API key to continue." };
    }

    await updateSession<StudioSessionData>(getSessionConfig(), {
      unlocked: true,
      geminiApiKey,
    });

    return publicAuth({ unlocked: true, geminiApiKey });
  });

export const logoutStudio = createServerFn({ method: "POST" }).handler(async () => {
  await clearSession(getSessionConfig());
  return emptyAuth;
});
