export function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-zinc-800/70 rounded-xl ${className}`} />;
}
