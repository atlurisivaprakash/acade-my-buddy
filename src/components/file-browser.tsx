import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, Button, Input, Select, EmptyState, SectionTitle, Badge } from "@/components/ui-primitives";
import { toast } from "sonner";
import { formatBytes, type FileRow } from "@/lib/academic";
import {
  Upload,
  Search,
  Download,
  Trash2,
  FileText,
  FileImage,
  File as FileIcon,
  Eye,
} from "lucide-react";

type Category = "material" | "question_paper" | "document" | "note";

export function FileBrowser({
  category,
  title,
  subtitle,
  showSubject = true,
  showSemester = false,
}: {
  category: Category;
  title: string;
  subtitle: string;
  showSubject?: boolean;
  showSemester?: boolean;
}) {
  const qc = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [uploading, setUploading] = useState(false);
  const [pendingSubject, setPendingSubject] = useState("");
  const [pendingDesc, setPendingDesc] = useState("");
  const [pendingTags, setPendingTags] = useState("");
  const [pendingSemester, setPendingSemester] = useState("");

  const { data: files = [] } = useQuery({
    queryKey: ["files", category],
    queryFn: async () =>
      (
        await supabase
          .from("files")
          .select("*")
          .eq("category", category)
          .order("created_at", { ascending: false })
      ).data ?? [],
  });
  const { data: subjects = [] } = useQuery({
    queryKey: ["subjects"],
    queryFn: async () => (await supabase.from("subjects").select("*").order("name")).data ?? [],
  });

  async function upload(fileList: FileList) {
    setUploading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      for (const f of Array.from(fileList)) {
        const path = `${u.user.id}/${category}/${Date.now()}-${f.name.replace(/[^\w.-]+/g, "_")}`;
        const { error: upErr } = await supabase.storage
          .from("student-files")
          .upload(path, f, { upsert: false });
        if (upErr) throw upErr;
        const { error: dbErr } = await supabase.from("files").insert({
          user_id: u.user.id,
          subject_id: pendingSubject || null,
          name: f.name,
          storage_path: path,
          category,
          mime_type: f.type || null,
          size_bytes: f.size,
          description: pendingDesc || null,
          tags: pendingTags
            ? pendingTags.split(",").map((t) => t.trim()).filter(Boolean)
            : null,
          semester: pendingSemester ? Number(pendingSemester) : null,
        });
        if (dbErr) throw dbErr;
      }
      toast.success(`Uploaded ${fileList.length} file${fileList.length === 1 ? "" : "s"}`);
      setPendingDesc("");
      setPendingTags("");
      qc.invalidateQueries();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function download(f: FileRow) {
    const { data, error } = await supabase.storage
      .from("student-files")
      .createSignedUrl(f.storage_path, 60);
    if (error || !data) return toast.error(error?.message ?? "Failed");
    window.open(data.signedUrl, "_blank");
  }
  async function preview(f: FileRow) {
    const { data, error } = await supabase.storage
      .from("student-files")
      .createSignedUrl(f.storage_path, 300);
    if (error || !data) return toast.error(error?.message ?? "Failed");
    window.open(data.signedUrl, "_blank", "noopener");
  }
  async function remove(f: FileRow) {
    if (!confirm(`Delete "${f.name}"?`)) return;
    await supabase.storage.from("student-files").remove([f.storage_path]);
    await supabase.from("files").delete().eq("id", f.id);
    qc.invalidateQueries();
    toast.success("Deleted");
  }

  const filtered = useMemo(() => {
    const ql = q.toLowerCase();
    return files.filter((f) => {
      if (subjectFilter && f.subject_id !== subjectFilter) return false;
      if (!ql) return true;
      return (
        f.name.toLowerCase().includes(ql) ||
        (f.description ?? "").toLowerCase().includes(ql) ||
        (f.tags ?? []).some((t) => t.toLowerCase().includes(ql))
      );
    });
  }, [files, q, subjectFilter]);

  const bySubject: Record<string, FileRow[]> = {};
  for (const f of filtered) {
    const key = f.subject_id ?? "__none";
    (bySubject[key] ||= []).push(f);
  }

  return (
    <div className="space-y-6">
      <Card>
        <SectionTitle title={title} subtitle={subtitle} />
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          {showSubject && (
            <Select
              value={pendingSubject}
              onChange={(e) => setPendingSubject(e.target.value)}
            >
              <option value="">No subject</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          )}
          <Input
            placeholder="Tags (comma-separated)"
            value={pendingTags}
            onChange={(e) => setPendingTags(e.target.value)}
          />
          <Button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={uploading}
          >
            <Upload className="size-4" /> {uploading ? "Uploading…" : "Upload"}
          </Button>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Input
            placeholder="Short description (optional)"
            value={pendingDesc}
            onChange={(e) => setPendingDesc(e.target.value)}
          />
          {showSemester && (
            <Input
              type="number"
              min={1}
              max={12}
              placeholder="Semester (optional)"
              value={pendingSemester}
              onChange={(e) => setPendingSemester(e.target.value)}
            />
          )}
        </div>
        <input
          ref={fileInput}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && upload(e.target.files)}
        />
      </Card>

      <Card>
        <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_240px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search files, tags, descriptions…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9"
            />
          </div>
          {showSubject && (
            <Select
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
            >
              <option value="">All subjects</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          )}
        </div>
        {filtered.length === 0 ? (
          <EmptyState
            title="No files yet"
            description="Upload files above to get started. They're organized by subject."
          />
        ) : (
          <div className="space-y-6">
            {Object.entries(bySubject).map(([sid, list]) => {
              const subj = subjects.find((s) => s.id === sid);
              return (
                <div key={sid}>
                  {showSubject && (
                    <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                      {subj?.name ?? "Unfiled"} · {list.length}
                    </h3>
                  )}
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {list.map((f) => (
                      <li
                        key={f.id}
                        className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-hairline bg-surface-alt/40 p-3 transition hover:bg-surface-alt"
                      >
                        <FileTypeIcon mime={f.mime_type} name={f.name} />
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold">{f.name}</div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
                            <span className="font-mono uppercase">
                              {formatBytes(f.size_bytes)}
                            </span>
                            {f.semester && <Badge tone="neutral">Sem {f.semester}</Badge>}
                            {(f.tags ?? []).slice(0, 3).map((t) => (
                              <Badge key={t} tone="brand">
                                {t}
                              </Badge>
                            ))}
                          </div>
                          {f.description && (
                            <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                              {f.description}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => preview(f)}
                            className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-surface hover:text-foreground"
                            title="Preview"
                          >
                            <Eye className="size-4" />
                          </button>
                          <button
                            onClick={() => download(f)}
                            className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-surface hover:text-foreground"
                            title="Download"
                          >
                            <Download className="size-4" />
                          </button>
                          <button
                            onClick={() => remove(f)}
                            className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-surface hover:text-[color:var(--danger)]"
                            title="Delete"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

function FileTypeIcon({ mime, name }: { mime: string | null; name: string }) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const isImg = mime?.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp"].includes(ext);
  const isPdf = mime === "application/pdf" || ext === "pdf";
  const bg = isPdf
    ? "bg-danger-soft text-[color:var(--danger)]"
    : isImg
      ? "bg-accent-emerald-soft text-[color:var(--accent-emerald)]"
      : "bg-brand-soft text-brand";
  const Icon = isImg ? FileImage : isPdf ? FileText : FileIcon;
  return (
    <div className={`grid size-10 shrink-0 place-items-center rounded-xl ${bg}`}>
      <Icon className="size-5" />
    </div>
  );
}