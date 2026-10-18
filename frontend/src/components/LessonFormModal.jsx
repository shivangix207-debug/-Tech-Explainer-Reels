import { useEffect, useRef, useState } from "react";
import { X, UploadCloud, FileVideo, CheckCircle2 } from "lucide-react";
import { reelsApi, uploadApi } from "../services/endpoints";
import { useToast } from "../context/ToastContext";

const MAX_MB = 100; // keep in sync with MAX_UPLOAD_MB on the server (the server's limit is authoritative)
const ALLOWED = [".mp4", ".webm", ".mov"];
const empty = { title: "", description: "", category: "", skillLevel: "beginner", tags: "", learningObjective: "", keyTakeaways: "", transcript: "", videoUrl: "", thumbnailUrl: "", duration: "", status: "published" };
const fmtSize = (b) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

// Create/edit form shared by the creator Studio and the admin lessons page.
const LessonFormModal = ({ open, onClose, categories, editing, isAdmin, onSaved }) => {
  const toast = useToast();
  const [form, setForm] = useState(empty);
  const [file, setFile] = useState(null); // { name, size }
  const [progress, setProgress] = useState(null);
  const [fileError, setFileError] = useState("");
  const [saving, setSaving] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setFileError(""); setProgress(null); setFile(null);
    if (editing) {
      setForm({
        title: editing.title, description: editing.description, category: editing.category?._id || editing.category || "",
        skillLevel: editing.skillLevel || "beginner", tags: (editing.tags || []).join(", "), learningObjective: editing.learningObjective || "",
        keyTakeaways: (editing.keyTakeaways || []).join("\n"), transcript: editing.transcript || "", videoUrl: editing.videoUrl,
        thumbnailUrl: editing.thumbnailUrl || "", duration: editing.duration || "", status: editing.status || "published",
      });
    } else setForm(empty);
  }, [open, editing]);

  if (!open) return null;
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const pickFile = async (f) => {
    if (!f) return;
    setFileError("");
    const ext = f.name.slice(f.name.lastIndexOf(".")).toLowerCase();
    if (!ALLOWED.includes(ext)) return setFileError(`Unsupported file type "${ext}". Use MP4, WebM or MOV.`);
    if (f.size > MAX_MB * 1048576) return setFileError(`File is ${fmtSize(f.size)}; the limit is ${MAX_MB} MB.`);
    setFile({ name: f.name, size: f.size });
    setProgress(0);
    try {
      const { data } = await uploadApi.video(f, setProgress);
      setForm((x) => ({ ...x, videoUrl: data.videoUrl, thumbnailUrl: data.thumbnailUrl || "", duration: data.duration || x.duration }));
      toast("Video uploaded", "success");
    } catch (err) {
      setFile(null);
      setFileError(err.response?.data?.message || "Upload failed. Check your connection and try again.");
    } finally { setProgress(null); }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.videoUrl) return setFileError("Upload a video file before saving.");
    if (!form.duration || Number(form.duration) < 1) return setFileError("Enter the video's duration in seconds (it could not be detected automatically).");
    setSaving(true);
    const payload = {
      title: form.title, description: form.description, category: form.category, skillLevel: form.skillLevel,
      tags: form.tags, learningObjective: form.learningObjective, keyTakeaways: form.keyTakeaways, transcript: form.transcript,
      videoUrl: form.videoUrl, thumbnailUrl: form.thumbnailUrl, duration: Number(form.duration),
      ...(isAdmin ? { status: form.status } : {}),
    };
    try {
      const { data } = editing ? await reelsApi.update(editing._id, payload) : await reelsApi.create(payload);
      const st = data.reel?.status;
      if (isAdmin) toast(editing ? "Lesson updated" : "Lesson saved", "success");
      else if (st === "published") toast("Published! Your track record lets clean lessons go live instantly.", "success", 5000);
      else if (st === "rejected") toast(data.reel.rejectionReason || "This lesson was rejected", "error", 6000);
      else toast("Submitted - it's in the review queue", "success");
      onSaved();
      onClose();
    } catch (err) {
      toast(err.response?.data?.message || "Couldn't save the lesson", "error");
    } finally { setSaving(false); }
  };

  const uploading = progress !== null;
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in" role="dialog" aria-modal="true">
      <div className="card-elevated w-full max-w-2xl max-h-[92vh] overflow-y-auto p-6 animate-scale-in">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-display font-bold">{editing ? "Edit lesson" : "New lesson"}</h2>
          <button onClick={onClose} aria-label="Close"><X className="h-5 w-5" /></button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          {/* Video */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); pickFile(e.dataTransfer.files[0]); }}
            onClick={() => !uploading && inputRef.current?.click()}
            className={`rounded-xl border-2 border-dashed p-5 text-center cursor-pointer transition-colors ${dragOver ? "border-brand-500 bg-brand-500/10" : "border-surface-border dark:border-surface-border-dark hover:border-brand-400"}`}
          >
            <input ref={inputRef} type="file" accept=".mp4,.webm,.mov,video/mp4,video/webm,video/quicktime" hidden onChange={(e) => pickFile(e.target.files[0])} />
            {file ? (
              <div className="flex items-center justify-center gap-2 text-sm">
                {uploading ? <FileVideo className="h-5 w-5 text-brand-500" /> : <CheckCircle2 className="h-5 w-5 text-success" />}
                <span className="font-medium truncate max-w-[16rem]">{file.name}</span><span className="text-ink-light/55 dark:text-ink-dark/50">{fmtSize(file.size)}</span>
              </div>
            ) : form.videoUrl ? (
              <p className="text-sm flex items-center justify-center gap-2"><CheckCircle2 className="h-5 w-5 text-success" /> Video attached - drop a new file to replace it</p>
            ) : (
              <>
                <UploadCloud className="h-7 w-7 mx-auto text-brand-500 mb-1" />
                <p className="text-sm font-medium">Drag & drop a video, or click to browse</p>
                <p className="text-xs text-ink-light/55 dark:text-ink-dark/50">MP4, WebM or MOV - up to {MAX_MB} MB</p>
              </>
            )}
            {uploading && (
              <div className="mt-3" aria-live="polite">
                <div className="h-1.5 rounded-full bg-surface-border dark:bg-surface-border-dark overflow-hidden"><div className="h-full bg-brand-500 transition-[width]" style={{ width: `${progress}%` }} /></div>
                <p className="text-xs mt-1 text-ink-light/60 dark:text-ink-dark/50">Uploading... {progress}%</p>
              </div>
            )}
          </div>
          {fileError && <p role="alert" className="text-sm text-error">{fileError}</p>}

          <input required minLength={3} maxLength={120} placeholder="Title" className="input" value={form.title} onChange={set("title")} />
          <textarea required minLength={10} maxLength={600} rows={2} placeholder="Short description" className="input" value={form.description} onChange={set("description")} />
          <div className="grid sm:grid-cols-3 gap-3">
            <select required className="input" value={form.category} onChange={set("category")}>
              <option value="">Category</option>
              {categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
            <select className="input" value={form.skillLevel} onChange={set("skillLevel")}>
              <option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option>
            </select>
            <input type="number" min="1" placeholder="Duration (sec)" className="input" value={form.duration} onChange={set("duration")} />
          </div>
          <input placeholder="Tags, comma separated (e.g. react, hooks)" className="input" value={form.tags} onChange={set("tags")} />
          <input maxLength={300} placeholder="Learning objective (optional)" className="input" value={form.learningObjective} onChange={set("learningObjective")} />
          <textarea rows={3} placeholder="Key takeaways - one per line (optional)" className="input" value={form.keyTakeaways} onChange={set("keyTakeaways")} />
          <textarea rows={5} placeholder="Transcript or lesson notes - the AI tutor, notes and quizzes are grounded in this" className="input" value={form.transcript} onChange={set("transcript")} />

          {isAdmin ? (
            <select className="input" value={form.status} onChange={set("status")}>
              <option value="published">Published</option><option value="pending">Pending review</option><option value="draft">Draft</option>
            </select>
          ) : (
            <p className="text-xs text-ink-light/60 dark:text-ink-dark/50">Lessons are screened automatically. Trusted creators publish instantly; everyone else is reviewed by an admin first.</p>
          )}

          <button type="submit" disabled={saving || uploading} className="btn-primary w-full">
            {saving ? "Saving..." : uploading ? "Wait for upload to finish..." : editing ? "Save changes" : isAdmin ? "Save lesson" : "Submit for review"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LessonFormModal;
