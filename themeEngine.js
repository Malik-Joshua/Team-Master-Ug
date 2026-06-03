console.log('[themeEngine.js] Module loaded');

/**
 * Team Master — Theme Engine
 *
 * Takes a club's primary + secondary hex colours and:
 *  1. Derives a full harmonious palette (tints, shades, text colours)
 *  2. Injects everything as CSS variables on :root
 *  3. Validates contrast and returns warnings
 *
 * Usage:
 *   import { applyClubTheme, getThemeWarnings } from './themeEngine';
 *   applyClubTheme({ primary: '#922B21', secondary: '#F8C300', clubName: 'Heathens RFC' });
 */

// ─── Colour math helpers ──────────────────────────────────────────────────────

function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

function rgbToHex({ r, g, b }) {
  return '#' + [r, g, b]
    .map(v => Math.min(255, Math.max(0, Math.round(v))).toString(16).padStart(2, '0'))
    .join('');
}

function relativeLuminance({ r, g, b }) {
  const srgb = [r, g, b].map(v => {
    v = v / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
}

function contrastRatio(hex1, hex2) {
  const l1 = relativeLuminance(hexToRgb(hex1));
  const l2 = relativeLuminance(hexToRgb(hex2));
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

/**
 * Returns white or dark text depending on which has better contrast
 * against the given background colour.
 */
function readableTextColor(bgHex) {
  const onWhite = contrastRatio(bgHex, '#ffffff');
  const onDark  = contrastRatio(bgHex, '#1a1a1a');
  return onWhite >= onDark ? '#ffffff' : '#1a1a1a';
}

/**
 * Lightens a hex colour by mixing it toward white.
 * amount: 0 (no change) → 1 (pure white)
 */
function lighten(hex, amount) {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex({
    r: r + (255 - r) * amount,
    g: g + (255 - g) * amount,
    b: b + (255 - b) * amount,
  });
}

/**
 * Darkens a hex colour by mixing it toward black.
 * amount: 0 (no change) → 1 (pure black)
 */
function darken(hex, amount) {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex({
    r: r * (1 - amount),
    g: g * (1 - amount),
    b: b * (1 - amount),
  });
}

/**
 * Converts hex to rgba string for semi-transparent uses.
 */
function hexToRgba(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ─── Preset Themes (derived from team-master-theme-preview.html) ───────────────

const PRESETS = {
  navy: {
    name: 'navy',
    label: 'Navy + Sky blue (default)',
    primary: '#080F1C',
    secondary: '#5BA3D9',
    p9: '#080F1C', p8: '#0D1828', p7: '#112035', p6: '#162844', p5: '#1A3A5C', p4: '#244E7A',
    acc: '#5BA3D9', accGlow: 'rgba(91,163,217,0.18)', accDim: 'rgba(91,163,217,0.10)',
    t1: '#EDF2F8', t2: '#8FA3BB', t3: '#506478',
    b1: 'rgba(255,255,255,0.07)', b2: 'rgba(255,255,255,0.04)',
    btnTxt: '#0D1828', blueDim: 'rgba(91,163,217,0.12)'
  },
  yellow: {
    name: 'yellow',
    label: 'Black + Gold',
    primary: '#0A0A0A',
    secondary: '#F8C300',
    p9: '#0A0A0A', p8: '#111111', p7: '#1A1A1A', p6: '#222222', p5: '#2A2A2A', p4: '#333333',
    acc: '#F8C300', accGlow: 'rgba(248,195,0,0.15)', accDim: 'rgba(248,195,0,0.08)',
    t1: '#F5F0E0', t2: '#A89D7A', t3: '#5C5440',
    b1: 'rgba(255,255,255,0.07)', b2: 'rgba(255,255,255,0.04)',
    btnTxt: '#0A0A0A', blueDim: 'rgba(248,195,0,0.10)'
  },
  red: {
    name: 'red',
    label: 'Dark Red + Red',
    primary: '#0F0505',
    secondary: '#E84040',
    p9: '#0F0505', p8: '#160A0A', p7: '#1E0E0E', p6: '#271414', p5: '#301A1A', p4: '#3D2020',
    acc: '#E84040', accGlow: 'rgba(232,64,64,0.18)', accDim: 'rgba(232,64,64,0.10)',
    t1: '#F5E8E8', t2: '#A87878', t3: '#604040',
    b1: 'rgba(255,255,255,0.07)', b2: 'rgba(255,255,255,0.04)',
    btnTxt: '#0F0505', blueDim: 'rgba(232,64,64,0.10)'
  },
  bw: {
    name: 'bw',
    label: 'Black + White',
    primary: '#080808',
    secondary: '#E8E8E8',
    p9: '#080808', p8: '#111111', p7: '#1A1A1A', p6: '#242424', p5: '#2E2E2E', p4: '#3A3A3A',
    acc: '#E8E8E8', accGlow: 'rgba(232,232,232,0.12)', accDim: 'rgba(232,232,232,0.07)',
    t1: '#FFFFFF', t2: '#999999', t3: '#555555',
    b1: 'rgba(255,255,255,0.08)', b2: 'rgba(255,255,255,0.04)',
    btnTxt: '#111111', blueDim: 'rgba(232,232,232,0.08)'
  },
  green: {
    name: 'green',
    label: 'Forest + Teal',
    primary: '#050F08',
    secondary: '#2DB88A',
    p9: '#050F08', p8: '#091510', p7: '#0E1F16', p6: '#142A1E', p5: '#1A3828', p4: '#1F4530',
    acc: '#2DB88A', accGlow: 'rgba(45,184,138,0.18)', accDim: 'rgba(45,184,138,0.10)',
    t1: '#E5F5EE', t2: '#6FA38C', t3: '#3A6050',
    b1: 'rgba(255,255,255,0.07)', b2: 'rgba(255,255,255,0.04)',
    btnTxt: '#050F08', blueDim: 'rgba(45,184,138,0.10)'
  },
  purple: {
    name: 'purple',
    label: 'Deep Purple',
    primary: '#08040F',
    secondary: '#9B6EE8',
    p9: '#08040F', p8: '#0F0818', p7: '#170D22', p6: '#1F122E', p5: '#28183C', p4: '#331F4A',
    acc: '#9B6EE8', accGlow: 'rgba(155,110,232,0.18)', accDim: 'rgba(155,110,232,0.10)',
    t1: '#EDE5F8', t2: '#9080B0', t3: '#504065',
    b1: 'rgba(255,255,255,0.07)', b2: 'rgba(255,255,255,0.04)',
    btnTxt: '#08040F', blueDim: 'rgba(155,110,232,0.10)'
  }
};

/**
 * Convert RGB to HSL.
 * Returns { h: 0-360, s: 0-100, l: 0-100 }
 */
function rgbToHsl({ r, g, b }) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  const d = max - min;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}

/**
 * Determines which beautiful preset theme matches a primary colour.
 */
export function getPresetThemeName(primary) {
  if (!primary) return 'navy';
  const clean = primary.trim();
  const rgb = hexToRgb(clean);
  if (!rgb) return 'navy';
  const hsl = rgbToHsl(rgb);

  // If low saturation/lightness, map to black + white (bw)
  if (hsl.s < 12 || hsl.l < 12 || hsl.l > 88) {
    return 'bw';
  }

  const h = hsl.h;
  if (h >= 340 || h < 20) {
    return 'red';
  }
  if (h >= 20 && h < 65) {
    return 'yellow';
  }
  if (h >= 65 && h < 165) {
    return 'green';
  }
  if (h >= 165 && h < 255) {
    return 'navy';
  }
  if (h >= 255 && h < 340) {
    return 'purple';
  }

  return 'navy';
}

/**
 * Sanitizes admin-picked colours by mapping them to beautiful preset pairs.
 */
function sanitizeColors(primary, secondary) {
  const name = getPresetThemeName(primary);
  const p = PRESETS[name];
  return { primary: p.p9, secondary: p.acc };
}

// ─── Palette derivation ───────────────────────────────────────────────────────

/**
 * Auto-detect whether the primary colour warrants a dark theme.
 * Dark themes look best when the primary is a deep, saturated colour.
 */
function detectDarkMode(primary) {
  const lum = relativeLuminance(hexToRgb(primary));
  return lum < 0.35; // Dark if primary luminance is below 0.35
}

/**
 * Derives a full set of theme tokens from the classified preset theme.
 * 
 * Returns an object of CSS variable names → values.
 * Maps both the --tm-* variable set and the specific reference theme variables (--p9, --p8, --acc, etc.)
 */
function deriveThemeTokens(primary, secondary, mode) {
  const presetName = getPresetThemeName(primary);
  const preset = PRESETS[presetName] || PRESETS.navy;

  return {
    // ── Reference / raw CSS variables from team-master-theme-preview.html ──
    '--p9':                      preset.p9,
    '--p8':                      preset.p8,
    '--p7':                      preset.p7,
    '--p6':                      preset.p6,
    '--p5':                      preset.p5,
    '--p4':                      preset.p4,
    '--acc':                     preset.acc,
    '--acc-glow':                preset.accGlow,
    '--acc-dim':                 preset.accDim,
    '--t1':                      preset.t1,
    '--t2':                      preset.t2,
    '--t3':                      preset.t3,
    '--b1':                      preset.b1,
    '--b2':                      preset.b2,
    '--btn-txt':                 preset.btnTxt,
    '--blue-dim':                preset.blueDim,

    // Status variables
    '--green':                   '#2DB88A',
    '--green-dim':               'rgba(45, 184, 138, 0.12)',
    '--red':                     '#E05757',
    '--red-dim':                 'rgba(224, 87, 87, 0.12)',
    '--amber':                   '#E09F42',
    '--amber-dim':               'rgba(224, 159, 66, 0.12)',

    // ── Generic surface / text / border tokens (adapt to mode) ──
    '--tm-bg':                  preset.p8,
    '--tm-bg-elevated':         preset.p8,
    '--tm-surface':             preset.p7,
    '--tm-surface-elevated':    preset.p7,
    '--tm-surface-hover':       preset.p6,
    '--tm-border':              preset.b1,
    '--tm-border-strong':       preset.b1,
    '--tm-text-1':              preset.t1,
    '--tm-text-2':              preset.t2,
    '--tm-text-3':              preset.t3,
    '--tm-text-muted':          preset.t3,
    '--tm-input-bg':            preset.p7,
    '--tm-input-border':        preset.b1,
    '--tm-divider':             preset.b1,

    // ── Mode flag ──
    '--tm-mode':                'dark', // All these beautiful presets are immersive dark modes

    // ── Brand colours ──
    '--tm-primary':              preset.acc,
    '--tm-primary-light':        preset.acc,
    '--tm-primary-lighter':      preset.acc,
    '--tm-primary-dark':         preset.acc,
    '--tm-primary-subtle':       preset.accDim,
    '--tm-primary-border':       preset.b1,

    '--tm-secondary':            preset.acc,
    '--tm-secondary-light':      preset.acc,
    '--tm-secondary-dark':       preset.acc,
    '--tm-secondary-subtle':     preset.accDim,

    // ── Text on brand colours ──
    '--tm-text-on-primary':      preset.btnTxt,
    '--tm-text-on-primary-muted': preset.btnTxt,
    '--tm-text-on-secondary':    preset.btnTxt,

    // ── Sidebar (always uses primary family) ──
    '--tm-sidebar-bg':           preset.p9,
    '--tm-sidebar-text':         preset.t3,
    '--tm-sidebar-text-muted':   preset.t3,
    '--tm-sidebar-active-bg':    preset.accGlow,
    '--tm-sidebar-active-text':  preset.acc,
    '--tm-sidebar-hover-bg':     preset.p7,
    '--tm-sidebar-border':       preset.b1,
    '--tm-sidebar-logo-bg':      preset.p9,

    // ── Accent bar / highlights ──
    '--tm-accent':               preset.acc,
    '--tm-accent-text':          preset.btnTxt,

    // ── Stat card icons ──
    '--tm-icon-bg':              preset.blueDim,
    '--tm-icon-color':           preset.acc,

    // ── Buttons ──
    '--tm-btn-primary-bg':       preset.acc,
    '--tm-btn-primary-text':     preset.btnTxt,
    '--tm-btn-primary-hover':    preset.acc,
    '--tm-btn-secondary-bg':     preset.p7,
    '--tm-btn-secondary-text':   preset.t2,
    '--tm-btn-secondary-hover':  preset.p6,
    '--tm-btn-outline-border':   preset.b1,
    '--tm-btn-outline-text':     preset.t2,
    '--tm-btn-outline-hover-bg': preset.p7,

    // ── Badges / pills ──
    '--tm-badge-bg':             preset.blueDim,
    '--tm-badge-text':           preset.acc,
    '--tm-badge-secondary-bg':   preset.blueDim,
    '--tm-badge-secondary-text': preset.acc,

    // ── Focus rings ──
    '--tm-focus-ring':           preset.accGlow,

    // ── Chart / data colours ──
    '--tm-chart-primary':        preset.acc,
    '--tm-chart-secondary':      preset.acc,
    '--tm-chart-primary-fade':   preset.accDim,
    '--tm-chart-secondary-fade': preset.accDim,
  };
}

// ─── CSS variable injection ───────────────────────────────────────────────────

/**
 * Writes all theme tokens as CSS custom properties on :root.
 * Call this once on app load (and again if the club changes theme).
 */
function injectCSSVariables(tokens) {
  const root = document.documentElement;
  Object.entries(tokens).forEach(([prop, value]) => {
    root.style.setProperty(prop, value);
  });
}

// ─── Contrast validation ──────────────────────────────────────────────────────

/**
 * Checks the chosen colour combination for potential issues.
 * Returns an array of warning objects: { level: 'error'|'warn'|'ok', message }
 */
function getThemeWarnings(primary, secondary) {
  const warnings = [];

  const primaryVsSecondary = contrastRatio(primary, secondary);
  const primaryVsWhite     = contrastRatio(primary, '#ffffff');
  const secondaryVsWhite   = contrastRatio(secondary, '#ffffff');
  const primaryVsDark      = contrastRatio(primary, '#1a1a1a');

  if (primaryVsSecondary < 2.5) {
    warnings.push({
      level: 'error',
      message: `Primary and secondary colours are too similar (${primaryVsSecondary.toFixed(1)}x contrast). The sidebar icons and accent elements will be hard to distinguish. Try a lighter or more contrasting secondary.`,
    });
  } else if (primaryVsSecondary < 4) {
    warnings.push({
      level: 'warn',
      message: `Primary and secondary contrast is acceptable (${primaryVsSecondary.toFixed(1)}x) but could be stronger. A higher-contrast secondary will make accents pop more.`,
    });
  } else {
    warnings.push({
      level: 'ok',
      message: `Great colour harmony — ${primaryVsSecondary.toFixed(1)}x contrast between primary and secondary. This theme will look sharp.`,
    });
  }

  if (primaryVsWhite < 3 && primaryVsDark < 3) {
    warnings.push({
      level: 'error',
      message: `Primary colour is too mid-tone — it will look washed out on both light and dark backgrounds. Choose a darker or more saturated primary.`,
    });
  }

  if (secondaryVsWhite < 1.5) {
    warnings.push({
      level: 'warn',
      message: `Secondary colour is very light — it will disappear against white card backgrounds. Consider using it only on the sidebar accent bar, not as a background.`,
    });
  }

  return warnings;
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Apply a club theme to the entire app.
 * 
 * @param {object} config
 * @param {string} config.primary    — Club primary hex colour e.g. '#922B21'
 * @param {string} config.secondary  — Club secondary hex colour e.g. '#F8C300'
 * @param {string} [config.clubName] — Optional club name (stored on data attribute)
 * 
 * @returns {object} { tokens, warnings }
 *   tokens   — the full derived palette (useful for debugging)
 *   warnings — array of contrast/harmony warnings
 */
export function applyClubTheme({ primary, secondary, clubName, mode }) {
  console.log('[applyClubTheme] Called with:', { primary, secondary, clubName, mode });

  // Classify the ORIGINAL chosen colour into a preset and derive all tokens
  // from it. NOTE: we must pass the original `primary` (with its real hue +
  // lightness) to deriveThemeTokens. Passing a "sanitized" near-black preset
  // background here would always re-classify as black & white, collapsing
  // every club to the bw theme.
  const presetName = getPresetThemeName(primary);
  console.log('[applyClubTheme] Resolved preset:', presetName);

  const resolvedMode = mode || 'dark';
  const tokens   = deriveThemeTokens(primary, secondary, resolvedMode);
  const warnings = getThemeWarnings(primary, secondary || primary);

  injectCSSVariables(tokens);

  // Store on root for debugging / devtools inspection
  document.documentElement.setAttribute('data-club-primary',   primary);
  document.documentElement.setAttribute('data-club-secondary', secondary);
  document.documentElement.setAttribute('data-club-mode',      resolvedMode);
  if (clubName) {
    document.documentElement.setAttribute('data-club-name', clubName);
  }

  return { tokens, warnings, mode: resolvedMode };
}

/**
 * Read warnings only — useful in the onboarding colour picker
 * to give live feedback before saving.
 */
export { getThemeWarnings, contrastRatio, readableTextColor, lighten, darken, sanitizeColors, PRESETS };
