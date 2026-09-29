/**
 * Client-side mirror of the API's image rules (services/api/messfit_api/uploads.py),
 * so an unsupported or oversized photo fails instantly instead of after a slow
 * upload on hostel Wi-Fi. The server remains the real gate.
 */
export const PHOTO_ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif";
export const PHOTO_MAX_BYTES = 10 * 1024 * 1024;

/** A user-facing reason the photo can't be sent, or null if it's fine. */
export function photoProblem(file: File): string | null {
  if (file.size > PHOTO_MAX_BYTES) return "That photo is larger than 10 MB. Try a smaller one.";
  if (file.size === 0) return "That photo is empty. Try taking it again.";
  return null;
}
