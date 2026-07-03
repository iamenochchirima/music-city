export const primaryNavigationItems = [
  { href: "/discover", label: "Discover" },
  { href: "/releases", label: "Releases" },
  { href: "/artists", label: "Artists" },
] as const;

export const browseNavigationItems = [
  {
    href: "/playlists",
    label: "Playlists",
    description: "Community-built listening paths",
  },
  {
    href: "/stream",
    label: "All tracks",
    description: "Jump into the full song catalog",
  },
  {
    href: "/marketplace",
    label: "Marketplace",
    description: "Unlock drops, access, and paid releases",
  },
] as const;
