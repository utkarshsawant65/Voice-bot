import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: { "/api/chat": ["./persona.md", "./persona.example.md"] },
};

export default nextConfig;
