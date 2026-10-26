import assert from "node:assert/strict";
import test from "node:test";
import { Pool } from "pg";
import { onboardingFeedbackMigrationStatements } from "./onboarding-feedback-migration.js";

const url = process.env.TEST_DATABASE_URL;
test(
  "onboarding migration preserves profiles, normalizes nested metadata, and is idempotent",
  { skip: !url },
  async () => {
    assert.ok(
      ["localhost", "127.0.0.1"].includes(new URL(url!).hostname),
      "Use a local test database",
    );
    const pool = new Pool({ connectionString: url });
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        "CREATE TEMP TABLE users(id text, primary_intent text, onboarding_step text, onboarding_status text, payload jsonb) ON COMMIT DROP",
      );
      await client.query(
        "CREATE TEMP TABLE tracks(payload jsonb) ON COMMIT DROP",
      );
      await client.query(
        "CREATE TEMP TABLE releases(payload jsonb) ON COMMIT DROP",
      );
      for (const intent of ["listener", "artist", "both"]) {
        await client.query(
          "INSERT INTO users VALUES($1,$1,'personalize','in_progress',$2)",
          [
            intent,
            JSON.stringify({
              genres: ["Soul", "R&B", "Hip-Hop", "Maskandi"],
              bio: "Soul music",
              socialLinks: {
                soundcloud: "https://soundcloud.com/old",
                facebook: "https://facebook.com/artist",
              },
              onboardingStep: "personalize",
            }),
          ],
        );
      }
      await client.query(
        "INSERT INTO users VALUES('completed','artist','complete','complete',$1)",
        [JSON.stringify({ onboardingStep: "complete", genres: ["Soul"] })],
      );
      await client.query("INSERT INTO tracks VALUES($1)", [
        JSON.stringify({ genre: "Soul", title: "Soul" }),
      ]);
      await client.query("INSERT INTO releases VALUES($1)", [
        JSON.stringify({
          genre: "R&B",
          liveVersion: {
            genre: "Soul",
            tracks: [{ track: { genre: "Hip-Hop" } }],
          },
        }),
      ]);
      const run = async () => {
        for (const statement of onboardingFeedbackMigrationStatements)
          await client.query(statement);
      };
      await run();
      const users = (await client.query("SELECT * FROM users ORDER BY id"))
        .rows;
      for (const row of users.filter((row) => row.id !== "completed")) {
        assert.deepEqual(row.payload.genres, [
          "R&B / Soul",
          "Hip-hop",
          "Maskandi",
        ]);
        assert.equal(row.payload.bio, "Soul music");
        assert.equal(
          row.payload.socialLinks.facebook,
          "https://facebook.com/artist",
        );
        assert.equal("soundcloud" in row.payload.socialLinks, false);
        assert.equal(
          row.onboarding_step,
          row.id === "listener" ? "visuals" : "artist_identity",
        );
        assert.equal(row.payload.onboardingStep, row.onboarding_step);
      }
      assert.equal(
        users.find((row) => row.id === "completed").onboarding_status,
        "complete",
      );
      assert.deepEqual(
        (await client.query("SELECT payload FROM tracks")).rows[0].payload,
        { genre: "R&B / Soul", title: "Soul" },
      );
      const release = (await client.query("SELECT payload FROM releases"))
        .rows[0].payload;
      assert.equal(release.liveVersion.genre, "R&B / Soul");
      assert.equal(release.liveVersion.tracks[0].track.genre, "Hip-hop");
      await run();
      assert.deepEqual(
        (await client.query("SELECT * FROM users ORDER BY id")).rows,
        users,
      );
    } finally {
      await client.query("ROLLBACK");
      client.release();
      await pool.end();
    }
  },
);
