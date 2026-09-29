/**
 * The dial from the logo, drawn as a large ring of ticks. Purely decorative.
 * `ticks` controls how many teeth go round the ring.
 */
export function VaultDial({ className, ticks = 24 }: { className?: string; ticks?: number }) {
  const step = 360 / ticks;
  return (
    <svg viewBox="0 0 560 560" className={className} aria-hidden="true" focusable="false">
      <circle cx="280" cy="280" r="258" fill="none" stroke="#3a3a4e" strokeWidth="1.5" />
      <circle cx="280" cy="280" r="236" fill="none" stroke="#282834" strokeWidth="1" />
      <circle cx="280" cy="280" r="170" fill="none" stroke="#22222c" strokeWidth="1" strokeDasharray="2 6" />
      <g transform="translate(280 280)">
        {Array.from({ length: ticks }, (_, i) => (
          <rect
            key={i}
            x={i % 3 === 0 ? -3 : -1.5}
            y={-252}
            width={i % 3 === 0 ? 6 : 3}
            height={i % 3 === 0 ? 22 : 12}
            rx={1.5}
            fill={i % 3 === 0 ? "#5c5c70" : "#363645"}
            transform={`rotate(${i * step})`}
          />
        ))}
        {/* The indicator notch, as on the logo */}
        <rect x="-3" y="-232" width="6" height="16" rx="3" fill="#7070a0" opacity="0.7" />
      </g>
    </svg>
  );
}
