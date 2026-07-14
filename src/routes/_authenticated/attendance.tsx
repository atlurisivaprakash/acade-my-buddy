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
      const [s, a] = await Promise.all([
        supabase.from("subjects").select("*").order("name"),
        supabase.from("attendance").select("*").order("date", { ascending: false }),
      ]);
      return { subjects: s.data ?? [], attendance: a.data ?? [] };
    },
  });
  const [date, setDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const subjects = data?.subjects ?? [];
  const attendance = data?.attendance ?? [];

  const dayRows = attendance.filter((a) => a.date === date);

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
        {subjects.length === 0 ? (
          <EmptyState
            title="Add subjects first"
            description="Create subjects on the Subjects page to start marking attendance."
          />
        ) : (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((p) => {
              const row = dayRows.find((r) => r.period === p);
              return (
                <div
                  key={p}
                  className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-xl border border-hairline bg-surface-alt/30 p-3"
                >
                  <div className="grid size-9 place-items-center rounded-lg bg-brand-soft font-mono text-sm font-bold text-brand">
                    P{p}
                  </div>
                  <Select
                    value={row?.subject_id ?? ""}
                    onChange={(e) => {
                      const sid = e.target.value;
                      if (!sid) return;
                      mark(sid, p, row?.status as AttendanceStatus ?? "present");
                    }}
                  >
                    <option value="">— Select subject —</option>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </Select>
                  <div className="flex items-center gap-1">
                    <StatusBtn
                      active={row?.status === "present"}
                      tone="safe"
                      onClick={() => row?.subject_id && mark(row.subject_id, p, "present")}
                      disabled={!row?.subject_id}
                      icon={<Check className="size-4" />}
                      label="P"
                    />
                    <StatusBtn
                      active={row?.status === "absent"}
                      tone="danger"
                      onClick={() => row?.subject_id && mark(row.subject_id, p, "absent")}
                      disabled={!row?.subject_id}
                      icon={<X className="size-4" />}
                      label="A"
                    />
                    <StatusBtn
                      active={row?.status === "leave"}
                      tone="warn"
                      onClick={() => row?.subject_id && mark(row.subject_id, p, "leave")}
                      disabled={!row?.subject_id}
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
                  <th className="pb-3 pr-4">To reach 75%</th>
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
                        {classesNeeded(s.present, s.total) || "—"}
                      </td>
                      <td className="py-3 font-mono">
                        {classesCanSkip(s.present, s.total) || "0"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {/* silence unused import warning */}
      <div className="hidden">{DAYS.join("")}</div>
    </div>
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