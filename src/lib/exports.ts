import { supabase } from "@/integrations/supabase/client";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

async function fetchAll() {
  const [profile, subjects, attendance, marks, tasks, timetable, semesters] = await Promise.all([
    supabase.from("profiles").select("*").maybeSingle(),
    supabase.from("subjects").select("*"),
    supabase.from("attendance").select("*"),
    supabase.from("marks").select("*"),
    supabase.from("tasks").select("*"),
    supabase.from("timetable_slots").select("*"),
    supabase.from("semester_records").select("*"),
  ]);
  return {
    profile: profile.data,
    subjects: subjects.data ?? [],
    attendance: attendance.data ?? [],
    marks: marks.data ?? [],
    tasks: tasks.data ?? [],
    timetable: timetable.data ?? [],
    semesters: semesters.data ?? [],
  };
}

export async function exportAttendancePdf() {
  const { profile, subjects, attendance } = await fetchAll();
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text("Attendance Report", 14, 18);
  doc.setFontSize(10);
  doc.text(
    `${profile?.full_name ?? "Student"}${profile?.roll_no ? ` · ${profile.roll_no}` : ""}`,
    14,
    26,
  );
  doc.text(new Date().toLocaleString(), 14, 32);

  const rows = subjects.map((s) => {
    const items = attendance.filter((a) => a.subject_id === s.id && a.status !== "leave");
    const present = items.filter((a) => a.status === "present").length;
    const total = items.length;
    const pct = total ? ((present / total) * 100).toFixed(1) : "—";
    return [s.name, s.code ?? "", `${present}/${total}`, `${pct}%`];
  });
  autoTable(doc, {
    startY: 40,
    head: [["Subject", "Code", "Attended", "Percentage"]],
    body: rows,
    theme: "striped",
    headStyles: { fillColor: [59, 130, 246] },
  });
  doc.save(`attendance-${Date.now()}.pdf`);
}

export async function exportMarksPdf() {
  const { profile, subjects, marks, semesters } = await fetchAll();
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text("Marks Report", 14, 18);
  doc.setFontSize(10);
  doc.text(
    `${profile?.full_name ?? "Student"}${profile?.roll_no ? ` · ${profile.roll_no}` : ""}`,
    14,
    26,
  );
  doc.text(new Date().toLocaleString(), 14, 32);

  const rows = marks.map((m) => {
    const s = subjects.find((x) => x.id === m.subject_id);
    return [
      s?.name ?? "—",
      m.exam_type,
      `${m.score}/${m.max_score}`,
      `${((Number(m.score) / Number(m.max_score)) * 100).toFixed(1)}%`,
    ];
  });
  autoTable(doc, {
    startY: 40,
    head: [["Subject", "Exam", "Score", "Percentage"]],
    body: rows,
    theme: "striped",
    headStyles: { fillColor: [139, 92, 246] },
  });

  if (semesters.length) {
    autoTable(doc, {
      startY: (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10,
      head: [["Semester", "SGPA", "Credits", "Backlogs"]],
      body: semesters.map((s) => [
        `S${s.semester}`,
        s.sgpa ?? "—",
        s.credits_earned ?? "—",
        s.backlogs,
      ]),
      theme: "striped",
      headStyles: { fillColor: [59, 130, 246] },
    });
  }
  doc.save(`marks-${Date.now()}.pdf`);
}

export async function exportAllExcel() {
  const all = await fetchAll();
  const wb = XLSX.utils.book_new();
  const add = (name: string, rows: unknown[]) => {
    const ws = XLSX.utils.json_to_sheet(rows as object[]);
    XLSX.utils.book_append_sheet(wb, ws, name);
  };
  if (all.profile) add("Profile", [all.profile]);
  add("Subjects", all.subjects);
  add("Attendance", all.attendance);
  add("Marks", all.marks);
  add("Tasks", all.tasks);
  add("Timetable", all.timetable);
  add("Semesters", all.semesters);
  XLSX.writeFile(wb, `scholaros-backup-${Date.now()}.xlsx`);
}

export async function backupJson() {
  const all = await fetchAll();
  const blob = new Blob([JSON.stringify(all, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `scholaros-backup-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}