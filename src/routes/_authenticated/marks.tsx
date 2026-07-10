import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, Button, Input, Select, EmptyState, SectionTitle, Badge } from "@/components/ui-primitives";
import { toast } from "sonner";
import { computeGpa, EXAM_LABELS, gradePoint, type ExamType } from "@/lib/academic";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/_authenticated/marks")({
  head: () => ({ meta: [{ title: "Marks & GPA — ScholarOS" }] }),
  component: MarksPage,
});

const EXAM_TYPES: ExamType[] = ["mid1", "mid2", "assignment", "lab", "sem"];

function MarksPage() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["marks-page"],
    queryFn: async () => {
      const [s, m] = await Promise.all([
        supabase.from("subjects").select("*").order("name"),
        supabase.from("marks").select("*"),
      ]);
      return { subjects: s.data ?? [], marks: m.data ?? [] };
    },
  });
  const subjects = data?.subjects ?? [];
  const marks = data?.marks ?? [];

  const [subjectId, setSubjectId] = useState("");
  const [examType, setExamType] = useState<ExamType>("mid1");
  const [score, setScore] = useState("");
  const [maxScore, setMaxScore] = useState("100");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!subjectId) return toast.error("Select a subject");
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await supabase
      .from("marks")
      .upsert(
        {
          user_id: u.user.id,
          subject_id: subjectId,
          exam_type: examType,
          score: Number(score),
          max_score: Number(maxScore),
        },
        { onConflict: "user_id,subject_id,exam_type" },
      );
    if (error) return toast.error(error.message);
    toast.success("Marks saved");
    setScore("");
    qc.invalidateQueries();
  }

  const gpa = computeGpa(marks, subjects);
  const totalCredits = subjects.reduce((a, s) => a + (s.credits ?? 3), 0);

  // trend chart: per subject avg across exam types
  const chartData = EXAM_TYPES.map((t) => {
    const rows = marks.filter((m) => m.exam_type === t);
    const avg =
      rows.length === 0
        ? 0
        : rows.reduce((a, r) => a + (Number(r.score) / Number(r.max_score)) * 100, 0) /
          rows.length;
    return { name: EXAM_LABELS[t], Average: Number(avg.toFixed(1)) };
  });

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Current GPA
          </div>
          <div className="mt-1 font-mono text-3xl font-bold">{gpa > 0 ? gpa.toFixed(2) : "—"}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            From {marks.filter((m) => m.exam_type === "sem").length} semester subjects
          </div>
        </Card>
        <Card>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Total Credits
          </div>
          <div className="mt-1 font-mono text-3xl font-bold">{totalCredits}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            Across {subjects.length} subjects
          </div>
        </Card>
        <Card>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Records
          </div>
          <div className="mt-1 font-mono text-3xl font-bold">{marks.length}</div>
          <div className="mt-1 text-xs text-muted-foreground">Marks entered</div>
        </Card>
      </div>

      <Card>
        <SectionTitle title="Enter marks" subtitle="Existing exam type for a subject is updated." />
        {subjects.length === 0 ? (
          <EmptyState title="Add subjects first" description="Create subjects to enter marks." />
        ) : (
          <form
            onSubmit={save}
            className="grid gap-3 sm:grid-cols-[1fr_1fr_100px_100px_auto]"
          >
            <Select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
              <option value="">Select subject</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
            <Select value={examType} onChange={(e) => setExamType(e.target.value as ExamType)}>
              {EXAM_TYPES.map((t) => (
                <option key={t} value={t}>
                  {EXAM_LABELS[t]}
                </option>
              ))}
            </Select>
            <Input
              type="number"
              step="0.01"
              placeholder="Score"
              value={score}
              onChange={(e) => setScore(e.target.value)}
              required
            />
            <Input
              type="number"
              step="0.01"
              placeholder="Max"
              value={maxScore}
              onChange={(e) => setMaxScore(e.target.value)}
              required
            />
            <Button type="submit">Save</Button>
          </form>
        )}
      </Card>

      <Card>
        <SectionTitle title="Progression" subtitle="Average % across exam types" />
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--hairline)" />
              <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={12} />
              <YAxis domain={[0, 100]} stroke="var(--muted-foreground)" fontSize={12} />
              <Tooltip
                contentStyle={{
                  background: "var(--surface)",
                  border: "1px solid var(--hairline)",
                  borderRadius: 12,
                }}
              />
              <Legend />
              <Line type="monotone" dataKey="Average" stroke="var(--brand)" strokeWidth={2.5} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card>
        <SectionTitle title="Per-subject performance" />
        {subjects.length === 0 ? (
          <EmptyState title="No data" description="Add subjects and enter marks first." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-hairline text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="pb-3 pr-4">Subject</th>
                  {EXAM_TYPES.map((t) => (
                    <th key={t} className="pb-3 pr-4">
                      {EXAM_LABELS[t]}
                    </th>
                  ))}
                  <th className="pb-3 pr-4">Avg</th>
                  <th className="pb-3">Grade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {subjects.map((s) => {
                  const sMarks = marks.filter((m) => m.subject_id === s.id);
                  const avg =
                    sMarks.length === 0
                      ? 0
                      : sMarks.reduce(
                          (a, r) => a + (Number(r.score) / Number(r.max_score)) * 100,
                          0,
                        ) / sMarks.length;
                  return (
                    <tr key={s.id}>
                      <td className="py-3 pr-4 font-medium">{s.name}</td>
                      {EXAM_TYPES.map((t) => {
                        const m = sMarks.find((x) => x.exam_type === t);
                        return (
                          <td key={t} className="py-3 pr-4 font-mono">
                            {m ? `${Number(m.score)}/${Number(m.max_score)}` : "—"}
                          </td>
                        );
                      })}
                      <td className="py-3 pr-4 font-mono font-bold">
                        {avg > 0 ? `${avg.toFixed(1)}%` : "—"}
                      </td>
                      <td className="py-3">
                        {avg > 0 && (
                          <Badge tone={avg >= 75 ? "safe" : avg >= 50 ? "warn" : "danger"}>
                            {gradePoint(avg)} pts
                          </Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}