// One coherent line-icon set for the whole app. 1.6px stroke, round joins,
// 24px grid — the vernacular of transit / wayfinding signage, not emoji.
// Every glyph inherits `currentColor` so color is controlled by CSS.
const P = {
  map: <><path d="M9 4 3 6.5v13.5L9 18l6 2 6-2.5V4L15 6 9 4Z"/><path d="M9 4v14M15 6v14"/></>,
  camera: <><path d="M4 8h3l1.5-2h7L17 8h3v11H4V8Z"/><circle cx="12" cy="13" r="3.2"/></>,
  chat: <><path d="M5 5h14v10H9l-4 4V5Z"/></>,
  mic: <><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></>,
  info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.5v.5"/></>,
  close: <path d="M6 6l12 12M18 6 6 18"/>,
  compass: <><circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z"/></>,
  // JIS-style running-person "evacuate" mark, simplified to a stroke glyph.
  shelter: <><path d="M4 11 12 5l8 6"/><path d="M6 10v9h12v-9"/><path d="M10 19v-5h4v5"/></>,
  warning: <><path d="M12 3 2.5 20h19L12 3Z"/><path d="M12 10v4.5M12 17.5v.2"/></>,
  shield: <><path d="M12 3 5 6v6c0 4 3 6.5 7 9 4-2.5 7-5 7-9V6l-7-3Z"/></>,
  route: <><circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h6a4 4 0 0 0 0-8H8a4 4 0 0 1 0-8h2" transform="translate(0 4)"/></>,
  pin: <><path d="M12 21c4.5-4.5 7-7.6 7-11a7 7 0 1 0-14 0c0 3.4 2.5 6.5 7 11Z"/><circle cx="12" cy="10" r="2.5"/></>,
  wifiOff: <><path d="M3 3l18 18"/><path d="M5 12.5a11 11 0 0 1 4-2.6M2 8.8a16 16 0 0 1 6-3.5M16 10.2a11 11 0 0 1 3 2.3M12 20h.01"/></>,
  check: <path d="m5 12 5 5 9-11"/>,
  play: <path d="M7 4v16l13-8L7 4Z"/>,
  reset: <><path d="M4 12a8 8 0 1 0 2.3-5.6"/><path d="M4 4v4h4"/></>,
  bolt: <path d="M13 3 4 14h6l-1 7 9-11h-6l1-7Z"/>,
};

export default function Icon({ name, size = 22, stroke = 1.6, fill = "none", className = "" }) {
  return (
    <svg className={`icn ${className}`} width={size} height={size} viewBox="0 0 24 24"
      fill={name === "play" ? "currentColor" : fill} stroke="currentColor" strokeWidth={stroke}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {P[name] || null}
    </svg>
  );
}
