import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Clock3,
  Headphones,
  Play,
  Radio,
  Sparkles,
  Users,
} from "lucide-react";

const featuredDrops = [
  {
    title: "Midnight Echoes",
    artist: "Neon Flux",
    genre: "Synthwave",
    status: "New this week",
    duration: "3:42",
    image: "/images/landing/artist-1.png",
    tone: "from-violet-500/80 via-fuchsia-500/20 to-cyan-300/10",
  },
  {
    title: "Ethereal Voices",
    artist: "Aurora",
    genre: "Ambient pop",
    status: "Early preview",
    duration: "4:18",
    image: "/images/landing/artist-2.png",
    tone: "from-cyan-300/60 via-sky-500/20 to-violet-500/20",
  },
  {
    title: "Night Shift",
    artist: "Club 808",
    genre: "Electronic",
    status: "Just added",
    duration: "2:56",
    image: "/images/landing/artist-3.png",
    tone: "from-fuchsia-500/70 via-orange-400/20 to-violet-500/10",
  },
] as const;

const popularTracks = [
  { title: "Urban Flow", artist: "0xKilla", genre: "Hip-hop", image: "/images/landing/artist-3.png" },
  { title: "Afterglow", artist: "Ethereal", genre: "Cyber-pop", image: "/images/landing/artist-2.png" },
  { title: "Static Hearts", artist: "Neon Flux", genre: "Synthwave", image: "/images/landing/artist-1.png" },
  { title: "Low Light", artist: "Club 808", genre: "Electronic", image: "/images/landing/artist-3.png" },
] as const;

const artists = [
  {
    name: "Neon Flux",
    genre: "Synthwave",
    detail: "Glowing nights and analogue warmth",
    image: "/images/landing/artist-1.png",
  },
  {
    name: "Ethereal",
    genre: "Cyber-pop",
    detail: "Soft vocals for wide-open spaces",
    image: "/images/landing/artist-2.png",
  },
  {
    name: "Block Beats",
    genre: "Underground",
    detail: "Rough edges, heavy low end",
    image: "/images/landing/artist-3.png",
  },
] as const;

