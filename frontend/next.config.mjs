import { createRequire } from 'module'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const { loadEnvConfig } = require('@next/env')

// Repo root `.env` (shared) and `frontend/.env` (app-only).
loadEnvConfig(path.join(__dirname, '..'))
loadEnvConfig(__dirname)

/** Vapi Web SDK needs the key in the browser; accept `VAPI_API_KEY` / `VAPI_ASSISTANT_ID` as aliases. */
const vapiPublicKey =
  process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY ||
  process.env.NEXT_PUBLIC_VAPI_API_KEY ||
  process.env.VAPI_API_KEY ||
  process.env.VAPI_PUBLIC_KEY ||
  ''

const vapiAssistantId =
  process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID || process.env.VAPI_ASSISTANT_ID || ''

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  env: {
    NEXT_PUBLIC_VAPI_PUBLIC_KEY: vapiPublicKey,
    NEXT_PUBLIC_VAPI_ASSISTANT_ID: vapiAssistantId,
  },
}

export default nextConfig
