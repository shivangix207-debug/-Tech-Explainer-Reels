const Logo = ({ size = 32, showWordmark = true, className = "" }) => (
  <div className={`flex items-center gap-2 ${className}`}>
    <svg width={size} height={size} viewBox="0 0 64 64" className="shrink-0">
      <defs>
        <linearGradient id="logo-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#7C3AED" />
          <stop offset="100%" stopColor="#7C3AED" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#logo-g)" />
      <path d="M24 20 L44 32 L24 44 Z" fill="#F7F7FB" />
      <circle cx="47" cy="19" r="5" fill="#06B6D4" />
    </svg>
    {showWordmark && <span className="font-display font-bold text-lg tracking-tight hidden sm:block">Tech Explainer Reels</span>}
  </div>
);

export default Logo;
