export default function LumoraLogo({ size = 32, light = false, className = '' }) {
  const bgFill = light ? 'rgba(255, 255, 255, 0.16)' : '#2563eb';
  const iconStroke = light ? '#ffffff' : '#ffffff';
  const accentColor = light ? '#93c5fd' : '#bfdbfe';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`lumora-logo-svg ${className}`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="lumoraGrad" x1="10" y1="10" x2="90" y2="90" gradientUnits="userSpaceOnUse">
          <stop stopColor={light ? '#3b82f6' : '#2563eb'} />
          <stop offset="1" stopColor={light ? '#1d4ed8' : '#1e40af'} />
        </linearGradient>
        <linearGradient id="leafGrad" x1="50" y1="20" x2="75" y2="45" gradientUnits="userSpaceOnUse">
          <stop stopColor="#60a5fa" />
          <stop offset="1" stopColor="#93c5fd" />
        </linearGradient>
      </defs>

      {/* Rounded squircle emblem */}
      <rect x="6" y="6" width="88" height="88" rx="26" fill="url(#lumoraGrad)" />

      {/* Subtle dining plate inner rim */}
      <circle cx="50" cy="50" r="36" stroke="rgba(255, 255, 255, 0.18)" strokeWidth="2.5" />

      {/* Stylized 'L' stem + dining cloche / plate base */}
      <path
        d="M34 26 V68 C34 71.5 36.8 74 40.5 74 H68 C70 74 71 72.5 71 70.8 C71 69 69.8 68 67.5 68 H42 V26 C42 24.2 40.8 23 38 23 C35.2 23 34 24.2 34 26 Z"
        fill={iconStroke}
      />

      {/* Subtle organic culinary leaf / flame accent crowning the L */}
      <path
        d="M48 24 C54 18 66 18 70 26 C70 34 60 40 52 38 C49 37 47 32 48 24 Z"
        fill={accentColor}
      />

      {/* Sparkle star / culinary perfection mark */}
      <circle cx="64" cy="46" r="3" fill="#ffffff" />
    </svg>
  );
}
