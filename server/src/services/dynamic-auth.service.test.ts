import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import { exportJWK, generateKeyPair, SignJWT } from "jose";

process.env.DATABASE_URL ??= "postgres://music-city:music-city@127.0.0.1:5432/music-city";
process.env.DYNAMIC_ENVIRONMENT_ID = "music-city-auth-test";

const { privateKey, publicKey } = await generateKeyPair("RS256");
const publicJwk = await exportJWK(publicKey);
publicJwk.kid = "music-city-test-key";
publicJwk.alg = "RS256";
publicJwk.use = "sig";

const jwksServer = createServer((_request, response) => {
  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify({ keys: [publicJwk] }));
});

await new Promise<void>((resolve) => {
  jwksServer.listen(0, "127.0.0.1", resolve);
});

const address = jwksServer.address();
if (!address || typeof address === "string") {
  throw new Error("Test JWKS server did not bind to a TCP port");
}
process.env.DYNAMIC_JWKS_URL = `http://127.0.0.1:${address.port}/jwks`;

const [{ dynamicAuthService }, { usersService }] = await Promise.all([
  import("./dynamic-auth.service.js"),
  import("../modules/users/users.service.js"),
]);

const signDynamicToken = async (verifiedCredentials: object[], scope = "user:basic") =>
  new SignJWT({
    email: "listener@example.test",
    environment_id: process.env.DYNAMIC_ENVIRONMENT_ID,
    scope,
    verified_credentials: verifiedCredentials,
  })
    .setProtectedHeader({ alg: "RS256", kid: publicJwk.kid })
    .setIssuer(`app.dynamic.xyz/${process.env.DYNAMIC_ENVIRONMENT_ID}`)
    .setSubject("dynamic-test-user")
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(privateKey);

test("Dynamic sessions verify provider claims and bind only a linked Stellar wallet", async () => {
  const originalGetProfile = usersService.getProfile;
  usersService.getProfile = (async () => null) as typeof usersService.getProfile;

  try {
    const walletAddress = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
    const token = await signDynamicToken([
      { chain: "stellar", address: walletAddress },
      { chain: "ethereum", address: "0x1234" },
    ]);

    const session = await dynamicAuthService.createSession(token);
    assert.equal(session.walletAddress, walletAddress);
    assert.equal(session.email, "listener@example.test");

    await assert.rejects(
      dynamicAuthService.createSession(token, "GOTHERWALLET"),
      /Requested Stellar wallet is not linked/,
    );

    const noStellarWalletToken = await signDynamicToken([
      { chain: "ethereum", address: "0x1234" },
    ]);
    await assert.rejects(
      dynamicAuthService.createSession(noStellarWalletToken),
      /No Stellar wallet is linked/,
    );

    const incompleteLoginToken = await signDynamicToken(
      [{ chain: "stellar", address: walletAddress }],
      "user:email",
    );
    await assert.rejects(
      dynamicAuthService.createSession(incompleteLoginToken),
      /missing the user:basic scope/,
    );
  } finally {
    usersService.getProfile = originalGetProfile;
  }
});

test.after(async () => {
  await new Promise<void>((resolve, reject) => {
    jwksServer.close((error) => (error ? reject(error) : resolve()));
  });
});
