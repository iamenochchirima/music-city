"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";
import type { PlaylistCreateInput, PlaylistDetail, PlaylistSummary } from "@music-city/shared";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PlaylistGrid } from "@/features/music/components/playlist-grid";
import { playlistsApi } from "@/features/music/lib/playlists-api";
import { useAuth } from "@/hooks/use-auth";

const initialForm: PlaylistCreateInput = {
  title: "",
  description: "",
  visibility: "private",
};

export const AccountPlaylistsOverview = () => {
  const { session } = useAuth();
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
  const [form, setForm] = useState<PlaylistCreateInput>(initialForm);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const loadPlaylists = async () => {
    const token = session?.token;

    if (!token) {
      setPlaylists([]);
      return;
    }

    setIsLoading(true);

    try {
      setPlaylists(await playlistsApi.listMyPlaylists(token));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadPlaylists();
  }, [session?.token]);

  const handleCreated = (playlist: PlaylistDetail) => {
    setPlaylists((current) => [
      playlist,
      ...current.filter((item) => item.id !== playlist.id),
    ]);
    setIsCreateOpen(false);
    setForm(initialForm);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const token = session?.token;

    if (!token) {
      return;
    }

    try {
      setIsCreating(true);
      const playlist = await playlistsApi.createPlaylist(token, form);
      handleCreated(playlist);
      toast.success("Playlist created.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create playlist");
    } finally {
      setIsCreating(false);
    }
  };

  if (!session) {
    return (
      <div className="rounded-lg border border-white/10 bg-white/5 p-8 text-sm text-slate-300">
        Log in to manage playlists.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4 rounded-lg border border-white/10 bg-white/5 p-6">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold text-white">Your playlists</h2>
          <p className="text-sm text-slate-300">
            Build listening sets from your favorite tracks.
          </p>
        </div>
        <Button
          className="bg-emerald-400 text-slate-950 hover:bg-emerald-300"
          onClick={() => setIsCreateOpen(true)}
        >
          <Plus className="mr-2 h-4 w-4" />
          New playlist
        </Button>
      </div>

      {isCreateOpen ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/80 px-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-[#171a2a] p-6 shadow-2xl sm:p-8">
            <div className="mb-6 space-y-2">
              <p className="text-sm font-medium uppercase tracking-[0.3em] text-emerald-400">
                New playlist
              </p>
              <h3 className="text-3xl font-semibold tracking-tight text-white">
                Create a playlist
              </h3>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <label className="text-sm text-slate-300">Title</label>
                <Input
                  value={form.title}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, title: event.target.value }))
                  }
                  className="border-white/10 bg-slate-950 text-white"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-slate-300">Visibility</label>
                <select
                  value={form.visibility}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      visibility: event.target.value as PlaylistCreateInput["visibility"],
                    }))
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
                  value={form.description ?? ""}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  className="min-h-28 border-white/10 bg-slate-950 text-white"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Button
                  type="button"
                  variant="outline"
                  className="border-white/10 bg-white/5 text-white hover:bg-white/10"
                  onClick={() => setIsCreateOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-emerald-400 text-slate-950 hover:bg-emerald-300"
                  disabled={isCreating}
                >
                  {isCreating ? "Creating..." : "Create playlist"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <div className="space-y-5">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-2xl font-semibold text-white">Saved sets</h2>
          <Button
            asChild
            variant="outline"
            className="border-white/10 bg-white/5 text-white hover:bg-white/10"
          >
            <Link href="/account">Back to account</Link>
          </Button>
        </div>

        {isLoading ? (
          <div className="text-sm text-slate-400">Loading your playlists...</div>
        ) : (
          <PlaylistGrid
            playlists={playlists}
            hrefBuilder={(playlist) => `/account/playlists/${playlist.id}`}
          />
        )}
      </div>
    </div>
  );
};
