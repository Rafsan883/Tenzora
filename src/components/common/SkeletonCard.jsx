export default function SkeletonCard() {
  return (
    <div className="pointer-events-none flex w-full flex-col font-mono">
      {/* Poster placeholder */}
      <div className="relative aspect-[2/3] w-full overflow-hidden border border-white/[0.08] bg-[#0a0b10] animate-shimmer shadow-[0_12px_28px_rgba(0,0,0,0.3)]" />
      
      {/* Title placeholders */}
      <div className="mt-3 w-full space-y-2 px-1">
        <div className="h-[11px] w-full animate-shimmer bg-[#11131a]" />
        <div className="h-[11px] w-[60%] animate-shimmer bg-[#11131a]" />
      </div>
    </div>
  );
}
