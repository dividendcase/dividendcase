import { useId } from "react";

/** Length of the tick ring's circumference: the lit arc is a dash of part of it */
export const TICK_RING = 2 * Math.PI * 238;

/**
 * The vault dial from the logo, drawn large. Purely decorative.
 *
 * The film animates it through data attributes: `data-rotor` groups turn together (the numbered
 * ring, the teeth and the face), and `data-lit` is the mask whose dash length lights the ticks that
 * have passed the notch at the top. The notch, the steel rim and the highlight stay still.
 */
export function Dial({
  className,
  glow = false,
  ref,
}: {
  className?: string;
  glow?: boolean;
  ref?: React.Ref<SVGSVGElement>;
}) {
  // useId returns characters that aren't valid in url(#…)
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  return (
    <svg ref={ref} viewBox="0 0 680 680" className={className} aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id={`${id}glow`} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#7abf50" stopOpacity="0.17" />
          <stop offset="0.55" stopColor="#7abf50" stopOpacity="0.04" />
          <stop offset="1" stopColor="#7abf50" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}steel`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4a4a60" />
          <stop offset="1" stopColor="#18181f" />
        </linearGradient>
        <radialGradient id={`${id}ring`} cx="38%" cy="32%" r="80%">
          <stop offset="0" stopColor="#8c8cbc" />
          <stop offset="1" stopColor="#46466a" />
        </radialGradient>
        <radialGradient id={`${id}face`} cx="38%" cy="30%" r="80%">
          <stop offset="0" stopColor="#ececf6" />
          <stop offset="0.5" stopColor="#bcbcd0" />
          <stop offset="1" stopColor="#74748c" />
        </radialGradient>
        <radialGradient id={`${id}hub`} cx="40%" cy="35%" r="70%">
          <stop offset="0" stopColor="#9a9ab6" />
          <stop offset="1" stopColor="#55556e" />
        </radialGradient>
        <mask id={`${id}lit`} maskUnits="userSpaceOnUse" x="0" y="0" width="680" height="680">
          <circle
            data-lit=""
            cx="340"
            cy="340"
            r="238"
            fill="none"
            stroke="#fff"
            strokeWidth="44"
            strokeDasharray={`0 ${TICK_RING}`}
            transform="rotate(-90 340 340)"
          />
        </mask>
      </defs>

      {glow && <circle cx="340" cy="340" r="340" fill={`url(#${id}glow)`} />}
      <circle cx="340" cy="340" r="270" fill={`url(#${id}steel)`} />
      <circle cx="340" cy="340" r="259" fill="#1d1d27" />

      {/* The numbered ring: 60 ticks, every fifth one longer */}
      <g data-rotor="">
        <circle cx="340" cy="340" r="238" fill="none" stroke="#3e3e50" strokeWidth="14" strokeDasharray="2.5 22.42" transform="rotate(-90 340 340)" />
        <circle cx="340" cy="340" r="238" fill="none" stroke="#6e6e88" strokeWidth="24" strokeDasharray="5 119.62" transform="rotate(-90.6 340 340)" />
      </g>
      <g mask={`url(#${id}lit)`}>
        <g data-rotor="">
          <circle cx="340" cy="340" r="238" fill="none" stroke="#ececf3" strokeWidth="14" strokeDasharray="2.5 22.42" transform="rotate(-90 340 340)" />
          <circle cx="340" cy="340" r="238" fill="none" stroke="#ffffff" strokeWidth="24" strokeDasharray="5 119.62" transform="rotate(-90.6 340 340)" />
        </g>
      </g>

      <g data-rotor="">
        <circle cx="340" cy="340" r="214" fill={`url(#${id}ring)`} />
        <circle cx="340" cy="340" r="196" fill="none" stroke="#c9c9dd" strokeWidth="22" strokeDasharray="11 91.63" transform="rotate(-91.6 340 340)" />
        <circle cx="340" cy="340" r="170" fill={`url(#${id}face)`} />
        <circle cx="340" cy="340" r="166" fill="none" stroke="#8a8aa4" strokeWidth="5" strokeDasharray="1.6 4.2" opacity="0.55" />
        <circle cx="340" cy="340" r="104" fill="none" stroke="#9a9ab4" strokeWidth="1" />
        <circle cx="340" cy="340" r="60" fill={`url(#${id}hub)`} />
        <circle cx="340" cy="340" r="34" fill="#9494b0" />
        <circle cx="340" cy="340" r="15" fill="#dcdcea" />
        <rect x="336" y="300" width="8" height="18" rx="4" fill="#5c5c78" />
      </g>

      <ellipse cx="270" cy="250" rx="130" ry="48" fill="#ffffff" opacity="0.07" transform="rotate(-32 270 250)" />
      {/* The notch the ticks pass */}
      <rect x="335" y="62" width="10" height="28" rx="5" fill="#ececf3" />
    </svg>
  );
}
