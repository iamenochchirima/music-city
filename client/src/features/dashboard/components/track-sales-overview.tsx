"use client";

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import type { AgreementSummary, TrackSummary } from "@music-city/shared";

import { StudioPageHeader } from "@/components/studio/page-header";
import { agreementApi } from "@/features/agreements/agreement-api";
import { tracksApi } from "@/features/music/lib/tracks-api";
import { useAuth } from "@/hooks/use-auth";

import { TrackSalesSettings } from "./track-sales-settings";

const Stat = ({ label, value }: { label: string; value: number }) => (
  <div className="rounded-xl border border-border bg-card p-4">
    <p className="text-2xl font-semibold text-foreground">{value}</p>
    <p className="mt-1 text-sm text-muted-foreground">{label}</p>
  </div>
);

export const TrackSalesOverview = () => {
  const { session } = useAuth();
  const [tracks, setTracks] = useState<TrackSummary[]>([]);
  const [agreements, setAgreements] = useState<AgreementSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    if (!session?.token) {
      setIsLoading(false);
      return;
    }

    void Promise.all([
      tracksApi.listMyTracks(session.token),
      agreementApi.list(session.token),
    ])
      .then(([myTracks, agreementList]) => {
        if (!active) return;
        setTracks(myTracks);
        setAgreements(agreementList.items);
      })
      .catch(() => {
        if (active) toast.error("Could not load your sales settings");
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [session?.token]);

  const agreementByTrack = useMemo(
    () =>
      new Map(
        agreements
          .filter((agreement) => agreement.effectiveVersion)
          .map((agreement) => [agreement.context.track.id, agreement]),
      ),
    [agreements],
  );

  const onSale = tracks.filter((track) => track.purchaseEnabled).length;
  const ready = tracks.filter((track) => agreementByTrack.has(track.id)).length;

  if (isLoading) {
    return <p role="status" className="text-sm text-muted-foreground">Loading sales settings…</p>;
  }

  return (
    <div className="space-y-6">
      <StudioPageHeader
        title="Sell your music"
        description="Set a USDC price for each song. Buyers purchase and download from the normal music pages."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Songs on sale" value={onSale} />
        <Stat label="Ready to price" value={ready} />
        <Stat label="Needs royalty agreement" value={Math.max(tracks.length - ready, 0)} />
      </div>

      {tracks.length === 0 ? (
        <p className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
          Upload a song and finalize its royalty agreement to start selling.
        </p>
      ) : (
        <ul className="space-y-3">
          {tracks.map((track) => {
            const agreement = agreementByTrack.get(track.id);
            const published = track.visibility === "published";
            const agreementHref = agreement
              ? `/account/agreements/${agreement.id}`
              : `/account/agreements/new?track=${encodeURIComponent(track.id)}`;

            return (
              <li
                key={track.id}
                className="space-y-3 rounded-xl border border-border bg-card p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{track.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {track.releaseTitle ?? "Single"}
                      {track.purchaseEnabled && track.purchasePrice
                        ? ` · On sale at ${track.purchasePrice} USDC`
                        : published
                          ? " · Not on sale"
                          : " · Not published"}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      agreement
                        ? "bg-emerald-400/10 text-emerald-300"
                        : "bg-amber-400/10 text-amber-200"
                    }`}
                  >
                    {agreement ? "Agreement active" : "Agreement needed"}
                  </span>
                </div>

                {published && session?.token ? (
                  <TrackSalesSettings
                    track={track}
                    token={session.token}
                    showHeading={false}
                    compact
                    agreementState={agreement ? "active" : "missing"}
                    agreementHref={agreementHref}
                    onSaved={(updated) =>
                      setTracks((current) =>
                        current.map((item) =>
                          item.id === updated.id ? updated : item,
                        ),
                      )
                    }
                  />
                ) : !published ? (
                  <p className="text-sm text-muted-foreground">
                    Publish this song in its release before selling it.{" "}
                    <Link
                      to={`/dashboard/releases/${encodeURIComponent(track.releaseId ?? "")}`}
                      className="underline underline-offset-4"
                    >
                      Open release
                    </Link>
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
