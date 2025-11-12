import { Outlet, Link, useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Home, User, BarChart3, ClipboardList, Bell } from "lucide-react";
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

function WorkbenchLayout() {
  const location = useLocation();

  return (
    <SidebarProvider>
      <div className="flex min-h-[calc(100vh-3.5rem)] bg-background">
        <Sidebar collapsible="icon" aria-label="工作台导航">
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupContent>
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
                            className="flex w-full items-center gap-3"
                          >
                            <Icon className="h-4 w-4 shrink-0" />
                            <div className="flex flex-1 flex-col truncate group-data-[state=collapsed]/sidebar:hidden">
                              <span className="text-sm font-semibold text-foreground">
                                {item.title}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {item.subtitle}
                              </span>
                            </div>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>
        <SidebarInset>
          <div className="flex-1 bg-muted/30 p-4 sm:p-6">
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
