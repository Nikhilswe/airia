// AIrIA — RN theme helpers
// Re-exports ThemeToken and adds React Native StyleSheet helpers.

import { StyleSheet } from 'react-native'
// Import directly from ThemeToken — avoids pulling in AiriaLogo/react-native-svg
// through the @airia/ui barrel, which conflicts with @react-navigation/native-stack.
import { THEMES, DEFAULT_THEME } from '@airia/ui/src/ThemeToken'
import type { ThemeColors, ThemeName } from '@airia/ui/src/ThemeToken'

export { THEMES, DEFAULT_THEME }
export type { ThemeColors, ThemeName }

/** Returns a StyleSheet-ready object for the given theme */
export function makeThemeStyles(theme: ThemeColors) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: theme.bg,
    },
    surface: {
      backgroundColor: theme.surface,
      borderColor: theme.surfaceBorder,
      borderWidth: 1,
      borderRadius: 12,
    },
    textPrimary: {
      color: theme.textPrimary,
    },
    textSecondary: {
      color: theme.textSecondary,
    },
    accent: {
      color: theme.accent,
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.surfaceBorder,
    },
  })
}
