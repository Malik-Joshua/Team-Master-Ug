'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Users, QrCode, BarChart3, Lock } from 'lucide-react'

const clubThemes = [
  { name: 'Heathens RFC',    primary: '#8B1A1A', secondary: '#F5C518' },
  { name: 'Black & Gold FC', primary: '#1A1A1A', secondary: '#F5C518' },
  { name: 'Blue & Gold SC',  primary: '#1A3A6B', secondary: '#F5C518' },
  { name: 'Green United',    primary: '#1A6B3A', secondary: '#FFFFFF' },
  { name: 'Brown Bears',     primary: '#7B4A1A', secondary: '#E8E8E8' },
]

const features = [
  {
    icon: Users,
    bg: 'bg-sky-100',
    fg: 'text-sky-600',
    title: 'Player management',
    desc: 'Full squad profiles, positions, jersey numbers, and personal performance history in one place.',
  },
  {
    icon: QrCode,
    bg: 'bg-emerald-100',
    fg: 'text-emerald-600',
    title: 'Attendance roster',
    desc: 'Coaches tick off players from the squad roster each session, save the register, and generate attendance reports instantly.',
  },
  {
    icon: BarChart3,
    bg: 'bg-orange-100',
    fg: 'text-orange-600',
    title: 'Performance analytics',
    desc: 'Season-long data on every player — fitness trends, attendance rates, and more — all in one dashboard.',
  },
]

const steps = [
  {
    num: '01',
    title: 'Register your club',
    desc: 'Enter your club name, sport, and contact. Pick your plan. Takes under two minutes.',
  },
  {
    num: '02',
    title: 'Set your brand',
    desc: 'Upload your badge, pick your primary and secondary colours. The whole app re-skins instantly.',
  },
  {
    num: '03',
    title: 'Import your squad',
    desc: 'Upload a CSV or add players manually. Send invite links via email or SMS.',
  },
  {
    num: '04',
    title: 'Go live',
    desc: 'Create your first session. Players check in. Real data starts flowing immediately.',
  },
]

const sports = [
  { name: 'Rugby',      style: 'bg-sky-100 text-sky-700' },
  { name: 'Football',   style: 'bg-emerald-100 text-emerald-700' },
  { name: 'Basketball', style: 'bg-orange-100 text-orange-700' },
  { name: 'Cricket',    style: 'bg-red-100 text-red-700' },
  { name: 'Netball',    style: 'bg-purple-100 text-purple-700' },
  { name: 'Athletics',  style: 'bg-yellow-100 text-yellow-700' },
]

