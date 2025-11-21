const DEFAULT_BASE_URL = "http://localhost:5001";

function normalizeBaseUrl(url: string | undefined) {
  if (!url) return DEFAULT_BASE_URL;
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

export const API_BASE_URL = normalizeBaseUrl(
  import.meta.env.VITE_API_BASE_URL as string | undefined,
);

export class ApiError<T = unknown> extends Error {
  status: number;
  payload: T | null;

  constructor(message: string, status: number, payload: T | null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

type Json = Record<string, unknown> | Array<unknown>;

function isJsonResponse(contentType: string | null): boolean {
  return Boolean(contentType && contentType.includes("application/json"));
}

export async function apiFetch<TResponse = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<TResponse> {
  // 允许传入相对路径统一走 API_BASE_URL，也允许直接传完整地址
  const url = path.startsWith("http")
    ? path
    : `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;

  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");

  const mergedInit: RequestInit = {
    credentials: "include",
    ...init,
    headers,
  };

  const response = await fetch(url, mergedInit);
  const contentType = response.headers.get("Content-Type");
  const isJson = isJsonResponse(contentType);
  let payload: Json | string | null = null;

  try {
    // 优先尝试解析 JSON，其次兜底解析文本，避免因为解析失败吞掉服务端返回的信息
    if (isJson) {
      payload = (await response.json()) as Json;
    } else if (
      contentType &&
      (contentType.includes("text/") || contentType.includes("application/"))
    ) {
      payload = await response.text();
    }
  } catch (error) {
    console.warn("Failed to parse API response payload", error);
  }

  if (!response.ok) {
    const defaultMessage = `Request failed with status ${response.status}`;
    const message =
      typeof payload === "string"
        ? payload || defaultMessage
        : typeof (payload as { error?: { message?: string } })?.error
            ?.message === "string"
          ? (payload as { error?: { message?: string } }).error!.message!
          : defaultMessage;

    throw new ApiError(message, response.status, payload);
  }

  return (payload as TResponse) ?? (undefined as TResponse);
}

export async function postJson<TResponse = unknown, TBody = unknown>(
  path: string,
  body?: TBody,
  init: RequestInit = {},
): Promise<TResponse> {
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return apiFetch<TResponse>(path, {
    ...init,
    method: "POST",
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
