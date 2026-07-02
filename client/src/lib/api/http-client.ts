import { clientEnv } from "@/lib/config/env";

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

const authHeaders = (token?: string): Record<string, string> => {
  if (!token) {
    return {};
  }

  return {
    Authorization: `Bearer ${token}`,
  };
};

type ErrorPayload = {
  message?: string;
  error?: string;
  detail?: string;
} | null;

const buildApiClientError = (payload: ErrorPayload, status: number) => {
  const message = payload?.message ?? payload?.error ?? "Request failed";
  return new ApiClientError(message, status, payload?.detail);
};

export const httpClient = {
  async get<T>(path: string, token?: string): Promise<T> {
    const response = await fetch(`${clientEnv.apiBaseUrl}${path}`, {
      credentials: "include",
      cache: "no-store",
      headers: authHeaders(token),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as ErrorPayload;
      throw buildApiClientError(payload, response.status);
    }

    return (await response.json()) as T;
  },

  async post<T>(path: string, body: unknown, token?: string): Promise<T> {
    const response = await fetch(`${clientEnv.apiBaseUrl}${path}`, {
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
      throw buildApiClientError(payload, response.status);
    }

    return (await response.json()) as T;
  },

  async put<T>(path: string, body: unknown, token?: string): Promise<T> {
    const response = await fetch(`${clientEnv.apiBaseUrl}${path}`, {
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
      throw buildApiClientError(payload, response.status);
    }

    return (await response.json()) as T;
  },

  async delete<T>(path: string, token?: string): Promise<T> {
    const response = await fetch(`${clientEnv.apiBaseUrl}${path}`, {
      method: "DELETE",
      credentials: "include",
      headers: authHeaders(token),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as ErrorPayload;
      throw buildApiClientError(payload, response.status);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  },
};
