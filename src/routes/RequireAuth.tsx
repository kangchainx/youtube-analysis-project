import { useAuth } from "@/contexts/AuthContext";
import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";

type RequireAuthProps = {
  children: ReactNode;
};

export function RequireAuth({ children }: RequireAuthProps) {
  const { user, isHydrated } = useAuth();
  const location = useLocation();

  if (!isHydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        正在加载会话...
      </div>
    );
  }

  if (!user) {
    return (
      <Navigate
        to="/"
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  return <>{children}</>;
}
