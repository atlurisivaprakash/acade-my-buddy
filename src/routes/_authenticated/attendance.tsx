import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, Button, Badge, EmptyState, SectionTitle, Select } from "@/components/ui-primitives";
import { toast } from "sonner";
import {
  format,
  subDays,
  startOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  addMonths,
  getDay,
  isSameMonth,
  isToday,
} from "date-fns";
import {
  attendancePct,
  classesNeeded,
  classesCanSkip,
  predictAttendance,
  statusTone,
  DAYS,
  type AttendanceStatus,
} from "@/lib/academic";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { Check, X, Coffee, ChevronLeft, ChevronRight, Coffee as BreakIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/attendance")({
  head: () => ({ meta: [{ title: "Attendance — ScholarOS" }] }),
  component: AttendancePage,
});

function AttendancePage() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["attendance-page"],
    queryFn: async () => {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      const [s, a, slots, prof] = await Promise.all([
        supabase.from("subjects").select("*").order("name"),
        supabase.from("attendance").select("*").order("date", { ascending: false }),
        supabase.from("timetable_slots").select("*"),
        uid
          ? supabase
              .from("profiles")
              .select("attendance_target,classes_per_day,working_days")
              .eq("id", uid)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      return {
        subjects: s.data ?? [],
        attendance: a.data ?? [],
        slots: slots.data ?? [],
        profile: prof.data ?? null,
      };
    },
  });
  const [date, setDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const subjects = data?.subjects ?? [];
  const attendance = data?.attendance ?? [];
  const slots = data?.slots ?? [];
  const target = Number(data?.profile?.attendance_target ?? 75);
  const classesPerDay = data?.profile?.classes_per_day ?? 6;
  const workingDays: number[] = data?.profile?.working_days ?? [1, 2, 3, 4, 5, 6];

  const dayRows = attendance.filter((a) => a.date === date);
  const dayOfWeek = new Date(`${date}T00:00:00`).getDay();
  const isWorkingDay = workingDays.includes(dayOfWeek);
  const daySlots = slots.filter((s) => s.day_of_week === dayOfWeek);

  const periodsToShow = Array.from({ length: classesPerDay }, (_, i) => i + 1);

  async function mark(subjectId: string, period: number, status: AttendanceStatus) {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const existing = dayRows.find((r) => r.period === period);
    if (existing) {
      const { error } = await supabase
        .from("attendance")
        .update({ status, subject_id: subjectId })
        .eq("id", existing.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("attendance").insert({
        user_id: u.user.id,
        subject_id: subjectId,
        date,
        period,
        status,
      });
      if (error) return toast.error(error.message);
    }
    qc.invalidateQueries();
  }

  async function clearPeriod(period: number) {
    const existing = dayRows.find((r) => r.period === period);
    if (!existing) return;
    await supabase.from("attendance").delete().eq("id", existing.id);
    qc.invalidateQueries();
  }

  const overall = attendancePct(attendance);
  const today = new Date();
  const daily = attendancePct(attendance.filter((a) => a.date === format(today, "yyyy-MM-dd")));
  const weekly = attendancePct(
    attendance.filter((a) => new Date(a.date) >= startOfWeek(today, { weekStartsOn: 1 })),
  );
  const monthly = attendancePct(
    attendance.filter((a) => new Date(a.date) >= startOfMonth(today)),
  );

  const trend = useMemo(() => {
    const days: { date: string; pct: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = format(subDays(today, i), "yyyy-MM-dd");
      const rows = attendance.filter((a) => a.date <= d);
      const { pct } = attendancePct(rows);
      days.push({ date: format(subDays(today, i), "d MMM"), pct: Number(pct.toFixed(1)) });
    }
    return days;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attendance]);

  const perSubject = subjects.map((s) => {
    const rows = attendance.filter((a) => a.subject_id === s.id);
    const { pct, present, total } = attendancePct(rows);
    return { ...s, pct, present, total };
  });

  const [predictAttend, setPredictAttend] = useState(5);
  const [predictSkip, setPredictSkip] = useState(0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricPill label="Overall" pct={overall.pct} count={`${overall.present}/${overall.total}`} />
        <MetricPill label="Today" pct={daily.pct} count={`${daily.present}/${daily.total}`} />
        <MetricPill label="This Week" pct={weekly.pct} count={`${weekly.present}/${weekly.total}`} />
        <MetricPill label="This Month" pct={monthly.pct} count={`${monthly.present}/${monthly.total}`} />
      </div>

      <Card>
        <SectionTitle
          title="Mark today's classes"
          subtitle="Tap a status for each period of the day."
          right={
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-xl border border-hairline bg-surface px-3 py-2 text-sm font-medium"
            />
          }
        />
        {!isWorkingDay && (
          <div className="mb-4 rounded-xl border border-hairline bg-surface-alt/50 p-3 text-xs text-muted-foreground">
            {DAYS[dayOfWeek]} is not a working day in your settings. You can still mark manually below.
          </div>
        )}
        {subjects.length === 0 ? (
          <EmptyState
            title="Add subjects first"
            description="Create subjects on the Subjects page to start marking attendance."
          />
        ) : (
          <div className="space-y-2">
            {periodsToShow.map((p) => {
              const row = dayRows.find((r) => r.period === p);
              const slot = daySlots.find((s) => s.period === p);
              // Prefill subject from timetable if attendance row hasn't overridden it
              const effectiveSubjectId = row?.subject_id ?? slot?.subject_id ?? "";
              const isBreak = slot?.slot_type === "break";
              if (isBreak) {
                return (
                  <div
                    key={p}
                    className="grid grid-cols-[auto_1fr] items-center gap-3 rounded-xl border border-dashed border-hairline bg-surface-alt/20 p-3"
                  >
                    <div className="grid size-9 place-items-center rounded-lg bg-surface-alt font-mono text-xs font-bold text-muted-foreground">
                      P{p}
                    </div>
                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                      <BreakIcon className="size-4" />
                      {slot?.label || "Break"}
                    </div>
                  </div>
                );
              }
              const subjName = subjects.find((s) => s.id === effectiveSubjectId)?.name;
              return (
                <div
                  key={p}
                  className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-xl border border-hairline bg-surface-alt/30 p-3"
                >
                  <div className="grid size-9 place-items-center rounded-lg bg-brand-soft font-mono text-sm font-bold text-brand">
                    P{p}
                  </div>
                  <Select
                    value={effectiveSubjectId}
                    onChange={(e) => {
                      const sid = e.target.value;
                      if (!sid) return;
                      mark(sid, p, row?.status as AttendanceStatus ?? "present");
                    }}
                  >
                    <option value="">{subjName ? subjName : "— Select subject —"}</option>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                        {slot?.subject_id === s.id ? " (from timetable)" : ""}
                      </option>
                    ))}
                  </Select>
                  <div className="flex items-center gap-1">
                    <StatusBtn
                      active={row?.status === "present"}
                      tone="safe"
                      onClick={() => effectiveSubjectId && mark(effectiveSubjectId, p, "present")}
                      disabled={!effectiveSubjectId}
                      icon={<Check className="size-4" />}
                      label="P"
                    />
                    <StatusBtn
                      active={row?.status === "absent"}
                      tone="danger"
                      onClick={() => effectiveSubjectId && mark(effectiveSubjectId, p, "absent")}
                      disabled={!effectiveSubjectId}
                      icon={<X className="size-4" />}
                      label="A"
                    />
                    <StatusBtn
                      active={row?.status === "leave"}
                      tone="warn"
                      onClick={() => effectiveSubjectId && mark(effectiveSubjectId, p, "leave")}
                      disabled={!effectiveSubjectId}
                      icon={<Coffee className="size-4" />}
                      label="L"
                    />
                    {row && (
                      <Button variant="ghost" onClick={() => clearPeriod(p)}>
                        Clear
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <SectionTitle title="Attendance trend" subtitle="Rolling overall % across the last 14 days" />
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--hairline)" />
                <XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={12} />
                <YAxis domain={[0, 100]} stroke="var(--muted-foreground)" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    background: "var(--surface)",
                    border: "1px solid var(--hairline)",
                    borderRadius: 12,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="pct"
                  stroke="var(--brand)"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: "var(--brand)" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <SectionTitle title="Predictor" subtitle="Simulate the next few classes" />
          <div className="space-y-4">
            <label className="block">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Classes I'll attend
              </div>
              <input
                type="range"
                min={0}
                max={30}
                value={predictAttend}
                onChange={(e) => setPredictAttend(Number(e.target.value))}
                className="w-full accent-[color:var(--brand)]"
              />
              <div className="mt-1 font-mono text-sm">{predictAttend}</div>
            </label>
            <label className="block">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Classes I'll miss
              </div>
              <input
                type="range"
                min={0}
                max={30}
                value={predictSkip}
                onChange={(e) => setPredictSkip(Number(e.target.value))}
                className="w-full accent-[color:var(--danger)]"
              />
              <div className="mt-1 font-mono text-sm">{predictSkip}</div>
            </label>
            <div className="rounded-xl bg-brand-soft p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-brand">
                Predicted overall
              </div>
              <div className="mt-1 font-mono text-3xl font-bold text-brand">
                {predictAttendance(overall.present, overall.total, predictAttend, predictSkip).toFixed(1)}%
              </div>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <SectionTitle title="Subject breakdown" subtitle="Includes classes-to-attend and classes-you-can-skip" />
        {perSubject.length === 0 ? (
          <EmptyState
            title="No subjects yet"
            description="Add subjects to see per-subject attendance."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-hairline text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="pb-3 pr-4">Subject</th>
                  <th className="pb-3 pr-4">Present</th>
                  <th className="pb-3 pr-4">%</th>
                  <th className="pb-3 pr-4">Status</th>
                  <th className="pb-3 pr-4">To reach {target}%</th>
                  <th className="pb-3">Can skip</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {perSubject.map((s) => {
                  const tone = s.total === 0 ? "neutral" : statusTone(s.pct);
                  return (
                    <tr key={s.id}>
                      <td className="py-3 pr-4 font-medium">{s.name}</td>
                      <td className="py-3 pr-4 font-mono">
                        {s.present}/{s.total}
                      </td>
                      <td className="py-3 pr-4 font-mono font-bold">
                        {s.total === 0 ? "—" : `${s.pct.toFixed(1)}%`}
                      </td>
                      <td className="py-3 pr-4">
                        <Badge tone={tone === "neutral" ? "neutral" : tone === "safe" ? "safe" : tone === "warn" ? "warn" : "danger"}>
                          {s.total === 0 ? "New" : tone === "safe" ? "Safe" : tone === "warn" ? "Watch" : "Shortage"}
                        </Badge>
                      </td>
                      <td className="py-3 pr-4 font-mono">
                        {classesNeeded(s.present, s.total, target) || "—"}
                      </td>
                      <td className="py-3 font-mono">
                        {classesCanSkip(s.present, s.total, target) || "0"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <MonthlyCalendar attendance={attendance} target={target} />

      {/* silence unused import warning */}
      <div className="hidden">{DAYS.join("")}</div>
    </div>
  );
}

function MonthlyCalendar({
  attendance,
  target,
}: {
  attendance: { date: string; status: string }[];
  target: number;
}) {
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const days = eachDayOfInterval({ start: startOfMonth(cursor), end: endOfMonth(cursor) });
  const leadingBlanks = getDay(startOfMonth(cursor)); // 0=Sun
  const byDay = new Map<string, { present: number; absent: number; leave: number }>();
  for (const r of attendance) {
    const cur = byDay.get(r.date) ?? { present: 0, absent: 0, leave: 0 };
    if (r.status === "present") cur.present++;
    else if (r.status === "absent") cur.absent++;
    else if (r.status === "leave") cur.leave++;
    byDay.set(r.date, cur);
  }

  function dayTone(key: string): string {
    const d = byDay.get(key);
    if (!d) return "";
    const counted = d.present + d.absent;
    if (counted === 0) return "bg-surface-alt";
    const pct = (d.present / counted) * 100;
    if (pct >= target + 10) return "bg-emerald-500/25 text-emerald-500";
    if (pct >= target) return "bg-emerald-500/15 text-emerald-500";
    if (pct >= target - 15) return "bg-amber-500/20 text-amber-600";
    return "bg-rose-500/20 text-rose-500";
  }

  return (
    <Card>
      <SectionTitle
        title={`Attendance calendar · ${format(cursor, "MMMM yyyy")}`}
        subtitle={`Green ≥ ${target}%, amber near shortfall, red below.`}
        right={
          <div className="flex items-center gap-1">
            <Button variant="ghost" onClick={() => setCursor((c) => addMonths(c, -1))}>
              <ChevronLeft className="size-4" />
            </Button>
            <Button variant="ghost" onClick={() => setCursor(startOfMonth(new Date()))}>
              Today
            </Button>
            <Button variant="ghost" onClick={() => setCursor((c) => addMonths(c, 1))}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
        }
      />
      <div className="grid grid-cols-7 gap-1 text-center">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="pb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {d}
          </div>
        ))}
        {Array.from({ length: leadingBlanks }).map((_, i) => (
          <div key={`b${i}`} />
        ))}
        {days.map((d) => {
          const key = format(d, "yyyy-MM-dd");
          const entry = byDay.get(key);
          const tone = dayTone(key);
          const dim = !isSameMonth(d, cursor);
          return (
            <div
              key={key}
              className={`aspect-square rounded-lg border border-hairline p-1 text-[11px] ${tone} ${
                dim ? "opacity-40" : ""
              } ${isToday(d) ? "ring-2 ring-brand ring-offset-1 ring-offset-surface" : ""}`}
            >
              <div className="font-mono font-bold">{format(d, "d")}</div>
              {entry && (
                <div className="mt-0.5 font-mono text-[9px] leading-tight opacity-80">
                  {entry.present}P {entry.absent}A
                  {entry.leave ? ` ${entry.leave}L` : ""}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function MetricPill({ label, pct, count }: { label: string; pct: number; count: string }) {
  const tone = statusTone(pct);
  const color = {
    safe: "text-[color:var(--accent-emerald)]",
    warn: "text-[color:var(--warn)]",
    danger: "text-[color:var(--danger)]",
  }[tone];
  return (
    <Card className="p-5">
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className={`mt-1 font-mono text-2xl font-bold ${color}`}>{pct.toFixed(1)}%</div>
      <div className="mt-1 font-mono text-xs text-muted-foreground">{count}</div>
    </Card>
  );
}

function StatusBtn({
  active,
  tone,
  onClick,
  disabled,
  icon,
  label,
}: {
  active: boolean;
  tone: "safe" | "danger" | "warn";
  onClick: () => void;
  disabled: boolean;
  icon: React.ReactNode;
  label: string;
}) {
  const bg = {
    safe: active ? "bg-[color:var(--accent-emerald)] text-white" : "hover:bg-accent-emerald-soft text-[color:var(--accent-emerald)]",
    danger: active ? "bg-[color:var(--danger)] text-white" : "hover:bg-danger-soft text-[color:var(--danger)]",
    warn: active ? "bg-[color:var(--warn)] text-white" : "hover:bg-warn-soft text-[color:var(--warn)]",
  }[tone];
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex size-9 items-center justify-center rounded-lg border border-hairline text-xs font-bold transition disabled:opacity-40 ${bg}`}
      aria-label={label}
      title={label}
    >
      {icon}
    </button>
  );
}