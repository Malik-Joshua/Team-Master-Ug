import { NextResponse } from 'next/server'

/**
 * API route to check if environment variables are available
 * This runs on the server, so it can access environment variables directly
 */
export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  return NextResponse.json({
    hasUrl: !!supabaseUrl,
    hasKey: !!supabaseKey,
    urlLength: supabaseUrl?.length || 0,
    keyLength: supabaseKey?.length || 0,
    urlPreview: supabaseUrl ? `${supabaseUrl.substring(0, 20)}...` : 'missing',
    keyPreview: supabaseKey ? `${supabaseKey.substring(0, 10)}...` : 'missing',
    allEnvKeys: Object.keys(process.env)
      .filter(k => k.includes('SUPABASE') || k.includes('NEXT_PUBLIC'))
      .sort(),
    // Show first few characters to help debug (not full values for security)
    urlStartsWith: supabaseUrl?.substring(0, 8) || 'N/A',
    keyStartsWith: supabaseKey?.substring(0, 10) || 'N/A',
    environment: process.env.NODE_ENV,
    // Check if we're on Vercel
    isVercel: !!process.env.VERCEL,
    vercelEnv: process.env.VERCEL_ENV, // production, preview, or development
  })
}

