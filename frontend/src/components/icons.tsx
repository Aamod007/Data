const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

export const icons = {
  dashboard: (
    <svg width="16" height="16" viewBox="0 0 16 16" {...stroke}>
      <rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1.5" />
      <rect x="9" y="1.5" width="5.5" height="5.5" rx="1.5" />
      <rect x="1.5" y="9" width="5.5" height="5.5" rx="1.5" />
      <rect x="9" y="9" width="5.5" height="5.5" rx="1.5" />
    </svg>
  ),
  incidents: (
    <svg width="16" height="16" viewBox="0 0 16 16" {...stroke}>
      <path d="M8 1.8 14.6 13.4H1.4L8 1.8Z" />
      <path d="M8 6.5v3.2" />
      <path d="M8 11.8v.1" />
    </svg>
  ),
  pipelines: (
    <svg width="16" height="16" viewBox="0 0 16 16" {...stroke}>
      <circle cx="3" cy="8" r="1.7" />
      <circle cx="13" cy="3.5" r="1.7" />
      <circle cx="13" cy="12.5" r="1.7" />
      <path d="M4.6 7.3 11.3 4.1M4.6 8.7l6.7 3.2" />
    </svg>
  ),
  bolt: (
    <svg width="16" height="16" viewBox="0 0 16 16" {...stroke}>
      <path d="M8.7 1.5 4 9h3.2l-.9 5.5L11 7H7.8l.9-5.5Z" />
    </svg>
  ),
  clock: (
    <svg width="12" height="12" viewBox="0 0 16 16" {...stroke}>
      <circle cx="8" cy="8" r="6.2" />
      <path d="M8 4.8V8l2.2 1.6" />
    </svg>
  ),
  plug: (
    <svg width="16" height="16" viewBox="0 0 16 16" {...stroke}>
      <path d="M5.5 1.8v3.4M10.5 1.8v3.4" />
      <path d="M3.5 5.2h9v2.6a4.5 4.5 0 0 1-9 0V5.2Z" />
      <path d="M8 12.3v2" />
    </svg>
  ),
  book: (
    <svg width="16" height="16" viewBox="0 0 16 16" {...stroke}>
      <path d="M2.5 2.5h4.2A1.8 1.8 0 0 1 8.5 4.3v9.4a1.4 1.4 0 0 0-1.4-1.4H2.5V2.5Z" />
      <path d="M13.5 2.5H9.3A1.8 1.8 0 0 0 7.5 4.3v9.4a1.4 1.4 0 0 1 1.4-1.4h4.6V2.5Z" />
    </svg>
  ),
  gear: (
    <svg width="16" height="16" viewBox="0 0 16 16" {...stroke}>
      <circle cx="8" cy="8" r="2.2" />
      <path d="M8 1.8v2M8 12.2v2M1.8 8h2M12.2 8h2M3.6 3.6l1.4 1.4M11 11l1.4 1.4M12.4 3.6 11 5M5 11l-1.4 1.4" />
    </svg>
  ),
};
