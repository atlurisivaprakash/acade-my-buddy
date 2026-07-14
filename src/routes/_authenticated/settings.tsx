import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, SectionTitle, Button, Input } from "@/components/ui-primitives";
import { Loader2, FileDown, FileSpreadsheet, Database, ShieldCheck, MailCheck, LogOut } from "lucide-react";
import { exportAttendancePdf, exportMarksPdf, exportAllExcel, backupJson } from "@/lib/exports";
import { InstallAppButton } from "@/components/install-app-button";
import { useNavigate } from "@tanstack/react-router";
import { z } from "zod";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — ScholarOS" }] }),
  component: SettingsPage,
});

const DAYS = [
  { v: 1, l: "Mon" },
  { v: 2, l: "Tue" },
  { v: 3, l: "Wed" },
  { v: 4, l: "Thu" },
  { v: 5, l: "Fri" },
  { v: 6, l: "Sat" },
  { v: 0, l: "Sun" },
];

function SettingsPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [classesPerDay, setClassesPerDay] = useState(6);
  const [workingDays, setWorkingDays] = useState<number[]>([1, 2, 3, 4, 5, 6]);
  const [semester, setSemester] = useState<number>(1);
  const [academicYear, setAcademicYear] = useState<string>("");
  const [attendanceTarget, setAttendanceTarget] = useState<number>(75);
  const [emailConfirmed, setEmailConfirmed] = useState<boolean>(false);
  const [userEmail, setUserEmail] = useState<string>("");
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [changingPw, setChangingPw] = useState(false);
  const [resendingVerif, setResendingVerif] = useState(false);
  const [signingOutAll, setSigningOutAll] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) return;
      setUserEmail(userRes.user.email ?? "");
      setEmailConfirmed(Boolean(userRes.user.email_confirmed_at || userRes.user.confirmed_at));
      const { data } = await supabase
        .from("profiles")
        .select("classes_per_day,working_days,semester,academic_year,attendance_target")
        .eq("id", userRes.user.id)
        .maybeSingle();
      if (data) {
        setClassesPerDay(data.classes_per_day ?? 6);
        setWorkingDays(data.working_days ?? [1, 2, 3, 4, 5, 6]);
        setSemester(data.semester ?? 1);
        setAcademicYear(data.academic_year ?? "");
        setAttendanceTarget(Number(data.attendance_target ?? 75));
      }
      setLoading(false);
    })();
  }, []);

  async function save() {
    setSaving(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) throw new Error("Not signed in");
      const { error } = await supabase
        .from("profiles")
        .update({
          classes_per_day: classesPerDay,
          working_days: workingDays,
          semester,
          academic_year: academicYear || null,
          attendance_target: attendanceTarget,
        })
        .eq("id", userRes.user.id);
      if (error) throw error;
      toast.success("Settings saved.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  function toggleDay(d: number) {
    setWorkingDays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort(),
    );
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
      <SectionTitle
        title="Academic settings"
        subtitle="Your timetable and attendance goals adapt to these values."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h3 className="mb-4 text-base font-semibold">Timetable</h3>
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Classes per day
              </label>
              <Input
                type="number"
                min={1}
                max={12}
                value={classesPerDay}
                onChange={(e) => setClassesPerDay(Number(e.target.value) || 1)}
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Working days
              </label>
              <div className="flex flex-wrap gap-2">
                {DAYS.map((d) => {
                  const on = workingDays.includes(d.v);
                  return (
                    <button
                      key={d.v}
                      onClick={() => toggleDay(d.v)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                        on
                          ? "border-brand bg-brand-soft text-brand"
                          : "border-hairline text-muted-foreground hover:bg-surface-alt"
                      }`}
                    >
                      {d.l}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </Card>
        <Card>
          <h3 className="mb-4 text-base font-semibold">Academic term</h3>
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Current semester
              </label>
              <Input
                type="number"
                min={1}
                max={12}
                value={semester}
                onChange={(e) => setSemester(Number(e.target.value) || 1)}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Academic year
              </label>
              <Input
                placeholder="2025–26"
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Attendance target ({attendanceTarget}%)
              </label>
              <input
                type="range"
                min={50}
                max={100}
                step={1}
                value={attendanceTarget}
                onChange={(e) => setAttendanceTarget(Number(e.target.value))}
                className="w-full accent-brand"
              />
            </div>
          </div>
        </Card>
      </div>
      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          {saving && <Loader2 className="size-4 animate-spin" />}
          {saving ? "Saving…" : "Save settings"}
        </Button>
      </div>

      <Card>
        <h3 className="mb-1 text-base font-semibold">Data management</h3>
        <p className="mb-4 text-sm text-muted-foreground">
          Export your academic data or back it up. All exports are generated in your browser.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => wrap(exportAttendancePdf, "Attendance PDF ready")}>
            <FileDown className="size-4" />
            Attendance PDF
          </Button>
          <Button variant="secondary" onClick={() => wrap(exportMarksPdf, "Marks PDF ready")}>
            <FileDown className="size-4" />
            Marks PDF
          </Button>
          <Button variant="secondary" onClick={() => wrap(exportAllExcel, "Excel workbook ready")}>
            <FileSpreadsheet className="size-4" />
            Excel backup
          </Button>
          <Button variant="secondary" onClick={() => wrap(backupJson, "JSON backup ready")}>
            <Database className="size-4" />
            JSON backup
          </Button>
        </div>
      </Card>
    </div>
  );
}

function wrap(fn: () => Promise<void>, ok: string) {
  return fn()
    .then(() => toast.success(ok))
    .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Export failed"));
}