import { Link, NavLink, useLocation } from "react-router-dom";
import { Home, LayoutDashboard } from "lucide-react";
import { UserAccountDropdown } from "@/components/user-account-dropdown";
import { cn } from "@/lib/utils";

type AppHeaderProps = {
  className?: string;
};

export function AppHeader({ className }: AppHeaderProps) {
  const location = useLocation();
  const isOnWorkbench = location.pathname.startsWith("/workbench");

  return (
    <header
      className={cn(
        "sticky top-0 z-40 flex h-14 items-center justify-between border-b bg-background/90 px-4 backdrop-blur",
        className,
      )}
    >
      <Link
        to="/home"
        className="flex items-center gap-2 text-sm font-semibold tracking-wide text-foreground transition-all duration-300 ease-in-out hover:scale-105 hover:text-primary"
      >
        <img
          src="/favicon/logo.png"
          alt="Logo"
          className="h-6 w-6"
          loading="lazy"
        />
        <span className="group-data-[state=collapsed]/sidebar:hidden">
          Youtube Analysis
        </span>
      </Link>
      <div className="flex items-center gap-3">
        <NavLink
          to="/home"
          className={({ isActive }) =>
            cn(
              "flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-all duration-300 ease-in-out hover:scale-105 hover:text-primary",
              isActive && "text-primary",
            )
          }
        >
          <Home className="h-4 w-4" />
          首页
        </NavLink>
        <NavLink
          to="/workbench"
          className={({ isActive }) =>
            cn(
              "flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-all duration-300 ease-in-out hover:scale-105 hover:text-primary",
              (isActive || isOnWorkbench) && "text-primary",
            )
          }
        >
          <LayoutDashboard className="h-4 w-4" />
          工作台
        </NavLink>
        <UserAccountDropdown />
      </div>
    </header>
  );
}
