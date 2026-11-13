import type { NextConfig } from "next";

// Trace from this app even when a parent folder has another lockfile or workspace file.
const config: NextConfig = { outputFileTracingRoot: process.cwd() };
export default config;
