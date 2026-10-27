
import { forwardRef, useState } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { mediaUrl } from "../services/api";

const VideoPlayer = forwardRef(
  ({ src, poster, className = "", ...rest }, ref) => {
    const [failed, setFailed] = useState(null);
    const [attempt, setAttempt] = useState(0);

    const describe = (e) => {
      const code = e.currentTarget?.error?.code;

      if (code === 4) {
        return "This video file is missing or its format isn't supported by your browser.";
      }

      if (code === 2) {
        return "A network error interrupted the video. Check your connection and retry.";
      }

      return "The video couldn't be played.";
    };

    const videoSrc = mediaUrl(src);
    const posterSrc = mediaUrl(poster);

    if (!videoSrc) {
      return <FallBack message="This lesson has no video file attached." />;
    }

    if (failed) {
      return (
        <FallBack
          message={failed}
          action={
            <button
              className="btn-secondary mt-3"
              onClick={() => {
                setFailed(null);
                setAttempt((a) => a + 1);
              }}
            >
              <RotateCcw className="h-4 w-4" />
              Try again
            </button>
          }
        />
      );
    }

    return (
      <video
        key={attempt}
        ref={ref}
        src={videoSrc}
        poster={posterSrc || undefined}
        controls
        playsInline
        preload="metadata"
        className={`w-full h-full ${className}`}
        onError={(e) => setFailed(describe(e))}
        {...rest}
      />
    );
  }
);

VideoPlayer.displayName = "VideoPlayer";

const FallBack = ({ message, action }) => (
  <div className="h-full w-full min-h-[220px] flex flex-col items-center justify-center text-center p-6 bg-surface-card-dark text-ink-dark">
    <AlertTriangle className="h-8 w-8 text-gold-400 mb-2" />
    <p className="text-sm max-w-xs">{message}</p>
    {action}
  </div>
);

export default VideoPlayer;
