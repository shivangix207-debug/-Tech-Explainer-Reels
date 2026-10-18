import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Award, Users, Zap, UserPlus, UserMinus } from "lucide-react";
import { socialApi } from "../services/endpoints";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { BADGE_LABELS } from "../utils/badges";
import Spinner from "../components/Spinner";

const PublicProfile = () => {
  const { id } = useParams();
  const { user: me } = useAuth();
  const toast = useToast();
  const [profile, setProfile] = useState(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isSelf, setIsSelf] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = () =>
    socialApi.profile(id).then(({ data }) => {
      setProfile(data.user);
      setIsFollowing(data.isFollowing);
      setIsSelf(data.isSelf);
    }).finally(() => setLoading(false));

  useEffect(() => { load(); }, [id]);

  const toggleFollow = async () => {
    if (!me) return toast("Log in to follow other learners", "info");
    const was = isFollowing;
    setIsFollowing(!was);
    setProfile((p) => ({ ...p, followerCount: p.followerCount + (was ? -1 : 1) }));
    try {
      await socialApi.toggleFollow(id);
      toast(was ? "Unfollowed" : "Following", "success", 1500);
    } catch {
      setIsFollowing(was);
      setProfile((p) => ({ ...p, followerCount: p.followerCount + (was ? 1 : -1) }));
      toast("Couldn't update follow status", "error");
    }
  };

  if (loading) return <Spinner full />;
  if (!profile) return <div className="text-center py-20">User not found.</div>;

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 py-12">
      <div className="card-elevated p-8 text-center">
        <div className="h-20 w-20 rounded-full bg-brand-600 text-white flex items-center justify-center text-3xl font-bold mx-auto mb-4">
          {profile.name?.[0]?.toUpperCase()}
        </div>
        <h1 className="text-2xl font-display font-bold">{profile.name}</h1>
        {profile.bio && <p className="text-sm text-ink-light/60 dark:text-ink-dark/50 mt-2 max-w-md mx-auto">{profile.bio}</p>}

        <div className="flex items-center justify-center gap-6 mt-5 text-sm">
          <div><p className="font-bold">{profile.followerCount}</p><p className="text-ink-light/50 text-xs">Followers</p></div>
          <div><p className="font-bold">{profile.followingCount}</p><p className="text-ink-light/50 text-xs">Following</p></div>
          <div><p className="font-bold">Lvl {profile.level}</p><p className="text-ink-light/50 text-xs">{profile.xp} XP</p></div>
        </div>

        {!isSelf && (
          <button onClick={toggleFollow} className={isFollowing ? "btn-secondary mt-6" : "btn-primary mt-6"}>
            {isFollowing ? <><UserMinus className="h-4 w-4" /> Unfollow</> : <><UserPlus className="h-4 w-4" /> Follow</>}
          </button>
        )}

        {profile.badges?.length > 0 && (
          <div className="mt-8">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-light/40 mb-3">Badges</p>
            <div className="flex flex-wrap justify-center gap-2">
              {profile.badges.map((b) => (
                <span key={b.key} className="badge-gold gap-1"><Award className="h-3 w-3" /> {BADGE_LABELS[b.key] || b.key}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PublicProfile;
