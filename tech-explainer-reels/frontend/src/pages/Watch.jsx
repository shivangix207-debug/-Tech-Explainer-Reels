
import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  Heart, Bookmark, MessageCircle, Share2, Volume2, VolumeX, ArrowLeft,
  Sparkles, X, Gauge, ChevronUp,
} from "lucide-react";
import { reelsApi, bookmarksApi } from "../services/endpoints";
import { mediaUrl } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import BottomSheet from "../components/BottomSheet";
import AIChatbot from "../components/AIChatbot";
import AINotes from "../components/AINotes";
import AIQuiz from "../components/AIQuiz";
import CommentSection from "../components/CommentSection";

const SPEEDS = [0.5, 1, 1.25, 1.5, 2];

const ReelPlayer = ({
  reel,
  active,
  muted,
  onEnded,
  registerVideoRef,
  speed,
}) => {
  const videoRef = useRef(null);
  const [progressPct, setProgressPct] = useState(0);
  const [showHeart, setShowHeart] = useState(false);
  const [broken, setBroken] = useState(false);
  const lastTapRef = useRef(0);
  const viewedRef = useRef(false);
  const resumedRef = useRef(false);

  useEffect(() => {
    registerVideoRef(reel._id, videoRef.current);

    return () => {
      registerVideoRef(reel._id, null);
    };
  }, [reel._id, registerVideoRef]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (active) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [active]);

  useEffect(() => {
    const video = videoRef.current;
    if (video) video.playbackRate = speed;
  }, [speed, active]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      setProgressPct(
        video.duration
          ? (video.currentTime / video.duration) * 100
          : 0
      );

      if (
        !viewedRef.current &&
        !video.paused &&
        video.currentTime >= 3
      ) {
        viewedRef.current = true;
        reelsApi.recordView(reel._id).catch(() => {});
      }
    };

    video.addEventListener("timeupdate", handleTimeUpdate);

    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
    };
  }, [reel._id]);

  useEffect(() => {
    if (
      active &&
      !resumedRef.current &&
      reel.myProgress?.watchedSeconds > 2 &&
      !reel.myProgress?.completed
    ) {
      const video = videoRef.current;

      if (video) {
        video.currentTime = reel.myProgress.watchedSeconds;
        resumedRef.current = true;
      }
    }
  }, [active, reel.myProgress]);

  const triggerLike = (force) => {
    window.dispatchEvent(
      new CustomEvent("watch:like", {
        detail: { reelId: reel._id, force },
      })
    );
  };

  const handleTap = () => {
    const now = Date.now();

    if (now - lastTapRef.current < 300) {
      triggerLike(true);
      setShowHeart(true);
      setTimeout(() => setShowHeart(false), 700);
    } else {
      const video = videoRef.current;

      if (video) {
        if (video.paused) {
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      }
    }

    lastTapRef.current = now;
  };

  return (
    <div
      className="relative h-[100dvh] w-full snap-start snap-always shrink-0 bg-black flex items-center justify-center overflow-hidden"
      onClick={handleTap}
    >
      <video
        ref={videoRef}
        src={mediaUrl(reel.videoUrl)}
        poster={mediaUrl(reel.thumbnailUrl)}
        muted={muted}
        playsInline
        loop={false}
        onEnded={onEnded}
        onError={() => setBroken(true)}
        onLoadedData={() => setBroken(false)}
        className="h-full w-full object-contain"
      />

      {broken && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-white text-sm text-center p-6">
          This video file is missing or can't be played in your browser.
        </div>
      )}

      {showHeart && (
        <Heart
          className="absolute h-28 w-28 text-white drop-shadow-lg animate-heart-burst pointer-events-none"
          fill="white"
        />
      )}

      {/* Progress bar */}
      <div className="absolute top-0 inset-x-0 h-1 bg-white/20">
        <div
          className="h-full bg-accent-500 transition-[width]"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Captions */}
      {reel.captions && (
        <div className="absolute bottom-28 md:bottom-20 inset-x-4 text-center">
          <p className="inline-block bg-black/50 text-white text-sm px-3 py-1.5 rounded-lg max-w-md">
            {reel.captions.slice(0, 140)}
          </p>
        </div>
      )}

      {/* Bottom info */}
      <div className="absolute bottom-6 left-4 right-20 text-white">
        {reel.category?.name && (
          <span
            className="badge text-white mb-2"
            style={{
              backgroundColor: reel.category.color || "#7C3AED",
            }}
          >
            {reel.category.name}
          </span>
        )}

        <h2 className="font-display font-semibold text-lg leading-snug drop-shadow">
          {reel.title}
        </h2>

        <p className="text-xs text-white/70 mt-1 line-clamp-2">
          {reel.description}
        </p>
      </div>
    </div>
  );
};

