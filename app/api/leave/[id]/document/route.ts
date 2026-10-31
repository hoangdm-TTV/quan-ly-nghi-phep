import { pool } from "@/lib/db/pool";
import { getCurrentUser, canAccessUserData } from "@/lib/auth/permissions";
import { getSafeUserById } from "@/lib/db/queries/users";

export const runtime = "nodejs";

const allowedMimeTypes = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
]);
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function notFound() {
  return new Response("Not found", {
    status: 404,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return new Response("Unauthorized", {
      status: 401,
      headers: { "Cache-Control": "no-store" },
    });
  }
  if (!uuidPattern.test(params.id)) return notFound();

  const metadataResult = await pool.query<{
    employee_id: string;
    status: string;
    document_mime_type: string | null;
    document_file_name: string | null;
  }>(
    `SELECT employee_id, status, document_mime_type, document_file_name
       FROM leave_requests
      WHERE id = $1 AND document_data IS NOT NULL
      LIMIT 1`,
    [params.id],
  );
  const metadata = metadataResult.rows[0];
  if (
    !metadata ||
    metadata.status !== "COMPLETED" ||
    !metadata.document_mime_type
  )
    return notFound();

  const applicant = await getSafeUserById(metadata.employee_id);
  if (!applicant || !canAccessUserData(currentUser, applicant))
    return notFound();

  const fileResult = await pool.query<{ document_data: Buffer }>(
    `SELECT document_data FROM leave_requests WHERE id = $1 AND status = 'COMPLETED' LIMIT 1`,
    [params.id],
  );
  const fileBuffer = fileResult.rows[0]?.document_data;
  if (!fileBuffer || !allowedMimeTypes.has(metadata.document_mime_type))
    return notFound();

  const safeName = (metadata.document_file_name || "signed-leave-document")
    .replace(/[\r\n"\\]/g, "_")
    .slice(0, 180);
  const asciiName = safeName.replace(/[^\x20-\x7E]/g, "_");
  const encodedName = encodeURIComponent(safeName).replace(
    /[!'()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );

  return new Response(new Uint8Array(fileBuffer), {
    status: 200,
    headers: {
      "Content-Type": metadata.document_mime_type,
      "Content-Length": String(fileBuffer.byteLength),
      "Content-Disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${encodedName}`,
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
