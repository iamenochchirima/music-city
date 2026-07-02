"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import type { PlaylistDetail, TrackSummary } from "@music-city/shared";
import { ArrowLeft, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { playlistsApi } from "@/features/music/lib/playlists-api";
import { tracksApi } from "@/features/music/lib/tracks-api";
import { useAuth } from "@/hooks/use-auth";

export const PlaylistManageOverview = ({ playlistId }: { playlistId: string }) => {
  const { session } = useAuth();
  const [playlist, setPlaylist] = useState<PlaylistDetail | null>(null);
  const [tracks, setTracks] = useState<TrackSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedTrackId, setSelectedTrackId] = useState("");

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const token = session?.token;

      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        const [nextPlaylist, publicTracks, myTracks] = await Promise.all([
          playlistsApi.getManagePlaylist(token, playlistId),
          tracksApi.listTracks(),
          tracksApi.listMyTracks(token),
        ]);

        if (!cancelled) {
          setPlaylist(nextPlaylist);
          const uniqueTracks = [...publicTracks];
          for (const track of myTracks) {
            if (!uniqueTracks.some((item) => item.id === track.id)) {
              uniqueTracks.push(track);
            }
          }
          setTracks(uniqueTracks);
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(
            error instanceof Error ? error.message : "Unable to load playlist",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [playlistId, session?.token]);

  const availableTracks = useMemo(() => {
    const assignedIds = new Set(playlist?.tracks.map((item) => item.trackId) ?? []);
    return tracks.filter((track) => !assignedIds.has(track.id));
  }, [tracks, playlist?.tracks]);

  const savePlaylist = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const token = session?.token;
    if (!token || !playlist) {
      return;
    }

    try {
      setIsSaving(true);
      const updated = await playlistsApi.updatePlaylist(token, playlist.id, {
        title: playlist.title,
        description: playlist.description,
        visibility: playlist.visibility,
      });
      setPlaylist(updated);
      toast.success("Playlist updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save playlist");
    } finally {
      setIsSaving(false);
    }
  };

  const addTrack = async () => {
    const token = session?.token;
    if (!token || !playlist || !selectedTrackId) {
      return;
    }

    try {
      setIsSaving(true);
      const updated = await playlistsApi.addTrackToPlaylist(token, playlist.id, {
        trackId: selectedTrackId,
      });
      setPlaylist(updated);
      setSelectedTrackId("");
      toast.success("Track added to playlist.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to add track");
    } finally {
      setIsSaving(false);
    }
  };

  const updatePosition = (trackId: string, position: number) => {
    if (!playlist) {
      return;
    }

    setPlaylist({
      ...playlist,
      tracks: playlist.tracks.map((item) =>
        item.trackId === trackId ? { ...item, position } : item,
      ),
    });
  };

  const saveOrder = async () => {
    const token = session?.token;
    if (!token || !playlist) {
      return;
    }

    try {
      setIsSaving(true);
      const updated = await playlistsApi.reorderPlaylistTracks(token, playlist.id, {
        items: playlist.tracks.map((item, index) => ({
          trackId: item.trackId,
          position: item.position || index + 1,
        })),
      });
      setPlaylist(updated);
      toast.success("Playlist order saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save order");
    } finally {
      setIsSaving(false);
    }
  };

  const removeTrack = async (trackId: string) => {
    const token = session?.token;
    if (!token || !playlist) {
      return;
    }

    try {
      setIsSaving(true);
      await playlistsApi.removeTrackFromPlaylist(token, playlist.id, trackId);
      const refreshed = await playlistsApi.getManagePlaylist(token, playlist.id);
      setPlaylist(refreshed);
      toast.success("Track removed from playlist.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to remove track");
    } finally {
      setIsSaving(false);
    }
  };

  if (!session) {
    return (
      <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-8 text-slate-300">
        Log in to manage playlists.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-8 text-slate-300">
        Loading playlist details...
      </div>
    );
  }

  if (!playlist) {
    return (
      <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-8 text-slate-300">
        Playlist not found.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <Button
        asChild
        variant="outline"
        className="border-white/10 bg-white/5 text-white hover:bg-white/10"
      >
        <Link href="/account/playlists">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to playlists
        </Link>
      </Button>

      <form
        className="space-y-6 rounded-[28px] border border-white/10 bg-white/[0.04] p-6 sm:p-8"
        onSubmit={savePlaylist}
      >
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-emerald-300">
            Playlist management
          </p>
          <h2 className="text-3xl font-semibold text-white">{playlist.title}</h2>
        </div>

        <div className="space-y-2">
          <label className="text-sm text-slate-300">Title</label>
          <Input
            value={playlist.title}
            onChange={(event) =>
              setPlaylist({ ...playlist, title: event.target.value })
            }
            className="border-white/10 bg-slate-950 text-white"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm text-slate-300">Visibility</label>
          <select
            value={playlist.visibility}
            onChange={(event) =>
              setPlaylist({
                ...playlist,
                visibility: event.target.value as PlaylistDetail["visibility"],
              })
            }
            className="flex h-10 w-full rounded-md border border-white/10 bg-slate-950 px-3 text-white"
          >
            <option value="private">Private</option>
            <option value="public">Public</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm text-slate-300">Description</label>
          <Textarea
            value={playlist.description ?? ""}
            onChange={(event) =>
              setPlaylist({
                ...playlist,
                description: event.target.value || undefined,
              })
            }
            className="min-h-28 border-white/10 bg-slate-950 text-white"
          />
        </div>

        <Button
          type="submit"
          className="bg-emerald-400 text-slate-950 hover:bg-emerald-300"
          disabled={isSaving}
        >
          {isSaving ? "Saving..." : "Save playlist details"}
        </Button>
      </form>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6 sm:p-8">
          <div className="mb-6 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-2xl font-semibold text-white">Tracklist</h3>
              <p className="text-sm text-slate-400">
                Reorder or remove tracks in this playlist.
              </p>
            </div>
            <Button
              className="bg-emerald-400 text-slate-950 hover:bg-emerald-300"
              disabled={isSaving || playlist.tracks.length === 0}
              onClick={() => void saveOrder()}
            >
              Save order
            </Button>
          </div>

          <div className="space-y-4">
            {playlist.tracks.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/30 p-6 text-sm text-slate-400">
                No tracks in this playlist yet.
              </div>
            ) : (
              playlist.tracks.map((item) => (
                <div
                  key={item.trackId}
                  className="grid gap-4 rounded-3xl border border-white/10 bg-slate-950/50 p-4 lg:grid-cols-[minmax(0,1fr)_100px_40px]"
                >
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold text-white">
                      {item.track.title}
                    </p>
                    <p className="truncate text-sm text-slate-400">
                      {item.track.artistName}
                    </p>
                  </div>
                  <Input
                    value={String(item.position)}
                    onChange={(event) =>
                      updatePosition(item.trackId, Number(event.target.value) || 1)
                    }
                    className="border-white/10 bg-slate-950 text-white"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    className="border border-white/10 text-red-200 hover:bg-red-500/10 hover:text-red-100"
                    onClick={() => void removeTrack(item.trackId)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </section>

        <aside className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6 sm:p-8">
          <h3 className="text-xl font-semibold text-white">Add track</h3>
          <p className="mt-2 text-sm text-slate-400">
            Add a track from the public catalog or your own private releases.
          </p>

          <div className="mt-5 space-y-4">
            <select
              value={selectedTrackId}
              onChange={(event) => setSelectedTrackId(event.target.value)}
              className="flex h-10 w-full rounded-md border border-white/10 bg-slate-950 px-3 text-white"
            >
              <option value="">Select a track</option>
              {availableTracks.map((track) => (
                <option key={track.id} value={track.id}>
                  {track.title} - {track.artistName}
                </option>
              ))}
            </select>

            <Button
              type="button"
              className="w-full bg-emerald-400 text-slate-950 hover:bg-emerald-300"
              disabled={isSaving || !selectedTrackId}
              onClick={() => void addTrack()}
            >
              Add track to playlist
            </Button>
          </div>
        </aside>
      </div>
    </div>
  );
};
