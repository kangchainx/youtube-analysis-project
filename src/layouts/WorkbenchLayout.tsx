import { Outlet, Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Home,
  User,
  BarChart3,
  ClipboardList,
  Bell,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type WorkbenchNavItem = {
  title: string;
  subtitle: string;
  href: string;
  icon: LucideIcon;
};

const navItems: WorkbenchNavItem[] = [
  {
    title: "仪表盘",
    subtitle: "Dashboard",
    href: "/workbench/dashboard",
    icon: Home,
  },
  {
    title: "我的订阅",
    subtitle: "My Subscriptions",
    href: "/workbench/subscriptions",
    icon: User,
  },
  {
    title: "频道分析",
    subtitle: "Channel Analytics",
    href: "/workbench/analytics",
    icon: BarChart3,
  },
  {
    title: "任务中心",
    subtitle: "Task Center",
    href: "/workbench/tasks",
    icon: ClipboardList,
  },
  {
    title: "通知中心",
    subtitle: "Notifications",
    href: "/workbench/notifications",
    icon: Bell,
  },
];

const isActivePath = (pathname: string, href: string) => {
  if (pathname === href) return true;
  return pathname.startsWith(`${href}/`);
};

function SidebarCollapseButton() {
  const { open, setOpen } = useSidebar();
  const Icon = open ? ChevronLeft : ChevronRight;

  return (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      className="ml-auto text-muted-foreground transition-colors hover:text-primary group-data-[state=collapsed]/sidebar:mx-auto"
      aria-label={open ? "收起侧边栏" : "展开侧边栏"}
      onClick={() => setOpen(!open)}
    >
      <Icon className="h-4 w-4" />
    </Button>
  );
}

function WorkbenchSidebarHeader() {
  const { open } = useSidebar();

  return (
    <SidebarHeader className="flex items-center justify-between border-b border-border/60">
      {open && (
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">
            工作台
          </p>
          <p className="truncate text-xs text-muted-foreground">
            管理你的工作台
          </p>
        </div>
      )}
      <SidebarCollapseButton />
    </SidebarHeader>
  );
}

function WorkbenchNavMenu() {
  const location = useLocation();
  const { open } = useSidebar();

  return (
    <SidebarMenu>
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = isActivePath(location.pathname, item.href);
        return (
          <SidebarMenuItem key={item.href}>
            <SidebarMenuButton asChild isActive={isActive}>
              <Link
                to={item.href}
                aria-current={isActive ? "page" : undefined}
                aria-label={item.title}
                className="flex w-full min-w-0 items-center gap-3"
              >
                <Icon className="h-4 w-4 shrink-0" />
                {open && (
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate whitespace-nowrap text-sm font-semibold leading-tight text-foreground">
                      {item.title}
                    </span>
                    <span className="truncate whitespace-nowrap text-xs leading-tight text-muted-foreground">
                      {item.subtitle}
                    </span>
                  </div>
                )}
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}

function WorkbenchLayout() {
  return (
    <SidebarProvider>
      <div className="flex min-h-[calc(100vh-3.5rem)] bg-background">
        <Sidebar
          collapsible="icon"
          aria-label="工作台导航"
          className="sticky top-14 h-[calc(100vh-3.5rem)]"
        >
          <WorkbenchSidebarHeader />
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupContent>
                <WorkbenchNavMenu />
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>
        <SidebarInset className="min-h-[calc(100vh-3.5rem)]">
          <div className="flex-1 overflow-y-auto bg-muted/30 p-4 sm:p-6">
            <div className="mb-4 flex justify-end sm:hidden">
              <SidebarTrigger />
            </div>
            <div className="mx-auto w-full max-w-6xl rounded-xl border border-border/60 bg-background p-4 shadow-sm sm:p-6">
              <Outlet />
            </div>
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

export default WorkbenchLayout;
