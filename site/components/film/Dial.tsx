import { useId } from "react";

/** Circumference of the lit band (ticks and numbers): the lit arc is a dash of part of it */
export const TICK_RING = 2 * Math.PI * 236;

const C = 340;
const NUMBERS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90];

/** One ring of graduations as a dashed circle: `count` ticks, each `width` wide and `length` long */
function Ticks({ r, count, width, length, color }: { r: number; count: number; width: number; length: number; color: string }) {
  const circumference = 2 * Math.PI * r;
  // Turn so the first tick is centred on the index mark at the top
  const offset = -90 - ((width / 2) / r) * (180 / Math.PI);
  return (
    <circle
      cx={C}
      cy={C}
      r={r}
      fill="none"
      stroke={color}
      strokeWidth={length}
      strokeDasharray={`${width} ${circumference / count - width}`}
      transform={`rotate(${offset} ${C} ${C})`}
    />
  );
}

/** The dial's numbers: 0 to 90 at every tenth graduation, upright to the dial like a safe's */
function Numbers({ color }: { color: string }) {
  return (
    <g fill={color} style={{ fontFamily: "var(--font-mono)" }} fontSize="21" fontWeight="500" textAnchor="middle">
      {NUMBERS.map((n, i) => (
        <text key={n} x={C} y={C - 214} transform={`rotate(${i * 36} ${C} ${C})`}>
          {n}
        </text>
      ))}
    </g>
  );
}

/**
 * The vault dial from the logo, drawn large, with a combination dial's graduations: 100 ticks,
 * every tenth numbered. Purely decorative.
 *
 * The film animates it through data attributes: `data-rotor` groups turn together (the numbered
 * ring, the teeth and the face), and `data-lit` is the mask whose dash length lights the ticks and
 * numbers that have passed the index mark at the top. The mark, the steel rim and the highlight
 * stay still.
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
  const graduations = (minor: string, mid: string, major: string) => (
    <>
      <Ticks r={251} count={100} width={1.6} length={9} color={minor} />
      <Ticks r={249.5} count={20} width={2.4} length={12} color={mid} />
      <Ticks r={248} count={10} width={3.4} length={16} color={major} />
    </>
  );
  return (
    <svg ref={ref} viewBox="0 0 680 680" className={className} aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id={`${id}glow`} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#7abf50" stopOpacity="0.16" />
          <stop offset="0.55" stopColor="#7abf50" stopOpacity="0.04" />
          <stop offset="1" stopColor="#7abf50" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}steel`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#50506a" />
          <stop offset="0.5" stopColor="#2c2c3a" />
          <stop offset="1" stopColor="#15151b" />
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
            cx={C}
            cy={C}
            r="236"
            fill="none"
            stroke="#fff"
            strokeWidth="64"
            strokeDasharray={`0 ${TICK_RING}`}
            transform={`rotate(-90 ${C} ${C})`}
          />
        </mask>
      </defs>

      {glow && <circle cx={C} cy={C} r="340" fill={`url(#${id}glow)`} />}
      <circle cx={C} cy={C} r="274" fill={`url(#${id}steel)`} />
      <circle cx={C} cy={C} r="263" fill="#191921" />

      {/* The numbered ring, and a bright copy of it that shows only where the mask has lit it */}
      <g data-rotor="">
        {graduations("#45455a", "#6a6a84", "#8a8aa6")}
        <Numbers color="#9a9ab4" />
      </g>
      <g mask={`url(#${id}lit)`}>
        <g data-rotor="">
          {graduations("#d4d4e4", "#ececf3", "#ffffff")}
          <Numbers color="#ffffff" />
        </g>
      </g>

      <g data-rotor="">
        <circle cx={C} cy={C} r="196" fill={`url(#${id}ring)`} />
        <Ticks r={182} count={12} width={10} length={18} color="#c9c9dd" />
        <circle cx={C} cy={C} r="160" fill={`url(#${id}face)`} />
        <circle cx={C} cy={C} r="156" fill="none" stroke="#8a8aa4" strokeWidth="5" strokeDasharray="1.6 4.2" opacity="0.55" />
        <circle cx={C} cy={C} r="96" fill="none" stroke="#9a9ab4" strokeWidth="1" />
        <circle cx={C} cy={C} r="56" fill={`url(#${id}hub)`} />
        <circle cx={C} cy={C} r="32" fill="#9494b0" />
        <circle cx={C} cy={C} r="14" fill="#dcdcea" />
        <rect x="336" y="300" width="8" height="18" rx="4" fill="#5c5c78" />
      </g>

      <ellipse cx="272" cy="252" rx="124" ry="46" fill="#ffffff" opacity="0.07" transform={`rotate(-32 272 252)`} />
      {/* The index mark the numbers turn past */}
      <path d="M331,64 L349,64 L340,80 Z" fill="#ececf3" />
    </svg>
  );
}
