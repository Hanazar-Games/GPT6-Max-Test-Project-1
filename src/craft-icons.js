const wings = {
  scout: 'M24 24 7 36 10 42 24 34Z',
  interceptor: 'M22 42 17 54 19 68 24 58Z',
  hauler: 'M21 43H12V64H23Z',
  viper: 'M23 36 10 9 7 16 11 57 23 62Z',
  skimmer: 'M24 23 3 27 3 34 24 31ZM23 52 2 56 3 63 24 59Z',
  manta: 'M26 16 1 56 4 68 24 62Z',
  wraith: 'M24 28 2 61 9 72 15 63 23 69Z',
  bulwark: 'M24 30 5 34 3 63 9 71 24 66Z',
  pulse: 'M24 35 5 43 5 64 24 62ZM4 46H17V49H4ZM4 55H17V58H4Z',
  comet: 'M24 44 10 3 7 7 9 70 23 63Z',
  owl: 'M24 22 3 34 5 40 24 31ZM24 35 4 48 6 53 24 44ZM24 49 7 62 10 67 24 58Z',
  trident: 'M24 36 15 2 11 6 11 68 24 59ZM7 21H10V64H7Z',
  dragonfly: 'M24 23C-3 14-3 43 24 35ZM24 48C-4 40-4 70 24 61Z',
  nautilus: 'M24 33 5 40 7 67 24 65ZM25 46A12 12 0 0 0 25 69Z',
  blade: 'M24 19 2 70 7 70 24 39Z',
  whale: 'M20 29C5 16 3 35 5 65Q12 79 20 65Z',
  paladin: 'M24 25 3 36 3 60 15 74 24 63Z',
  specter: 'M24 20 2 42 17 73 24 59 14 43Z',
  sunbird: 'M22 31H16V61H22ZM14 35H8V65H14ZM6 39H1V69H6Z',
  nova: 'M24 41 7 6 11 63 23 72Z',
};

export function craftIcon(id) {
  return `<svg viewBox="0 0 60 80" aria-hidden="true"><path d="M30 4 40 35 40 66 30 61 20 66 20 35Z" fill="currentColor" opacity=".7"/><g fill="currentColor"><path d="${wings[id]}"/><path d="${wings[id]}" transform="translate(60 0) scale(-1 1)"/></g><path d="M30 18 34 39 30 48 26 39Z" fill="#152431"/><path d="M13 44H19V69H13ZM41 44H47V69H41Z" fill="#8da4b5"/>${id === 'pulse' ? '<circle cx="30" cy="55" r="9" fill="none" stroke="#9df0fa" stroke-width="2"/>' : ''}<path d="M14 74h4m24 0h4" stroke="#9df0fa" stroke-width="3"/></svg>`;
}
