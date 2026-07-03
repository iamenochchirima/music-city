import { adminEnv } from "@/lib/config/env";

export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly detail?: string,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

const authHeaders = (token?: string): Record<string, string> =>
  token
    ? {
        Authorization: `Bearer ${token}`,
      }
    : {};

type ErrorPayload = {
  message?: string;
  error?: string;
  detail?: string;
} | null;

const buildError = (payload: ErrorPayload, status: number) =>
  new ApiClientError(
    payload?.message ?? payload?.error ?? "Request failed",
    status,
    payload?.detail,
  );

export const httpClient = {
  async get<T>(path: string, token?: string) {
    const response = await fetch(`${adminEnv.apiBaseUrl}${path}`, {
      credentials: "include",
      cache: "no-store",
      headers: authHeaders(token),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as ErrorPayload;
      throw buildError(payload, response.status);
    }

    return (await response.json()) as T;
  },

  async post<T>(path: string, body: unknown, token?: string) {
    const response = await fetch(`${adminEnv.apiBaseUrl}${path}`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(token),
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as ErrorPayload;
      throw buildError(payload, response.status);
    }

    return (await response.json()) as T;
  },

  async put<T>(path: string, body: unknown, token?: string) {
    const response = await fetch(`${adminEnv.apiBaseUrl}${path}`, {
      method: "PUT",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(token),
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as ErrorPayload;
      throw buildError(payload, response.status);
    }

    return (await response.json()) as T;
  },

  async delete<T>(path: string, token?: string) {
    const response = await fetch(`${adminEnv.apiBaseUrl}${path}`, {
      method: "DELETE",
      credentials: "include",
      headers: authHeaders(token),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as ErrorPayload;
      throw buildError(payload, response.status);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  },
};