const Watch = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();

  const [reels, setReels] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [muted, setMuted] = useState(true);
  const [liked, setLiked] = useState({});
  const [likeCounts, setLikeCounts] = useState({});
  const [bookmarked, setBookmarked] = useState({});
  const [sheet, setSheet] = useState(null);
  const [speed, setSpeed] = useState(1);
  const [speedMenuOpen, setSpeedMenuOpen] = useState(false);

  const containerRef = useRef(null);
  const itemRefs = useRef({});
  const videoRefs = useRef({});
  const navRef = useRef({});

  useEffect(() => {
    let cancelled = false;

    reelsApi
      .list({ limit: 15, sort: "latest" })
      .then(({ data }) => {
        if (cancelled) return;

        let list = data.reels || [];

        if (id && !list.some((reel) => reel._id === id)) {
          reelsApi
            .get(id)
            .then(({ data: single }) => {
              if (!cancelled && single.reel) {
                setReels([single.reel, ...list]);
              }
            })
            .catch(() => {
              if (!cancelled) toast("Couldn't load this reel", "error");
            });

          return;
        }

        if (id) {
          const index = list.findIndex((reel) => reel._id === id);

          if (index > 0) {
            list = [
              list[index],
              ...list.slice(0, index),
              ...list.slice(index + 1),
            ];
          }
        }

        setReels(list);
      })
      .catch(() => {
        if (!cancelled) toast("Couldn't load reels", "error");
      });

    if (user) {
      bookmarksApi
        .list()
        .then(({ data }) => {
          if (cancelled) return;

          const map = {};

          (data.bookmarks || []).forEach((bookmark) => {
            if (bookmark.reel) {
              map[bookmark.reel._id] = true;
            }
          });

          setBookmarked(map);
        })
        .catch(() => {});
    }

    return () => {
      cancelled = true;
    };
  }, [id, user, toast]);

  useEffect(() => {
    const initialLikes = {};
    const initialCounts = {};

    reels.forEach((reel) => {
      initialLikes[reel._id] = user
        ? (reel.likes || []).some(
            (like) => like === user.id || like?._id === user.id
          )
        : false;

      initialCounts[reel._id] =
        reel.likeCount ?? reel.likes?.length ?? 0;
    });

    setLiked((previous) => ({ ...initialLikes, ...previous }));
    setLikeCounts((previous) => ({ ...initialCounts, ...previous }));
  }, [reels, user]);

  const registerVideoRef = useCallback((reelId, element) => {
    if (element) {
      videoRefs.current[reelId] = element;
    } else {
      delete videoRefs.current[reelId];
    }
  }, []);

  // Detect which reel is currently visible.
  useEffect(() => {
    if (!reels.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
            setActiveIndex(Number(entry.target.dataset.index));
          }
        });
      },
      { threshold: [0.6] }
    );

    Object.values(itemRefs.current).forEach((element) => {
      if (element) observer.observe(element);
    });

    return () => observer.disconnect();
  }, [reels]);

  const activeReel = reels[activeIndex];

  navRef.current = {
    activeIndex,
    count: reels.length,
    go: (index) =>
      itemRefs.current[reels[index]?._id]?.scrollIntoView({
        behavior: "smooth",
      }),
  };

  const doLike = useCallback(
    async (reelId, force = false) => {
      if (!user) {
        return toast("Log in to like reels", "info");
      }

      const wasLiked = !!liked[reelId];

      if (force && wasLiked) return;

      setLiked((previous) => ({
        ...previous,
        [reelId]: !wasLiked,
      }));

      setLikeCounts((previous) => ({
        ...previous,
        [reelId]: (previous[reelId] || 0) + (wasLiked ? -1 : 1),
      }));

      try {
        const { data } = await reelsApi.toggleLike(reelId);

        setLiked((previous) => ({
          ...previous,
          [reelId]: data.liked,
        }));

        setLikeCounts((previous) => ({
          ...previous,
          [reelId]: data.likeCount,
        }));

        if (data.liked) toast("Liked", "success", 1500);
      } catch {
        setLiked((previous) => ({
          ...previous,
          [reelId]: wasLiked,
        }));

        setLikeCounts((previous) => ({
          ...previous,
          [reelId]: (previous[reelId] || 0) + (wasLiked ? 1 : -1),
        }));

        toast("Couldn't update like", "error");
      }
    },
    [liked, user, toast]
  );

  useEffect(() => {
    const handler = (event) => {
      doLike(event.detail.reelId, event.detail.force);
    };

    window.addEventListener("watch:like", handler);

    return () => {
      window.removeEventListener("watch:like", handler);
    };
  }, [doLike]);

  const doBookmark = async (reelId) => {
    if (!user) {
      return toast("Log in to bookmark reels", "info");
    }

    const wasBookmarked = !!bookmarked[reelId];

    setBookmarked((previous) => ({
      ...previous,
      [reelId]: !wasBookmarked,
    }));

    try {
      if (wasBookmarked) {
        await bookmarksApi.remove(reelId);
        toast("Removed bookmark", "success", 1500);
      } else {
        await bookmarksApi.add(reelId);
        toast("Bookmarked", "success", 1500);
      }
    } catch {
      setBookmarked((previous) => ({
        ...previous,
        [reelId]: wasBookmarked,
      }));

      toast("Couldn't update bookmark", "error");
    }
  };

  const doShare = async (reel) => {
    const url = `${window.location.origin}/reels/${reel._id}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: reel.title, url });
      } catch {
        // Sharing was cancelled or is unavailable.
      }
    } else {
      try {
        await navigator.clipboard.writeText(url);
        toast("Link copied to clipboard", "success");
      } catch {
        toast("Couldn't copy link", "error");
      }
    }
  };

  // Keep mouse-wheel gestures to one reel at a time.
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    let locked = false;
    let lockStart = 0;
    let lastWheel = 0;

    const onWheel = (event) => {
      event.preventDefault();

      const now = performance.now();
      const gap = now - lastWheel;
      lastWheel = now;

      if (locked) {
        if (gap > 140 && now - lockStart > 450) {
          locked = false;
        } else {
          return;
        }
      }

      if (Math.abs(event.deltaY) < 8) return;

      const { activeIndex: current, count, go } = navRef.current;
      const next = Math.max(
        0,
        Math.min(count - 1, current + (event.deltaY > 0 ? 1 : -1))
      );

      locked = true;
      lockStart = now;

      if (next !== current) go(next);
    };

    element.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      element.removeEventListener("wheel", onWheel);
    };
  }, [reels.length]);

  const scrollToIndex = (index) => {
    itemRefs.current[reels[index]?._id]?.scrollIntoView({
      behavior: "smooth",
    });
  };

  const handleEnded = (index) => {
    const reel = reels[index];

    if (user && reel) {
      reelsApi
        .updateProgress(reel._id, {
          watchedSeconds: reel.duration || 0,
          completed: true,
        })
        .catch(() => {});
    }

    if (index < reels.length - 1) {
      scrollToIndex(index + 1);
    }
  };

  // Keyboard shortcuts.
  useEffect(() => {
    const onKey = (event) => {
      if (["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName)) {
        return;
      }

      if (event.code === "Space") {
        event.preventDefault();

        const video = videoRefs.current[activeReel?._id];

        if (video) {
          if (video.paused) video.play().catch(() => {});
          else video.pause();
        }
      } else if (event.key === "ArrowDown") {
        event.preventDefault();

        if (activeIndex < reels.length - 1) {
          scrollToIndex(activeIndex + 1);
        }
      } else if (event.key === "ArrowUp") {
        event.preventDefault();

        if (activeIndex > 0) {
          scrollToIndex(activeIndex - 1);
        }
      } else if (event.key.toLowerCase() === "l" && activeReel) {
        doLike(activeReel._id);
      } else if (event.key.toLowerCase() === "b" && activeReel) {
        doBookmark(activeReel._id);
      }
    };

    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [activeIndex, activeReel, reels, doLike]);

  if (!reels.length) {
    return (
      <div className="h-[100dvh] w-full bg-black flex items-center justify-center">
        <div className="h-10 w-10 rounded-full border-2 border-brand-400 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="relative h-[100dvh] w-full bg-black overflow-hidden">
      <Link
        to="/"
        className="absolute top-4 left-4 z-30 text-white bg-black/40 rounded-full p-2 hover:bg-black/60"
      >
        <ArrowLeft className="h-5 w-5" />
      </Link>

      <div className="absolute top-4 right-4 z-30 flex flex-col items-end gap-2">
        <button
          onClick={() => setMuted((previous) => !previous)}
          className="text-white bg-black/40 rounded-full p-2 hover:bg-black/60"
          aria-label={muted ? "Unmute videos" : "Mute videos"}
        >
          {muted ? (
            <VolumeX className="h-5 w-5" />
          ) : (
            <Volume2 className="h-5 w-5" />
          )}
        </button>

        <div className="relative">
          <button
            onClick={() => setSpeedMenuOpen((open) => !open)}
            className="text-white bg-black/40 rounded-full p-2 hover:bg-black/60 flex items-center gap-1"
            aria-label="Playback speed"
          >
            <Gauge className="h-5 w-5" />
          </button>

          {speedMenuOpen && (
            <div className="absolute right-0 mt-1 bg-black/80 rounded-xl p-1.5 flex flex-col gap-0.5 animate-scale-in">
              {SPEEDS.map((value) => (
                <button
                  key={value}
                  onClick={() => {
                    setSpeed(value);
                    setSpeedMenuOpen(false);
                  }}
                  className={`px-3 py-1 rounded-lg text-xs text-white ${
                    speed === value
                      ? "bg-brand-600"
                      : "hover:bg-white/10"
                  }`}
                >
                  {value}x
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="hidden md:flex flex-col gap-2 absolute top-1/2 -translate-y-1/2 left-4 z-30 text-white/40 text-xs">
        <ChevronUp className="h-4 w-4" />
        <span>&darr;</span>
      </div>

      <div
        ref={containerRef}
        className="h-full w-full overflow-y-scroll snap-y snap-mandatory overscroll-contain no-scrollbar"
      >
        {reels.map((reel, index) => (
          <div
            key={reel._id}
            ref={(element) => {
              itemRefs.current[reel._id] = element;
            }}
            data-index={index}
          >
            <ReelPlayer
              reel={reel}
              active={index === activeIndex}
              muted={muted}
              speed={speed}
              onEnded={() => handleEnded(index)}
              registerVideoRef={registerVideoRef}
            />
          </div>
        ))}
      </div>

      {/* Action buttons */}
      {activeReel && (
        <div className="absolute right-3 bottom-28 md:bottom-16 z-30 flex flex-col items-center gap-5 text-white">
          <button
            onClick={() => doLike(activeReel._id)}
            className="flex flex-col items-center gap-1"
          >
            <div
              className={`h-11 w-11 rounded-full flex items-center justify-center ${
                liked[activeReel._id]
                  ? "bg-accent-500"
                  : "bg-black/40"
              }`}
            >
              <Heart
                className="h-5 w-5"
                fill={liked[activeReel._id] ? "white" : "none"}
              />
            </div>

            <span className="text-xs">
              {likeCounts[activeReel._id] ?? 0}
            </span>
          </button>

          <button
            onClick={() => doBookmark(activeReel._id)}
            className="flex flex-col items-center gap-1"
          >
            <div
              className={`h-11 w-11 rounded-full flex items-center justify-center ${
                bookmarked[activeReel._id]
                  ? "bg-brand-500"
                  : "bg-black/40"
              }`}
            >
              <Bookmark
                className="h-5 w-5"
                fill={bookmarked[activeReel._id] ? "white" : "none"}
              />
            </div>

            <span className="text-xs">Save</span>
          </button>

          <button
            onClick={() => setSheet("comments")}
            className="flex flex-col items-center gap-1"
          >
            <div className="h-11 w-11 rounded-full bg-black/40 flex items-center justify-center">
              <MessageCircle className="h-5 w-5" />
            </div>

            <span className="text-xs">Chat</span>
          </button>

          <button
            onClick={() => doShare(activeReel)}
            className="flex flex-col items-center gap-1"
          >
            <div className="h-11 w-11 rounded-full bg-black/40 flex items-center justify-center">
              <Share2 className="h-5 w-5" />
            </div>

            <span className="text-xs">Share</span>
          </button>

          <button
            onClick={() => setSheet("tutor")}
            className="flex flex-col items-center gap-1"
          >
            <div className="h-11 w-11 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
              <Sparkles className="h-5 w-5" />
            </div>

            <span className="text-xs">AI</span>
          </button>
        </div>
      )}

      <BottomSheet
        open={!!sheet}
        onClose={() => setSheet(null)}
        title={
          sheet === "tutor"
            ? "AI Tutor"
            : sheet === "notes"
              ? "AI Notes"
              : sheet === "quiz"
                ? "AI Quiz"
                : "Comments"
        }
      >
        {activeReel && sheet === "tutor" && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <button
                onClick={() => setSheet("tutor")}
                className="badge bg-brand-600 text-white"
              >
                Tutor
              </button>

              <button
                onClick={() => setSheet("notes")}
                className="badge bg-black/5 dark:bg-white/10"
              >
                Notes
              </button>

              <button
                onClick={() => setSheet("quiz")}
                className="badge bg-black/5 dark:bg-white/10"
              >
                Quiz
              </button>
            </div>

            <AIChatbot
              reelId={activeReel._id}
              reelTitle={activeReel.title}
            />
          </div>
        )}

        {activeReel && sheet === "notes" && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <button
                onClick={() => setSheet("tutor")}
                className="badge bg-black/5 dark:bg-white/10"
              >
                Tutor
              </button>

              <button
                onClick={() => setSheet("notes")}
                className="badge bg-brand-600 text-white"
              >
                Notes
              </button>

              <button
                onClick={() => setSheet("quiz")}
                className="badge bg-black/5 dark:bg-white/10"
              >
                Quiz
              </button>
            </div>

            <AINotes reelId={activeReel._id} />
          </div>
        )}

        {activeReel && sheet === "quiz" && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <button
                onClick={() => setSheet("tutor")}
                className="badge bg-black/5 dark:bg-white/10"
              >
                Tutor
              </button>

              <button
                onClick={() => setSheet("notes")}
                className="badge bg-black/5 dark:bg-white/10"
              >
                Notes
              </button>

              <button
                onClick={() => setSheet("quiz")}
                className="badge bg-brand-600 text-white"
              >
                Quiz
              </button>
            </div>

            <AIQuiz reelId={activeReel._id} />
          </div>
        )}

        {activeReel && sheet === "comments" && (
          <CommentSection reelId={activeReel._id} />
        )}
      </BottomSheet>
    </div>
  );
};

export default Watch;
