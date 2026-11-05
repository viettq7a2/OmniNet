import React from 'react';

interface OmniNetLogoProps {
  size?: number;
  variant?: 'icon' | 'full';
  className?: string;
  subtitle?: string;
}

export const OMNINET_SVG_SOURCE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
  <defs>
    <linearGradient id="omninetBg" x1="6" y1="6" x2="58" y2="58" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#0284C7" />
      <stop offset="50%" stop-color="#2563EB" />
      <stop offset="100%" stop-color="#0F172A" />
    </linearGradient>
    <linearGradient id="omninetAccent" x1="14" y1="14" x2="50" y2="50" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#38BDF8" />
      <stop offset="100%" stop-color="#34D399" />
    </linearGradient>
  </defs>
  <rect x="4" y="4" width="56" height="56" rx="16" fill="url(#omninetBg)" stroke="#38BDF8" stroke-width="1.5" stroke-opacity="0.45" />
  <polygon points="32,11 50,21.5 50,42.5 32,53 14,42.5 14,21.5" stroke="url(#omninetAccent)" stroke-width="2.2" fill="rgba(15,23,42,0.45)" stroke-linejoin="round" />
  <line x1="32" y1="11" x2="32" y2="25" stroke="#38BDF8" stroke-width="1.8" stroke-linecap="round" />
  <line x1="50" y1="21.5" x2="38" y2="28.5" stroke="#38BDF8" stroke-width="1.8" stroke-linecap="round" />
  <line x1="50" y1="42.5" x2="38" y2="35.5" stroke="#34D399" stroke-width="1.8" stroke-linecap="round" />
  <line x1="32" y1="53" x2="32" y2="39" stroke="#34D399" stroke-width="1.8" stroke-linecap="round" />
  <line x1="14" y1="42.5" x2="26" y2="35.5" stroke="#38BDF8" stroke-width="1.8" stroke-linecap="round" />
  <line x1="14" y1="21.5" x2="26" y2="28.5" stroke="#38BDF8" stroke-width="1.8" stroke-linecap="round" />
  <circle cx="32" cy="32" r="7" fill="#0F172A" stroke="url(#omninetAccent)" stroke-width="2.4" />
  <circle cx="32" cy="32" r="2.8" fill="#34D399" />
  <circle cx="32" cy="11" r="2.8" fill="#38BDF8" />
  <circle cx="50" cy="21.5" r="2.8" fill="#38BDF8" />
  <circle cx="50" cy="42.5" r="2.8" fill="#34D399" />
  <circle cx="32" cy="53" r="2.8" fill="#34D399" />
  <circle cx="14" cy="42.5" r="2.8" fill="#38BDF8" />
  <circle cx="14" cy="21.5" r="2.8" fill="#38BDF8" />
</svg>`;

export const OmniNetLogo: React.FC<OmniNetLogoProps> = ({
  size = 36,
  variant = 'icon',
  className = '',
  subtitle = 'Autonomous NetOps & Multi-Vendor NCM',
}) => {
  const uid = React.useId().replace(/:/g, '');

  const iconSvg = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0 select-none"
      aria-label="OmniNet Logo"
    >
      <defs>
        <linearGradient
          id={`omninetBg-${uid}`}
          x1="6"
          y1="6"
          x2="58"
          y2="58"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#0284C7" />
          <stop offset="50%" stopColor="#2563EB" />
          <stop offset="100%" stopColor="#0F172A" />
        </linearGradient>
        <linearGradient
          id={`omninetAccent-${uid}`}
          x1="14"
          y1="14"
          x2="50"
          y2="50"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="100%" stopColor="#34D399" />
        </linearGradient>
      </defs>

      {/* Outer Rounded Squircle Chassis */}
      <rect
        x="4"
        y="4"
        width="56"
        height="56"
        rx="16"
        fill={`url(#omninetBg-${uid})`}
        stroke="#38BDF8"
        strokeWidth="1.5"
        strokeOpacity="0.45"
      />

      {/* Hexagonal Core Mesh Ring */}
      <polygon
        points="32,11 50,21.5 50,42.5 32,53 14,42.5 14,21.5"
        stroke={`url(#omninetAccent-${uid})`}
        strokeWidth="2.2"
        fill="rgba(15,23,42,0.48)"
        strokeLinejoin="round"
      />

      {/* Radial Interconnect Links */}
      <line x1="32" y1="11" x2="32" y2="25" stroke="#38BDF8" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="50" y1="21.5" x2="38" y2="28.5" stroke="#38BDF8" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="50" y1="42.5" x2="38" y2="35.5" stroke="#34D399" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="32" y1="53" x2="32" y2="39" stroke="#34D399" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="14" y1="42.5" x2="26" y2="35.5" stroke="#38BDF8" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="14" y1="21.5" x2="26" y2="28.5" stroke="#38BDF8" strokeWidth="1.8" strokeLinecap="round" />

      {/* Central Autonomous Switching Core */}
      <circle
        cx="32"
        cy="32"
        r="7"
        fill="#0F172A"
        stroke={`url(#omninetAccent-${uid})`}
        strokeWidth="2.4"
      />
      <circle cx="32" cy="32" r="2.8" fill="#34D399" />

      {/* 6 Perimeter Multi-Vendor Nodes */}
      <circle cx="32" cy="11" r="2.8" fill="#38BDF8" />
      <circle cx="50" cy="21.5" r="2.8" fill="#38BDF8" />
      <circle cx="50" cy="42.5" r="2.8" fill="#34D399" />
      <circle cx="32" cy="53" r="2.8" fill="#34D399" />
      <circle cx="14" cy="42.5" r="2.8" fill="#38BDF8" />
      <circle cx="14" cy="21.5" r="2.8" fill="#38BDF8" />
    </svg>
  );

  if (variant === 'icon') {
    return <div className={`inline-flex items-center justify-center ${className}`}>{iconSvg}</div>;
  }

  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      {iconSvg}
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-bold tracking-tight text-slate-900 dark:text-white leading-none text-base">
            Omni<span className="text-sky-500 dark:text-sky-400">Net</span>
          </span>
        </div>
        {subtitle && (
          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">{subtitle}</p>
        )}
      </div>
    </div>
  );
};
