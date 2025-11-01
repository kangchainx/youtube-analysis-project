const YOUTUBE_CHANNELS_URL = "https://www.googleapis.com/youtube/v3/channels";
const YOUTUBE_SEARCH_URL = "https://www.googleapis.com/youtube/v3/search";
const YOUTUBE_VIDEOS_URL = "https://www.googleapis.com/youtube/v3/videos";
const YOUTUBE_PLAYLIST_ITEMS_URL =
  "https://www.googleapis.com/youtube/v3/playlistItems";
const YOUTUBE_COMMENT_THREADS_URL =
  "https://www.googleapis.com/youtube/v3/commentThreads";
const YOUTUBE_COMMENTS_URL = "https://www.googleapis.com/youtube/v3/comments";

type Primitive = string | number | boolean;

type QueryValue = Primitive | Primitive[] | null | undefined;

export interface ChannelsListOptions {
  params: Record<string, QueryValue>;
  signal?: AbortSignal;
  headers?: HeadersInit;
}

export interface SearchListOptions {
  params: Record<string, QueryValue>;
  signal?: AbortSignal;
  headers?: HeadersInit;
}

export interface VideosListOptions {
  params: Record<string, QueryValue>;
  signal?: AbortSignal;
  headers?: HeadersInit;
}

export interface PlaylistItemsListOptions {
  params: Record<string, QueryValue>;
  signal?: AbortSignal;
  headers?: HeadersInit;
}

export interface CommentThreadsListOptions {
  params: Record<string, QueryValue>;
  signal?: AbortSignal;
  headers?: HeadersInit;
}

export interface CommentsListOptions {
  params: Record<string, QueryValue>;
  signal?: AbortSignal;
  headers?: HeadersInit;
}

function createQueryString(params: Record<string, QueryValue>) {
  const searchParams = new URLSearchParams();

  for (const [key, rawValue] of Object.entries(params)) {
    if (rawValue === undefined || rawValue === null) continue;

    const values = Array.isArray(rawValue) ? rawValue : [rawValue];

    for (const value of values) {
      searchParams.append(key, String(value));
    }
  }

  return searchParams.toString();
}

export async function channelsList({
  params,
  signal,
  headers,
}: ChannelsListOptions) {
  const query = createQueryString(params);
  const url = query ? `${YOUTUBE_CHANNELS_URL}?${query}` : YOUTUBE_CHANNELS_URL;

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      ...headers,
    },
    signal,
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(
      `YouTube channels.list request failed: ${response.status} ${response.statusText}${errorBody ? ` - ${errorBody}` : ""}`,
    );
  }

  return response.json();
}

export async function searchList({
  params,
  signal,
  headers,
}: SearchListOptions) {
  const query = createQueryString(params);
  const url = query ? `${YOUTUBE_SEARCH_URL}?${query}` : YOUTUBE_SEARCH_URL;

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      ...headers,
    },
    signal,
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(
      `YouTube search.list request failed: ${response.status} ${response.statusText}${errorBody ? ` - ${errorBody}` : ""}`,
    );
  }

  return response.json();
}

export async function videosList({
  params,
  signal,
  headers,
}: VideosListOptions) {
  const query = createQueryString(params);
  const url = query ? `${YOUTUBE_VIDEOS_URL}?${query}` : YOUTUBE_VIDEOS_URL;

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      ...headers,
    },
    signal,
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(
      `YouTube videos.list request failed: ${response.status} ${response.statusText}${errorBody ? ` - ${errorBody}` : ""}`,
    );
  }

  return response.json();
}

export async function playlistItemsList({
  params,
  signal,
  headers,
}: PlaylistItemsListOptions) {
  const query = createQueryString(params);
  const url = query
    ? `${YOUTUBE_PLAYLIST_ITEMS_URL}?${query}`
    : YOUTUBE_PLAYLIST_ITEMS_URL;

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      ...headers,
    },
    signal,
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(
      `YouTube playlistItems.list request failed: ${response.status} ${response.statusText}${errorBody ? ` - ${errorBody}` : ""}`,
    );
  }

  return response.json();
}

export async function commentThreadsList({
  params,
  signal,
  headers,
}: CommentThreadsListOptions) {
  const query = createQueryString(params);
  const url = query
    ? `${YOUTUBE_COMMENT_THREADS_URL}?${query}`
    : YOUTUBE_COMMENT_THREADS_URL;

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      ...headers,
    },
    signal,
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(
      `YouTube commentThreads.list request failed: ${response.status} ${response.statusText}${errorBody ? ` - ${errorBody}` : ""}`,
    );
  }

  return response.json();
}

export async function commentsList({
  params,
  signal,
  headers,
}: CommentsListOptions) {
  const query = createQueryString(params);
  const url = query ? `${YOUTUBE_COMMENTS_URL}?${query}` : YOUTUBE_COMMENTS_URL;

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      ...headers,
    },
    signal,
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(
      `YouTube comments.list request failed: ${response.status} ${response.statusText}${errorBody ? ` - ${errorBody}` : ""}`,
    );
  }

  return response.json();
}
