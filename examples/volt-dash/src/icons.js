// Original inline SVG icon set (24x24). Strokes use currentColor unless a glyph
// needs its own fill (cell / gem currency marks).
const S = (body, extra = '') =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${body}</svg>`;

export const ICONS = {
  cell: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1.8 20.6 7v10L12 22.2 3.4 17V7z" fill="#ffd23f" stroke="#8a5a00" stroke-width="1.4"/><path d="M13.4 5.5 8.6 13h3.2l-1.2 5.5 4.8-7.5h-3.2z" fill="#7a4300"/></svg>`,
  gem: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 3.5h11L22 9l-10 12L2 9z" fill="#ff5ad1" stroke="#7a1062" stroke-width="1.4"/><path d="M2 9h20M8.5 3.5 7 9l5 12 5-12-1.5-5.5" fill="none" stroke="#ffd1f5" stroke-width="1.1" opacity=".8"/></svg>`,
  home: S('<path d="M3.5 11 12 4l8.5 7"/><path d="M6 9.5V20h4.5v-5.5h3V20H18V9.5"/>'),
  shop: S('<path d="M4 8h16l-1.3 11.2a1.5 1.5 0 0 1-1.5 1.3H6.8a1.5 1.5 0 0 1-1.5-1.3z"/><path d="M8.5 10V6.5a3.5 3.5 0 0 1 7 0V10"/>'),
  chars: S('<rect x="4.5" y="6" width="15" height="12" rx="6"/><path d="M8 11.5h8"/><path d="M12 6V3"/><circle cx="12" cy="2.6" r=".6" fill="currentColor"/><path d="M8.5 21h7"/>'),
  missions: S('<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r=".8" fill="currentColor"/>'),
  gear: S('<circle cx="12" cy="12" r="3.2"/><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7"/><circle cx="12" cy="12" r="6.6"/>'),
  plus: S('<path d="M12 6v12M6 12h12"/>', 'stroke-width="3"'),
  pause: S('<path d="M9 6v12M15 6v12"/>', 'stroke-width="3.2"'),
  play: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.9l10.4-6.5a1 1 0 0 0 0-1.8L9.5 4.6A1 1 0 0 0 8 5.5z" fill="currentColor"/></svg>`,
  close: S('<path d="M6 6l12 12M18 6 6 18"/>', 'stroke-width="2.8"'),
  left: S('<path d="M15 5 8 12l7 7"/>', 'stroke-width="3"'),
  right: S('<path d="m9 5 7 7-7 7"/>', 'stroke-width="3"'),
  lock: S('<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3"/>'),
  check: S('<path d="m5 12.5 4.5 4.5L19 7.5"/>', 'stroke-width="3"'),
  calendar: S('<rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/><path d="m9.5 14.5 2 2 3.5-3.5"/>'),
  trophy: S('<path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4v1.5A3.5 3.5 0 0 0 7.5 11M17 6h3v1.5a3.5 3.5 0 0 1-3.5 3.5"/><path d="M12 14v3M8.5 20h7l-1-3h-5z"/>'),
  sound: S('<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>'),
  music: S('<path d="M9 18V5.5l10-2V16"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>'),
  vibe: S('<rect x="8" y="3.5" width="8" height="17" rx="2"/><path d="M4.5 8v8M19.5 8v8M2 10.5v3M22 10.5v3"/>'),
  quality: S('<path d="M12 3 3 8l9 5 9-5z"/><path d="m3 12.5 9 5 9-5"/><path d="m3 16.5 9 5 9-5" opacity=".55"/>'),
  reset: S('<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4 4.5v4h4"/>'),
  flag: S('<path d="M5 21V4"/><path d="M5 4h12l-2.5 4L17 12H5"/>'),
  timer: S('<circle cx="12" cy="13.5" r="7.5"/><path d="M12 9.5v4l2.5 2M9.5 3h5M12 3v3"/>'),
  star: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2.8 2.7 5.8 6.3.7-4.7 4.3 1.3 6.2L12 16.7l-5.6 3.1 1.3-6.2L3 9.3l6.3-.7z" fill="currentColor"/></svg>`,
  // Power-ups and items.
  magnet: S('<path d="M6 4v8a6 6 0 0 0 12 0V4"/><path d="M6 4h3.5v8a2.5 2.5 0 0 0 5 0V4H18"/><path d="M6 7.5h3.5M14.5 7.5H18"/>'),
  spring: S('<path d="M7 20h10M7 4h10"/><path d="M8 17.5 16 15l-8-2.5 8-2.5-8-2.5 8-2.5"/>'),
  shield: S('<path d="M12 3 4.5 6v5.5c0 4.6 3.2 8 7.5 9.5 4.3-1.5 7.5-4.9 7.5-9.5V6z"/><path d="m8.8 12 2.3 2.3 4.2-4.6"/>'),
  x2: `<svg viewBox="0 0 24 24" aria-hidden="true"><text x="12" y="17" text-anchor="middle" font-size="13" font-weight="900" font-family="system-ui,sans-serif" fill="currentColor">x2</text></svg>`,
  hyper: S('<path d="m4 5 7 7-7 7"/><path d="m12 5 7 7-7 7"/>', 'stroke-width="2.8"'),
  headstart: S('<path d="M12 2.8c3.5 2.2 5 5.8 4.5 10.2l-2 2.5h-5l-2-2.5C7 8.6 8.5 5 12 2.8z"/><circle cx="12" cy="9" r="1.8"/><path d="M9.5 15.5 7 20l3.2-1.6M14.5 15.5 17 20l-3.2-1.6"/>'),
  revive: S('<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z"/><path d="M12 10.5v5M9.5 13h5"/>'),
  booster: S('<path d="M12 20V5"/><path d="m6.5 10.5 5.5-5.5 5.5 5.5"/><path d="M5 20h14"/>'),
  mystery: S('<path d="M4 9h16v11H4z"/><path d="M3 6h18v3H3zM12 6v14"/><path d="M12 6c-1.5-3-5-3-5-1s3 1 5 1c2 0 5 1 5-1s-3.5-2-5 1"/>'),
  swipeH: S('<path d="M3 12h18"/><path d="m7 8-4 4 4 4M17 8l4 4-4 4"/>', 'stroke-width="2.6"'),
  swipeUp: S('<path d="M12 21V3"/><path d="m7 8 5-5 5 5"/>', 'stroke-width="2.6"'),
  swipeDown: S('<path d="M12 3v18"/><path d="m7 16 5 5 5-5"/>', 'stroke-width="2.6"'),
};

/** @param {keyof typeof ICONS} name */
export const icon = (name, cls = 'ic') => `<span class="${cls}">${ICONS[name] || ''}</span>`;
