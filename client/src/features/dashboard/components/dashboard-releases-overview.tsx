"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  type ReleaseSummary,
} from "@music-city/shared";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { FormField } from "@/components/ui/form-field";
import { StudioPageHeader } from "@/components/studio/page-header";
import { LibraryRow } from "@/components/studio/library-row";
import { EmptyState } from "@/components/studio/empty-state";
import { StatusBadge } from "@/components/studio/status-badge";
import { releasesApi } from "@/features/music/lib/releases-api";
import { ArtistAccessGate } from "@/features/onboarding/components/artist-access-gate";
import { useAuth } from "@/hooks/use-auth";

export const DashboardReleasesOverview = () => {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [releases, setReleases] = useState<ReleaseSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [loadError, setLoadError] = useState("");
  const loadReleases = async () => {
    if (!session?.token) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setLoadError("");
    try {
      setReleases(await releasesApi.listMyReleases(session.token));
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Unable to load releases",
      );
    } finally {
      setIsLoading(false);
    }
  };
  useEffect(() => {
    void loadReleases();
  }, [session?.token]);
  if (!session)
    return (
      <p className="text-sm text-muted-foreground">
        Connect your wallet before managing releases.
      </p>
    );
  if (session.primaryIntent !== "artist" && session.primaryIntent !== "both")
    return <ArtistAccessGate action="create or manage releases" />;
  const visible = releases.filter(
    (release) => filter === "all" || release.status === filter,
  );
  return (
    <div className="space-y-6">
      <StudioPageHeader
        title="Your releases"
        description="Build and publish your discography."
        actions={
          <Button
            onClick={() => navigate("/dashboard/releases/new")}
          >
            <Plus />
            New release
          </Button>
        }
      />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <FormField
          id="release-filter"
          label="Status"
          className="w-full sm:w-52"
        >
          <Select
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          >
            <option value="all">All releases</option>
            <option value="draft">Drafts</option>
            <option value="scheduled">Scheduled</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </Select>
        </FormField>
        <p className="text-sm text-muted-foreground">
          {releases.filter((item) => item.status === "draft").length} drafts ·{" "}
          {releases.filter((item) => item.status === "scheduled").length}{" "}
          scheduled ·{" "}
          {releases.filter((item) => item.status === "published").length}{" "}
          published
        </p>
      </div>
      {loadError ? (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-3 text-sm text-destructive"
        >
          {loadError}
          <Button variant="outline" onClick={() => void loadReleases()}>
            Retry
          </Button>
        </div>
      ) : null}
      {isLoading ? (
        <p role="status" className="text-sm text-muted-foreground">
          Loading your releases...
        </p>
      ) : visible.length ? (
        <ul className="space-y-4">
          {visible.map((release) => (
            <LibraryRow
              key={release.id}
              variant="card"
              title={release.title}
              href={`/dashboard/releases/${release.id}`}
              description={
                <>
                  {release.type.toUpperCase()} · {release.trackCount} {release.trackCount === 1 ? "track" : "tracks"}
                  {release.releaseDate ? (
                    <>
                      <br />
                      Release date:{" "}
                      {new Date(release.releaseDate).toLocaleString()} ·{" "}
                      {Intl.DateTimeFormat().resolvedOptions().timeZone}
                    </>
                  ) : null}
                </>
              }
              actions={
                <Button asChild variant="outline">
                  <Link href={`/releases/${release.id}`}>Preview fan page</Link>
                </Button>
              }
            >
              <div className="flex flex-wrap gap-2"><StatusBadge status={release.publication?.state==="failed"?"Needs attention":release.publication?.state==="processing"||release.publication?.state==="scheduled"?release.publication.state:release.status} />{release.hasRevision ? <StatusBadge status="Saved revision" /> : null}</div>
            </LibraryRow>
          ))}
        </ul>
      ) : !loadError ? (
        <EmptyState
          title={
            filter === "all"
              ? "No releases yet"
              : "No releases with this status"
          }
          description={
            filter === "all"
              ? "Create a Single, EP, or album, then add your recordings."
              : "Choose another status to see the rest of your catalog."
          }
        />
      ) : null}

    </div>
  );
};
