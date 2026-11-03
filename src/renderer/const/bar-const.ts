export const USER_SET_OPTIONS = [
  {
    label: 'Settings',
    key: 'set'
  }
];

export const SEARCH_TYPES = [
  {
    label: 'search.tab.songs',
    key: 'music'
  },
  {
    label: 'search.tab.videos',
    key: 'video'
  }
];

export const SEARCH_TYPE = {
  MUSIC: 'music',
  VIDEO: 'video',
  // Numeric aliases for backward compatibility
  1: 'music',
  1004: 'video'
} as const;
