import { apiFetch } from "@/lib/api-client";
import type { AuthUser } from "@/contexts/AuthContext";

export type UserProfile = AuthUser & {
  avatar?: string | null;
  [key: string]: unknown;
};

type UserProfileEnvelope = {
  user?: UserProfile;
  [key: string]: unknown;
};

function normalizeUserProfile(data: unknown): UserProfile {
  const envelope = (data ?? {}) as UserProfileEnvelope;
  const rawUser = envelope.user ?? (data as Partial<UserProfile>);
  return {
    id: (rawUser?.id as string) ?? "",
    email: (rawUser?.email as string) ?? "",
    name: (rawUser?.name as string | null | undefined) ?? null,
    emailVerified: Boolean(
      (rawUser as { emailVerified?: boolean })?.emailVerified,
    ),
    avatar: (rawUser?.avatar as string | null | undefined) ?? null,
    picture: (rawUser?.picture as string | null | undefined) ?? null,
    avatarUrl: (rawUser?.avatarUrl as string | null | undefined) ?? null,
    imageUrl: (rawUser?.imageUrl as string | null | undefined) ?? null,
    ...((rawUser ?? {}) as Record<string, unknown>),
  } satisfies UserProfile;
}

export async function fetchCurrentUserProfile(): Promise<UserProfile> {
  const response = await apiFetch<unknown>("/api/users/me");
  return normalizeUserProfile(response);
}

export type UpdateUserProfileInput = {
  name?: string | null;
  email?: string | null;
  avatar?: string | null;
  password?: string;
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

  return normalizeUserProfile(response);
}

export async function updateCurrentUserPassword(input: {
  currentPassword: string;
  password: string;
}): Promise<{ success: boolean }> {
  const response = await apiFetch<{ success?: boolean }>(
    "/api/users/me/password",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    },
  );

  return { success: Boolean(response?.success) };
}
