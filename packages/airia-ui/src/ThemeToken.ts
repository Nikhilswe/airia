// AIrIA — ThemeToken
// Layered surface hierarchy + shock accent for premium depth.

export interface ThemeColors {
  accent: string
  accentDark: string
  accentLight: string
  accentBorder: string
  accentText: string
  shock: string
  orbBg: string
  orbGlow: string
  surface: string
  surfaceRaised: string
  surfaceBorder: string
  bg: string
  bgCard: string
  bgFloat: string
  textPrimary: string
  textSecondary: string
  textTertiary: string
}

export type ThemeName = 'dawn' | 'midnight' | 'forest' | 'ocean' | 'rose' | 'slate'

export const THEMES: Record<ThemeName, ThemeColors> = {
  dawn: {
    accent:        '#F5A623',
    accentDark:    '#C47D0E',
    accentLight:   'rgba(245, 166, 35, 0.10)',
    accentBorder:  'rgba(245, 166, 35, 0.30)',
    accentText:    '#FFDEA0',
    shock:         '#FFB020',
    orbBg:         'rgba(200, 120, 10, 0.25)',
    orbGlow:       'rgba(245, 166, 35, 0.4)',
    surface:       '#131110',
    surfaceRaised: '#1C1916',
    surfaceBorder: 'rgba(255, 255, 255, 0.05)',
    bg:            '#0B0A08',
    bgCard:        '#151311',
    bgFloat:       '#1E1B17',
    textPrimary:   '#ECE7DC',
    textSecondary: '#9E8E6E',
    textTertiary:  '#5C5040',
  },
  midnight: {
    accent:        '#8B7FFF',
    accentDark:    '#5E52D6',
    accentLight:   'rgba(139, 127, 255, 0.10)',
    accentBorder:  'rgba(139, 127, 255, 0.30)',
    accentText:    '#C8C2FF',
    shock:         '#00F0FF',
    orbBg:         'rgba(60, 50, 160, 0.25)',
    orbGlow:       'rgba(139, 127, 255, 0.4)',
    surface:       '#0F0E18',
    surfaceRaised: '#16142A',
    surfaceBorder: 'rgba(255, 255, 255, 0.05)',
    bg:            '#0A0912',
    bgCard:        '#111020',
    bgFloat:       '#1A1830',
    textPrimary:   '#E4E2F4',
    textSecondary: '#8880B0',
    textTertiary:  '#555080',
  },
  forest: {
    accent:        '#5DD45B',
    accentDark:    '#369934',
    accentLight:   'rgba(93, 212, 91, 0.10)',
    accentBorder:  'rgba(93, 212, 91, 0.28)',
    accentText:    '#ACEEAB',
    shock:         '#00FF88',
    orbBg:         'rgba(30, 90, 28, 0.28)',
    orbGlow:       'rgba(93, 212, 91, 0.35)',
    surface:       '#0C0F0C',
    surfaceRaised: '#141A14',
    surfaceBorder: 'rgba(255, 255, 255, 0.05)',
    bg:            '#080B08',
    bgCard:        '#0E120E',
    bgFloat:       '#171D17',
    textPrimary:   '#DEF0DD',
    textSecondary: '#7EA87E',
    textTertiary:  '#4A6A4A',
  },
  ocean: {
    accent:        '#38B6FF',
    accentDark:    '#1484CC',
    accentLight:   'rgba(56, 182, 255, 0.10)',
    accentBorder:  'rgba(56, 182, 255, 0.28)',
    accentText:    '#A8DCFF',
    shock:         '#00E5FF',
    orbBg:         'rgba(10, 60, 110, 0.28)',
    orbGlow:       'rgba(56, 182, 255, 0.35)',
    surface:       '#0A0E14',
    surfaceRaised: '#10161E',
    surfaceBorder: 'rgba(255, 255, 255, 0.05)',
    bg:            '#070A10',
    bgCard:        '#0C1018',
    bgFloat:       '#141A24',
    textPrimary:   '#DAE8F4',
    textSecondary: '#6A90B8',
    textTertiary:  '#3E5878',
  },
  rose: {
    accent:        '#FF6EA3',
    accentDark:    '#CC3B72',
    accentLight:   'rgba(255, 110, 163, 0.10)',
    accentBorder:  'rgba(255, 110, 163, 0.28)',
    accentText:    '#FFB8D4',
    shock:         '#FF2D8A',
    orbBg:         'rgba(120, 20, 60, 0.25)',
    orbGlow:       'rgba(255, 110, 163, 0.38)',
    surface:       '#120C10',
    surfaceRaised: '#1C1218',
    surfaceBorder: 'rgba(255, 255, 255, 0.05)',
    bg:            '#0C080A',
    bgCard:        '#140E12',
    bgFloat:       '#1E161A',
    textPrimary:   '#F4E0E8',
    textSecondary: '#B87098',
    textTertiary:  '#784060',
  },
  slate: {
    accent:        '#9EAABF',
    accentDark:    '#6B7A8F',
    accentLight:   'rgba(158, 170, 191, 0.10)',
    accentBorder:  'rgba(158, 170, 191, 0.25)',
    accentText:    '#CBD4E2',
    shock:         '#50E8FF',
    orbBg:         'rgba(40, 50, 65, 0.30)',
    orbGlow:       'rgba(158, 170, 191, 0.30)',
    surface:       '#0E1014',
    surfaceRaised: '#16181E',
    surfaceBorder: 'rgba(255, 255, 255, 0.05)',
    bg:            '#0A0C10',
    bgCard:        '#101216',
    bgFloat:       '#1A1C22',
    textPrimary:   '#D8DEE8',
    textSecondary: '#7888A0',
    textTertiary:  '#485868',
  },
}

export const DEFAULT_THEME: ThemeName = 'dawn'
