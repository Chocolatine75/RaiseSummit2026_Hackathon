// One coherent line-icon set for the whole app. 1.75px stroke, round joins,
// 24px grid — wayfinding/Material vernacular, not emoji. Inherits currentColor.
const P = {
  map: <><path d="M9 4 3 6.5v13.5L9 18l6 2 6-2.5V4L15 6 9 4Z"/><path d="M9 4v14M15 6v14"/></>,
  home: <><path d="M4 11 12 4l8 7"/><path d="M6 10v9h12v-9"/></>,
  mic: <><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></>,
  info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.5v.5"/></>,
  close: <path d="M6 6l12 12M18 6 6 18"/>,
  chevronR: <path d="m9 6 6 6-6 6"/>,
  chevronL: <path d="m15 6-6 6 6 6"/>,
  chevronD: <path d="m6 9 6 6 6-6"/>,
  compass: <><circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z"/></>,
  shelter: <><path d="M4 11 12 5l8 6"/><path d="M6 10v9h12v-9"/><path d="M10 19v-5h4v5"/></>,
  warning: <><path d="M12 3 2.5 20h19L12 3Z"/><path d="M12 10v4.5M12 17.5v.2"/></>,
  shield: <><path d="M12 3 5 6v6c0 4 3 6.5 7 9 4-2.5 7-5 7-9V6l-7-3Z"/></>,
  shieldCheck: <><path d="M12 3 5 6v6c0 4 3 6.5 7 9 4-2.5 7-5 7-9V6l-7-3Z"/><path d="m9 12 2 2 4-4"/></>,
  pin: <><path d="M12 21c4.5-4.5 7-7.6 7-11a7 7 0 1 0-14 0c0 3.4 2.5 6.5 7 11Z"/><circle cx="12" cy="10" r="2.5"/></>,
  wifiOff: <><path d="M3 3l18 18"/><path d="M5 12.5a11 11 0 0 1 4-2.6M2 8.8a16 16 0 0 1 6-3.5M16 10.2a11 11 0 0 1 3 2.3M12 20h.01"/></>,
  wifi: <><path d="M5 12.5a11 11 0 0 1 14 0M2 9a16 16 0 0 1 20 0M8.5 16a6 6 0 0 1 7 0M12 20h.01"/></>,
  check: <path d="m5 12 5 5 9-11"/>,
  checkCircle: <><circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.5 2.5 4.5-5"/></>,
  play: <path d="M7 4v16l13-8L7 4Z"/>,
  reset: <><path d="M4 12a8 8 0 1 0 2.3-5.6"/><path d="M4 4v4h4"/></>,
  bolt: <path d="M13 3 4 14h6l-1 7 9-11h-6l1-7Z"/>,
  globe: <><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18Z"/></>,
  message: <><path d="M5 5h14v10H9l-4 4V5Z"/></>,
  building: <><rect x="5" y="3" width="14" height="18" rx="1"/><path d="M9 7h.01M15 7h.01M9 11h.01M15 11h.01M9 15h.01M15 15h.01"/></>,
  phone: <path d="M5 4h3l2 5-2 1a10 10 0 0 0 4 4l1-2 5 2v3a2 2 0 0 1-2 2A15 15 0 0 1 3 6a2 2 0 0 1 2-2Z"/>,
  headphones: <><path d="M4 13a8 8 0 0 1 16 0"/><rect x="3" y="13" width="4" height="7" rx="1.5"/><rect x="17" y="13" width="4" height="7" rx="1.5"/></>,
  cross: <path d="M10 4h4v6h6v4h-6v6h-4v-6H4v-4h6V4Z"/>,
  lock: <><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></>,
  download: <><path d="M12 4v10m0 0 4-4m-4 4-4-4"/><path d="M5 18h14"/></>,
  navigation: <path d="M12 3 4 20l8-4 8 4L12 3Z"/>,
  crosshair: <><circle cx="12" cy="12" r="7"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></>,
  users: <><circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0M16 6a3 3 0 0 1 0 6M21 20a6 6 0 0 0-4-5.6"/></>,
  utensils: <><path d="M6 3v7a2 2 0 0 0 4 0V3M8 10v11M18 3c-1.5 0-2.5 2-2.5 5s1 4 2.5 4v9"/></>,
  battery: <><rect x="2" y="8" width="18" height="9" rx="2"/><path d="M22 11v3"/></>,
  arrowUp: <path d="M12 20V5M6 11l6-6 6 6"/>,
  loader: <><path d="M12 3v4M12 17v4M5 12H3M21 12h-2M6.3 6.3 4.9 4.9M19.1 19.1l-1.4-1.4M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4"/></>,
  volume: <><path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></>,
};

export default function Icon({ name, size = 22, stroke = 1.75, className = "", style }) {
  return (
    <svg className={`icn ${className}`} width={size} height={size} viewBox="0 0 24 24" style={style}
      fill={name === "play" || name === "navigation" ? "currentColor" : "none"} stroke="currentColor"
      strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {P[name] || null}
    </svg>
  );
}
