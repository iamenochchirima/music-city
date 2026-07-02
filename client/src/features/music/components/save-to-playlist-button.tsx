"use client";

import { useEffect, useState } from "react";
import type { PlaylistSummary, TrackSummary } from "@music-city/shared";
import { ListPlus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { playlistsApi } from "@/features/music/lib/playlists-api";
import { useAuth } from "@/hooks/use-auth";

export const SaveToPlaylistButton = ({ track }: { track: TrackSummary }) => {
  const { session } = useAuth();
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const token = session?.token;
      if (!token || !isOpen) {
        return;
      }

      try {
        const items = await playlistsApi.listMyPlaylists(token);
        if (!cancelled) {
          setPlaylists(items);
        }
      } catch {
        if (!cancelled) {
          setPlaylists([]);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [isOpen, session?.token]);

  if (!session?.token) {
    return null;
  }

  const saveTrack = async () => {
    const token = session?.token;
    if (!token || !selectedPlaylistId) {
      return;
    }

    try {
      setIsSaving(true);
      await playlistsApi.addTrackToPlaylist(token, selectedPlaylistId, {
        trackId: track.id,
      });
      toast.success("Track saved to playlist.");
      setIsOpen(false);
      setSelectedPlaylistId("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save track");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        className="border-white/10 bg-white/5 text-white hover:bg-white/10"
        onClick={() => setIsOpen(true)}
      >
        <ListPlus className="mr-2 h-4 w-4" />
        Save to playlist
      </Button>

      {isOpen ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/80 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#171a2a] p-6 shadow-2xl">
            <div className="space-y-2">
              <p className="text-sm font-medium uppercase tracking-[0.3em] text-emerald-400">
                Save track
              </p>
              <h3 className="text-2xl font-semibold text-white">{track.title}</h3>
            </div>

            <div className="mt-6 space-y-4">
              <select
                value={selectedPlaylistId}
                onChange={(event) => setSelectedPlaylistId(event.target.value)}
                className="flex h-10 w-full rounded-md border border-white/10 bg-slate-950 px-3 text-white"
              >
                <option value="">Select a playlist</option>
                {playlists.map((playlist) => (
                  <option key={playlist.id} value={playlist.id}>
                    {playlist.title}
                  </option>
                ))}
              </select>

              <div className="grid gap-3 sm:grid-cols-2">
                <Button
                  type="button"
                  variant="outline"
                  className="border-white/10 bg-white/5 text-white hover:bg-white/10"
                  onClick={() => setIsOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  className="bg-emerald-400 text-slate-950 hover:bg-emerald-300"
                  disabled={!selectedPlaylistId || isSaving}
                  onClick={() => void saveTrack()}
                >
                  {isSaving ? "Saving..." : "Save track"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
};
