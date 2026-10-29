import { Platform } from 'react-native';

const tintColorLight = '#0a7ea4';
const tintColorDark = '#189726';

// Fixed palette used by the existing branded screens. Keep the adaptive
// Colors below separate until those screens support dark mode end to end.
export const AppColors = {
  background: '#f5f3ee',
  surface: '#ffffff',
  primary: '#2e6b4b',
  text: '#1e2a1e',
  textSecondary: '#2e3a2e',
  textMuted: '#6b7a6b',
  shadow: '#141e14',
  actionSurface: '#eef4ef',
  discoverySurface: '#fffaf0',
} as const;

export const Spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24 } as const;
export const Radii = { sm: 12, card: 18, discovery: 22, pill: 999 } as const;

export const Colors = {
  light: {
    text: '#11181C',
    background: '#f4f4f4',
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
