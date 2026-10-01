import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The app used to live under /v2; keep old links and bookmarks working.
  async redirects() {
    return [
      { source: "/v2", destination: "/", permanent: false },
      { source: "/v2/learn/:concept", destination: "/learn/:concept", permanent: false },
      { source: "/v2/decks/:concept", destination: "/decks/:concept", permanent: false },
    ];
  },
};

export default nextConfig;
