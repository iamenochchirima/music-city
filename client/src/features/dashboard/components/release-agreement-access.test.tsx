import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import {
  agreementVersionSchema,
  type AgreementSummary,
} from "@music-city/shared";
import evidence from "../../../../../docs/contributor-agreements-evidence/stellar-testnet.json";
import { ReleaseAgreementAccess } from "./release-agreement-access";

const mocks = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock("@/features/agreements/agreement-api", async (original) => ({
  ...(await original<typeof import("@/features/agreements/agreement-api")>()),
  agreementApi: { list: mocks.list },
}));

const version = agreementVersionSchema.parse(evidence.versionHistory[0]);
const people = version.proposal.recipients.map((recipient, index) => ({
  walletAddress: recipient.walletAddress,
  profileId: `profile-${index}`,
    name:
      recipient.walletAddress === version.proposal.ownerWallet
        ? "Artist"
        : "Producer",
}));
const summary: AgreementSummary = {
  id: version.proposal.agreementId,
  effectiveVersion: version.proposal.version,
  current: version,
  context: {
    track: { id: version.proposal.trackId, title: "Recording one" },
    owner: people.find(
      (person) => person.walletAddress === version.proposal.ownerWallet,
    )!,
    people,
  },
};

describe("release agreement access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.list.mockResolvedValue({ items: [summary] });
  });
  afterEach(cleanup);

  it("shows a setup action for each song and an in-context manage link when an agreement exists", async () => {
    render(
      <MemoryRouter>
        <ReleaseAgreementAccess
          token="session-token"
          release={{
            id: "release-1",
            tracks: [
              {
                trackId: version.proposal.trackId,
                trackNumber: 1,
                discNumber: 1,
                isFocusTrack: true,
                track: {
                  id: version.proposal.trackId,
                  title: "Recording one",
                  artistId: "artist-1",
                  artistName: "Artist",
                  genre: "Pop",
                  runtime: "3:00",
                  priceLabel: "Free",
                  status: "published",
                  plays: 0,
                  likes: 0,
                },
              },
              {
                trackId: "track-two",
                trackNumber: 2,
                discNumber: 1,
                isFocusTrack: false,
                track: {
                  id: "track-two",
                  title: "Recording two",
                  artistId: "artist-1",
                  artistName: "Artist",
                  genre: "Pop",
                  runtime: "3:00",
                  priceLabel: "Free",
                  status: "published",
                  plays: 0,
                  likes: 0,
                },
              },
            ],
          }}
        />
      </MemoryRouter>,
    );

    expect(await screen.findByText(`Active · v${version.proposal.version}`)).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Manage agreement" }).getAttribute("href"),
    ).toBe(`/account/agreements/${summary.id}?release=release-1`);
    expect(
      screen.getByRole("link", { name: "Set up split" }).getAttribute("href"),
    ).toBe(`/account/agreements/new?track=track-two&release=release-1`);
    expect(mocks.list).toHaveBeenCalledWith("session-token");
  });
});
