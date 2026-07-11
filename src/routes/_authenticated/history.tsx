import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, SectionTitle, Button, Input } from "@/components/ui-primitives";
import { Loader2, Plus, Trash2, TrendingUp } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/_authenticated/history")({
  head: () => ({ meta: [{ title: "Academic History — ScholarOS" }] }),
  component: HistoryPage,
});

type Record = {
  id: string;
  semester: number;
  sgpa: number | null;
  credits_earned: number | null;
  total_credits: number | null;
  backlogs: number;
  note: string | null;
};

function HistoryPage() {
  const [loading, setLoading] = useState(true);
  const [uid, setUid] = useState<string | null>(null);
  const [rows, setRows] = useState<Record[]>([]);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      setUid(u.user.id);
      const { data } = await supabase
        .from("semester_records")
        .select("*")
        .order("semester");
      setRows((data as Record[]) ?? []);
      setLoading(false);
    })();
  }, []);

  const cgpa = useMemo(() => {
    const items = rows.filter((r) => r.sgpa != null && r.credits_earned);
    if (items.length === 0) return null;
    const weight = items.reduce((s, r) => s + Number(r.credits_earned || 0), 0);
    const total = items.reduce(
      (s, r) => s + Number(r.sgpa || 0) * Number(r.credits_earned || 0),
      0,
    );
    return weight > 0 ? total / weight : null;
  }, [rows]);

  const totalCredits = rows.reduce((s, r) => s + Number(r.credits_earned || 0), 0);
  const totalBacklogs = rows.reduce((s, r) => s + Number(r.backlogs || 0), 0);

  const chartData = rows
    .filter((r) => r.sgpa != null)
    .map((r) => ({ sem: `S${r.semester}`, SGPA: Number(r.sgpa) }));

  async function upsert(row: Partial<Record> & { semester: number }) {
    if (!uid) return;
    const payload = { ...row, user_id: uid };
    const { data, error } = await supabase
      .from("semester_records")
      .upsert(payload, { onConflict: "user_id,semester" })
      .select()
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    setRows((prev) => {
      const others = prev.filter((r) => r.semester !== row.semester);
      return [...others, data as Record].sort((a, b) => a.semester - b.semester);
    });
    toast.success(`Semester ${row.semester} saved`);
  }

  async function remove(id: string) {
    const { error } = await supabase.from("semester_records").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  if (loading) {
    return (
      <div className="grid place-items-center py-24 text-muted-foreground">
        <Loader2 className="size-6 animate-spin" />
      </div>
    );
  }

  const nextSemester = (rows[rows.length - 1]?.semester ?? 0) + 1;

  return (
    <div className="space-y-6 animate-fade-in">
      <SectionTitle
        title="Academic history"
        subtitle="Semester-wise SGPA, credits and backlogs. CGPA auto-calculated."
        right={
          <Button onClick={() => setAdding(true)} disabled={nextSemester > 12}>
            <Plus className="size-4" />
            Add semester
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="CGPA" value={cgpa != null ? cgpa.toFixed(2) : "—"} icon={TrendingUp} />
        <StatCard label="Credits earned" value={totalCredits.toString()} />
        <StatCard label="Total backlogs" value={totalBacklogs.toString()} />
      </div>

      {chartData.length > 1 && (
        <Card>
          <h3 className="mb-4 text-sm font-semibold">SGPA trend</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--hairline)" />
                <XAxis dataKey="sem" stroke="var(--muted-foreground)" fontSize={12} />
                <YAxis domain={[0, 10]} stroke="var(--muted-foreground)" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    background: "var(--surface)",
                    border: "1px solid var(--hairline)",
                    borderRadius: 12,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="SGPA"
                  stroke="var(--brand)"
                  strokeWidth={2.5}
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-hairline text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <th className="p-3">Sem</th>
              <th className="p-3">SGPA</th>
              <th className="p-3">Credits earned</th>
              <th className="p-3">Total credits</th>
              <th className="p-3">Backlogs</th>
              <th className="p-3">Note</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-6 text-center text-sm text-muted-foreground">
                  No semesters logged yet.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <SemesterRow key={r.id} row={r} onSave={upsert} onRemove={() => remove(r.id)} />
              ))
            )}
          </tbody>
        </table>
      </Card>

      {adding && (
        <SemesterDialog
          semester={nextSemester}
          onClose={() => setAdding(false)}
          onSave={(row) => {
            void upsert(row);
            setAdding(false);
          }}
        />
      )}
    </div>
  );
}

