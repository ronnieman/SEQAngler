// API Configuration
const getApiUrl = () => {
  if (process.env.EXPO_PUBLIC_BACKEND_URL) {
    return `${process.env.EXPO_PUBLIC_BACKEND_URL}/api`;
  }
  return 'http://localhost:8001/api';
};

export const API_URL = getApiUrl();

// App Colors
export const Colors = {
  light: {
    text: '#1f2937',
    textSecondary: '#6b7280',
    background: '#ffffff',
    card: '#f9fafb',
    primary: '#0ea5e9',
    primaryDark: '#0284c7',
    accent: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    border: '#e5e7eb',
    tabBar: '#ffffff',
    tabBarInactive: '#9ca3af',
  },
  dark: {
    text: '#f9fafb',
    textSecondary: '#9ca3af',
    background: '#111827',
    card: '#1f2937',
    primary: '#0ea5e9',
    primaryDark: '#0284c7',
    accent: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    border: '#374151',
    tabBar: '#1f2937',
    tabBarInactive: '#6b7280',
  },
};

// Map Settings
export const MapConfig = {
  defaultRegion: {
    latitude: -27.4698,
    longitude: 153.0251,
    latitudeDelta: 0.5,
    longitudeDelta: 0.5,
  },
  // South East Queensland bounds
  seqBounds: {
    north: -26.5,
    south: -28.2,
    east: 153.6,
    west: 152.5,
  },
};

// Zone Colors
export const ZoneColors = {
  green: '#22c55e',
  yellow: '#f59e0b',
  habitat_protection: '#eab308',
  blue: '#3b82f6',
};
