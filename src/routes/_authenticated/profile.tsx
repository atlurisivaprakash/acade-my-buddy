import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, SectionTitle, Button, Input } from "@/components/ui-primitives";
import { Loader2, UserRound, Upload } from "lucide-react";
import { initials } from "@/lib/academic";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Profile — ScholarOS" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uid, setUid] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [rollNo, setRollNo] = useState("");
  const [department, setDepartment] = useState("");
  const [college, setCollege] = useState("");
  const [academicYear, setAcademicYear] = useState("");
  const [branch, setBranch] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarSigned, setAvatarSigned] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) return;
      setUid(userRes.user.id);
      const { data } = await supabase
        .from("profiles")
        .select("full_name,roll_no,department,college_name,academic_year,branch,avatar_url")
        .eq("id", userRes.user.id)
        .maybeSingle();
      if (data) {
        setFullName(data.full_name ?? "");
        setRollNo(data.roll_no ?? "");
        setDepartment(data.department ?? "");
        setCollege(data.college_name ?? "");
        setAcademicYear(data.academic_year ?? "");
        setBranch(data.branch ?? "");
        setAvatarUrl(data.avatar_url ?? null);
        if (data.avatar_url) {
          const { data: signed } = await supabase.storage
            .from("avatars")
            .createSignedUrl(data.avatar_url, 3600);
          if (signed) setAvatarSigned(signed.signedUrl);
        }
      }
      setLoading(false);
    })();
  }, []);

  async function save() {
    if (!uid) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName || null,
          roll_no: rollNo || null,
          department: department || null,
          college_name: college || null,
          academic_year: academicYear || null,
          branch: branch || null,
        })
        .eq("id", uid);
      if (error) throw error;
      toast.success("Profile updated.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !uid) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5 MB.");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${uid}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      // remove old
      if (avatarUrl) await supabase.storage.from("avatars").remove([avatarUrl]);
      await supabase.from("profiles").update({ avatar_url: path }).eq("id", uid);
      setAvatarUrl(path);
      const { data: signed } = await supabase.storage.from("avatars").createSignedUrl(path, 3600);
      if (signed) setAvatarSigned(signed.signedUrl);
      toast.success("Photo updated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  if (loading) {
    return (
      <div className="grid place-items-center py-24 text-muted-foreground">
        <Loader2 className="size-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <SectionTitle title="Your profile" subtitle="Personal details used across ScholarOS." />
      <Card>
        <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
          <div className="relative">
            <div className="grid size-24 place-items-center overflow-hidden rounded-full bg-brand-soft text-2xl font-bold text-brand">
              {avatarSigned ? (
                <img src={avatarSigned} alt="Avatar" className="size-full object-cover" />
              ) : (
                <span>{initials(fullName || "S")}</span>
              )}
            </div>
          </div>
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-2">
              <UserRound className="size-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Profile picture</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Upload className="size-4" />
                )}
                {uploading ? "Uploading…" : "Upload photo"}
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onFile}
              />
            </div>
          </div>
        </div>
      </Card>
      <Card>
        <div className="grid gap-4 sm:grid-cols-2">
          <LabeledInput label="Full name" value={fullName} onChange={setFullName} />
          <LabeledInput label="Roll number" value={rollNo} onChange={setRollNo} />
          <LabeledInput label="Department" value={department} onChange={setDepartment} />
          <LabeledInput label="Branch" value={branch} onChange={setBranch} />
          <LabeledInput label="College name" value={college} onChange={setCollege} />
          <LabeledInput
            label="Academic year"
            value={academicYear}
            onChange={setAcademicYear}
            placeholder="2025–26"
          />
        </div>
        <div className="mt-6 flex justify-end">
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            {saving ? "Saving…" : "Save profile"}
          </Button>
        </div>
      </Card>
    </div>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </label>
  );
}