export default function Home() {
  const [activeTheme, setActiveTheme] = useState(0)
  const theme = clubThemes[activeTheme]

  return (
    <div className="min-h-screen bg-[#1e1e1e]">

      {/* ── NAV ────────────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4">
        <span className="inline-block border border-sky-400/40 text-sky-300 text-xs tracking-widest uppercase px-4 py-1.5 rounded-full">
          Team Master
        </span>
        <Link
          href="/login"
          className="text-sm text-gray-300 border border-white/25 px-5 py-2.5 rounded-xl transition-all duration-200 hover:bg-sky-400/15 hover:text-sky-300 hover:border-sky-400/60 hover:scale-105 hover:shadow-[0_0_18px_rgba(56,189,248,0.35)] active:scale-100 active:bg-sky-400/25"
        >
          Sign in
        </Link>
      </nav>

      {/* ── HERO ─────────────────────────────────────────────── */}
      <section className="relative min-h-screen bg-[#0d1b2e] flex flex-col items-center justify-center overflow-hidden pb-24">
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,1) 1px, transparent 1px)',
            backgroundSize: '36px 36px',
          }}
        />

        {/* Floating sport balls */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
          {/* Soccer ball — top left */}
          <svg viewBox="0 0 64 64" className="absolute" width="72" height="72"
            style={{ top: '12%', left: '6%', opacity: 0.1, animation: 'float-slow 7s ease-in-out infinite', animationDelay: '0s' }}>
            <circle cx="32" cy="32" r="28" stroke="white" strokeWidth="2" fill="none"/>
            <polygon points="32,10 38,20 26,20" stroke="white" strokeWidth="1.5" fill="none"/>
            <polygon points="10,38 18,32 18,44" stroke="white" strokeWidth="1.5" fill="none"/>
            <polygon points="54,38 46,32 46,44" stroke="white" strokeWidth="1.5" fill="none"/>
            <polygon points="22,54 26,44 38,44 42,54" stroke="white" strokeWidth="1.5" fill="none"/>
          </svg>

          {/* Basketball — top right */}
          <svg viewBox="0 0 64 64" className="absolute" width="90" height="90"
            style={{ top: '8%', right: '8%', opacity: 0.09, animation: 'float-mid 8s ease-in-out infinite', animationDelay: '1.5s' }}>
            <circle cx="32" cy="32" r="28" stroke="white" strokeWidth="2" fill="none"/>
            <path d="M32 4 Q48 18 48 32 Q48 46 32 60" stroke="white" strokeWidth="1.5" fill="none"/>
            <path d="M32 4 Q16 18 16 32 Q16 46 32 60" stroke="white" strokeWidth="1.5" fill="none"/>
            <line x1="4" y1="32" x2="60" y2="32" stroke="white" strokeWidth="1.5"/>
          </svg>

          {/* Rugby ball — mid left */}
          <svg viewBox="0 0 80 50" className="absolute" width="100" height="64"
            style={{ top: '42%', left: '3%', opacity: 0.08, animation: 'float-fast 6s ease-in-out infinite', animationDelay: '3s' }}>
            <ellipse cx="40" cy="25" rx="36" ry="20" stroke="white" strokeWidth="2" fill="none"/>
            <line x1="4" y1="25" x2="76" y2="25" stroke="white" strokeWidth="1.5"/>
            <path d="M28 10 Q40 25 28 40" stroke="white" strokeWidth="1.5" fill="none"/>
            <path d="M52 10 Q40 25 52 40" stroke="white" strokeWidth="1.5" fill="none"/>
          </svg>

          {/* Tennis ball — bottom left */}
          <svg viewBox="0 0 64 64" className="absolute" width="60" height="60"
            style={{ bottom: '18%', left: '12%', opacity: 0.1, animation: 'float-mid 9s ease-in-out infinite', animationDelay: '0.8s' }}>
            <circle cx="32" cy="32" r="28" stroke="white" strokeWidth="2" fill="none"/>
            <path d="M10 20 Q22 32 10 44" stroke="white" strokeWidth="1.5" fill="none"/>
            <path d="M54 20 Q42 32 54 44" stroke="white" strokeWidth="1.5" fill="none"/>
          </svg>

          {/* Volleyball — mid right */}
          <svg viewBox="0 0 64 64" className="absolute" width="78" height="78"
            style={{ top: '38%', right: '5%', opacity: 0.08, animation: 'float-slow 10s ease-in-out infinite', animationDelay: '2.2s' }}>
            <circle cx="32" cy="32" r="28" stroke="white" strokeWidth="2" fill="none"/>
            <path d="M8 22 Q32 14 56 22" stroke="white" strokeWidth="1.5" fill="none"/>
            <path d="M8 42 Q32 50 56 42" stroke="white" strokeWidth="1.5" fill="none"/>
            <line x1="32" y1="4" x2="32" y2="60" stroke="white" strokeWidth="1.5"/>
          </svg>

          {/* Cricket ball — bottom right */}
          <svg viewBox="0 0 64 64" className="absolute" width="56" height="56"
            style={{ bottom: '22%', right: '10%', opacity: 0.09, animation: 'float-fast 7.5s ease-in-out infinite', animationDelay: '4s' }}>
            <circle cx="32" cy="32" r="28" stroke="white" strokeWidth="2" fill="none"/>
            <path d="M20 10 Q32 32 20 54" stroke="white" strokeWidth="1.5" fill="none"/>
            <path d="M44 10 Q32 32 44 54" stroke="white" strokeWidth="1.5" fill="none"/>
            <line x1="4" y1="32" x2="60" y2="32" stroke="white" strokeWidth="1"/>
          </svg>

          {/* Small soccer ball — upper mid */}
          <svg viewBox="0 0 64 64" className="absolute" width="44" height="44"
            style={{ top: '20%', left: '38%', opacity: 0.07, animation: 'float-slow 11s ease-in-out infinite', animationDelay: '5s' }}>
            <circle cx="32" cy="32" r="28" stroke="white" strokeWidth="2" fill="none"/>
            <polygon points="32,10 38,20 26,20" stroke="white" strokeWidth="1.5" fill="none"/>
          </svg>
        </div>
        <div className="relative z-10 text-center px-4 max-w-3xl mx-auto">
          <div className="flex justify-center mb-6">
            <div className="w-[100px] h-[100px] rounded-2xl bg-[#141e2d] border border-white/10 flex flex-col items-center justify-center shadow-lg hover:shadow-sky-500/20 hover:border-sky-400/30 transition-all duration-300 hover:-translate-y-1">
              <span className="text-3xl font-bold text-sky-400 tracking-tight" style={{ fontFamily: 'Georgia, serif' }}>TM</span>
              <div className="w-10 h-[1.5px] bg-gray-500 my-1" />
              <span className="text-[10px] tracking-[0.2em] text-gray-400 font-medium">MASTER</span>
            </div>
          </div>
          <h1 className="text-5xl md:text-6xl font-bold text-white leading-tight mb-5">
            Run your club like a<br />
            <span className="text-sky-400">professional</span>
          </h1>
          <p className="text-blue-200 text-lg md:text-xl mb-10 max-w-xl mx-auto leading-relaxed">
            Attendance, training, injuries, fixtures and more — all in one place,
            branded to your club&apos;s colours and values.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/signup"
              className="bg-sky-400 text-[#0d1b2e] px-8 py-4 rounded-lg font-semibold text-base transition-all duration-200 hover:bg-sky-300 hover:scale-[1.03] hover:shadow-[0_0_20px_rgba(56,189,248,0.45)] active:scale-100 inline-flex items-center justify-center"
            >
              Get started free <ArrowRight className="ml-2 w-4 h-4" />
            </Link>
            <a
              href="#how-it-works"
              className="border border-white/25 text-white px-8 py-4 rounded-lg font-semibold text-base transition-all duration-200 hover:bg-white/10 hover:border-white/50 hover:scale-[1.03] hover:shadow-lg active:scale-100 inline-flex items-center justify-center"
            >
              See how it works
            </a>
          </div>
        </div>

        {/* Stats bar */}
        <div className="absolute bottom-0 left-0 right-0 bg-[#0f2137] border-t border-white/10">
          <div className="max-w-3xl mx-auto px-4 py-6 grid grid-cols-3 divide-x divide-white/10">
            {[
              { value: '12',   label: 'Clubs onboarded' },
              { value: '340+', label: 'Active players' },
              { value: '820+', label: 'Sessions logged' },
            ].map((s) => (
              <div key={s.label} className="text-center px-4">
                <p className="text-2xl font-bold text-sky-400">{s.value}</p>
                <p className="text-sm text-blue-300 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ─────────────────────────────────────────── */}
      <section className="py-24 px-4 bg-[#1e1e1e]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs tracking-widest uppercase text-gray-500 mb-3">Everything your club needs</p>
            <h2 className="text-4xl font-bold text-white mb-4">One platform, every sport</h2>
            <p className="text-gray-400 max-w-lg mx-auto leading-relaxed">
              From Uganda Rugby Premiership to football, basketball and beyond.<br />
              Team Master adapts to your sport and your club.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
            {features.map((f) => (
              <div key={f.title}>
                <div className={`w-12 h-12 ${f.bg} rounded-xl flex items-center justify-center mb-4 opacity-90`}>
                  <f.icon className={`w-5 h-5 ${f.fg}`} />
                </div>
                <h3 className="font-semibold text-white mb-2">{f.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{f.desc}</p>
              </div>
            ))}
            {/* Teaser tile */}
            <div className="flex flex-col justify-between border border-dashed border-white/15 rounded-xl p-5 bg-white/5">
              <div>
                <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center mb-4">
                  <Lock className="w-5 h-5 text-gray-400" />
                </div>
                <h3 className="font-semibold text-gray-400 mb-2">More inside the app</h3>
                <p className="text-sm text-gray-500 leading-relaxed">
                  Injury tracking, match day tools, training sessions and more — available once your club is set up.
                </p>
              </div>
              <Link
                href="/signup"
                className="mt-6 text-sm font-medium text-sky-500 hover:text-sky-600 inline-flex items-center"
              >
                Get access <ArrowRight className="ml-1 w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────── */}
      <section id="how-it-works" className="py-24 px-4 bg-[#1e1e1e]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs tracking-widest uppercase text-gray-500 mb-3">How it works</p>
            <h2 className="text-4xl font-bold text-white mb-4">Up and running in one afternoon</h2>
            <p className="text-gray-400 max-w-lg mx-auto leading-relaxed">
              No IT department needed. A club admin can have the whole squad<br />
              onboarded and the first session live the same day.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((step) => {
              const [first, ...rest] = step.title.split(' ')
              return (
                <div key={step.num} className="border border-white/10 rounded-xl p-6 bg-white/[0.03]">
                  <p className="text-xs text-gray-500 mb-3 font-mono">{step.num}</p>
                  <h3 className="font-semibold text-white mb-2">
                    {first}{rest.length ? ' ' + rest.join(' ') : ''}
                  </h3>
                  <p className="text-sm text-gray-400 leading-relaxed">{step.desc}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── CLUB BRANDING ────────────────────────────────────── */}
      <section className="py-24 px-4 bg-[#1e1e1e]">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs tracking-widest uppercase text-gray-500 mb-3">Club Branding</p>
            <h2 className="text-4xl font-bold text-white mb-4">Your colours. Your crest. Your app.</h2>
            <p className="text-gray-400 max-w-lg mx-auto leading-relaxed">
              Every club in the league gets a fully branded experience. Players open<br />
              the app and see their own club — not a generic tool.
            </p>
          </div>

          <div className="mb-2">
            <p className="text-sm text-gray-400 mb-3">Try a club theme:</p>
            <div className="flex gap-3 flex-wrap">
              {clubThemes.map((t, i) => (
                <button
                  key={t.name}
                  onClick={() => setActiveTheme(i)}
                  title={t.name}
                  className={`w-12 h-8 rounded-md border-2 transition-all ${activeTheme === i ? 'border-sky-400 scale-110' : 'border-white/20'}`}
                  style={{ background: `linear-gradient(90deg, ${t.primary} 60%, ${t.secondary} 60%)` }}
                />
              ))}
            </div>
            <p className="text-sm text-gray-500 mt-2">{theme.name}</p>
          </div>

          {/* App preview */}
          <div className="rounded-xl overflow-hidden border border-white/10 shadow-lg mt-6">
            <div className="px-5 py-3 text-white text-sm font-semibold" style={{ backgroundColor: theme.primary }}>
              {theme.name}
            </div>
            <div className="flex">
              <nav className="w-32 py-2" style={{ backgroundColor: theme.primary }}>
                {['Dashboard', 'Players', 'Training', 'Fixtures'].map((item, i) => (
                  <div
                    key={item}
                    className="px-4 py-2 text-sm"
                    style={{
                      color: i === 0 ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.55)',
                      backgroundColor: i === 0 ? 'rgba(0,0,0,0.2)' : 'transparent',
                      margin: i === 0 ? '0 8px' : '0',
                      borderRadius: i === 0 ? '4px' : '0',
                      fontWeight: i === 0 ? 500 : 400,
                    }}
                  >
                    {item}
                  </div>
                ))}
              </nav>
              <div className="flex-1 bg-gray-50 p-4 space-y-3">
                {[
                  { value: '17', label: 'Total players',      accent: false },
                  { value: '4',  label: 'Sessions this week', accent: false },
                  { value: '1',  label: 'Active injuries',    accent: true  },
                ].map((stat) => (
                  <div key={stat.label} className="flex items-center justify-between bg-white rounded-lg px-4 py-3 shadow-sm">
                    <div>
                      <p className="text-xl font-bold text-gray-900">{stat.value}</p>
                      <p className="text-xs text-gray-500">{stat.label}</p>
                    </div>
                    <div
                      className="w-8 h-8 rounded-md"
                      style={{ backgroundColor: stat.accent ? '#ef4444' : theme.secondary }}
                    />
                  </div>
                ))}
              </div>
            </div>
            <div className="h-1.5" style={{ backgroundColor: theme.secondary }} />
          </div>
        </div>
      </section>

      {/* ── BUILT FOR EVERY SPORT ────────────────────────────── */}
      <section className="py-16 px-4 bg-[#1e1e1e] border-t border-white/10">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-white mb-2">Built for every sport</h2>
          <p className="text-gray-400 mb-6">Team Master adapts its modules and terminology to whatever sport your club plays.</p>
          <div className="flex flex-wrap gap-2">
            {sports.map((s) => (
              <span key={s.name} className={`px-3 py-1 rounded-full text-sm font-medium ${s.style}`}>{s.name}</span>
            ))}
            <span className="px-3 py-1 rounded-full text-sm font-medium bg-white/10 text-gray-400">+ more sports coming</span>
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────── */}
      <section className="bg-[#141414] py-20 px-4 border-t border-white/10">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">
            Ready to bring your club into the modern era?
          </h2>
          <p className="text-gray-400 mb-8">Join Uganda&apos;s first clubs already running on Team Master.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/signup"
              className="bg-sky-400 text-[#141414] px-8 py-4 rounded-lg font-semibold transition-all duration-200 hover:bg-sky-300 hover:scale-[1.03] hover:shadow-[0_0_20px_rgba(56,189,248,0.45)] active:scale-100 inline-flex items-center justify-center"
            >
              Register your club <ArrowRight className="ml-2 w-4 h-4" />
            </Link>
            <a
              href="mailto:hello@teammaster.ug"
              className="border border-white/25 text-white px-8 py-4 rounded-lg font-semibold transition-all duration-200 hover:bg-white/10 hover:border-white/50 hover:scale-[1.03] hover:shadow-lg active:scale-100 inline-flex items-center justify-center"
            >
              Book a demo
            </a>
          </div>
        </div>
      </section>

    </div>
  )
}


