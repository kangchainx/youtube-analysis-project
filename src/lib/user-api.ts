import { apiFetch } from "@/lib/api-client";
import type { AuthUser } from "@/contexts/AuthContext";

export type UserProfile = AuthUser & {
  [key: string]: unknown;
};

type UserProfileResponse = {
  user?: UserProfile;
  [key: string]: unknown;
};

function extractUserProfile(data: unknown): UserProfile {
  if (data && typeof data === "object") {
    const candidate = data as UserProfileResponse;
    if (candidate.user && typeof candidate.user === "object") {
      return candidate.user;
    }
  }
  return (data ?? {}) as UserProfile;
}

export async function fetchCurrentUserProfile(): Promise<UserProfile> {
  const response = await apiFetch<unknown>("/api/users/me");
  return extractUserProfile(response);
}

export type UpdateUserProfileInput = {
  name?: string | null;
  picture?: string | null;
  avatarUrl?: string | null;
};

export async function updateCurrentUserProfile(
  input: UpdateUserProfileInput,
): Promise<UserProfile> {
  const response = await apiFetch<unknown>("/api/users/me", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  return extractUserProfile(response);
}

