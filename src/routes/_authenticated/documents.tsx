import { createFileRoute } from "@tanstack/react-router";
import { FileBrowser } from "@/components/file-browser";

export const Route = createFileRoute("/_authenticated/documents")({
  head: () => ({ meta: [{ title: "Important Documents — ScholarOS" }] }),
  component: DocumentsPage,
});

function DocumentsPage() {
  return (
    <FileBrowser
      category="document"
      title="Important documents"
      subtitle="Hall tickets, certificates, fee receipts, academic documents. Secure to your account."
      showSubject={false}
    />
  );
}