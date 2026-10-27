export const SkeletonReelCard = () => (
  <div className="card overflow-hidden">
    <div className="skeleton aspect-[9/12] rounded-none" />
    <div className="p-3 space-y-2">
      <div className="skeleton h-3.5 w-4/5" />
      <div className="skeleton h-3.5 w-2/5" />
      <div className="flex gap-3 pt-1">
        <div className="skeleton h-3 w-10" />
        <div className="skeleton h-3 w-10" />
      </div>
    </div>
  </div>
);

export const SkeletonReelGrid = ({ count = 8 }) => (
  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
    {Array.from({ length: count }).map((_, i) => (
      <SkeletonReelCard key={i} />
    ))}
  </div>
);

export const SkeletonStatCard = () => (
  <div className="card p-5 space-y-3">
    <div className="skeleton h-4 w-24" />
    <div className="skeleton h-8 w-16" />
  </div>
);

export const SkeletonStatGrid = ({ count = 4 }) => (
  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
    {Array.from({ length: count }).map((_, i) => (
      <SkeletonStatCard key={i} />
    ))}
  </div>
);

export const SkeletonCommentRow = () => (
  <div className="flex gap-3">
    <div className="skeleton h-8 w-8 rounded-full shrink-0" />
    <div className="flex-1 space-y-2">
      <div className="skeleton h-3 w-28" />
      <div className="skeleton h-3.5 w-4/5" />
    </div>
  </div>
);

export const SkeletonCommentList = ({ count = 3 }) => (
  <div className="space-y-4">
    {Array.from({ length: count }).map((_, i) => (
      <SkeletonCommentRow key={i} />
    ))}
  </div>
);

export const SkeletonRow = ({ className = "" }) => <div className={`skeleton ${className}`} />;
