"use client";
// Icon set — outline style, stroke-based, inherits currentColor.
//
// Replaces the emoji glyphs the app shipped with. Emoji are rendered by the OS,
// so they changed shape between iPhone/Android/Windows, couldn't take the brand
// colour, and read as informal on a product residents trust with their home.
// These are drawn on a 24px grid at ~1.75 stroke (Phosphor/Lucide proportions)
// and are declared inline so there's no icon-font or package dependency.

const P = {
  house: <><path d="M3.5 10.6 12 3.6l8.5 7v9.1a.9.9 0 0 1-.9.9h-4.4v-5.9H8.8v5.9H4.4a.9.9 0 0 1-.9-.9z" /></>,
  wrench: (
    <path d="M14.8 6.2a3.9 3.9 0 0 1 5 5l-1.9-1.9-2.1.5-.6-.6.5-2.1zm-1.1 5.1L5.4 19.6a1.9 1.9 0 0 1-2.7-2.7l8.3-8.3" />
  ),
  chat: (
    <path d="M20.5 11.6a7.6 7.6 0 0 1-8.1 7.6 8.4 8.4 0 0 1-2.6-.5L4.2 20.4l1.6-5.4a7.4 7.4 0 0 1-.8-3.4 7.6 7.6 0 0 1 15.5 0z" />
  ),
  user: (
    <><circle cx="12" cy="8.2" r="3.7" /><path d="M4.8 20a7.9 7.9 0 0 1 14.4 0" /></>
  ),
  users: (
    <><circle cx="9.4" cy="8.4" r="3.4" /><path d="M3 19.4a7 7 0 0 1 12.8 0" /><path d="M15.8 5.4a3.4 3.4 0 0 1 0 6" /><path d="M17.6 14.2a7 7 0 0 1 3.6 3.4" /></>
  ),
  building: (
    <><rect x="4.6" y="3.4" width="14.8" height="17.2" rx="1.2" /><path d="M9 8h2M13 8h2M9 12h2M13 12h2" /><path d="M10.4 20.6v-4h3.2v4" /></>
  ),
  search: (
    <><circle cx="10.8" cy="10.8" r="6.3" /><path d="m15.5 15.5 4.4 4.4" /></>
  ),
  camera: (
    <><path d="M3.6 8.6h3.2l1.5-2.4h7.4l1.5 2.4h3.2a.9.9 0 0 1 .9.9v9a.9.9 0 0 1-.9.9H3.6a.9.9 0 0 1-.9-.9v-9a.9.9 0 0 1 .9-.9z" /><circle cx="12" cy="13.6" r="3.5" /></>
  ),
  calendar: (
    <><rect x="3.6" y="5.4" width="16.8" height="15" rx="1.3" /><path d="M3.6 10h16.8M8.2 3.4v3.6M15.8 3.4v3.6" /></>
  ),
  clipboard: (
    <><path d="M9 4.6H6.7a1.1 1.1 0 0 0-1.1 1.1v14.1a1.1 1.1 0 0 0 1.1 1.1h10.6a1.1 1.1 0 0 0 1.1-1.1V5.7a1.1 1.1 0 0 0-1.1-1.1H15" /><rect x="9" y="2.8" width="6" height="3.6" rx="1" /><path d="M8.8 11.6h6.4M8.8 15.4h4.4" /></>
  ),
  chart: (
    <><path d="M4 20.2h16" /><rect x="5.8" y="12" width="3.4" height="6" rx=".7" /><rect x="10.9" y="8" width="3.4" height="10" rx=".7" /><rect x="16" y="4.6" width="3.4" height="13.4" rx=".7" /></>
  ),
  bell: (
    <><path d="M18.2 16.4H5.8c1 0 1.6-1.3 1.6-2.3v-3a4.6 4.6 0 1 1 9.2 0v3c0 1 .6 2.3 1.6 2.3z" /><path d="M10.2 19a2 2 0 0 0 3.6 0" /></>
  ),
  warning: (
    <><path d="M10.7 4.2 3.3 17.4a1.5 1.5 0 0 0 1.3 2.3h14.8a1.5 1.5 0 0 0 1.3-2.3L13.3 4.2a1.5 1.5 0 0 0-2.6 0z" /><path d="M12 9.6v4.2" /><circle cx="12" cy="16.7" r=".9" fill="currentColor" stroke="none" /></>
  ),
  pin: (
    <><path d="M12 21s6.4-5.5 6.4-10.2a6.4 6.4 0 1 0-12.8 0C5.6 15.5 12 21 12 21z" /><circle cx="12" cy="10.6" r="2.4" /></>
  ),
  envelope: (
    <><rect x="3" y="5.4" width="18" height="13.2" rx="1.3" /><path d="m3.6 6.4 8.4 6.2 8.4-6.2" /></>
  ),
  check: <path d="m4.8 12.6 4.8 4.6 9.6-10" />,
  checkCircle: (
    <><circle cx="12" cy="12" r="8.6" /><path d="m8.2 12.3 2.6 2.6 5-5.4" /></>
  ),
  x: <path d="M6.2 6.2 17.8 17.8M17.8 6.2 6.2 17.8" />,
  plus: <path d="M12 5.4v13.2M5.4 12h13.2" />,
  caretRight: <path d="m9.6 5.4 6.8 6.6-6.8 6.6" />,
  caretDown: <path d="m5.4 9.6 6.6 6.8 6.6-6.8" />,
  arrowLeft: <path d="M19.4 12H4.6m0 0 5.8-5.8M4.6 12l5.8 5.8" />,
  arrowRight: <path d="M4.6 12h14.8m0 0-5.8-5.8M19.4 12l-5.8 5.8" />,
  send: <path d="M20.6 3.4 3.6 10.2l6.6 2.9 2.9 6.6z" />,
  sparkle: (
    <path d="M12 3.2c.5 3.8 1.6 5 5.4 5.5-3.8.6-4.9 1.7-5.4 5.5-.5-3.8-1.6-4.9-5.4-5.5 3.8-.5 4.9-1.7 5.4-5.5zM18.6 15c.3 1.9.8 2.5 2.7 2.8-1.9.3-2.4.9-2.7 2.7-.2-1.8-.8-2.4-2.7-2.7 1.9-.3 2.5-.9 2.7-2.8z" />
  ),
  tray: (
    <><rect x="3.4" y="3.4" width="17.2" height="17.2" rx="1.4" /><path d="M3.4 14.4h4.2a1 1 0 0 1 .9.6 3.9 3.9 0 0 0 7 0 1 1 0 0 1 .9-.6h4.2" /></>
  ),
  note: (
    <><path d="M18.6 10.4v9.1a1 1 0 0 1-1 1H5.4a1 1 0 0 1-1-1V5.4a1 1 0 0 1 1-1h7.2" /><path d="m15.4 4.2 4.4 4.4-6 6h-4.4v-4.4z" /></>
  ),
  phone: (
    <path d="M8.1 4.4 6 4.2a1.5 1.5 0 0 0-1.6 1.3C3.8 12 11.9 20.1 18.4 19.5a1.5 1.5 0 0 0 1.3-1.6l-.2-2.1a1.4 1.4 0 0 0-1-1.2l-2.7-.8a1.4 1.4 0 0 0-1.4.4l-1 1.1a12.6 12.6 0 0 1-4.6-4.6l1.1-1a1.4 1.4 0 0 0 .4-1.4l-.8-2.7a1.4 1.4 0 0 0-1.4-1z" />
  ),
  info: (
    <><circle cx="12" cy="12" r="8.6" /><path d="M11.2 11.2h1v4.6h1" /><circle cx="11.9" cy="8.2" r=".95" fill="currentColor" stroke="none" /></>
  ),
  grid: (
    <><rect x="3.8" y="3.8" width="7" height="7" rx="1.2" /><rect x="13.2" y="3.8" width="7" height="7" rx="1.2" /><rect x="3.8" y="13.2" width="7" height="7" rx="1.2" /><rect x="13.2" y="13.2" width="7" height="7" rx="1.2" /></>
  ),
};

export default function Icon({ name, size = 20, strokeWidth = 1.75, style, title, ...rest }) {
  const d = P[name];
  if (!d) return null;
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      focusable="false"
      style={{ display: "block", flexShrink: 0, ...style }}
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      {d}
    </svg>
  );
}

export const ICON_NAMES = Object.keys(P);
