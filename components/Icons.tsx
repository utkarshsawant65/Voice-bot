type Props = { className?: string };

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export function MicIcon({ className = "h-5 w-5" }: Props) {
  return (
    <svg {...base} className={className}>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  );
}

export function StopIcon({ className = "h-5 w-5" }: Props) {
  return (
    <svg {...base} className={className}>
      <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
    </svg>
  );
}

export function ArrowIcon({ className = "h-4 w-4" }: Props) {
  return (
    <svg {...base} className={className}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function PlayIcon({ className = "h-3.5 w-3.5" }: Props) {
  return (
    <svg {...base} className={className}>
      <path d="M7 5l12 7-12 7z" fill="currentColor" />
    </svg>
  );
}
