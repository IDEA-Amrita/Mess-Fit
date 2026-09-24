import { redirect } from "next/navigation";

// Menus are created by uploading a photo (Menu OCR), not edited by hand here.
// Kept as a redirect so old links and bookmarks still land somewhere useful.
export default async function AdminMessMenuPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/admin/ocr?mess=${encodeURIComponent(id)}`);
}
