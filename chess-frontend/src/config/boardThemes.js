export const BOARD_THEMES = {
  // Free themes (2)
  classic:  { name: 'Classic',  dark: '#769656', light: '#eeeed2', tier: 'free' },
  blue:     { name: 'Blue',     dark: '#4b7399', light: '#eae9d2', tier: 'free' },

  // Standard+ themes (6)
  brown:    { name: 'Walnut',   dark: '#b58863', light: '#f0d9b5', tier: 'standard' },
  purple:   { name: 'Royal',    dark: '#7b61a6', light: '#e8d0ff', tier: 'standard' },
  coral:    { name: 'Coral',    dark: '#c76e6e', light: '#fce4e4', tier: 'standard' },
  midnight: { name: 'Midnight', dark: '#4a4a6a', light: '#c8c8d4', tier: 'standard' },
  forest:   { name: 'Forest',   dark: '#5a8a4a', light: '#d4e8c4', tier: 'standard' },
  marble:   { name: 'Marble',   dark: '#888888', light: '#f5f5f0', tier: 'standard' },
};

export const getTheme = (key) => BOARD_THEMES[key] || BOARD_THEMES.classic;
