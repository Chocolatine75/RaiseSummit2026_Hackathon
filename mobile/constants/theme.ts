import { Platform } from 'react-native';

export const Colors = {
  background:    '#0C0C0C',
  surface:       '#141414',
  border:        'rgba(255,255,255,0.07)',
  borderAccent:  'rgba(255,77,46,0.25)',

  textPrimary:   '#FAFAFA',
  textSecondary: '#A1A1AA',
  textMuted:     '#3F3F46',

  accent:        '#FF4D2E',
  warning:       '#F59E0B',
  online:        '#FAFAFA',

  // Semantic
  micIdle:       '#141414',
  micBorder:     'rgba(255,255,255,0.10)',
  micActive:     '#FF4D2E',
};

export const Fonts = {
  body: undefined as string | undefined, // system default
  mono: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'Courier New' }) as string,
  size: {
    xxs: 8,
    xs:  10,
    sm:  12,
    md:  14,
    lg:  16,
    xl:  20,
  },
};

export const Spacing = {
  xs:  4,
  sm:  8,
  md:  12,
  lg:  16,
  xl:  20,
  xxl: 24,
};

export const Radius = {
  sm: 4,
  md: 6,
  lg: 10,
};
