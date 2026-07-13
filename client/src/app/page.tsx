import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Disc3,
  Headphones,
  Play,
  Radio,
  Users,
} from "lucide-react";

const stats = [
  { label: "Artist-owned drops", value: "24/7" },
  { label: "Private previews", value: "01" },
  { label: "Global release flow", value: "∞" },
] as const;

const tracks = [
  { title: "Midnight Echoes", artist: "Neon Flux", genre: "Synthwave" },
  { title: "Urban Flow", artist: "0xKilla", genre: "Hip-Hop" },
  { title: "Ethereal Voices", artist: "Aurora", genre: "Ambient" },
  { title: "Deep House", artist: "Club 808", genre: "Electronic" },
] as const;

const features = [
  {
    title: "Private drops",
    description: "Share music before release day without making the files public.",
    icon: Headphones,
  },
  {
    title: "Clean streaming",
    description: "Mux-powered playback keeps previews fast and listener-friendly.",
    icon: Radio,
  },
  {
    title: "Artist control",
    description: "Profiles, releases, and access are managed from one workspace.",
    icon: Users,
  },
] as const;

const artists = [
  {
    name: "Neon Flux",
    genre: "Synthwave",
    image: "/images/landing/artist-1.png",
  },
  {
    name: "Ethereal",
    genre: "Cyber-Pop",
    image: "/images/landing/artist-2.png",
  },
  {
    name: "Block Beats",
    genre: "Underground",
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
                <span className="block pb-2 bg-gradient-to-r from-violet-400 to-cyan-300 bg-clip-text text-transparent">
                  Rhythm.
                </span>
              </h1>
              <p className="mt-8 max-w-lg text-xl font-light leading-snug text-white/55 sm:text-2xl">
                A music platform for polished streams and artist/label-owned
                release moments.
              </p>

              <div className="mt-12 flex flex-col gap-4 sm:flex-row">
                <Link
                  href="/auth"
                  className="inline-flex h-14 items-center justify-center gap-3 rounded-full bg-white px-8 text-lg font-extrabold text-black transition hover:scale-[1.03]"
                >
                  Start releasing
                  <Play className="h-5 w-5 fill-black" />
                </Link>
                <Link
                  href="/discover"
                  className="inline-flex h-14 items-center justify-center gap-3 rounded-full border border-white/20 bg-white/[0.03] px-8 text-lg font-bold text-white transition hover:bg-white/10"
                >
                  Explore music
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

      <section className="border-y border-white/5 bg-black/45 py-12 backdrop-blur-xl sm:py-16">
        <div className="mx-auto grid max-w-6xl gap-8 px-6 text-center sm:grid-cols-3 md:text-left">
          {stats.map((stat) => (
            <div key={stat.label}>
              <p className="text-5xl font-bold tracking-[-0.07em] text-white/90 sm:text-6xl">
                {stat.value}
              </p>
              <p className="mt-2 text-xs font-bold uppercase tracking-[0.3em] text-white/40">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-[#03030d] py-24 sm:py-32">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-14 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-4xl font-black tracking-[-0.05em] sm:text-5xl">
                Trending now
              </h2>
              <p className="mt-2 text-lg text-white/50">
                Sounds shaping the next release cycle.
              </p>
            </div>
            <Link
              href="/stream"
              className="w-fit rounded-full border border-white/10 bg-white/[0.04] px-6 py-3 text-sm font-bold tracking-wide text-white transition hover:bg-white/10"
            >
              VIEW ALL
            </Link>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {tracks.map((track) => (
              <Link
                key={track.title}
                href="/stream"
                className="group overflow-hidden rounded-[1.5rem] border border-white/5 bg-white/[0.025] transition hover:border-violet-400/40"
              >
                <div className="relative flex aspect-square items-center justify-center overflow-hidden bg-white/[0.04]">
                  <div className="absolute inset-0 bg-gradient-to-br from-violet-500/20 to-transparent opacity-0 transition group-hover:opacity-100" />
                  <Disc3 className="relative z-10 h-16 w-16 text-white/20 transition duration-500 group-hover:scale-110 group-hover:text-white/35" />
                  <div className="absolute bottom-4 left-4 z-20 flex h-10 w-10 translate-y-4 items-center justify-center rounded-full bg-black/50 opacity-0 backdrop-blur-md transition group-hover:translate-y-0 group-hover:opacity-100">
                    <Play className="h-4 w-4 fill-white text-white" />
                  </div>
                </div>
                <div className="p-6">
                  <h3 className="truncate text-lg font-bold">{track.title}</h3>
                  <p className="mt-1 text-sm text-white/50">{track.artist}</p>
                  <p className="mt-4 inline-block rounded bg-white/5 px-2 py-1 text-[10px] font-semibold uppercase text-white/60">
                    {track.genre}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-white/5 bg-black/40 py-24 sm:py-32">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto mb-20 max-w-3xl text-center">
            <h2 className="text-4xl font-bold tracking-[-0.05em] sm:text-6xl">
              Pure listening
            </h2>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="rounded-[2rem] border border-white/5 bg-white/[0.025] p-8 text-center backdrop-blur-xl transition hover:bg-white/[0.045]"
              >
                <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-violet-500/10">
                  <feature.icon className="h-8 w-8 text-violet-300" />
                </div>
                <h3 className="text-2xl font-bold">{feature.title}</h3>
                <p className="mt-3 text-white/50">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-white/5 bg-[#03030d] py-24 sm:py-32">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-16 text-center sm:mb-20">
            <h2 className="text-5xl font-black tracking-[-0.08em] sm:text-7xl">
              Featured artists
            </h2>
            <p className="mt-4 text-xl text-white/60">
              Discover the voices defining tomorrow.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            {artists.map((artist) => (
              <Link
                key={artist.name}
                href="/artists"
                className="group relative aspect-[4/5] overflow-hidden rounded-[2rem] bg-white/5"
              >
                <div className="absolute inset-0 z-10 bg-gradient-to-t from-black via-black/20 to-transparent" />
                <Image
                  src={artist.image}
                  alt={artist.name}
                  fill
                  sizes="(min-width: 768px) 33vw, 100vw"
                  className="object-cover opacity-80 transition duration-1000 group-hover:scale-110 group-hover:rotate-1 group-hover:opacity-100"
                />
                <div className="absolute inset-x-0 bottom-0 z-20 p-8">
                  <p className="mb-2 text-xs font-bold uppercase tracking-[0.28em] text-violet-300">
                    {artist.genre}
                  </p>
                  <h3 className="text-4xl font-black tracking-tight">
                    {artist.name}
                  </h3>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-white/5 bg-black py-12">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-6 md:flex-row">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-tr from-violet-500 to-cyan-300">
              <Play className="ml-0.5 h-3 w-3 fill-white text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight">Music City</span>
          </div>
          <div className="flex gap-6 text-sm font-semibold text-white/50">
            <Link href="/discover" className="transition hover:text-white">
              Discover
            </Link>
            <Link href="/artists" className="transition hover:text-white">
              Artists
            </Link>
            <Link href="/marketplace" className="transition hover:text-white">
              Marketplace
            </Link>
          </div>
          <p className="text-sm text-white/30">
            © {new Date().getFullYear()} Music City. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
