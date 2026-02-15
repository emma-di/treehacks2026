'use client';

interface AtriaLogoProps {
  className?: string;
  size?: number;
}

export function AtriaLogo({ className, size = 48 }: AtriaLogoProps) {
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <circle cx="24" cy="24" r="6" fill="currentColor" />
      <circle cx="24" cy="24" r="14" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
      <circle cx="24" cy="24" r="20" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.2" />
      <circle cx="24" cy="10" r="3" fill="currentColor" opacity="0.7" />
      <circle cx="38" cy="24" r="3" fill="currentColor" opacity="0.7" />
      <circle cx="24" cy="38" r="3" fill="currentColor" opacity="0.7" />
      <circle cx="10" cy="24" r="3" fill="currentColor" opacity="0.7" />
    </svg>
  );
}
