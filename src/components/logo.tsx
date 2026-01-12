import { cn } from '@/lib/utils';

export function Logo({
  className,
  showText = false,
  variant = 'rectangular'
}: {
  className?: string;
  showText?: boolean;
  variant?: 'rectangular' | 'square';
}) {
  const logoSrc = variant === 'square'
    ? '/assets/logo/sq-BOBBLE.webp'
    : '/assets/logo/re-BOBBLE.webp';

  return (
    <div className={cn("flex items-center justify-center gap-3", className)}>
      <img
        src={logoSrc}
        alt="BobbleChat Logo"
        className={cn(
          "shrink-0 object-contain",
          variant === 'square' ? "h-10 w-10" : "h-10 w-auto"
        )}
      />
    </div>
  );
}
