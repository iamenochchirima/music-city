import { referralInvitationSchema, referralSummarySchema } from "@music-city/shared";
import { httpClient } from "@/lib/api/http-client";
export const referralsApi = {
  async capture(code: string) { return referralInvitationSchema.parse(await httpClient.post("/referrals/capture",{ code })); },
  async mine(token: string) { return referralSummarySchema.parse(await httpClient.get("/referrals/me",token)); },
};
