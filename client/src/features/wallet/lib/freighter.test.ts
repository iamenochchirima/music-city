import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getNetwork: vi.fn(),
  requestAccess: vi.fn(),
  signTransaction: vi.fn(),
  requestChallenge: vi.fn(),
  verifyChallenge: vi.fn(),
}));

vi.mock("@stellar/freighter-api", () => ({
  getNetwork: mocks.getNetwork,
  requestAccess: mocks.requestAccess,
  signTransaction: mocks.signTransaction,
}));
vi.mock("@/features/auth/lib/auth-api", () => ({
  authApi: {
    requestChallenge: mocks.requestChallenge,
    verifyChallenge: mocks.verifyChallenge,
  },
}));
vi.mock("@/lib/config/env", () => ({
  clientEnv: { stellarNetworkPassphrase: "Test SDF Network ; September 2015" },
}));

import { signInWithFreighter, signWithFreighter } from "./freighter";

const account = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
const challenge = {
  transaction: "unsigned-xdr",
  networkPassphrase: "Test SDF Network ; September 2015",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getNetwork.mockResolvedValue({ networkPassphrase: challenge.networkPassphrase });
  mocks.requestAccess.mockResolvedValue({ address: account });
  mocks.requestChallenge.mockResolvedValue(challenge);
  mocks.signTransaction.mockResolvedValue({ signedTxXdr: "signed-xdr", signerAddress: account });
  mocks.verifyChallenge.mockResolvedValue({ walletAddress: account, token: "session" });
});
afterEach(() => vi.restoreAllMocks());

it("signs a server challenge and verifies the returned signature", async () => {
  await signInWithFreighter();

  expect(mocks.requestAccess).toHaveBeenCalledOnce();
  expect(mocks.requestChallenge).toHaveBeenCalledWith(account);
  expect(mocks.signTransaction).toHaveBeenCalledWith("unsigned-xdr", {
    address: account,
    networkPassphrase: challenge.networkPassphrase,
  });
  expect(mocks.verifyChallenge).toHaveBeenCalledWith({ transaction: "signed-xdr" });
});

it("refuses sign-in when the wallet is on another Stellar network", async () => {
  mocks.getNetwork.mockResolvedValue({ networkPassphrase: "Public Global Stellar Network ; September 2015" });

  await expect(signInWithFreighter()).rejects.toThrow("different Stellar network");
  expect(mocks.requestChallenge).not.toHaveBeenCalled();
  expect(mocks.signTransaction).not.toHaveBeenCalled();
});

it("ignores a wallet access response that arrives after sign-in was cancelled", async () => {
  let resolveAccess!: (result: { address: string }) => void;
  mocks.requestAccess.mockImplementation(
    () =>
      new Promise((resolve) => {
        resolveAccess = resolve;
      }),
  );
  const controller = new AbortController();
  const signIn = signInWithFreighter(controller.signal);

  controller.abort(new Error("Freighter did not respond in time"));
  resolveAccess({ address: account });

  await expect(signIn).rejects.toThrow("Freighter did not respond in time");
  expect(mocks.getNetwork).not.toHaveBeenCalled();
  expect(mocks.requestChallenge).not.toHaveBeenCalled();
  expect(mocks.signTransaction).not.toHaveBeenCalled();
});

it("rejects a signature made by an account other than the requested creator", async () => {
  mocks.signTransaction.mockResolvedValue({ signedTxXdr: "signed-xdr", signerAddress: `${account}X` });

  await expect(signInWithFreighter()).rejects.toThrow("different account");
  expect(mocks.verifyChallenge).not.toHaveBeenCalled();
});

it("checks the account and network before signing an agreement response", async () => {
  await signWithFreighter("agreement-xdr", account);

  expect(mocks.signTransaction).toHaveBeenCalledWith("agreement-xdr", {
    address: account,
    networkPassphrase: challenge.networkPassphrase,
  });
});
