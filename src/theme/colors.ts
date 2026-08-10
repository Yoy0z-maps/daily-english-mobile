export type AppTheme = {
  background: string;
  surface: string;
  surfaceMuted: string;
  text: string;
  textMuted: string;
  border: string;
  primary: string;
  primarySoft: string;
  purple: string;
  success: string;
  danger: string;
  cardShadow: string;
};

export const lightTheme: AppTheme = {
  background: '#F7F8FF',
  surface: '#FFFFFF',
  surfaceMuted: '#EEF2FF',
  text: '#141827',
  textMuted: '#6B7280',
  border: '#E4E7F2',
  primary: '#4F7CFF',
  primarySoft: '#DFE7FF',
  purple: '#8B5CF6',
  success: '#16A34A',
  danger: '#EF4444',
  cardShadow: '#1F2A44'
};

export const darkTheme: AppTheme = {
  background: '#0E1220',
  surface: '#171B2D',
  surfaceMuted: '#242A42',
  text: '#F8FAFC',
  textMuted: '#AAB2C5',
  border: '#2A3148',
  primary: '#7FA0FF',
  primarySoft: '#1E2B58',
  purple: '#B794F6',
  success: '#4ADE80',
  danger: '#FB7185',
  cardShadow: '#000000'
};
