import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchAll } from "@/lib/queries";
import {
  attendancePct,
  classesNeeded,
  computeGpa,
  EXAM_LABELS,
  statusTone,
  type ExamType,
} from "@/lib/academic";
import { Card, Badge, EmptyState, Button } from "@/components/ui-primitives";
import { Link } from "@tanstack/react-router";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from "recharts";
import { AlertTriangle, TrendingUp, Percent, ListTodo, ArrowRight } from "lucide-react";
import { format, isAfter, addDays } from "date-fns";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — ScholarOS" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: fetchAll,
  });

  if (isLoading || !data) {
    return <div className="text-sm text-muted-foreground">Loading…</div>;
  }

  const { subjects, attendance, marks, tasks } = data;

  const overall = attendancePct(attendance);
  const perSubject = subjects.map((s) => {
    const rows = attendance.filter((a) => a.subject_id === s.id);
    const { pct, present, total } = attendancePct(rows);
    return { ...s, pct, present, total };
  });

  const shortages = perSubject.filter((s) => s.total > 0 && s.pct < 75);
  const gpa = computeGpa(marks, subjects);

  const now = new Date();
  const upcoming = tasks
    .filter((t) => !t.completed && t.due_date && isAfter(new Date(t.due_date), addDays(now, -1)))
    .slice(0, 5);

  const midChart = subjects
    .map((s) => {
      const m1 = marks.find((m) => m.subject_id === s.id && m.exam_type === "mid1");
      const m2 = marks.find((m) => m.subject_id === s.id && m.exam_type === "mid2");
      const sem = marks.find((m) => m.subject_id === s.id && m.exam_type === "sem");
      return {
        name: (s.code || s.name).slice(0, 6),
        Mid1: m1 ? (Number(m1.score) / Number(m1.max_score)) * 100 : 0,
        Mid2: m2 ? (Number(m2.score) / Number(m2.max_score)) * 100 : 0,
        Sem: sem ? (Number(sem.score) / Number(sem.max_score)) * 100 : 0,
      };
    })
    .filter((r) => r.Mid1 || r.Mid2 || r.Sem);

  const avgMid1 = avg(marks.filter((m) => m.exam_type === "mid1"));
  const avgMid2 = avg(marks.filter((m) => m.exam_type === "mid2"));
  const avgSem = avg(marks.filter((m) => m.exam_type === "sem"));

  return (
    <div className="space-y-8">
      {/* Stat grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<Percent className="size-5" />}
          label="Overall Attendance"
          value={`${overall.pct.toFixed(1)}%`}
          hint={`${overall.present}/${overall.total} classes`}
          tone={overall.pct >= 75 ? "safe" : "danger"}
        >
          <ProgressBar value={overall.pct} />
        </StatCard>
        <StatCard
          icon={<TrendingUp className="size-5" />}
          label="Current GPA"
          value={gpa > 0 ? gpa.toFixed(2) : "—"}
          hint={gpa > 0 ? "Semester exam average" : "Add semester marks"}
          tone="brand"
        >
          <div className="mt-4 flex gap-1">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={`h-4 flex-1 rounded-sm ${
                  gpa >= (i + 1) * 2.5
                    ? "bg-[color:var(--accent-emerald)]"
                    : "bg-[color:var(--accent-emerald)]/20"
                }`}
              />
            ))}
          </div>
        </StatCard>
        <StatCard
          icon={<AlertTriangle className="size-5" />}
          label="Attendance Shortages"
          value={shortages.length.toString()}
          hint={
            shortages.length > 0
              ? `${shortages[0].name} · ${shortages[0].pct.toFixed(0)}%`
              : "All subjects safe"
          }
          tone={shortages.length > 0 ? "danger" : "safe"}
        />
        <StatCard
          icon={<ListTodo className="size-5" />}
          label="Upcoming Tasks"
          value={upcoming.length.toString()}
          hint={upcoming[0] ? `Next: ${upcoming[0].title}` : "Nothing due soon"}
          tone="warn"
        />
      </div>

      {/* Shortage alerts */}
      {shortages.length > 0 && (
        <Card className="border-l-4 border-l-[color:var(--danger)] bg-danger-soft/40 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-[color:var(--danger)]" />
            <div className="min-w-0 flex-1 space-y-1">
              <div className="font-semibold">Attendance shortage</div>
              <div className="text-sm text-muted-foreground">
                {shortages.map((s) => (
                  <span key={s.id} className="mr-3 inline-block">
                    <b className="text-foreground">{s.name}</b> — {s.pct.toFixed(1)}% (need{" "}
                    {classesNeeded(s.present, s.total)} more classes)
                  </span>
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="mb-6 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
            <div className="min-w-0">
              <h2 className="text-lg font-bold">Marks Progression</h2>
              <p className="text-sm text-muted-foreground">Mid-1, Mid-2 and Semester (%)</p>
            </div>
            <Link
              to="/marks"
              className="text-sm font-semibold text-brand hover:underline"
            >
              Full report →
            </Link>
          </div>
          {midChart.length === 0 ? (
            <EmptyState
              title="No marks yet"
              description="Add your Mid-1 or Mid-2 marks to see your progression chart."
              action={
                <Link to="/marks">
                  <Button variant="primary">Add marks</Button>
                </Link>
              }
            />
          ) : (
            <>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={midChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--hairline)" />
                    <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={12} />
                    <YAxis stroke="var(--muted-foreground)" fontSize={12} domain={[0, 100]} />
                    <Tooltip
                      contentStyle={{
                        background: "var(--surface)",
                        border: "1px solid var(--hairline)",
                        borderRadius: 12,
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="Mid1" fill="var(--brand)" radius={[4, 4, 0, 0]} />
                    <Bar
                      dataKey="Mid2"
                      fill="var(--accent-emerald)"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar dataKey="Sem" fill="var(--warn)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-6 grid grid-cols-3 gap-3">
                <MiniStat label="Avg Mid-1" value={fmtAvg(avgMid1)} />
                <MiniStat label="Avg Mid-2" value={fmtAvg(avgMid2)} />
                <MiniStat label="Avg Semester" value={fmtAvg(avgSem)} highlight />
              </div>
            </>
          )}
        </Card>

        <Card className="bg-slate-900 text-white">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-lg font-bold">Upcoming Tasks</h2>
            <Link
              to="/tasks"
              className="text-xs font-semibold text-white/70 hover:text-white"
            >
              View all
            </Link>
          </div>
          {upcoming.length === 0 ? (
            <p className="text-sm text-white/60">Nothing due soon — inbox zero.</p>
          ) : (
            <ul className="space-y-4">
              {upcoming.map((t) => (
                <li key={t.id} className="flex items-start gap-3">
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-brand" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{t.title}</div>
                    <div className="text-xs text-white/60">
                      {t.due_date
                        ? format(new Date(t.due_date), "EEE, dd MMM · p")
                        : "No due date"}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card>
        <div className="mb-6 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
          <div className="min-w-0">
            <h2 className="text-lg font-bold">Subject-wise Attendance</h2>
            <p className="text-sm text-muted-foreground">
              Attendance leaves aren't counted in the denominator.
            </p>
          </div>
          <Link
            to="/attendance"
            className="inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline"
          >
            Mark today <ArrowRight className="size-4" />
          </Link>
        </div>
        {perSubject.length === 0 ? (
          <EmptyState
            title="Add your subjects"
            description="Create subjects to start tracking attendance and marks."
            action={
              <Link to="/subjects">
                <Button variant="primary">Add subjects</Button>
              </Link>
            }
          />
        ) : (
          <div className="divide-y divide-hairline">
            {perSubject.map((s) => {
              const tone = s.total === 0 ? "neutral" : statusTone(s.pct);
              return (
                <div key={s.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 py-4">
                  <div className="flex min-w-0 items-center gap-4">
                    <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-soft text-xs font-bold text-brand">
                      {(s.code || s.name).slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{s.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {s.present}/{s.total} classes · {s.credits} credits
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-right">
                    <div>
                      <div className="font-mono text-base font-bold">
                        {s.total === 0 ? "—" : `${s.pct.toFixed(0)}%`}
                      </div>
                      <Badge tone={tone === "neutral" ? "neutral" : tone === "safe" ? "safe" : tone === "warn" ? "warn" : "danger"}>
                        {s.total === 0 ? "New" : tone === "safe" ? "Safe" : tone === "warn" ? "Watch" : "Shortage"}
                      </Badge>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  hint,
  tone,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
  tone: "safe" | "warn" | "danger" | "brand";
  children?: React.ReactNode;
}) {
  const iconBg = {
    safe: "bg-accent-emerald-soft text-[color:var(--accent-emerald)]",
    warn: "bg-warn-soft text-[color:var(--warn)]",
    danger: "bg-danger-soft text-[color:var(--danger)]",
    brand: "bg-brand-soft text-brand",
  }[tone];
  return (
    <Card>
      <div className="mb-4 flex items-start justify-between">
        <div className={`grid size-10 place-items-center rounded-xl ${iconBg}`}>{icon}</div>
      </div>
      <div className="text-sm font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 truncate text-3xl font-bold tracking-tight">{value}</div>
      <div className="mt-2 truncate text-xs text-muted-foreground">{hint}</div>
      {children}
    </Card>
  );
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-surface-alt">
      <div
        className="h-full rounded-full bg-brand transition-all"
        style={{ width: `${Math.min(100, value)}%` }}
      />
    </div>
  );
}

function MiniStat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        highlight
          ? "border-transparent bg-brand text-brand-foreground"
          : "border-hairline bg-surface-alt/60"
      }`}
    >
      <div className={`text-xs ${highlight ? "text-white/70" : "text-muted-foreground"}`}>
        {label}
      </div>
      <div className="mt-1 text-lg font-bold tracking-tight">{value}</div>
    </div>
  );
}

function avg(rows: { score: number | string; max_score: number | string }[]): number {
  if (rows.length === 0) return 0;
  const s = rows.reduce(
    (acc, r) => acc + (Number(r.score) / Number(r.max_score)) * 100,
    0,
  );
  return s / rows.length;
}
function fmtAvg(n: number): string {
  return n === 0 ? "—" : `${n.toFixed(0)}%`;
}
// suppress unused import
void EXAM_LABELS;
void ({} as ExamType);