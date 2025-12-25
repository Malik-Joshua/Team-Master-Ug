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
    } else {
      // Server-side: Ensure PDFKit doesn't try to load external font files
      config.resolve.alias = {
        ...config.resolve.alias,
      }
      // Prevent PDFKit from trying to access font files
      config.externals = config.externals || []
    }
    return config
  },
}

module.exports = nextConfig



