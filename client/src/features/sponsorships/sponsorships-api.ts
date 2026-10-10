"use client";

import type { ArtistActivationQuote } from "@music-city/shared";

import { httpClient } from "@/lib/api/http-client";

export const sponsorshipsApi = {
  getMyArtistActivation(token: string) {
    return httpClient.get<ArtistActivationQuote>("/sponsorships/mine", token);
  },
};
