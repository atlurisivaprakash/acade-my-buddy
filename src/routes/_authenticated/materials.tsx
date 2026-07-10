import { createFileRoute } from "@tanstack/react-router";
import { FileBrowser } from "@/components/file-browser";

export const Route = createFileRoute("/_authenticated/materials")({
  head: () => ({ meta: [{ title: "Study Materials — ScholarOS" }] }),
  component: () => (
    <FileBrowser
      category="material"
      title="Study materials"
      subtitle="Upload PDFs, notes, slides and images. Organized by subject."
    />
  ),
});
*** Add File: src/routes/_authenticated/papers.tsx
import { createFileRoute } from "@tanstack/react-router";
import { FileBrowser } from "@/components/file-browser";

export const Route = createFileRoute("/_authenticated/papers")({
  head: () => ({ meta: [{ title: "Question Papers — ScholarOS" }] }),
  component: () => (
    <FileBrowser
      category="question_paper"
      title="Question paper archive"
      subtitle="Previous year papers, organized by subject and semester with tags."
      showSemester
    />
  ),
});
*** Add File: src/routes/_authenticated/documents.tsx
import { createFileRoute } from "@tanstack/react-router";
import { FileBrowser } from "@/components/file-browser";

export const Route = createFileRoute("/_authenticated/documents")({
  head: () => ({ meta: [{ title: "Important Documents — ScholarOS" }] }),
  component: () => (
    <FileBrowser
      category="document"
      title="Important documents"
      subtitle="Hall tickets, certificates, fee receipts, academic documents. Secure to your account."
      showSubject={false}
    />
  ),
});