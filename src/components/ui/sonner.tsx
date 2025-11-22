import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

const Toaster = ({ toastOptions, ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  const baseToastOptions: ToasterProps["toastOptions"] = {
    style: {
      marginInline: "auto",
      width: "max-content",
      minWidth: "120px",
      maxWidth: "min(420px, calc(100vw - 32px))",
      position: "static",
    },
    classNames: {
      toast:
        "group pointer-events-auto mx-auto inline-flex min-w-[120px] max-w-[420px] items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm shadow-lg shadow-emerald-100/80 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100",
      content: "text-sm leading-relaxed text-emerald-800 dark:text-emerald-100",
      description:
        "text-sm leading-relaxed text-emerald-700 dark:text-emerald-50",
      icon: "mt-0.5 shrink-0 text-emerald-500 dark:text-emerald-300",
      closeButton:
        "text-emerald-500 transition hover:text-emerald-600 dark:text-emerald-200 dark:hover:text-emerald-50",
      actionButton:
        "rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700 transition hover:bg-emerald-500/20 dark:text-emerald-100",
      cancelButton:
        "text-xs font-medium text-muted-foreground hover:text-foreground",
    },
  };

  const mergedToastOptions: ToasterProps["toastOptions"] = {
    ...baseToastOptions,
    ...toastOptions,
    classNames: {
      ...baseToastOptions?.classNames,
      ...toastOptions?.classNames,
    },
    style: {
      ...baseToastOptions?.style,
      ...toastOptions?.style,
    },
  };

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
          "--width": "max-content",
        } as React.CSSProperties
      }
      toastOptions={mergedToastOptions}
      {...props}
    />
  );
};

export { Toaster };
