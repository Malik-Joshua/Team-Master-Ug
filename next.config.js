/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: [],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
    ],
  },
  // NEXT_PUBLIC_* variables are automatically available in the browser
  // No need to explicitly define them here
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Fix for pdfjs-dist in browser
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      }
    }
    return config
  },
}

module.exports = nextConfig



