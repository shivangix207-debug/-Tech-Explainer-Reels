import { Link } from "react-router-dom";
import { Heart, Eye, Clock, Play, Layers } from "lucide-react";

const formatDuration = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

const ReelCard = ({ reel }) => {
  return (
    <Link
      to={`/reels/${reel._id}`}
      className="group card overflow-hidden hover:shadow-medium hover:-translate-y-0.5 transition-all duration-200 stagger-item"
    >
      <div className="relative aspect-[9/16] bg-gradient-to-br from-brand-50 to-surface-border dark:from-surface-card-dark dark:to-surface-dark overflow-hidden">
        {reel.thumbnailUrl ? (
          <img src={reel.thumbnailUrl} alt={reel.title} className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full flex items-center justify-center">
            <Play className="h-10 w-10 text-ink-light/40 dark:text-ink-dark/70" />
          </div>
        )}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
          <Play className="h-10 w-10 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="white" />
        </div>
        {reel.videoSource === "generated-slides" && (
          <span title="Narrated slide lesson (synthetic voice)" className="absolute bottom-2 left-2 badge bg-black/60 text-white gap-1"><Layers className="h-3 w-3" /> Narrated</span>
        )}
        <span className="absolute bottom-2 right-2 badge bg-black/60 text-white gap-1">
          <Clock className="h-3 w-3" /> {formatDuration(reel.duration || 0)}
        </span>
        {reel.category?.name && (
          <span
            className="absolute top-2 left-2 badge text-white"
            style={{ backgroundColor: reel.category.color || "#6366F1" }}
          >
            {reel.category.name}
          </span>
        )}
      </div>
      <div className="p-3">
        <h3 className="font-semibold text-sm line-clamp-2 leading-snug">{reel.title}</h3>
        {reel.skillLevel && <p className="text-[11px] mt-1 capitalize text-brand-500 font-medium">{reel.skillLevel}</p>}
        <div className="mt-2 flex items-center gap-3 text-xs text-ink-light/60 dark:text-ink-dark/50">
          <span className="flex items-center gap-1"><Eye className="h-3.5 w-3.5" /> {reel.views ?? 0}</span>
          <span className="flex items-center gap-1"><Heart className="h-3.5 w-3.5" /> {reel.likeCount ?? reel.likes?.length ?? 0}</span>
        </div>
      </div>
    </Link>
  );
};

export default ReelCard;
