import { NextResponse } from 'next/server'

/**
 * API route to check if environment variables are available
 * This runs on the server, so it can access environment variables directly
 */
export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  const allEnvKeys = Object.keys(process.env)
  const supabaseKeys = allEnvKeys.filter(k => k.includes('SUPABASE'))
  const nextPublicKeys = allEnvKeys.filter(k => k.startsWith('NEXT_PUBLIC_'))

  return NextResponse.json({
    hasUrl: !!supabaseUrl,
    hasKey: !!supabaseKey,
    hasServiceKey: !!serviceKey,
    urlLength: supabaseUrl?.length || 0,
    keyLength: supabaseKey?.length || 0,
    urlPreview: supabaseUrl ? `${supabaseUrl.substring(0, 20)}...` : 'missing',
    keyPreview: supabaseKey ? `${supabaseKey.substring(0, 10)}...` : 'missing',
    // Show all SUPABASE-related keys found
    supabaseKeys: supabaseKeys.sort(),
    // Show all NEXT_PUBLIC_ keys (for debugging)
    allNextPublicKeys: nextPublicKeys.sort(),
    // Show first few characters to help debug (not full values for security)
    urlStartsWith: supabaseUrl?.substring(0, 8) || 'N/A',
    keyStartsWith: supabaseKey?.substring(0, 10) || 'N/A',
    environment: process.env.NODE_ENV,
    // Check if we're on Vercel
    isVercel: !!process.env.VERCEL,
    vercelEnv: process.env.VERCEL_ENV, // production, preview, or development
    // Helpful message
    message: !supabaseUrl || !supabaseKey
      ? '❌ Missing Supabase environment variables. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel Settings → Environment Variables, then redeploy.'
      : '✅ Supabase environment variables are configured',
    missingVariables: [
      !supabaseUrl && 'NEXT_PUBLIC_SUPABASE_URL',
      !supabaseKey && 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      !serviceKey && 'SUPABASE_SERVICE_ROLE_KEY (optional for client-side auth)',
    ].filter(Boolean) as string[],
    // Critical: Show if variables exist on SERVER but might not be in CLIENT bundle
    serverHasVariables: !!supabaseUrl && !!supabaseKey,
    // Instructions based on what we find
    instructions: !supabaseUrl || !supabaseKey
      ? [
          '1. Go to Vercel Dashboard → Settings → Environment Variables',
          '2. Verify NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY exist',
          '3. Check that Production checkbox is checked for both',
          '4. Force a fresh rebuild (see FORCE_REBUILD_FIX.md)',
          '5. Variables must be set BEFORE the build starts',
        ]
      : [
          '✅ Variables are set on the server',
          'If client still shows hasUrl: false, the build cache is being used',
          'Force a fresh rebuild by making a code change and pushing',
        ],
  })
}



