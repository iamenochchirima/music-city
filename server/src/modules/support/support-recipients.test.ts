import test from "node:test";
import assert from "node:assert/strict";
import type {
  UserProfile,
  TrackSummary,
  TrackRoyaltySplitRecord,
} from "@music-city/shared";
import { supportService as s } from "./support.service.js";
import { usersService } from "../users/users.service.js";
import { usersRepository } from "../users/users.repository.js";
import { tracksService } from "../tracks/tracks.service.js";
import { finalizedSplitsRepository } from "../agreements/effective-split.js";
test("contributor destinations come from public linked credits or finalized agreements, including listener contributors", async () => {
  const original = {
    public: usersService.getPublicArtistProfile,
    byId: usersRepository.findById,
    byWallet: usersRepository.findByWallet,
    track: tracksService.getTrack,
    isPublic: tracksService.isTrackPublic,
    effective: finalizedSplitsRepository.effective,
  };
  const member = (id: string, wallet: string) =>
    ({
      id,
      walletAddress: wallet,
      displayName: id,
      onboardingStatus: "complete",
      primaryIntent: "listener",
    }) as UserProfile;
  usersService.getPublicArtistProfile = async () =>
    ({ id: "owner", walletAddress: "GOWNER", displayName: "Owner" }) as never;
  tracksService.getTrack = async () =>
    ({
      id: "track",
      artistId: "owner",
      credits: [
        { artistId: "linked", name: "Linked", role: "composer" },
        { name: "Unlinked", role: "producer" },
      ],
    }) as TrackSummary;
  tracksService.isTrackPublic = async () => true;
  usersRepository.findById = async (id) => member(id, "GLINKED");
  usersRepository.findByWallet = async (wallet) => member("listener", wallet);
  finalizedSplitsRepository.effective = async () =>
    ({
      recipients: [{ walletAddress: "GLISTENER", role: "producer" }],
    }) as TrackRoyaltySplitRecord;
  try {
    const recipients = await s.trackRecipients("track");
    assert.equal(recipients.length, 3);
    assert.equal(recipients[2]!.walletAddress, "GLISTENER");
    assert.equal(recipients[2]!.target.kind, "contributor");
    await assert.rejects(
      s.recipient({
        kind: "contributor",
        trackId: "track",
        profileId: "unlinked",
      }),
      /Contributor not found/,
    );
    tracksService.isTrackPublic = async () => false;
    await assert.rejects(s.trackRecipients("track"), /Song not found/);
  } finally {
    usersService.getPublicArtistProfile = original.public;
    usersRepository.findById = original.byId;
    usersRepository.findByWallet = original.byWallet;
    tracksService.getTrack = original.track;
    tracksService.isTrackPublic = original.isPublic;
    finalizedSplitsRepository.effective = original.effective;
  }
});
