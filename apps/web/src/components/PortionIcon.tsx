"use client";

import React from "react";

// ── base ──────────────────────────────────────────────────────────────────

interface SvgProps {
  size?: number;
  color?: string;
  className?: string;
}

function Svg({
  size = 20,
  color = "currentColor",
  className,
  children,
}: SvgProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {children}
    </svg>
  );
}

// ── icons ──────────────────────────────────────────────────────────────────

/**
 * katori — wide Indian bowl (dal, curry, sambar)
 *
 *    ─────────────
 *   ╰─────╮─────╯
 *         ─
 */
function KatoriIcon(props: SvgProps) {
  return (
    <Svg {...props}>
      <line x1="3" y1="8" x2="21" y2="8" />
      <path d="M5 8Q4 18 12 19Q20 18 19 8" />
      <line x1="9" y1="19" x2="15" y2="19" />
    </Svg>
  );
}

/**
 * small_katori — smaller bowl (chutneys, accompaniments)
 *
 *      ─────────
 *     ╰────╮───╯
 *          ─
 */
function SmallKatoriIcon(props: SvgProps) {
  return (
    <Svg {...props}>
      <line x1="6" y1="10" x2="18" y2="10" />
      <path d="M7 10Q7 18 12 18Q17 18 17 10" />
      <line x1="10" y1="18" x2="14" y2="18" />
    </Svg>
  );
}

/**
 * piece — whole individual unit (roti, idli, banana, egg)
 *
 *      ╭───╮
 *     │     │
 *      ╰───╯
 */
function PieceIcon(props: SvgProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="7.5" />
    </Svg>
  );
}

/**
 * glass — cup or glass (milk, juice, lassi)
 *
 *    ─────────
 *    │       │
 *     │     │
 *     ───────
 */
function GlassIcon(props: SvgProps) {
  return (
    <Svg {...props}>
      <line x1="7" y1="4" x2="17" y2="4" />
      <path d="M7 4L9 20h6L17 4" />
      <line x1="9" y1="20" x2="15" y2="20" />
    </Svg>
  );
}

/**
 * thumb — thumb-tip dollop (ghee, butter, oil, pickle)
 *
 *      ╭──╮
 *     ╰────╯
 *      ╰──╯
 */
function ThumbIcon(props: SvgProps) {
  return (
    <Svg {...props}>
      <path d="M12 4Q8 9 8 14A4 4 0 0 0 16 14Q16 9 12 4Z" />
    </Svg>
  );
}

// ── registry + public API ─────────────────────────────────────────────────

const ICON_MAP: Record<string, (props: SvgProps) => React.ReactElement> = {
  katori: KatoriIcon,
  small_katori: SmallKatoriIcon,
  piece: PieceIcon,
  glass: GlassIcon,
  thumb: ThumbIcon,
};

interface PortionIconProps extends SvgProps {
  /** Matches the `portion_icon` field from the backend PlateItem contract. */
  icon: string;
}

/**
 * Renders the appropriate serving-unit icon for a dish's `portion_icon` value.
 * Falls back to KatoriIcon for any unrecognised icon string.
 */
export function PortionIcon({ icon, ...rest }: PortionIconProps) {
  const Icon = ICON_MAP[icon] ?? KatoriIcon;
  return <Icon {...rest} />;
}

/** The set of icon keys the library currently supports. */
export const SUPPORTED_ICONS = Object.keys(ICON_MAP) as (keyof typeof ICON_MAP)[];
