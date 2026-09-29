import type { SVGProps } from "react";

const DIAL_TEETH = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];

/** The DividendCase mark: a vault (the "case") with leaves growing out of it. */
export function LogoMark({ title, ...props }: SVGProps<SVGSVGElement> & { title?: string }) {
  return (
    <svg
      viewBox="0 0 200 200"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      {...props}
    >
      {title && <title>{title}</title>}
      <path d="M87,89 C80,76 68,56 73,34 C82,50 86,70 94,87Z" fill="#4a8c1a" />
      <path d="M87,89 C84,77 80,60 73,34 C82,50 86,70 94,87Z" fill="#7abf50" opacity="0.4" />
      <path d="M113,89 C120,76 132,56 127,34 C118,50 114,70 106,87Z" fill="#4a8c1a" />
      <path d="M113,89 C116,77 120,60 127,34 C118,50 114,70 106,87Z" fill="#7abf50" opacity="0.4" />
      <path d="M100,90 C88,68 84,38 100,5 C116,38 112,68 100,90Z" fill="#2d6010" />
      <path d="M100,90 C94,68 90,38 100,5 C100,38 100,68 100,90Z" fill="#5a9e2f" opacity="0.5" />
      <line x1="100" y1="90" x2="100" y2="5" stroke="#639922" strokeWidth="0.9" strokeLinecap="round" opacity="0.4" />
      <rect x="15" y="86" width="170" height="103" rx="13" fill="#343444" />
      <rect x="19" y="90" width="162" height="95" rx="11" fill="#5c5c70" />
      <ellipse cx="63" cy="108" rx="22" ry="9" fill="#ffffff" opacity="0.055" transform="rotate(-18,63,108)" />
      <rect x="10" y="103" width="12" height="20" rx="3.5" fill="#8888a0" />
      <rect x="10" y="133" width="12" height="20" rx="3.5" fill="#8888a0" />
      <circle cx="114" cy="140" r="31" fill="#3a3a4e" />
      <circle cx="114" cy="140" r="27" fill="#7070a0" />
      <g transform="translate(114,140)" fill="#c0c0d8">
        {DIAL_TEETH.map((deg) => (
          <rect key={deg} x="-2" y="-26" width="4" height="7" rx="1.5" transform={`rotate(${deg})`} />
        ))}
      </g>
      <circle cx="114" cy="140" r="18" fill="#d0d0e0" />
      <circle cx="114" cy="140" r="17" fill="none" stroke="#9090b0" strokeWidth="1" />
      <circle cx="114" cy="140" r="7" fill="#707090" />
      <circle cx="114" cy="140" r="4" fill="#9090b0" />
      <circle cx="114" cy="140" r="2" fill="#d0d0e0" />
      <rect x="112.5" y="113" width="3" height="7" rx="1.5" fill="#2a2a38" />
      <rect x="30" y="184" width="28" height="11" rx="4" fill="#888898" />
      <rect x="142" y="184" width="28" height="11" rx="4" fill="#888898" />
    </svg>
  );
}

/** Mark plus the word "DividendCase", with "Dividend" in green. */
export function Logo({
  className,
  markClassName,
  wordClassName,
}: {
  className?: string;
  markClassName?: string;
  wordClassName?: string;
}) {
  return (
    <span className={className} style={{ display: "inline-flex", alignItems: "center", gap: "0.55em" }}>
      <LogoMark className={markClassName} style={{ height: "1.9em", width: "1.9em", flex: "none" }} />
      <span className={wordClassName} style={{ fontWeight: 600, letterSpacing: "-0.015em" }}>
        <span style={{ color: "var(--color-sprout)" }}>Dividend</span>Case
      </span>
    </span>
  );
}
