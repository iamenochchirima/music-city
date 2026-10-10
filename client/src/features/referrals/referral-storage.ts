import { referralInvitationSchema, type ReferralInvitation } from "@music-city/shared";

const KEY = "music-city:pending-referral";
type Pending = ReferralInvitation & { wallet?: string };
export function pendingReferral(): Pending | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const decoded = JSON.parse(raw);
    const invitation = referralInvitationSchema.parse(decoded);
    if (Date.parse(invitation.expiresAt) <= Date.now()) { clearReferral(); return null; }
    return { ...invitation, wallet: typeof decoded.wallet === "string" ? decoded.wallet : undefined };
  } catch { clearReferral(); return null; }
}
export function rememberReferral(invitation: ReferralInvitation, replace = false) {
  const current = pendingReferral();
  if (current && !replace) return current;
  const next = { ...invitation, wallet: current?.wallet };
  localStorage.setItem(KEY,JSON.stringify(next));
  return next;
}
export function clearReferral() { localStorage.removeItem(KEY); }
export function bindReferralWallet(wallet: string) {
  const invitation = pendingReferral();
  if (!invitation) return;
  if (invitation.wallet && invitation.wallet !== wallet) { clearReferral(); return; }
  localStorage.setItem(KEY,JSON.stringify({ ...invitation,wallet }));
}
