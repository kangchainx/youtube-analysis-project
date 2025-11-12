import { apiFetch, postJson } from "./api-client";

export type NotificationRecord = {
  id: string;
  userId: string;
  msgType: string;
  msgStatus: string;
  msgTitle: string | null;
  msgContent: string | null;
  isDelete: boolean;
  createdAt: string;
  updatedAt: string;
};

export type NotificationListMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type NotificationListResponse = {
  data: NotificationRecord[];
  meta: NotificationListMeta;
};

export type NotificationStatus = "unread" | "read";

export type FetchNotificationsParams = {
  page?: number;
  pageSize?: number;
  msgStatus?: NotificationStatus;
};

export async function fetchNotifications(
  params: FetchNotificationsParams = {},
): Promise<NotificationListResponse> {
  const search = new URLSearchParams();
  if (params.page) {
    search.set("page", String(params.page));
  }
  if (params.pageSize) {
    const key = "pageSize";
    search.set(key, String(params.pageSize));
  }
  if (params.msgStatus) {
    search.set("msgStatus", params.msgStatus);
  }

  const query = search.toString();
  const path = `/api/notifications${query ? `?${query}` : ""}`;
  return apiFetch<NotificationListResponse>(path);
}

export async function markNotificationAsRead(id: string): Promise<void> {
  await postJson(`/api/notifications/${id}/mark-read`);
}

export async function markAllNotificationsAsRead(): Promise<void> {
  await postJson("/api/notifications/mark-all-read");
}
