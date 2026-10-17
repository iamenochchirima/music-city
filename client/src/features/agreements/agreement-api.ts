import type {
  AgreementDetail,
  AgreementPerson,
  AgreementSummary,
  AgreementVersion,
} from "@music-city/shared";
import { clientEnv } from "@/lib/config/env";
import { ApiClientError } from "@/lib/api/http-client";

async function request<T>(
  token: string,
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const response = await fetch(`${clientEnv.apiBaseUrl}/agreements${path}`, {
    method,
    credentials: "include",
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok)
    throw new ApiClientError(
      result?.message ?? result?.error ?? "Could not load the agreement",
      response.status,
      result?.detail,
      result?.fields,
    );
  return result as T;
}
export const agreementApi = {
  list: (token: string) => request<{ items: AgreementSummary[] }>(token, ""),
  detail: (token: string, id: string) =>
    request<AgreementDetail>(token, `/${id}`),
  contributors: (token: string, q: string) =>
    request<{ items: AgreementPerson[] }>(
      token,
      `/contributors?q=${encodeURIComponent(q)}`,
    ),
  forTrack: (token: string, id: string) =>
    request<{ id: string | null }>(token, `/track/${id}`),
  save: (
    token: string,
    id: string | null,
    mode: "create" | "edit" | "revise",
    body: unknown,
  ) =>
    request<{ version: AgreementVersion }>(
      token,
      mode === "create"
        ? ""
        : `/${id}/${mode === "edit" ? "draft" : "revisions"}`,
      mode === "edit" ? "PUT" : "POST",
      body,
    ),
  act: (
    token: string,
    id: string,
    action: "submit" | "cancel",
    expectedVersion: number,
    expectedHash: string,
  ) =>
    request<{ version: AgreementVersion }>(token, `/${id}/${action}`, "POST", {
      expectedVersion,
      expectedHash,
    }),
  challenge: (token: string, id: string, body: unknown) =>
    request<{
      id: string;
      transaction: string;
      expiresAt: string;
      proposalHash: string;
      networkPassphrase: string;
    }>(token, `/${id}/challenges`, "POST", body),
  respond: (token: string, id: string, body: unknown) =>
    request<{ version: AgreementVersion }>(
      token,
      `/${id}/responses`,
      "POST",
      body,
    ),
};
export const agreementStateLabel = (state: AgreementVersion["state"]) =>
  ({
    draft: "Draft",
    proposed: "Awaiting responses",
    ready: "Ready to finalize",
    rejected: "Rejected",
    disputed: "Disputed",
    finalizing: "Finalizing",
    finalized: "Active",
    cancelled: "Cancelled",
  })[state];
export const compactWallet = (wallet: string) =>
  `${wallet.slice(0, 8)}…${wallet.slice(-5)}`;
