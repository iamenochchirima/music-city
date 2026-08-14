"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ArtistSummary, TrackCredit, TrackCreditRole, TrackSummary } from "@music-city/shared";
import { ArrowLeft, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { tracksApi } from "@/features/music/lib/tracks-api";
import { usersApi } from "@/features/users/lib/users-api";

const CREDIT_ROLES: TrackCreditRole[] = [
  "songwriter",
  "composer",
  "producer",
  "publisher",
  "lyricist",
  "remixer",
  "engineer",
];

export const TrackManageOverview = ({ trackId }: { trackId: string }) => {
  const router = useRouter();
  const { session } = useAuth();
  const [track, setTrack] = useState<TrackSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isMetadataSaving, setIsMetadataSaving] = useState(false);
  const [isrc, setIsrc] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isExplicit, setIsExplicit] = useState(false);
  const [featuredArtists, setFeaturedArtists] = useState("");
  const [credits, setCredits] = useState<TrackCredit[]>([]);
  const [newCreditRole, setNewCreditRole] = useState<TrackCreditRole>("songwriter");
  const [newCreditName, setNewCreditName] = useState("");
  const [newCreditArtistId, setNewCreditArtistId] = useState("");
  const [artistOptions, setArtistOptions] = useState<ArtistSummary[]>([]);

  useEffect(() => {
    let cancelled = false;

    const loadTrack = async () => {
      if (!session?.token) {
        setIsLoading(false);
        return;
      }

      try {
        const nextTrack = await tracksApi.getManageTrack(session.token, trackId);

        if (!cancelled) {
          if (!nextTrack) {
            setTrack(null);
            return;
          }

          setTrack(nextTrack);
          setTitle(nextTrack.title);
          setIsrc(nextTrack.isrc ?? "");
          setDescription(nextTrack.description ?? "");
          setIsExplicit(nextTrack.isExplicit ?? false);
          setFeaturedArtists(nextTrack.featuredArtists?.join(", ") ?? "");
          setCredits(nextTrack.credits ?? []);
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(
            error instanceof Error ? error.message : "Unable to load track details",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadTrack();

    return () => {
      cancelled = true;
    };
  }, [session?.token, trackId]);

  useEffect(() => {
    let cancelled = false;

    void usersApi.listArtists().then((artists) => {
      if (!cancelled) {
        setArtistOptions(artists);
      }
    }).catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  const deleteTrack = async () => {
    if (!session?.token || !track) {
      return;
    }

    const confirmed = window.confirm(
      `Delete "${track.title}"? This action cannot be undone.`,
    );

    if (!confirmed) {
      return;
    }

    try {
      setIsDeleting(true);
      await tracksApi.deleteTrack(session.token, track.id);
      toast.success("Track deleted.");
      router.push("/dashboard/tracks");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to delete track",
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const addCredit = () => {
    const name = newCreditName.trim();

    if (!name) {
      return;
    }

    setCredits((current) => [
      ...current,
      {
        role: newCreditRole,
        name,
        artistId: newCreditArtistId || undefined,
      },
    ]);
    setNewCreditName("");
    setNewCreditArtistId("");
  };

  const saveTitle = async () => {
    if (!session?.token || !track) {
      return;
    }

    try {
      setIsMetadataSaving(true);
      const updated = await tracksApi.updateTrackMetadata(session.token, track.id, {
        title: title.trim(),
      });
      setTrack(updated);
      toast.success("Track title saved.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to save track metadata",
      );
    } finally {
      setIsMetadataSaving(false);
    }
  };

  const saveMetadata = async () => {
    if (!session?.token || !track) {
      return;
    }

    try {
      setIsMetadataSaving(true);
      const updated = await tracksApi.updateTrackMetadata(session.token, track.id, {
        title: title.trim(),
        isrc: isrc.trim(),
        description: description.trim(),
        isExplicit,
        featuredArtists: featuredArtists
          .split(",")
          .map((artist) => artist.trim())
          .filter(Boolean),
        credits,
      });
      setTrack(updated);
      toast.success("Track metadata saved.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to save track metadata",
      );
    } finally {
      setIsMetadataSaving(false);
    }
  };

  if (!session) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.04] p-5 text-slate-300">
        Connect your account before managing a track.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.04] p-5 text-slate-300">
        Loading track details...
      </div>
    );
  }

  if (!track) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.04] p-5 text-slate-300">
        Track not found.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Button
          asChild
          variant="outline"
          className="border-white/10 bg-white/5 text-white hover:bg-white/10"
        >
          <Link href="/dashboard">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to dashboard
          </Link>
        </Button>

        <div className="flex flex-wrap gap-2">
          <Button
            asChild
            variant="outline"
            className="border-white/10 bg-white/5 text-white hover:bg-white/10"
          >
            <Link href={track.releaseId ? `/dashboard/releases/${track.releaseId}` : "/dashboard/releases"}>
              {track.releaseId ? "Manage release" : "Add to release"}
            </Link>
          </Button>
          <Button
            variant="outline"
            className="border-white/10 bg-white/5 text-white hover:bg-white/10"
            onClick={() => router.push("/discover")}
          >
            Open discover
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.04] p-5 sm:p-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-emerald-300">
            Track
          </p>
          <h2 className="mt-1 text-2xl font-semibold text-white">{track.title}</h2>
          <p className="mt-1 text-sm text-slate-400">
            {track.artistName} · {track.genre} · {track.runtime}
          </p>
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          <div className="rounded-lg border border-white/10 bg-slate-950/50 p-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
              Status
            </p>
            <p className="mt-2 text-base text-white">{track.status}</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-slate-950/50 p-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
              Playback
            </p>
            <p className="mt-2 text-base text-white">
              {track.playbackReady ? "Ready" : "Not ready"}
            </p>
          </div>
          <div className="rounded-lg border border-white/10 bg-slate-950/50 p-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
              Release
            </p>
            <p className="mt-2 truncate text-base text-white">
              {track.releaseTitle ?? "Not assigned"}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.04] p-5 sm:p-6">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-emerald-300">
          Track details
        </p>
        <div className="mt-4 max-w-xl space-y-2">
          <label htmlFor="track-title" className="text-sm text-slate-300">
            Track title
          </label>
          <Input
            id="track-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Track title"
            className="border-white/10 bg-slate-950 text-white"
          />
        </div>
        <Button
          type="button"
          className="mt-4 bg-emerald-400 text-slate-950 hover:bg-emerald-300"
          disabled={isMetadataSaving || !title.trim()}
          onClick={() => void saveTitle()}
        >
          {isMetadataSaving ? "Saving..." : "Save changes"}
        </Button>
      </div>

      <details className="group rounded-xl border border-white/10 bg-white/[0.04]">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-base font-semibold text-white [&::-webkit-details-marker]:hidden">
          Credits & identifiers
          <span className="text-xs font-normal text-slate-500 group-open:text-emerald-300">
            Optional metadata
          </span>
        </summary>
        <div className="space-y-5 border-t border-white/10 p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm text-slate-300">Existing ISRC</label>
              <Input
                value={isrc}
                onChange={(event) => setIsrc(event.target.value)}
                placeholder="Leave blank if you do not have one"
                className="border-white/10 bg-slate-950 text-white"
              />
              <p className="text-xs text-slate-500">Music City will not generate an official ISRC.</p>
            </div>
            <label className="flex items-start gap-3 rounded-lg border border-white/10 bg-slate-950/45 p-3 text-sm text-slate-300">
              <input type="checkbox" checked={isExplicit} onChange={(event) => setIsExplicit(event.target.checked)} className="mt-0.5 h-4 w-4 accent-emerald-400" />
              <span>
                <span className="block font-medium text-white">Explicit content</span>
                <span className="mt-1 block text-xs text-slate-500">Show the explicit-content marker to listeners.</span>
              </span>
            </label>
          </div>

          <div className="space-y-2">
            <label className="text-sm text-slate-300">Featured artists</label>
            <Input
              value={featuredArtists}
              onChange={(event) => setFeaturedArtists(event.target.value)}
              placeholder="Separate names with commas"
              className="border-white/10 bg-slate-950 text-white"
            />
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-sm text-slate-300">Credits</p>
              <p className="mt-1 text-xs text-slate-500">Add as many contributors as needed. These do not block saving.</p>
            </div>
            {credits.length > 0 ? (
              <div className="space-y-2">
                {credits.map((credit, index) => (
                  <div key={`${credit.role}-${credit.name}-${index}`} className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-slate-950/45 px-3 py-2 text-sm">
                    <span className="text-white">
                      {credit.name}
                      <span className="ml-2 text-xs capitalize text-slate-500">{credit.role}</span>
                      {credit.artistId ? <span className="ml-2 text-xs text-emerald-300">Linked profile</span> : null}
                    </span>
                    <button type="button" className="text-slate-500 hover:text-red-200" onClick={() => setCredits((current) => current.filter((_, creditIndex) => creditIndex !== index))} aria-label={`Remove ${credit.name}`}><Trash2 className="h-4 w-4" /></button>
                  </div>
                ))}
              </div>
            ) : null}
            <div className="grid gap-2 sm:grid-cols-[160px_minmax(0,1fr)_minmax(0,180px)_auto]">
              <select value={newCreditRole} onChange={(event) => setNewCreditRole(event.target.value as TrackCreditRole)} className="h-10 rounded-md border border-white/10 bg-slate-950 px-3 text-sm capitalize text-white">
                {CREDIT_ROLES.map((role) => <option key={role} value={role}>{role}</option>)}
              </select>
              <Input value={newCreditName} onChange={(event) => setNewCreditName(event.target.value)} placeholder="Contributor name" className="border-white/10 bg-slate-950 text-white" />
              <select value={newCreditArtistId} onChange={(event) => setNewCreditArtistId(event.target.value)} className="h-10 rounded-md border border-white/10 bg-slate-950 px-3 text-sm text-white">
                <option value="">Link profile (optional)</option>
                {artistOptions.map((artist) => <option key={artist.id} value={artist.id}>{artist.name}</option>)}
              </select>
              <Button type="button" variant="outline" className="border-white/10 bg-white/5 text-white hover:bg-white/10" onClick={addCredit}>Add credit</Button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm text-slate-300">Track note <span className="text-slate-500">(optional)</span></label>
            <Textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="A short listener-facing note about this recording" className="min-h-24 border-white/10 bg-slate-950 text-white" />
          </div>

          <Button type="button" className="bg-emerald-400 text-slate-950 hover:bg-emerald-300" disabled={isMetadataSaving} onClick={() => void saveMetadata()}>
            {isMetadataSaving ? "Saving..." : "Save metadata"}
          </Button>
        </div>
      </details>

      <div className="rounded-xl border border-white/10 bg-white/[0.04] p-5 sm:p-6">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-emerald-300">
          Release publication
        </p>
        <h3 className="mt-2 text-xl font-semibold text-white">
          {track.releaseTitle ? `Included in ${track.releaseTitle}` : "This track is not in a release yet"}
        </h3>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
          Tracks become public when their Single, EP, or Album is published. Upload and edit this recording here, then manage its public release from the release workspace.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button
            asChild
            className="bg-emerald-400 text-slate-950 hover:bg-emerald-300"
          >
            <Link href={track.releaseId ? `/dashboard/releases/${track.releaseId}` : "/dashboard/releases"}>
              {track.releaseId ? "Open release workspace" : "Add to a release"}
            </Link>
          </Button>
          <Button
            variant="outline"
            className="border-red-400/30 bg-red-500/10 text-red-100 hover:bg-red-500/20"
            disabled={isDeleting}
            onClick={() => void deleteTrack()}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {isDeleting ? "Deleting..." : "Delete track"}
          </Button>
        </div>
      </div>
    </div>
  );
};
