import { randomBytes } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { chromium } from "playwright";

const requireServer = createRequire(new URL("../server/package.json", import.meta.url));
const { Keypair, TransactionBuilder } = requireServer("@stellar/stellar-sdk");

const api = process.env.TEST_API_URL;
const client = process.env.TEST_CLIENT_URL;
const admin = process.env.TEST_ADMIN_URL;
const output = process.env.TEST_EVIDENCE_DIR;
if (!api || !client || !admin || !output) throw new Error("Browser test URLs and evidence directory are required");
await mkdir(output, { recursive: true });

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const signIn = async () => {
  const keypair = Keypair.random();
  const challengeResponse = await fetch(`${api}/auth/challenge?account=${encodeURIComponent(keypair.publicKey())}`);
  assert(challengeResponse.ok, `auth challenge failed: ${challengeResponse.status}`);
  const challenge = await challengeResponse.json();
  const signed = TransactionBuilder.fromXDR(challenge.transaction, challenge.networkPassphrase);
  signed.sign(keypair);
  const verified = await fetch(`${api}/auth/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transaction: signed.toXDR() }),
  });
  assert(verified.ok, `signed wallet verification failed: ${verified.status}`);
  return (await verified.json()).session;
};

const watchActivationNetwork = (page) => {
  const calls = { paymentIntents: [], balances: [], accountBalances: [] };
  let onAccount = false;
  page.on("request", (request) => {
    if (request.url().includes("/payments/intents/artist-onboarding-fee")) calls.paymentIntents.push(request.url());
    if (request.url().includes("/wallet/me")) {
      if (onAccount) calls.accountBalances.push(request.url());
      else calls.balances.push(request.url());
    }
  });
  return { calls, showAccountOverview: () => { onAccount = true; } };
};

const launchOptions = { headless: true, args: ["--no-sandbox"] };
if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
  launchOptions.executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
}
const browser = await chromium.launch(launchOptions);

try {
  const displayName = "Early User Artist With A Longer Name To Check Narrow Layout On Mobile";
  assert(displayName.length <= 80, "long display name must fit the profile limit");
  const session = await signIn();
  const context = await browser.newContext({ viewport: { width: 1360, height: 1000 } });
  await context.addInitScript((value) => localStorage.setItem("music-city-auth-session", JSON.stringify(value)), session);
  const page = await context.newPage();
  const network = watchActivationNetwork(page);
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto(`${client}/onboarding`);
  await page.getByLabel(/Display name/).fill(displayName);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("radio").nth(1).check();
  const quote = page.getByLabel("Artist activation");
  await quote.waitFor();
  const quoteText = await quote.innerText();
  assert(quoteText.includes("$20.00") && quoteText.includes("100% early-user discount") && quoteText.includes("$0.00"), `unexpected activation quote: ${quoteText}`);
  await page.screenshot({ path: `${output}/artist-activation-quote.png`, fullPage: true });

  // Simulate an interrupted registration after the artist intent and quote have been saved.
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("heading", { name: "Artist profile" }).waitFor();
  await page.reload();
  await page.getByRole("heading", { name: "Artist profile" }).waitFor();
  await page.getByRole("button", { name: "Skip for now", exact: true }).click();
  await page.getByRole("button", { name: "Skip for now", exact: true }).click();
  await page.getByText("Your artist workspace is ready.").waitFor();

  const receipt = page.getByLabel("Artist activation");
  await receipt.waitFor();
  const receiptText = await receipt.innerText();
  assert(receiptText.includes("EARLYUSER") && receiptText.includes("Your artist access is active") && receiptText.includes("terms v1"), `saved sponsorship receipt is incomplete: ${receiptText}`);
  assert(network.calls.paymentIntents.length === 0, "sponsored onboarding requested a payment intent");
  assert(network.calls.balances.length === 0, "sponsored onboarding requested a wallet balance");
  assert(pageErrors.length === 0, `browser errors: ${pageErrors.join("; ")}`);
  await page.screenshot({ path: `${output}/artist-activation-complete.png`, fullPage: true });

  await page.reload();
  await page.getByLabel("Artist activation").waitFor();
  assert((await page.getByLabel("Artist activation").innerText()).includes("EARLYUSER"), "receipt did not survive refresh");
  network.showAccountOverview();
  await page.goto(`${client}/account`);
  await page.getByText("Activated by Music City").waitFor();
  await page.getByText("Early-user discount", { exact: false }).waitFor();
  await page.screenshot({ path: `${output}/artist-account-receipt.png`, fullPage: true });

  const auth = { Authorization: `Bearer ${session.token}` };
  const beforeReferralResponse = await page.request.get(`${api}/referrals/me`, { headers: auth });
  assert(beforeReferralResponse.ok(), `could not load inviter progress: ${beforeReferralResponse.status()}`);
  const beforeReferral = await beforeReferralResponse.json();
  assert(beforeReferral.enabled && beforeReferral.code, "inviter does not have an active invitation link");

  // Follow the real invitation URL in another authenticated browser profile.
  const referredContext = await browser.newContext({ viewport: { width: 1360, height: 1000 } });
  const referredPage = await referredContext.newPage();
  const referredNetwork = watchActivationNetwork(referredPage);
  const referredErrors = [];
  referredPage.on("pageerror", (error) => referredErrors.push(error.message));
  await referredPage.goto(`${client}/join?ref=${encodeURIComponent(beforeReferral.code)}`);
  await referredPage.getByText(`You were invited by ${displayName}. Your invitation is saved for registration.`).waitFor();
  await referredPage.screenshot({ path: `${output}/artist-referral-invitation.png`, fullPage: true });
  const referredSession = await signIn();
  await referredPage.evaluate((value) => localStorage.setItem("music-city-auth-session", JSON.stringify(value)), referredSession);
  await referredPage.reload();
  await referredPage.goto(`${client}/onboarding`);
  await referredPage.getByText(`Invited by ${displayName}. Applied to your registration.`).waitFor();
  await referredPage.getByLabel(/Display name/).fill("Referred Early Artist");
  await referredPage.getByRole("button", { name: "Continue", exact: true }).click();
  await referredPage.getByRole("radio").nth(1).check();
  const referredQuote = referredPage.getByLabel("Artist activation");
  await referredQuote.waitFor();
  assert((await referredQuote.innerText()).includes("100% early-user discount"), "referred artist did not receive the automatic sponsorship quote");
  await referredPage.screenshot({ path: `${output}/referred-artist-activation-quote.png`, fullPage: true });
  await referredPage.getByRole("button", { name: "Continue", exact: true }).click();
  await referredPage.getByRole("button", { name: "Skip for now", exact: true }).click();
  await referredPage.getByRole("button", { name: "Skip for now", exact: true }).click();
  await referredPage.getByText("Your artist workspace is ready.").waitFor();
  const referredReceipt = await referredPage.getByLabel("Artist activation").innerText();
  assert(referredReceipt.includes("EARLYUSER") && referredReceipt.includes("Your artist access is active"), "referred artist did not receive the saved sponsored receipt");
  assert(referredNetwork.calls.paymentIntents.length === 0 && referredNetwork.calls.balances.length === 0, "referred sponsored onboarding made a payment or balance request");
  assert(referredErrors.length === 0, `referred browser errors: ${referredErrors.join("; ")}`);

  const afterReferralResponse = await page.request.get(`${api}/referrals/me`, { headers: auth });
  assert(afterReferralResponse.ok(), `could not reload inviter progress: ${afterReferralResponse.status()}`);
  const afterReferral = await afterReferralResponse.json();
  assert(afterReferral.totals.started === beforeReferral.totals.started + 1, "inviter registration total did not increase once");
  assert(afterReferral.totals.completed === beforeReferral.totals.completed + 1 && afterReferral.totals.artists === beforeReferral.totals.artists + 1, "inviter artist completion totals did not increase once");
  assert(afterReferral.rewardsEnabled === false, "registration referral unexpectedly enabled cash rewards");
  const trackResponse = await page.request.post(`${api}/tracks`, { headers: auth, data: { title: "Sponsored draft track", genre: "Afrobeats" } });
  assert(trackResponse.status() === 201, `sponsored artist could not create a draft track (${trackResponse.status()})`);
  const trackPayload = await trackResponse.json();
  assert(trackPayload.track.status === "awaiting_upload", "track was not saved as a draft");
  const releaseResponse = await page.request.post(`${api}/releases`, { headers: auth, data: { title: "Sponsored draft single", type: "single", genre: "Afrobeats" } });
  assert(releaseResponse.status() === 201, `sponsored artist could not create a draft release (${releaseResponse.status()})`);

  const bootstrapResponse = await fetch(`${api}/admin/auth/bootstrap`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Early User Reviewer", email: "early-user-review@example.test", password: randomBytes(24).toString("hex") }),
  });
  assert(bootstrapResponse.ok, `admin bootstrap failed: ${bootstrapResponse.status}`);
  const adminSession = await bootstrapResponse.json();
  const reportResponse = await page.request.get(`${api}/admin/referrals`, { headers: { Authorization: `Bearer ${adminSession.session.token}` } });
  assert(reportResponse.ok(), `admin referral report failed: ${reportResponse.status()}`);
  const referralReport = await reportResponse.json();
  assert(Array.isArray(referralReport.items), `admin referral report shape was ${JSON.stringify(Object.keys(referralReport))}`);
  const referredRow = referralReport.items.find((item) => item.invitee_name === "Referred Early Artist");
  assert(referredRow && referredRow.inviter_name === displayName && referredRow.paid_activation === null, "admin referral report lost the inviter or counted a paid activation");

  const adminContext = await browser.newContext({ viewport: { width: 1360, height: 1000 } });
  await adminContext.addInitScript((value) => localStorage.setItem("music-city-admin-session", JSON.stringify(value)), adminSession);
  const adminPage = await adminContext.newPage();
  await adminPage.goto(`${admin}/console/sponsorships`);
  await adminPage.getByRole("heading", { name: displayName, exact: true }).waitFor();
  await adminPage.getByText("Referred Early Artist").waitFor();
  await adminPage.getByText(`Personal invitation from ${displayName}`).waitFor();
  await adminPage.getByText("Fees waived at face value: $40.00").waitFor();
  await adminPage.screenshot({ path: `${output}/admin-sponsorship-report.png`, fullPage: true });
  await page.goto(`${client}/account/referrals`);
  await page.getByText("Artist registered", { exact: true }).waitFor();
  await page.getByText("Registrations started").waitFor();
  await page.screenshot({ path: `${output}/referral-progress.png`, fullPage: true });

  const reason = adminPage.getByLabel("Reason for pausing");
  await reason.fill("Browser acceptance pause");
  await adminPage.getByRole("button", { name: "Pause new eligibility" }).click();
  await adminPage.getByText("Paused", { exact: true }).waitFor();

  const pausedSession = await signIn();
  const pausedContext = await browser.newContext({ viewport: { width: 1360, height: 1000 } });
  await pausedContext.addInitScript((value) => localStorage.setItem("music-city-auth-session", JSON.stringify(value)), pausedSession);
  const pausedPage = await pausedContext.newPage();
  const pausedNetwork = watchActivationNetwork(pausedPage);
  await pausedPage.goto(`${client}/onboarding`);
  await pausedPage.getByLabel(/Display name/).fill("Account Registered During Campaign Pause");
  await pausedPage.getByRole("button", { name: "Continue", exact: true }).click();
  await pausedPage.getByRole("radio").nth(1).check();
  const pausedQuote = pausedPage.getByLabel("Artist activation");
  await pausedQuote.waitFor();
  const pausedQuoteText = await pausedQuote.innerText();
  assert(pausedQuoteText.includes("$20.00") && pausedQuoteText.includes("early-user offer is not available"), `post-pause quote was not the full price: ${pausedQuoteText}`);
  assert(!pausedQuoteText.includes("100% early-user discount"), "post-pause account was automatically sponsored");
  assert(pausedNetwork.calls.paymentIntents.length === 0 && pausedNetwork.calls.balances.length === 0, "post-pause quote unexpectedly started a payment or balance check");
  await adminPage.getByLabel("Reason for resuming").fill("Browser acceptance resume");
  await adminPage.getByRole("button", { name: "Resume new eligibility" }).click();
  await adminPage.getByText("Active", { exact: true }).waitFor();

  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await mobileContext.addInitScript((value) => localStorage.setItem("music-city-auth-session", JSON.stringify(value)), session);
  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto(`${client}/account`);
  await mobilePage.getByLabel("Artist activation").waitFor();
  const mobileDimensions = await mobilePage.evaluate(() => ({ width: innerWidth, documentWidth: document.documentElement.scrollWidth }));
  assert(mobileDimensions.documentWidth <= mobileDimensions.width, `mobile layout overflows: ${JSON.stringify(mobileDimensions)}`);
  await mobilePage.screenshot({ path: `${output}/artist-account-receipt-mobile.png`, fullPage: true });

  const stalePaymentAttempt = await page.request.post(`${api}/payments/intents/artist-onboarding-fee`, { headers: auth, data: {} });
  assert(stalePaymentAttempt.status() === 409, `stale sponsored session was not rejected (${stalePaymentAttempt.status()})`);
  console.log(JSON.stringify({
    result: "passed",
    quote: quoteText,
    receipt: receiptText,
    referral: { started: afterReferral.totals.started, completed: afterReferral.totals.completed, artists: afterReferral.totals.artists, adminPaidActivation: referredRow.paid_activation },
    trackStatus: trackPayload.track.status,
    releaseCreated: true,
    stalePaymentAttempt: stalePaymentAttempt.status(),
    activationPaymentIntentCalls: network.calls.paymentIntents.length + referredNetwork.calls.paymentIntents.length + pausedNetwork.calls.paymentIntents.length,
    activationBalanceCalls: network.calls.balances.length + referredNetwork.calls.balances.length + pausedNetwork.calls.balances.length,
    accountWalletOverviewCalls: network.calls.accountBalances.length,
    mobileDimensions,
    pausedQuote: pausedQuoteText,
  }));

  await adminContext.close();
  await pausedContext.close();
  await mobileContext.close();
  await referredContext.close();
  await context.close();
} finally {
  await browser.close();
}
