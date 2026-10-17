import type { AgreementFinalization, AgreementVersion } from "./agreements.js";

export type AgreementPerson = {
  walletAddress: string;
  profileId: string;
  name: string;
};
export type AgreementContext = {
  track: { id: string; title: string };
  owner: AgreementPerson;
  people: AgreementPerson[];
};
export type AgreementPermissions = {
  edit: boolean;
  submit: boolean;
  cancel: boolean;
  revise: boolean;
  accept: boolean;
  reject: boolean;
  dispute: boolean;
};
export type AgreementSummary = {
  id: string;
  effectiveVersion: number | null;
  current: AgreementVersion;
  context: AgreementContext;
};
export type AgreementEvent = {
  id: string;
  version: number;
  action: string;
  actor_wallet: string;
  created_at: string;
  payload: Record<string, unknown>;
};
export type AgreementDetail = {
  id: string;
  effectiveVersion: number | null;
  currentVersion: number;
  versions: AgreementVersion[];
  finalizations: AgreementFinalization[];
  events: AgreementEvent[];
  context: AgreementContext;
  permissions: AgreementPermissions;
};
