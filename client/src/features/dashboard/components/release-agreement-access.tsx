import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { AgreementSummary, ReleaseDetail } from "@music-city/shared";
import { Button } from "@/components/ui/button";
import { agreementApi, agreementStateLabel } from "@/features/agreements/agreement-api";

export function ReleaseAgreementAccess({
  release,
  token,
}: {
  release: Pick<ReleaseDetail, "id" | "tracks">;
  token: string;
}) {
  const [agreements, setAgreements] = useState<AgreementSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await agreementApi.list(token);
      setAgreements(result.items);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not load agreements",
      );
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const byTrack = new Map(
    agreements.map((agreement) => [agreement.context.track.id, agreement]),
  );

  return (
    <section
      aria-labelledby="release-agreements-title"
      className="space-y-4 rounded-lg border border-border bg-card p-4 sm:p-5"
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 id="release-agreements-title" className="text-lg font-semibold">
            Contributors & splits
          </h2>
          <p className="text-sm text-muted-foreground">
            Set the royalty shares for each song. Contributors review agreements separately.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/account/agreements">All agreements</Link>
        </Button>
      </header>

      {loading ? (
        <p role="status" className="text-sm text-muted-foreground">
          Loading song agreements…
        </p>
      ) : error ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3">
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
          <Button variant="outline" size="sm" onClick={() => void load()}>
            Try again
          </Button>
        </div>
      ) : release.tracks.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Add a song to this release before setting its split.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {release.tracks.map(({ trackId, track }) => {
            const agreement = byTrack.get(trackId);
            const target = agreement
              ? `/account/agreements/${agreement.id}?release=${encodeURIComponent(release.id)}`
              : `/account/agreements/new?track=${encodeURIComponent(trackId)}&release=${encodeURIComponent(release.id)}`;
            const split = agreement?.current.proposal.recipients
              .map((recipient) => {
                const person = agreement.context.people.find(
                  (candidate) => candidate.walletAddress === recipient.walletAddress,
                );
                return `${person?.name ?? "Contributor"} ${Number((recipient.shareBps / 100).toFixed(2))}%`;
              })
              .join(" · ");
            const status = agreement
              ? agreement.effectiveVersion
                ? agreement.current.state === "finalized"
                  ? `Active · v${agreement.effectiveVersion}`
                  : `${agreementStateLabel(agreement.current.state)} · Active v${agreement.effectiveVersion}`
                : agreementStateLabel(agreement.current.state)
              : "Not set up";

            return (
              <li
                key={trackId}
                className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-0 flex-1">
                  <h3 className="break-words font-medium">{track.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {status}
                  </p>
                  {split && (
                    <p className="mt-1 break-words text-sm text-muted-foreground">
                      {split}
                    </p>
                  )}
                </div>
                <Button asChild variant={agreement ? "outline" : "default"} size="sm">
                  <Link to={target}>
                    {agreement
                      ? agreement.current.state === "draft"
                        ? "Continue setup"
                        : "Manage agreement"
                      : "Set up split"}
                  </Link>
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
