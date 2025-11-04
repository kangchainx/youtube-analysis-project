import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { UserAccountDropdown } from "@/components/user-account-dropdown";

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
      <div className="min-h-screen bg-background text-foreground">
        <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b bg-background/90 px-4 backdrop-blur">
          <Link
            to="/home"
            className="text-sm font-semibold tracking-wide text-foreground transition-colors hover:text-primary"
          >
            Youtube Analysis
          </Link>
          <UserAccountDropdown />
        </header>
        <main className="min-h-[calc(100vh-3.5rem)]">
          <Outlet />
        </main>
      </div>
    </AppLayoutContext.Provider>
  );
}

export default AppLayout;
