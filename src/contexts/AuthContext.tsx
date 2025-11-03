import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
  useEffect,
} from "react";
import { postJson } from "@/lib/api-client";

export type AuthUser = {
  id: string;
  email: string;
  name: string | null;
  emailVerified: boolean;
  picture?: string | null;
  avatarUrl?: string | null;
  imageUrl?: string | null;
};

export type AuthSession = {
  user: AuthUser | null;
  token: string | null;
  scope: string | null;
  expiresIn: string | null;
};

export type AuthSessionPayload = {
  user: AuthUser;
  token: string;
  scope: string | null;
  expiresIn: string | null;
  state?: string;
};

const STORAGE_KEY = "ya-auth-session";
const EMPTY_SESSION: AuthSession = {
  user: null,
  token: null,
  scope: null,
  expiresIn: null,
};

function readStoredSession(): AuthSession {
  if (typeof window === "undefined") return EMPTY_SESSION;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_SESSION;
    const parsed = JSON.parse(raw) as Partial<AuthSession>;

    if (!parsed || typeof parsed !== "object") {
      return EMPTY_SESSION;
    }

    return {
      user: parsed.user ?? null,
      token: typeof parsed.token === "string" ? parsed.token : null,
      scope: typeof parsed.scope === "string" ? parsed.scope : null,
      expiresIn:
        typeof parsed.expiresIn === "string" ? parsed.expiresIn : null,
    };
  } catch (error) {
    console.warn("Failed to parse stored auth session", error);
    return EMPTY_SESSION;
  }
}

type AuthContextValue = AuthSession & {
  isHydrated: boolean;
  isLoggingOut: boolean;
  setSession: (session: AuthSessionPayload) => void;
  clearSession: () => void;
  logout: (options?: { revoke?: boolean }) => Promise<void>;
  updateUser: (user: AuthUser) => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSessionState] = useState<AuthSession>(readStoredSession);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const persistSession = useCallback((next: AuthSession) => {
    setSessionState(next);
    if (typeof window === "undefined") return;

    try {
      if (!next.user) {
        window.localStorage.removeItem(STORAGE_KEY);
        return;
      }

      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          user: next.user,
          token: next.token,
          scope: next.scope,
          expiresIn: next.expiresIn,
        }),
      );
    } catch (error) {
      console.warn("Failed to persist auth session", error);
    }
  }, []);

  const setSession = useCallback(
    (payload: AuthSessionPayload) => {
      persistSession({
        user: payload.user,
        token: payload.token,
        scope: payload.scope,
        expiresIn: payload.expiresIn,
      });
    },
    [persistSession],
  );

  const clearSession = useCallback(() => {
    persistSession(EMPTY_SESSION);
  }, [persistSession]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;
      if (!event.newValue) {
        setSessionState(EMPTY_SESSION);
        return;
      }

      try {
        const parsed = JSON.parse(event.newValue) as AuthSession;
        setSessionState({
          user: parsed.user ?? null,
          token: parsed.token ?? null,
          scope: parsed.scope ?? null,
          expiresIn: parsed.expiresIn ?? null,
        });
      } catch (error) {
        console.warn("Failed to sync auth session from storage", error);
        setSessionState(EMPTY_SESSION);
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const logout = useCallback(
    async (options?: { revoke?: boolean }) => {
      setIsLoggingOut(true);
      try {
        const hasOptions = Boolean(options?.revoke);
        await postJson("/api/auth/logout", hasOptions ? { revoke: true } : undefined);
      } catch (error) {
        console.warn("Logout request failed", error);
      } finally {
        clearSession();
        setIsLoggingOut(false);
      }
    },
    [clearSession],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session.user,
      token: session.token,
      scope: session.scope,
      expiresIn: session.expiresIn,
      isHydrated,
      isLoggingOut,
      setSession,
      clearSession,
      logout,
      updateUser: (nextUser: AuthUser) => {
        persistSession({
          user: nextUser,
          token: session.token,
          scope: session.scope,
          expiresIn: session.expiresIn,
        });
      },
    }),
    [session, isHydrated, isLoggingOut, setSession, clearSession, logout, persistSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
