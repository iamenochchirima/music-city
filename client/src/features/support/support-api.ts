import type {
  PrepareSupportInput,
  SupportPayment,
  SupportRecipient,
} from "@music-city/shared";
import { httpClient } from "@/lib/api/http-client";
export const supportApi = {
  async recipients(trackId: string) {
    return (
      await httpClient.get<{ items: SupportRecipient[] }>(
        `/support/recipients/tracks/${trackId}`,
      )
    ).items;
  },
  async artist(id: string) {
    return (
      await httpClient.get<{ recipient: SupportRecipient }>(
        `/support/recipients/artists/${id}`,
      )
    ).recipient;
  },
  async prepare(token: string, input: PrepareSupportInput) {
    return (
      await httpClient.post<{ payment: SupportPayment }>(
        "/support",
        input,
        token,
      )
    ).payment;
  },
  async get(token: string, id: string) {
    return (
      await httpClient.get<{ payment: SupportPayment }>(`/support/${id}`, token)
    ).payment;
  },
  async authorize(token: string, id: string, signedTransaction: string) {
    return (
      await httpClient.post<{ payment: SupportPayment }>(
        `/support/${id}/authorize`,
        { signedTransaction },
        token,
      )
    ).payment;
  },
  async submit(token: string, id: string) {
    return (
      await httpClient.post<{ payment: SupportPayment }>(
        `/support/${id}/submit`,
        {},
        token,
      )
    ).payment;
  },
  async cancel(token: string, id: string) {
    return (
      await httpClient.post<{ payment: SupportPayment }>(
        `/support/${id}/cancel`,
        {},
        token,
      )
    ).payment;
  },
  async list(token: string) {
    return (
      await httpClient.get<{ items: SupportPayment[] }>("/support", token)
    ).items;
  },
};
export const supportReceiptUrl = (payment: SupportPayment) =>
  `https://stellar.expert/explorer/${payment.networkPassphrase.includes("Test SDF") ? "testnet" : "public"}/tx/${payment.transactionHash}`;
export const supportAmount = (amount: string) =>
  amount.includes(".") ? amount.replace(/0+$/, "").replace(/\.$/, "") : amount;
