import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { AppHeader } from "@/components/app-header";
import { TranscriptionTasksProvider } from "@/contexts/TranscriptionTasksContext";
import { Toaster } from "@/components/ui/sonner";
import { useAuth } from "@/contexts/AuthContext";
import { NotificationsProvider } from "@/contexts/NotificationsContext";

type ProfileNavigationState = Record<string, unknown> | null;

type AppLayoutContextValue = {
  profileNavigationState: ProfileNavigationState;
  setProfileNavigationState: (state: ProfileNavigationState) => void;
};

const AppLayoutContext = createContext<AppLayoutContextValue | undefined>(
  undefined,
);

export function useAppLayout(): AppLayoutContextValue {
  const context = useContext(AppLayoutContext);
  if (!context) {
    throw new Error("useAppLayout must be used within AppLayout");
  }
  return context;
}

function AppLayout() {
  const location = useLocation();
  const { user } = useAuth();
  const mainMinHeightClass = user
    ? "min-h-[calc(100vh-3.5rem)]"
    : "min-h-screen";
  const [profileNavigationState, setProfileNavigationState] = useState<
    ProfileNavigationState
  >({ from: location.pathname });

  useEffect(() => {
    setProfileNavigationState({ from: location.pathname });
  }, [location.pathname]);

  const contextValue = useMemo(
    () => ({
      profileNavigationState,
      setProfileNavigationState,
    }),
    [profileNavigationState],
  );

  return (
    <AppLayoutContext.Provider value={contextValue}>
      <TranscriptionTasksProvider>
        <NotificationsProvider>
          <div className="min-h-screen bg-background text-foreground">
            {user && <AppHeader />}
            <main className={mainMinHeightClass}>
              <Outlet />
            </main>
            <Toaster richColors position="top-center" />
          </div>
        </NotificationsProvider>
      </TranscriptionTasksProvider>
    </AppLayoutContext.Provider>
  );
}

export default AppLayout;
