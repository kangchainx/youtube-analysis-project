import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/contexts/NotificationsContext";
import { useAppLayout } from "@/layouts/AppLayout";
import { useNavigate, useLocation } from "react-router-dom";
import { useMemo } from "react";
import { Bell, LogOut, User } from "lucide-react";

function deriveAvatarUrl(
  user: ReturnType<typeof useAuth>["user"],
): string | null {
  if (!user) return null;
  const candidates = [
    (user as { avatar?: string | null }).avatar,
    user.picture,
    user.avatarUrl,
    user.imageUrl,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }
  return null;
}

function avatarFallbackFor(user: ReturnType<typeof useAuth>["user"]): string {
  if (!user) return "?";
  const source =
    user.name?.trim() ||
    user.email?.trim() ||
    (user as { id?: string })?.id?.trim() ||
    "?";
  return source.slice(0, 2).toUpperCase();
}

export function UserAccountDropdown() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, isLoggingOut } = useAuth();
  const { profileNavigationState, setProfileNavigationState } = useAppLayout();
  const { unreadCount } = useNotifications();

  const avatarUrl = useMemo(() => deriveAvatarUrl(user), [user]);
  const avatarFallback = useMemo(() => avatarFallbackFor(user), [user]);
  const unreadBadgeLabel = unreadCount > 99 ? "99+" : unreadCount;

  const createProfileState = (section?: string): Record<string, unknown> => {
    const baseState = profileNavigationState ?? {
      from: location.pathname,
    };
    return section ? { ...baseState, section } : baseState;
  };

  const handleProfileClick = () => {
    const state = createProfileState();
    navigate("/profile", { state });
  };

  const handleNotificationsClick = () => {
    navigate("/workbench/notifications");
  };

  const handleLogout = async () => {
    await logout();
    setProfileNavigationState(null);
    navigate("/", { replace: true });
  };

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-lg"
          aria-label="账号菜单"
          className="rounded-full border border-border/70 bg-background/90 p-0 shadow-sm transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-primary/50"
          disabled={!user}
        >
          <Avatar className="h-9 w-9">
            {avatarUrl ? <AvatarImage src={avatarUrl} alt="用户头像" /> : null}
            <AvatarFallback className="text-xs font-medium">
              {avatarFallback}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-50">
        <DropdownMenuLabel>
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              {avatarUrl ? (
                <AvatarImage src={avatarUrl} alt="用户头像" />
              ) : null}
              <AvatarFallback className="text-sm font-semibold">
                {avatarFallback}
              </AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate text-sm font-semibold">
                {user?.name ?? user?.email ?? "已登录用户"}
              </span>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={handleProfileClick} className="gap-2">
          <User className="h-4 w-4" />
          <span>账户</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={handleNotificationsClick}
          className="gap-2"
        >
          <Bell className="h-4 w-4" />
          <span className="flex-1">通知</span>
          {unreadCount > 0 && (
            <span className="rounded-full bg-destructive px-1.5 text-[11px] font-semibold leading-4 text-white">
              {unreadBadgeLabel}
            </span>
          )}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          disabled={isLoggingOut}
          onSelect={() => {
            if (isLoggingOut) return;
            void handleLogout();
          }}
          className="gap-2"
        >
          <LogOut className="h-4 w-4" />
          <span>{isLoggingOut ? "正在退出..." : "退出登录"}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
