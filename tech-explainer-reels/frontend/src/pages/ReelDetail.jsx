import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Heart,
  Bookmark,
  Eye,
  Clock,
  Bot,
  FileText,
  HelpCircle,
  MessageCircle,
  Share2,
  Gauge,
  Film,
  Target,
  ListChecks,
  Layers,
  ShieldAlert,
  Flag,
} from "lucide-react";

import { reelsApi, bookmarksApi } from "../services/endpoints";
import { mediaUrl } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import Spinner from "../components/Spinner";
import ReelCard from "../components/ReelCard";
import AIChatbot from "../components/AIChatbot";
import AINotes from "../components/AINotes";
import AIQuiz from "../components/AIQuiz";
import CommentSection from "../components/CommentSection";
import VideoPlayer from "../components/VideoPlayer";
import StatusBadge from "../components/StatusBadge";

const tabs = [
  { id: "chat", label: "AI Tutor", icon: Bot },
  { id: "notes", label: "Notes", icon: FileText },
  { id: "quiz", label: "Quiz", icon: HelpCircle },
  { id: "comments", label: "Comments", icon: MessageCircle },
];

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

const ReelDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();

  const [reel, setReel] = useState(null);
  const [related, setRelated] = useState([]);
  const [myProgress, setMyProgress] = useState(null);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [bookmarked, setBookmarked] = useState(false);
  const [activeTab, setActiveTab] = useState("chat");
  const [loading, setLoading] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [speedOpen, setSpeedOpen] = useState(false);
  const [resumed, setResumed] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [isPortrait, setIsPortrait] = useState(null);

  const videoRef = useRef(null);
  const lastSavedRef = useRef(0);
  const viewedRef = useRef(false);

  useEffect(() => {
    setLoading(true);
    setActiveTab("chat");
    setResumed(false);

    reelsApi
      .get(id)
      .then(({ data }) => {
        setReel(data.reel);
        setRelated(data.related);
        setMyProgress(data.myProgress);
        setLikeCount(data.reel.likeCount ?? data.reel.likes?.length ?? 0);

        if (user) {
          setLiked(
            data.reel.likes?.some(
              (l) => l === user.id || l._id === user.id
            )
          );
        }
      })
      .finally(() => setLoading(false));

    if (user) {
      bookmarksApi.list().then(({ data }) => {
        setBookmarked(
          data.bookmarks.some((b) => b.reel?._id === id)
        );
      });
    }
  }, [id, user]);

  const handleLoadedMetadata = () => {
    const video = videoRef.current;

    if (video?.videoWidth) {
      setIsPortrait(video.videoHeight > video.videoWidth);
    }

    if (
      !resumed &&
      myProgress?.watchedSeconds > 2 &&
      !myProgress?.completed &&
      videoRef.current
    ) {
      videoRef.current.currentTime = myProgress.watchedSeconds;
      setResumed(true);

      toast(
        `Resumed from ${Math.floor(
          myProgress.watchedSeconds / 60
        )}:${String(myProgress.watchedSeconds % 60).padStart(2, "0")}`,
        "info",
        2500
      );
    }
  };

  const handleLike = async () => {
    if (!user) {
      return navigate("/login", {
        state: { from: `/reels/${id}` },
      });
    }

    const wasLiked = liked;
    setLiked(!wasLiked);
    setLikeCount((count) => count + (wasLiked ? -1 : 1));

    try {
      const { data } = await reelsApi.toggleLike(id);
      setLiked(data.liked);
      setLikeCount(data.likeCount);
    } catch {
      setLiked(wasLiked);
      setLikeCount((count) => count + (wasLiked ? 1 : -1));
      toast("Couldn't update like", "error");
    }
  };

  const handleBookmark = async () => {
    if (!user) {
      return navigate("/login", {
        state: { from: `/reels/${id}` },
      });
    }

    const wasBookmarked = bookmarked;
    setBookmarked(!wasBookmarked);

    try {
      if (wasBookmarked) {
        await bookmarksApi.remove(id);
        toast("Removed bookmark", "success");
      } else {
        await bookmarksApi.add(id);
        toast("Bookmarked", "success");
      }
    } catch {
      setBookmarked(wasBookmarked);
      toast("Couldn't update bookmark", "error");
    }
  };

  const submitReport = async () => {
    try {
      const { data } = await reelsApi.report(id, reportReason);

      toast(
        data.alreadyReported
          ? "You already reported this lesson"
          : "Thanks - we'll review it",
        "success"
      );

      setReportOpen(false);
      setReportReason("");
    } catch (err) {
      toast(
        err.response?.data?.message || "Couldn't send the report",
        "error"
      );
    }
  };

  const handleShare = async () => {
    const url = window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({ title: reel.title, url });
        return;
      } catch {
        // Fall through to clipboard.
      }
    }

    await navigator.clipboard.writeText(url);
    toast("Link copied to clipboard", "success");
  };

  const saveProgress = () => {
    const video = videoRef.current;

    if (!user || !video || !video.duration) return;

    lastSavedRef.current = video.currentTime;

    reelsApi
      .updateProgress(id, {
        watchedSeconds: Math.round(video.currentTime),
      })
      .then(({ data }) => {
        if (data.gamification) {
          toast(
            `Lesson completed! +${data.gamification.xpGained} XP`,
            "success"
          );
        }
      })
      .catch(() => {});
  };

  const handleTimeUpdate = () => {
    const video = videoRef.current;

    if (
      video &&
      !viewedRef.current &&
      video.currentTime >= 3
    ) {
      viewedRef.current = true;
      reelsApi.recordView(id).catch(() => {});
    }

    if (
      video &&
      Math.abs(video.currentTime - lastSavedRef.current) >= 8
    ) {
      saveProgress();
    }
  };

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
  }, [speed]);

  const applyTagFilter = (tag) => {
    navigate(`/reels?tag=${encodeURIComponent(tag)}`);
  };

  if (loading) return <Spinner full />;

  if (!reel) {
    return (
      <div className="text-center py-20">
        Reel not found.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <div className="grid lg:grid-cols-3 gap-8">
        {/* Video and lesson information */}
        <div className="lg:col-span-2 space-y-6">
          <div
            className="relative rounded-2xl overflow-hidden bg-black group mx-auto"
            style={
              (isPortrait ?? reel.videoSource === "generated-slides")
                ? {
                    aspectRatio: "9 / 16",
                    width: "min(100%, calc(78vh * 9 / 16))",
                  }
                : {
                    aspectRatio: "16 / 9",
                    width: "100%",
                  }
            }
          >
            <VideoPlayer
              ref={videoRef}
              src={mediaUrl(reel.videoUrl)}
              poster={mediaUrl(reel.thumbnailUrl)}
              onTimeUpdate={handleTimeUpdate}
              onPause={saveProgress}
              onEnded={saveProgress}
              onLoadedMetadata={handleLoadedMetadata}
            />

            <div className="absolute top-3 right-3">
              <button
                onClick={() => setSpeedOpen((open) => !open)}
                className="text-white bg-black/50 rounded-lg px-2.5 py-1.5 text-xs font-medium flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Gauge className="h-3.5 w-3.5" /> {speed}x
              </button>

              {speedOpen && (
                <div className="absolute right-0 mt-1 bg-black/85 rounded-xl p-1.5 flex flex-col gap-0.5">
                  {SPEEDS.map((value) => (
                    <button
                      key={value}
                      onClick={() => {
                        setSpeed(value);
                        setSpeedOpen(false);
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

          {reel.status && reel.status !== "published" && (
            <div className="flex items-start gap-3 rounded-xl border border-gold-400/40 bg-gold-400/10 p-4 text-sm">
              <ShieldAlert className="h-5 w-5 text-gold-500 shrink-0" />

              <div>
                <p className="font-semibold flex items-center gap-2">
                  Only you (and admins) can see this lesson{" "}
                  <StatusBadge status={reel.status} />
                </p>

                {reel.status === "pending" && (
                  <p className="text-ink-light/70 dark:text-ink-dark/60">
                    It is waiting for admin review before students can watch it.
                  </p>
                )}

                {reel.status === "rejected" && (
                  <p className="text-ink-light/70 dark:text-ink-dark/60">
                    Rejected
                    {reel.rejectionReason
                      ? `: ${reel.rejectionReason}`
                      : "."}{" "}
                    Edit it in Studio to resubmit.
                  </p>
                )}
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span
                className="badge text-white"
                style={{
                  backgroundColor: reel.category?.color || "#7C3AED",
                }}
              >
                {reel.category?.name}
              </span>

              {reel.skillLevel && (
                <span className="badge bg-brand-50 dark:bg-surface-card-dark capitalize">
                  {reel.skillLevel}
                </span>
              )}
            </div>

            {reel.videoSource === "generated-slides" && (
              <span className="badge bg-black/5 dark:bg-white/10 gap-1 mb-2">
                <Layers className="h-3 w-3" />
                Narrated slides - synthetic voice reading the lesson transcript
              </span>
            )}

            <h1 className="text-2xl font-display font-bold">
              {reel.title}
            </h1>

            <div className="flex items-center gap-4 mt-2 text-sm text-ink-light/60 dark:text-ink-dark/50 flex-wrap">
              <span className="flex items-center gap-1">
                <Eye className="h-4 w-4" /> {reel.views} views
              </span>

              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {Math.floor(reel.duration / 60)}:
                {String(reel.duration % 60).padStart(2, "0")}
              </span>

              <span>By {reel.uploadedBy?.name}</span>
            </div>

            <div className="flex items-center gap-3 mt-4 flex-wrap">
              <button
                onClick={handleLike}
                className={`btn-secondary ${
                  liked ? "!border-accent-400 !text-accent-500" : ""
                }`}
              >
                <Heart
                  className={`h-4 w-4 ${
                    liked ? "fill-accent-500 text-accent-500" : ""
                  }`}
                />
                {likeCount}
              </button>

              <button
                onClick={handleBookmark}
                className={`btn-secondary ${
                  bookmarked ? "!border-brand-400 !text-brand-600" : ""
                }`}
              >
                <Bookmark
                  className={`h-4 w-4 ${
                    bookmarked ? "fill-brand-500 text-brand-500" : ""
                  }`}
                />
                {bookmarked ? "Saved" : "Save"}
              </button>

              <button onClick={handleShare} className="btn-secondary">
                <Share2 className="h-4 w-4" /> Share
              </button>

              {user &&
                String(reel.uploadedBy?._id) !== String(user.id) && (
                  <button
                    onClick={() => setReportOpen(true)}
                    className="btn-ghost text-ink-light/60 dark:text-ink-dark/50"
                    aria-label="Report this lesson"
                    title="Report this lesson"
                  >
                    <Flag className="h-4 w-4" />
                  </button>
                )}

              <button
                onClick={() => navigate(`/watch/${id}`)}
                className="btn-primary ml-auto"
              >
                <Film className="h-4 w-4" /> Watch in Feed
              </button>
            </div>

            <p className="mt-4 text-sm text-ink-light/75 dark:text-ink-dark/70 leading-relaxed">
              {reel.description}
            </p>

            {reel.tags?.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {reel.tags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => applyTagFilter(tag)}
                    className="badge bg-brand-50 dark:bg-surface-card-dark text-ink-light/75 dark:text-ink-dark/70 hover:bg-brand-100 dark:hover:bg-surface-border-dark transition-colors"
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            )}
          </div>

          {reel.learningObjective && (
            <div className="card p-4 flex gap-3 text-sm">
              <Target className="h-5 w-5 text-accent-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Learning objective</p>
                <p className="text-ink-light/75 dark:text-ink-dark/70">
                  {reel.learningObjective}
                </p>
              </div>
            </div>
          )}

          {reel.keyTakeaways?.length > 0 && (
            <div className="card p-5">
              <h3 className="font-semibold flex items-center gap-2 mb-3">
                <ListChecks className="h-5 w-5 text-brand-500" />
                Key takeaways
              </h3>

              <ul className="space-y-2 text-sm">
                {reel.keyTakeaways.map((item, index) => (
                  <li key={index} className="flex gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-brand-500 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {reel.transcript && (
            <details className="card p-4 text-sm" open>
              <summary className="cursor-pointer font-semibold">
                Transcript
              </summary>

              <p className="mt-2 text-ink-light/75 dark:text-ink-dark/70 leading-relaxed whitespace-pre-line">
                {reel.transcript}
              </p>
            </details>
          )}

          {reel.interviewQA?.length > 0 && (
            <div className="card p-5">
              <h3 className="font-semibold mb-3">Interview questions</h3>

              <div className="space-y-2">
                {reel.interviewQA.map((qa, index) => (
                  <details
                    key={index}
                    className="rounded-lg border border-surface-border dark:border-surface-border-dark px-3 py-2 text-sm group"
                  >
                    <summary className="cursor-pointer font-medium">
                      {qa.question}
                    </summary>

                    <p className="mt-2 text-ink-light/75 dark:text-ink-dark/70 leading-relaxed">
                      {qa.answer}
                    </p>
                  </details>
                ))}
              </div>
            </div>
          )}

          {related.length > 0 && (
            <div>
              <h3 className="font-semibold mb-3">Related lessons</h3>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {related.map((relatedReel) => (
                  <ReelCard key={relatedReel._id} reel={relatedReel} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* AI Panel */}
        <div>
          <div className="flex gap-1 mb-4 overflow-x-auto card p-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? "bg-brand-600 text-white"
                    : "text-ink-light/60 dark:text-ink-dark/50 hover:bg-brand-50 dark:hover:bg-surface-card-dark"
                }`}
              >
                <tab.icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            ))}
          </div>

          {!user && activeTab !== "comments" ? (
            <div className="card p-6 text-center">
              <p className="text-sm text-ink-light/60 dark:text-ink-dark/50 mb-3">
                Log in to use the AI tutor, notes and quizzes, and to track your progress.
              </p>

              <button
                onClick={() =>
                  navigate("/login", {
                    state: { from: `/reels/${id}` },
                  })
                }
                className="btn-primary"
              >
                Log in
              </button>
            </div>
          ) : (
            <>
              {activeTab === "chat" && (
                <AIChatbot reelId={id} reelTitle={reel.title} />
              )}

              {activeTab === "notes" && <AINotes reelId={id} />}

              {activeTab === "quiz" && (
                <AIQuiz
                  reelId={id}
                  hasLessonQuiz={(reel.quizCount || 0) > 0}
                />
              )}

              {activeTab === "comments" && <CommentSection reelId={id} />}
            </>
          )}
        </div>
      </div>

      {reportOpen && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50"
          role="dialog"
          aria-modal="true"
          aria-label="Report lesson"
        >
          <div className="card-elevated w-full max-w-sm p-6 animate-scale-in">
            <h2 className="font-display font-bold mb-1">
              Report this lesson
            </h2>

            <p className="text-sm text-ink-light/60 dark:text-ink-dark/50 mb-3">
              Why are you reporting it? Several reports hide the lesson until an admin checks it.
            </p>

            <div className="space-y-2" role="radiogroup">
              {[
                ["spam", "Spam or advertising"],
                ["inappropriate", "Inappropriate content"],
                ["misleading", "Wrong or misleading"],
                ["copyright", "Copyright issue"],
                ["other", "Something else"],
              ].map(([value, label]) => (
                <label
                  key={value}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer ${
                    reportReason === value
                      ? "border-brand-500 bg-brand-500/10"
                      : "border-surface-border dark:border-surface-border-dark"
                  }`}
                >
                  <input
                    type="radio"
                    name="report-reason"
                    checked={reportReason === value}
                    onChange={() => setReportReason(value)}
                  />
                  {label}
                </label>
              ))}
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <button
                className="btn-secondary"
                onClick={() => setReportOpen(false)}
              >
                Cancel
              </button>

              <button
                className="btn-primary"
                disabled={!reportReason}
                onClick={submitReport}
              >
                Send report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReelDetail;
