import { apiFetch } from "@/lib/api-client";

type YoutubeApiKeyResponse = {
  youtubeApiKey?: string | null;
  [key: string]: unknown;
};

const YOUTUBE_KEY_ENDPOINT = "/api/config/youtube-api-key";

let youtubeApiKey: string | null = null;
let inFlightRequest: Promise<string> | null = null;

function resolveEnvYoutubeKey(): string | null {
  const key = import.meta.env.VITE_YOUTUBE_API_KEY as string | undefined;
  if (typeof key !== "string") return null;
  const trimmed = key.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function requestYoutubeKey(): Promise<string | null> {
  try {
    const response =
      await apiFetch<YoutubeApiKeyResponse>(YOUTUBE_KEY_ENDPOINT);
    const rawKey = response?.youtubeApiKey;
    if (typeof rawKey !== "string") return null;
    const trimmed = rawKey.trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch (error) {
    console.warn("Failed to fetch YouTube API key from backend", error);
    return null;
  }
}

export async function getYoutubeApiKey(): Promise<string> {
  if (youtubeApiKey) return youtubeApiKey;
  if (inFlightRequest) return inFlightRequest;

  inFlightRequest = (async () => {
    const backendKey = await requestYoutubeKey();
    const envKey = backendKey ?? resolveEnvYoutubeKey();

    if (!envKey) {
      throw new Error(
        "YouTube API key unavailable. Please configure the backend endpoint or set VITE_YOUTUBE_API_KEY.",
      );
    }

    youtubeApiKey = envKey;
    return envKey;
  })().finally(() => {
    inFlightRequest = null;
  });

  return inFlightRequest;
}

export function clearYoutubeApiKeyCache() {
  youtubeApiKey = null;
  inFlightRequest = null;
}