export default function LandingPage() {
  return (
    <div className="relative -mt-16 min-h-screen overflow-hidden bg-[#03030d] pt-16 text-white selection:bg-violet-500 selection:text-white">
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-1 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-300" />

      <section className="relative min-h-[calc(100svh-4rem)] overflow-hidden bg-[#03030d]">
        <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
          <div className="absolute left-[12%] top-[18%] h-2 w-2 animate-[musiccity-float_12s_linear_infinite] rounded-full bg-violet-400/50 blur-[1px]" />
          <div className="absolute left-[46%] top-[28%] h-1.5 w-1.5 animate-[musiccity-float_16s_linear_infinite] rounded-full bg-cyan-300/40 blur-[1px]" />
          <div className="absolute bottom-[22%] left-[30%] h-1.5 w-1.5 animate-[musiccity-float_14s_linear_infinite] rounded-full bg-fuchsia-400/40 blur-[1px]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(139,92,246,0.16),transparent_28%),radial-gradient(circle_at_72%_22%,rgba(34,211,238,0.12),transparent_24%)]" />
        </div>

        <div className="relative z-10 grid min-h-[calc(100svh-4rem)] lg:grid-cols-2">
          <div className="flex items-center px-6 py-16 sm:px-10 lg:px-16 xl:px-24">
            <div className="max-w-xl animate-[musiccity-rise_900ms_ease-out_both]">
              <p className="mb-5 text-xs font-bold uppercase tracking-[0.46em] text-violet-300">
                Music City
              </p>
              <h1 className="text-[4.4rem] font-black leading-[0.98] tracking-[-0.08em] text-white sm:text-[6rem] sm:leading-[0.96] lg:text-[7rem]">
                Feel the
                <span className="block bg-gradient-to-r from-violet-400 to-cyan-300 bg-clip-text pb-2 text-transparent">
                  Rhythm.
                </span>
              </h1>
              <p className="mt-8 max-w-lg text-xl font-light leading-snug text-white/55 sm:text-2xl">
                Discover new artists, preview the next drop, and find the music
                you will want to play again.
              </p>

              <div className="mt-12 flex flex-col gap-4 sm:flex-row">
                <Link
                  href="/discover"
                  className="inline-flex h-14 items-center justify-center gap-3 rounded-full bg-white px-8 text-lg font-extrabold text-black transition hover:scale-[1.03]"
                >
                  Start listening
                  <Play className="h-5 w-5 fill-black" />
                </Link>
                <Link
                  href="/artists"
                  className="inline-flex h-14 items-center justify-center gap-3 rounded-full border border-white/20 bg-white/[0.03] px-8 text-lg font-bold text-white transition hover:bg-white/10"
                >
                  Browse artists
                  <ArrowRight className="h-5 w-5" />
                </Link>
              </div>
            </div>
          </div>

          <div className="relative min-h-[52vh] overflow-hidden lg:min-h-[calc(100svh-4rem)]">
            <div className="absolute inset-0 z-10 bg-gradient-to-t from-[#03030d] via-[#03030d]/20 to-transparent lg:bg-gradient-to-r lg:from-[#03030d] lg:via-[#03030d]/35 lg:to-transparent" />
            <Image
              src="/images/landing/musiccity-hero.png"
              alt="Artist in a cinematic Music City listening scene"
              fill
              priority
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="animate-[musiccity-image-in_1200ms_ease-out_both] object-cover object-center"
            />
          </div>
        </div>

        <div className="absolute bottom-8 left-6 z-20 hidden animate-bounce flex-col items-center gap-2 text-white/45 md:left-24 lg:flex">
          <span className="text-[10px] font-bold uppercase tracking-[0.28em]">
            Scroll
          </span>
          <div className="h-8 w-px bg-gradient-to-b from-white to-transparent" />
        </div>
      </section>

      <section className="border-y border-white/5 bg-black/45 py-6 backdrop-blur-xl sm:py-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-8 gap-y-4 px-6 text-center text-sm font-semibold text-white/65 sm:justify-between sm:text-left">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-400/10 text-violet-300">
              <Headphones className="h-4 w-4" />
            </span>
            <span>New music worth finding</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-cyan-300/10 text-cyan-200">
              <Radio className="h-4 w-4" />
            </span>
            <span>Early previews from rising artists</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-fuchsia-400/10 text-fuchsia-200">
              <Sparkles className="h-4 w-4" />
            </span>
            <span>A better way to keep listening</span>
          </div>
        </div>
      </section>

      <section className="bg-[#03030d] py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-10 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.35em] text-violet-300">
                Curated for discovery
              </p>
              <h2 className="mt-3 text-4xl font-black tracking-[-0.06em] sm:text-5xl">
                Featured drops
              </h2>
              <p className="mt-3 max-w-xl text-lg text-white/50">
                Fresh releases and early previews to put something new in your
                headphones.
              </p>
            </div>
            <Link
              href="/releases"
              className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10"
            >
              See all releases
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
            <Link
              href="/stream"
              className="group relative min-h-[23rem] overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04]"
            >
              <Image
                src={featuredDrops[0].image}
                alt=""
                fill
                sizes="(min-width: 1024px) 55vw, 100vw"
                className="object-cover object-center opacity-70 transition duration-700 group-hover:scale-105 group-hover:opacity-85"
              />
              <div className={`absolute inset-0 bg-gradient-to-br ${featuredDrops[0].tone}`} />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-7 sm:p-9">
                <div className="mb-5 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.25em] text-cyan-200">
                  <span className="rounded-full bg-cyan-300/15 px-3 py-1.5">{featuredDrops[0].status}</span>
                  <span className="flex items-center gap-1 text-white/55">
                    <Clock3 className="h-3.5 w-3.5" />
                    {featuredDrops[0].duration}
                  </span>
                </div>
                <h3 className="text-4xl font-black tracking-[-0.06em] sm:text-5xl">
                  {featuredDrops[0].title}
                </h3>
                <p className="mt-2 text-lg text-white/70">
                  {featuredDrops[0].artist} · {featuredDrops[0].genre}
                </p>
                <span className="mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-extrabold text-black transition group-hover:gap-3">
                  <Play className="h-4 w-4 fill-black" />
                  Preview track
                </span>
              </div>
            </Link>

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1">
              {featuredDrops.slice(1).map((drop) => (
                <Link
                  key={drop.title}
                  href="/stream"
                  className="group relative flex min-h-[11rem] overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/[0.04]"
                >
                  <Image
                    src={drop.image}
                    alt=""
                    fill
                    sizes="(min-width: 1024px) 40vw, 100vw"
                    className="object-cover object-center opacity-45 transition duration-700 group-hover:scale-105 group-hover:opacity-65"
                  />
                  <div className={`absolute inset-0 bg-gradient-to-br ${drop.tone}`} />
                  <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/45 to-transparent" />
                  <div className="relative flex flex-col justify-center p-6">
                    <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-violet-200">
                      {drop.status}
                    </p>
                    <h3 className="mt-2 text-2xl font-black tracking-tight">{drop.title}</h3>
                    <p className="mt-1 text-sm text-white/65">
                      {drop.artist} · {drop.genre}
                    </p>
                    <span className="mt-4 flex items-center gap-1 text-xs font-bold text-white/75">
                      <Play className="h-3.5 w-3.5 fill-white" />
                      Listen now
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-white/5 bg-black/35 py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-10 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.35em] text-cyan-200">
                Keep exploring
              </p>
              <h2 className="mt-3 text-4xl font-black tracking-[-0.06em] sm:text-5xl">
                Popular with listeners
              </h2>
            </div>
            <Link
              href="/stream"
              className="hidden items-center gap-2 text-sm font-bold text-white/60 transition hover:text-white sm:flex"
            >
              Open the full catalog
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {popularTracks.map((track, index) => (
              <Link
                key={track.title}
                href="/stream"
                className="group rounded-[1.5rem] border border-white/10 bg-white/[0.035] p-3 transition hover:-translate-y-1 hover:border-violet-300/35 hover:bg-white/[0.06]"
              >
                <div className="relative aspect-square overflow-hidden rounded-[1.15rem] bg-gradient-to-br from-violet-500/30 to-cyan-300/10">
                  <Image
                    src={track.image}
                    alt=""
                    fill
                    sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                    className="object-cover opacity-65 transition duration-500 group-hover:scale-105 group-hover:opacity-85"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                  <span className="absolute left-3 top-3 rounded-full bg-black/45 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white/75 backdrop-blur-md">
                    0{index + 1}
                  </span>
                  <span className="absolute bottom-3 right-3 flex h-10 w-10 translate-y-2 items-center justify-center rounded-full bg-white text-black opacity-0 shadow-xl transition group-hover:translate-y-0 group-hover:opacity-100">
                    <Play className="h-4 w-4 fill-black" />
                  </span>
                </div>
                <div className="px-2 pb-2 pt-4">
                  <h3 className="truncate text-lg font-bold">{track.title}</h3>
                  <p className="mt-1 text-sm text-white/55">{track.artist}</p>
                  <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">
                    {track.genre}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#03030d] py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.35em] text-fuchsia-200">
                Voices worth following
              </p>
              <h2 className="mt-3 text-4xl font-black tracking-[-0.06em] sm:text-5xl">
                Artists to discover
              </h2>
            </div>
            <Link
              href="/artists"
              className="inline-flex w-fit items-center gap-2 text-sm font-bold text-white/60 transition hover:text-white"
            >
              Browse all artists
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {artists.map((artist) => (
              <Link
                key={artist.name}
                href="/artists"
                className="group flex items-center gap-5 rounded-[1.5rem] border border-white/10 bg-white/[0.035] p-4 transition hover:border-fuchsia-300/30 hover:bg-white/[0.06]"
              >
                <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-white/10">
                  <Image
                    src={artist.image}
                    alt={artist.name}
                    fill
                    sizes="96px"
                    className="object-cover transition duration-500 group-hover:scale-110"
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-fuchsia-200">
                    {artist.genre}
                  </p>
                  <h3 className="mt-2 truncate text-xl font-black tracking-tight">
                    {artist.name}
                  </h3>
                  <p className="mt-1 line-clamp-2 text-sm leading-5 text-white/45">
                    {artist.detail}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-white/5 bg-[radial-gradient(circle_at_50%_0%,rgba(139,92,246,0.22),transparent_48%),#050511] py-20 sm:py-24">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white/10 text-white">
            <Users className="h-6 w-6" />
          </div>
          <h2 className="mt-7 text-4xl font-black tracking-[-0.06em] sm:text-6xl">
            Your next favorite track is here.
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-white/55">
            Take a walk through the catalog, find a new voice, and make your
            listening queue feel like yours.
          </p>
          <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/discover"
              className="inline-flex h-14 items-center justify-center gap-2 rounded-full bg-white px-7 py-3.5 font-extrabold text-black transition hover:scale-[1.03]"
            >
              Start listening
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/become-artist"
              className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/[0.04] px-7 py-3.5 text-sm font-bold text-white/75 transition hover:bg-white/10 hover:text-white"
            >
              For artists
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/5 bg-black py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-5 px-6 md:flex-row">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-tr from-violet-500 to-cyan-300">
              <Play className="ml-0.5 h-3 w-3 fill-white text-white" />
            </span>
            <span className="text-xl font-bold tracking-tight">Music City</span>
          </Link>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm font-semibold text-white/50">
            <Link href="/discover" className="transition hover:text-white">Discover</Link>
            <Link href="/artists" className="transition hover:text-white">Artists</Link>
            <Link href="/playlists" className="transition hover:text-white">Playlists</Link>
            <Link href="/become-artist" className="transition hover:text-white">For artists</Link>
          </div>
          <p className="text-sm text-white/30">
            © {new Date().getFullYear()} Music City
          </p>
        </div>
      </footer>
    </div>
  );
}
