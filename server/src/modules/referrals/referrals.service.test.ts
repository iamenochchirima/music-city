import assert from "node:assert/strict";
import test from "node:test";
import jwt from "jsonwebtoken";

process.env.DATABASE_URL ??= "postgres://localhost/music_city_test";
const { env } = await import("../../config/env.js");
const { verifyReferralReceipt } = await import("./referrals.service.js");
const claim = { inviterId: "inviter", wallet: "wallet", campaign: "registration-v1" };
const options = { algorithm: "HS256" as const, audience: "music-city-referral", issuer: "music-city" };

test("invitation receipts enforce signature, purpose, campaign and exact expiry window", () => {
  const valid = jwt.sign(claim,env.JWT_SECRET,{ ...options,expiresIn: "30d" });
  assert.equal(verifyReferralReceipt(valid).inviterId,"inviter");
  const now = Math.floor(Date.now()/1000);
  for (const receipt of [
    "forged", jwt.sign(claim,"wrong-secret",{ ...options,expiresIn: "30d" }),
    jwt.sign(claim,env.JWT_SECRET,{ ...options,audience: "session",expiresIn: "30d" }),
    jwt.sign({ ...claim,campaign: "unknown" },env.JWT_SECRET,{ ...options,expiresIn: "30d" }),
    jwt.sign(claim,env.JWT_SECRET,{ ...options,expiresIn: "1d" }),
    jwt.sign({ ...claim,iat: now-31*86400 },env.JWT_SECRET,{ ...options,expiresIn: "30d" }),
    jwt.sign({ ...claim,iat: now+100 },env.JWT_SECRET,{ ...options,expiresIn: "30d" }),
  ]) assert.throws(() => verifyReferralReceipt(receipt), /invalid or expired/);
});
