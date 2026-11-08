import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Tailwind v4 vía Turbopack: sin esta regla `@import "tailwindcss"`
     pasa sin procesar y ninguna utilidad se genera (página sin estilos). */
  turbopack: {
    rules: {
      "*.css": {
        loaders: [{ loader: "@tailwindcss/turbopack" }],
      },
    },
  },
};

export default nextConfig;
