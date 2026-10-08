import assert from "node:assert/strict";
import test from "node:test";
import { Keypair, TransactionBuilder } from "@stellar/stellar-sdk";

process.env.DATABASE_URL ??= "postgres://music-city:music-city@127.0.0.1:5432/music-city";

const [{ stellarAuthService }, { databaseService }, { usersService }] =
  await Promise.all([
    import("./stellar-auth.service.js"),
    import("./database.service.js"),
    import("../modules/users/users.service.js"),
  ]);

const restore = <T extends object, K extends keyof T>(
  target: T,
  key: K,
  replacement: T[K],
) => {
  const original = target[key];
  target[key] = replacement;
  return () => {
    target[key] = original;
  };
};

test("Stellar wallet sign-in consumes its server-signed challenge once", async () => {
  const records = new Map<string, { walletAddress: string; expiresAt: Date }>();
  const restoreDatabase = [
    restore(
      databaseService,
      "createStellarAuthChallenge",
      (async (hash: string, walletAddress: string, expiresAt: Date) => {
        records.set(hash, { walletAddress, expiresAt });
      }) as typeof databaseService.createStellarAuthChallenge,
    ),
    restore(
      databaseService,
      "consumeStellarAuthChallenge",
      (async (hash: string, walletAddress: string) => {
        const record = records.get(hash);
        if (
          !record ||
          record.walletAddress !== walletAddress ||
          record.expiresAt.getTime() <= Date.now()
        ) {
          return false;
        }
        records.delete(hash);
        return true;
      }) as typeof databaseService.consumeStellarAuthChallenge,
    ),
  ];
  const restoreProfile = restore(
    usersService,
    "getProfile",
    (async () => null) as typeof usersService.getProfile,
  );

  try {
    const owner = Keypair.random();
    const challenge = await stellarAuthService.createChallenge(owner.publicKey());
    const signedTransaction = TransactionBuilder.fromXDR(
      challenge.transaction,
      challenge.networkPassphrase,
    );
    signedTransaction.sign(owner);

    const session = await stellarAuthService.verifyChallenge(
      signedTransaction.toXDR(),
    );
    assert.equal(session.walletAddress, owner.publicKey());
    assert.equal(records.size, 0);

    await assert.rejects(
      stellarAuthService.verifyChallenge(signedTransaction.toXDR()),
      /expired or already used/,
    );
  } finally {
    restoreProfile();
    restoreDatabase.reverse().forEach((restoreMethod) => restoreMethod());
  }
});

test("Stellar sign-in rejects a transaction signed by a different wallet", async () => {
  const records = new Map<string, { walletAddress: string; expiresAt: Date }>();
  const restoreDatabase = [
    restore(
      databaseService,
      "createStellarAuthChallenge",
      (async (hash: string, walletAddress: string, expiresAt: Date) => {
        records.set(hash, { walletAddress, expiresAt });
      }) as typeof databaseService.createStellarAuthChallenge,
    ),
    restore(
      databaseService,
      "consumeStellarAuthChallenge",
      (async (hash: string, walletAddress: string) => {
        const record = records.get(hash);
        if (!record || record.walletAddress !== walletAddress) return false;
        records.delete(hash);
        return true;
      }) as typeof databaseService.consumeStellarAuthChallenge,
    ),
  ];

  try {
    const owner = Keypair.random();
    const other = Keypair.random();
    const challenge = await stellarAuthService.createChallenge(owner.publicKey());
    const signedByOther = TransactionBuilder.fromXDR(
      challenge.transaction,
      challenge.networkPassphrase,
    );
    signedByOther.sign(other);

    await assert.rejects(
      stellarAuthService.verifyChallenge(signedByOther.toXDR()),
      /wallet owner/,
    );
    assert.equal(records.size, 1);
  } finally {
    restoreDatabase.reverse().forEach((restoreMethod) => restoreMethod());
  }
});
