import { Link } from 'react-router-dom';

export interface GrotecLogoProps {
  to?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  subtitle?: string;
  showTagline?: boolean;
  className?: string;
  onClick?: () => void;
  variant?: 'full' | 'mark-only' | 'hero';
}

const SIZE_MAP = {
  xs: { img: 'h-7 w-7', title: 'text-sm', sub: 'text-[10px]' },
  sm: { img: 'h-9 w-9', title: 'text-base', sub: 'text-[11px]' },
  md: { img: 'h-11 w-11', title: 'text-lg', sub: 'text-xs' },
  lg: { img: 'h-16 w-16', title: 'text-2xl', sub: 'text-sm' },
  xl: { img: 'h-20 w-20', title: 'text-3xl', sub: 'text-base' },
};

export function GrotecLogo({
  to = '/dashboard',
  size = 'sm',
  subtitle = 'FarmerOS v2.4',
  showTagline = false,
  className = '',
  onClick,
  variant = 'full',
}: GrotecLogoProps) {
  const { img, title, sub } = SIZE_MAP[size];

  if (variant === 'mark-only') {
    const mark = (
      <img
        src="/grotec_logo.webp"
        alt="GROTEC — Science for Crops"
        width={474}
        height={474}
        className={`${img} aspect-square object-contain shrink-0 transition-transform duration-200 hover:scale-105 filter drop-shadow-xs ${className}`}
        loading="eager"
        decoding="async"
      />
    );
    if (!to) return mark;
    return (
      <Link to={to} onClick={onClick} aria-label="GROTEC FarmerOS Homepage" className="inline-block focus:outline-none">
        {mark}
      </Link>
    );
  }

  const content = (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      <div className="relative shrink-0 flex items-center justify-center">
        <img
          src="/grotec_logo.webp"
          alt="GROTEC — Science for Crops"
          width={474}
          height={474}
          className={`${img} aspect-square object-contain shrink-0 rounded-lg transition-transform duration-200 hover:scale-105 filter drop-shadow-xs`}
          loading="eager"
          decoding="async"
        />
      </div>

      <div className="flex flex-col min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={`font-black tracking-tight text-slate-900 leading-none ${title}`}>
            GROTEC
          </span>
          <span className="rounded bg-accent-100 px-1.5 py-0.5 text-[9px] font-bold text-accent-700 uppercase tracking-wide border border-accent-200/80">
            Bio
          </span>
        </div>
        {subtitle && (
          <span className={`font-semibold text-slate-400 mt-1 leading-none ${sub}`}>
            {subtitle}
          </span>
        )}
        {showTagline && (
          <span className="text-[10px] italic text-[#1E7A3D] font-medium mt-1">
            Science for Crops
          </span>
        )}
      </div>
    </div>
  );

  if (!to) return content;

  return (
    <Link
      to={to}
      onClick={onClick}
      className="inline-block focus:outline-none focus:ring-2 focus:ring-brand-500/20 rounded-lg"
      aria-label="GROTEC FarmerOS Homepage"
    >
      {content}
    </Link>
  );
}
