import { createFileRoute } from "@tanstack/react-router";
import { FileBrowser } from "@/components/file-browser";

export const Route = createFileRoute("/_authenticated/materials")({
  head: () => ({ meta: [{ title: "Study Materials — ScholarOS" }] }),
  component: MaterialsPage,
});

function MaterialsPage() {
  return (
    <FileBrowser
      category="material"
      title="Study materials"
      subtitle="Upload PDFs, notes, slides and images. Organized by subject."
    />
  );
}