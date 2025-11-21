import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { PanelLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type SidebarContextValue = {
  open: boolean;
  setOpen: (value: boolean) => void;
};

const SidebarContext = React.createContext<SidebarContextValue | undefined>(
  undefined,
);

export function useSidebar() {
  const context = React.useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within SidebarProvider");
  }
  return context;
}

type SidebarProviderProps = {
  defaultOpen?: boolean;
  children: React.ReactNode;
};

export function SidebarProvider({
  defaultOpen = true,
  children,
}: SidebarProviderProps) {
  const [open, setOpen] = React.useState(defaultOpen);

  const value = React.useMemo(
    () => ({
      open,
      setOpen,
    }),
    [open],
  );

  return (
    <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>
  );
}

type SidebarProps = React.ComponentPropsWithoutRef<"aside"> & {
  collapsible?: "icon" | "none";
};

export const Sidebar = React.forwardRef<HTMLElement, SidebarProps>(
  ({ className, collapsible = "none", ...props }, ref) => {
    const { open } = useSidebar();
    const isIconCollapsible = collapsible === "icon";
    const expandedWidth = "w-72";
    const collapsedWidth = "w-16";
    const widthClass = isIconCollapsible
      ? open
        ? expandedWidth
        : collapsedWidth
      : expandedWidth;

    return (
      <aside
        ref={ref}
        data-state={open ? "open" : "collapsed"}
        data-collapsible={isIconCollapsible ? "icon" : undefined}
        className={cn(
          "group/sidebar relative flex h-full shrink-0 flex-col overflow-hidden border-r border-border/60 bg-card text-card-foreground transition-[width] duration-200 ease-linear",
          widthClass,
          className,
        )}
        {...props}
      />
    );
  },
);
Sidebar.displayName = "Sidebar";

export const SidebarHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex items-center gap-2 px-4 py-3 text-sm font-semibold",
      className,
    )}
    {...props}
  />
));
SidebarHeader.displayName = "SidebarHeader";

export const SidebarContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex flex-1 flex-col gap-4 overflow-y-auto px-2 py-4",
      className,
    )}
    {...props}
  />
));
SidebarContent.displayName = "SidebarContent";

export const SidebarFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("border-t border-border/60 px-4 py-3", className)}
    {...props}
  />
));
SidebarFooter.displayName = "SidebarFooter";

export const SidebarGroup = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex flex-col gap-2", className)} {...props} />
));
SidebarGroup.displayName = "SidebarGroup";

export const SidebarGroupLabel = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground",
      "group-data-[state=collapsed]/sidebar:hidden",
      className,
    )}
    {...props}
  />
));
SidebarGroupLabel.displayName = "SidebarGroupLabel";

export const SidebarGroupContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex flex-col gap-1", className)} {...props} />
));
SidebarGroupContent.displayName = "SidebarGroupContent";

export const SidebarMenu = React.forwardRef<
  HTMLUListElement,
  React.HTMLAttributes<HTMLUListElement>
>(({ className, ...props }, ref) => (
  <ul ref={ref} className={cn("space-y-1", className)} {...props} />
));
SidebarMenu.displayName = "SidebarMenu";

export const SidebarMenuItem = React.forwardRef<
  HTMLLIElement,
  React.LiHTMLAttributes<HTMLLIElement>
>(({ className, ...props }, ref) => (
  <li ref={ref} className={cn("list-none", className)} {...props} />
));
SidebarMenuItem.displayName = "SidebarMenuItem";

type SidebarMenuButtonProps = React.ComponentPropsWithoutRef<"button"> & {
  asChild?: boolean;
  isActive?: boolean;
};

export const SidebarMenuButton = React.forwardRef<
  HTMLButtonElement,
  SidebarMenuButtonProps
>(({ className, asChild = false, isActive, ...props }, ref) => {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      ref={ref}
      type={asChild ? undefined : "button"}
      data-active={isActive ? "true" : "false"}
      className={cn(
        "group/sidebar-button flex w-full min-w-0 items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring/50",
        "group-data-[collapsible=icon]/sidebar:justify-center group-data-[state=collapsed]/sidebar:px-2",
        isActive && "bg-muted text-primary hover:text-primary",
        className,
      )}
      {...props}
    />
  );
});
SidebarMenuButton.displayName = "SidebarMenuButton";

export const SidebarTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<typeof Button>
>(({ className, onClick, ...props }, ref) => {
  const { open, setOpen } = useSidebar();
  const handleToggle = (event: React.MouseEvent<HTMLButtonElement>) => {
    onClick?.(event);
    if (event.defaultPrevented) return;
    setOpen(!open);
  };
  return (
    <Button
      ref={ref}
      type="button"
      variant="ghost"
      size="icon"
      className={cn("h-8 w-8", className)}
      {...props}
      onClick={handleToggle}
    >
      <PanelLeft className="h-4 w-4" />
      <span className="sr-only">切换侧边栏</span>
    </Button>
  );
});
SidebarTrigger.displayName = "SidebarTrigger";

export const SidebarInset = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex min-w-0 flex-1 flex-col", className)}
    {...props}
  />
));
SidebarInset.displayName = "SidebarInset";
