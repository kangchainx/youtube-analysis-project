import { type MouseEvent } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { Home, LayoutDashboard, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { UserAccountDropdown } from "@/components/user-account-dropdown";
import { cn } from "@/lib/utils";

type AppHeaderProps = {
  className?: string;
};

export function AppHeader({ className }: AppHeaderProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { resolvedTheme, setTheme } = useTheme();
  const isOnWorkbench = location.pathname.startsWith("/workbench");
  const activeTheme = resolvedTheme ?? "light";

  const handleHomeNav = (event?: MouseEvent) => {
    event?.preventDefault();
    navigate("/home", { state: { resetHome: true, ts: Date.now() } });
  };

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
        state={{ resetHome: true, ts: Date.now() }}
        onClick={handleHomeNav}
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
          state={{ resetHome: true, ts: Date.now() }}
          onClick={handleHomeNav}
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
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTheme("light")}
            aria-label="切换到浅色模式"
            aria-pressed={activeTheme === "light"}
            title="浅色模式"
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-full border border-border/70 bg-background/90 text-muted-foreground transition-colors hover:text-primary",
              activeTheme === "light" &&
                "border-primary/60 text-primary shadow-sm shadow-primary/20",
            )}
          >
            <Sun className="h-4 w-4" />
          </button>
          <span
            aria-hidden="true"
            className="h-4 w-px bg-border/80 dark:bg-border/40"
          />
          <button
            type="button"
            onClick={() => setTheme("dark")}
            aria-label="切换到深色模式"
            aria-pressed={activeTheme === "dark"}
            title="深色模式"
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-full border border-border/70 bg-background/90 text-muted-foreground transition-colors hover:text-primary",
              activeTheme === "dark" &&
                "border-primary/60 text-primary shadow-sm shadow-primary/20",
            )}
          >
            <Moon className="h-4 w-4" />
          </button>
        </div>
        <UserAccountDropdown />
      </div>
    </header>
  );
}
