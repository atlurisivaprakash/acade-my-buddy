import { createFileRoute } from "@tanstack/react-router";
import { FileBrowser } from "@/components/file-browser";

export const Route = createFileRoute("/_authenticated/papers")({
  head: () => ({ meta: [{ title: "Question Papers — ScholarOS" }] }),
  component: PapersPage,
});

function PapersPage() {
  return (
    <FileBrowser
      category="question_paper"
      title="Question paper archive"
      subtitle="Previous year papers, organized by subject and semester with tags."
      showSemester
    />
  );
}