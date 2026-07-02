import Link from "next/link";
import type { ArtistSummary } from "@music-city/shared";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const ArtistGrid = ({ artists }: { artists: ArtistSummary[] }) => {
  if (artists.length === 0) {
    return (
      <div className="rounded-lg border border-white/10 bg-white/5 p-8 text-sm text-slate-300">
        No artist profiles are available yet.
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {artists.map((artist) => (
        <Link key={artist.id} href={`/artists/${artist.id}`}>
          <Card className="h-full border-white/10 bg-white/5 text-white shadow-none transition hover:border-emerald-400/30 hover:bg-white/[0.07]">
            <CardHeader className="space-y-2">
              <CardTitle className="text-xl">{artist.name}</CardTitle>
              <p className="text-sm text-slate-400">
                {artist.genre} • {artist.city}
              </p>
            </CardHeader>
            <CardContent className="text-sm text-slate-300">
              <div className="rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2">
                {artist.monthlyListeners} monthly listeners
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
};
