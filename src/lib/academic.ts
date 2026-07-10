import type { Tables } from "@/integrations/supabase/types";

export type Attendance = Tables<"attendance">;
export type Subject = Tables<"subjects">;
export type Mark = Tables<"marks">;
export type Task = Tables<"tasks">;
export type FileRow = Tables<"files">;
export type Slot = Tables<"timetable_slots">;

export type AttendanceStatus = "present" | "absent" | "leave";
export type ExamType = "mid1" | "mid2" | "assignment" | "lab" | "sem";

/** Attendance percentage: leave classes are excluded from denominator. */
export function attendancePct(rows: Pick<Attendance, "status">[]): {
  pct: number;
  present: number;
  total: number;
} {
  const counted = rows.filter((r) => r.status !== "leave");
  const present = counted.filter((r) => r.status === "present").length;
  const total = counted.length;
  return { pct: total === 0 ? 0 : (present / total) * 100, present, total };
}

/** Classes needed to reach target (default 75%) given present/total. */
export function classesNeeded(present: number, total: number, target = 75): number {
  if (total === 0) return 0;
  const pct = (present / total) * 100;
  if (pct >= target) return 0;
  // (p + x) / (t + x) >= target/100  =>  x >= (target*t - 100*p)/(100 - target)
  return Math.ceil((target * total - 100 * present) / (100 - target));
}

/** Classes you can safely skip while staying at/above target. */
export function classesCanSkip(present: number, total: number, target = 75): number {
  if (total === 0) return 0;
  // p / (t + x) >= target/100  =>  x <= (100p - target*t)/target
  const room = Math.floor((100 * present - target * total) / target);
  return Math.max(0, room);
}

/** Predict attendance if `attendMore` classes are attended and `skipMore` missed. */
export function predictAttendance(
  present: number,
  total: number,
  attendMore: number,
  skipMore: number,
): number {
  const newPresent = present + attendMore;
  const newTotal = total + attendMore + skipMore;
  if (newTotal === 0) return 0;
  return (newPresent / newTotal) * 100;
}

/** GPA from marks: sem exam scores mapped to 10-point scale weighted by credits. */
export function computeGpa(
  marks: Pick<Mark, "subject_id" | "exam_type" | "score" | "max_score">[],
  subjects: Pick<Subject, "id" | "credits">[],
): number {
  const sems = marks.filter((m) => m.exam_type === "sem");
  if (sems.length === 0) return 0;
  let totalPoints = 0;
  let totalCredits = 0;
  for (const m of sems) {
    const subj = subjects.find((s) => s.id === m.subject_id);
    const credits = subj?.credits ?? 3;
    const pct = (Number(m.score) / Number(m.max_score)) * 100;
    const gp = gradePoint(pct);
    totalPoints += gp * credits;
    totalCredits += credits;
  }
  return totalCredits === 0 ? 0 : totalPoints / totalCredits;
}

export function gradePoint(pct: number): number {
  if (pct >= 90) return 10;
  if (pct >= 80) return 9;
  if (pct >= 70) return 8;
  if (pct >= 60) return 7;
  if (pct >= 50) return 6;
  if (pct >= 40) return 5;
  return 0;
}

export const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export const EXAM_LABELS: Record<ExamType, string> = {
  mid1: "Mid-1",
  mid2: "Mid-2",
  assignment: "Assignment",
  lab: "Lab",
  sem: "Semester",
};

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function statusTone(pct: number): "safe" | "warn" | "danger" {
  if (pct >= 85) return "safe";
  if (pct >= 75) return "warn";
  return "danger";
}