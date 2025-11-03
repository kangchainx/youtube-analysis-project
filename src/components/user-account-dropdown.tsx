import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
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
import { useAppLayout } from "@/layouts/AppLayout";
import { useNavigate, useLocation } from "react-router-dom";
import { useMemo } from "react";

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

  const avatarUrl = useMemo(() => deriveAvatarUrl(user), [user]);
  const avatarFallback = useMemo(() => avatarFallbackFor(user), [user]);

  const handleProfileClick = () => {
    const state =
      profileNavigationState ??
      ({
        from: location.pathname,
      } as Record<string, unknown>);
    navigate("/profile", { state });
  };

  const handleLogout = async () => {
    await logout();
    setProfileNavigationState(null);
    navigate("/", { replace: true });
  };

  return (
    <DropdownMenu>
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
      <DropdownMenuContent align="end" className="w-64">
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
              {user?.email ? (
                <span className="truncate text-xs text-muted-foreground">
                  {user.email}
                </span>
              ) : null}
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={handleProfileClick}>
          个人信息
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          disabled={isLoggingOut}
          onSelect={() => {
            if (isLoggingOut) return;
            void handleLogout();
          }}
        >
          {isLoggingOut ? "正在退出..." : "退出登录"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
