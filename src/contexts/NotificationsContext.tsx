import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { API_BASE_URL } from "@/lib/api-client";
import {
  fetchNotifications,
  type NotificationRecord,
} from "@/lib/notifications-api";
import { useAuth } from "./AuthContext";

type StreamStatus = "idle" | "connecting" | "open" | "error";

type NotificationsContextValue = {
  latestNotifications: NotificationRecord[];
  streamStatus: StreamStatus;
  lastReceivedAt: number | null;
  unreadCount: number;
  refreshUnreadCount: () => Promise<void>;
  addNotification: (notification: NotificationRecord) => void;
};

const NotificationsContext = createContext<
  NotificationsContextValue | undefined
>(undefined);

const RECENT_LIMIT = 20;

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [latestNotifications, setLatestNotifications] = useState<
    NotificationRecord[]
  >([]);
  const [streamStatus, setStreamStatus] = useState<StreamStatus>("idle");
  const [lastReceivedAt, setLastReceivedAt] = useState<number | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);

  const refreshUnreadCount = useCallback(async () => {
    if (!user) {
      setUnreadCount(0);
      return;
    }
    try {
      const response = await fetchNotifications({
        page: 1,
        pageSize: 1,
        msgStatus: "unread",
      });
      setUnreadCount(response.meta.total ?? response.data.length ?? 0);
    } catch (error) {
      console.warn("Failed to refresh unread notification count", error);
    }
  }, [user]);

  const addNotification = useCallback(
    (notification: NotificationRecord) => {
      setLatestNotifications((current) => {
        const deduped = current.filter((item) => item.id !== notification.id);
        return [notification, ...deduped].slice(0, RECENT_LIMIT);
      });
      if (notification.msgStatus?.toLowerCase?.() === "unread") {
        setUnreadCount((current) => current + 1);
      }
      setLastReceivedAt(Date.now());
    },
    [],
  );

  useEffect(() => {
    if (!user) {
      setLatestNotifications([]);
      setStreamStatus("idle");
      setLastReceivedAt(null);
      setUnreadCount(0);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      return;
    }

    const connect = () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      setStreamStatus("connecting");
      const source = new EventSource(
        `${API_BASE_URL}/api/notifications/stream`,
        { withCredentials: true },
      );
      eventSourceRef.current = source;

      source.addEventListener("open", () => {
        setStreamStatus("open");
      });

      source.addEventListener("connected", () => {
        setStreamStatus("open");
      });

      source.addEventListener("message", (event) => {
        if (!event.data) return;
        try {
          const payload = JSON.parse(event.data) as NotificationRecord;
          addNotification(payload);
          const toastMessage = payload.msgTitle ?? "收到新的通知";
          toast.success(toastMessage, {
            description: (
              <a
                href="/workbench/notifications"
                className="text-primary underline underline-offset-4"
              >
                前往通知中心
              </a>
            ),
          });
        } catch (error) {
          console.warn("Failed to parse notification payload", error);
        }
      });

      source.addEventListener("error", () => {
        setStreamStatus("error");
        source.close();
        eventSourceRef.current = null;
        if (reconnectTimerRef.current) {
          window.clearTimeout(reconnectTimerRef.current);
        }
        reconnectTimerRef.current = window.setTimeout(() => {
          connect();
        }, 5000);
      });
    };

    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };
  }, [user, addNotification]);

  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      return;
    }
    void refreshUnreadCount();
  }, [user, refreshUnreadCount]);

  const value = useMemo<NotificationsContextValue>(
    () => ({
      latestNotifications,
      streamStatus,
      lastReceivedAt,
      unreadCount,
      refreshUnreadCount,
      addNotification,
    }),
    [
      latestNotifications,
      streamStatus,
      lastReceivedAt,
      unreadCount,
      refreshUnreadCount,
      addNotification,
    ],
  );

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error(
      "useNotifications must be used within a NotificationsProvider",
    );
  }
  return context;
}
