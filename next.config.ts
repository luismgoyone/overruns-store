import type { NextConfig } from 'next'

const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname : undefined

const nextConfig: NextConfig = {
  // Tailwind v4 is wired through its Turbopack loader (create-next-app 16.4 ships no PostCSS config).
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
  images: {
    // Local Supabase serves from 127.0.0.1, which the optimizer refuses; skip optimization in dev.
    unoptimized: process.env.NODE_ENV === 'development',
    remotePatterns: [
      { protocol: 'https', hostname: 'picsum.photos' },
      { protocol: 'https', hostname: 'fastly.picsum.photos' },
      ...(supabaseHost ? [{ protocol: 'https' as const, hostname: supabaseHost, pathname: '/storage/v1/object/public/**' }] : []),
    ],
  },
}

export default nextConfig