function SemesterRow({
  row,
  onSave,
  onRemove,
}: {
  row: Record;
  onSave: (r: Partial<Record> & { semester: number }) => void;
  onRemove: () => void;
}) {
  const [sgpa, setSgpa] = useState(row.sgpa?.toString() ?? "");
  const [ce, setCe] = useState(row.credits_earned?.toString() ?? "");
  const [tc, setTc] = useState(row.total_credits?.toString() ?? "");
  const [bl, setBl] = useState(row.backlogs.toString());
  const [note, setNote] = useState(row.note ?? "");

  function save() {
    onSave({
      semester: row.semester,
      sgpa: sgpa ? Number(sgpa) : null,
      credits_earned: ce ? Number(ce) : null,
      total_credits: tc ? Number(tc) : null,
      backlogs: Number(bl) || 0,
      note: note || null,
    });
  }
  return (
    <tr className="border-b border-hairline last:border-0">
      <td className="p-3 font-semibold">S{row.semester}</td>
      <td className="p-3">
        <Input value={sgpa} onChange={(e) => setSgpa(e.target.value)} onBlur={save} type="number" step="0.01" />
      </td>
      <td className="p-3">
        <Input value={ce} onChange={(e) => setCe(e.target.value)} onBlur={save} type="number" />
      </td>
      <td className="p-3">
        <Input value={tc} onChange={(e) => setTc(e.target.value)} onBlur={save} type="number" />
      </td>
      <td className="p-3">
        <Input value={bl} onChange={(e) => setBl(e.target.value)} onBlur={save} type="number" />
      </td>
      <td className="p-3">
        <Input value={note} onChange={(e) => setNote(e.target.value)} onBlur={save} />
      </td>
      <td className="p-3">
        <button
          onClick={onRemove}
          className="grid size-8 place-items-center rounded-lg border border-hairline text-muted-foreground hover:text-danger"
          aria-label="Delete"
        >
          <Trash2 className="size-4" />
        </button>
      </td>
    </tr>
  );
}

function SemesterDialog({
  semester,
  onClose,
  onSave,
}: {
  semester: number;
  onClose: () => void;
  onSave: (r: Partial<Record> & { semester: number }) => void;
}) {
  const [sgpa, setSgpa] = useState("");
  const [ce, setCe] = useState("");
  const [tc, setTc] = useState("");
  const [bl, setBl] = useState("0");

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-hairline bg-surface p-6 animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-bold">Add semester {semester}</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Input
            placeholder="SGPA (e.g. 8.5)"
            value={sgpa}
            onChange={(e) => setSgpa(e.target.value)}
            type="number"
            step="0.01"
          />
          <Input
            placeholder="Backlogs"
            value={bl}
            onChange={(e) => setBl(e.target.value)}
            type="number"
          />
          <Input
            placeholder="Credits earned"
            value={ce}
            onChange={(e) => setCe(e.target.value)}
            type="number"
          />
          <Input
            placeholder="Total credits"
            value={tc}
            onChange={(e) => setTc(e.target.value)}
            type="number"
          />
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() =>
              onSave({
                semester,
                sgpa: sgpa ? Number(sgpa) : null,
                credits_earned: ce ? Number(ce) : null,
                total_credits: tc ? Number(tc) : null,
                backlogs: Number(bl) || 0,
              })
            }
          >
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </div>
          <div className="mt-2 font-mono text-3xl font-bold tracking-tight">{value}</div>
        </div>
        {Icon && (
          <div className="grid size-10 place-items-center rounded-xl bg-brand-soft text-brand">
            <Icon className="size-5" />
          </div>
        )}
      </div>
    </Card>
  );
}