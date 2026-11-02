"use client";

import { FormEvent, useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { AlertCircle, Loader2, Upload, Sparkles } from "lucide-react";
import {
  uploadLeaveDocumentAction,
  LeaveActionState,
} from "@/lib/leave/actions";

const MAX_IMAGE_EDGE = 2200;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const TARGET_IMAGE_SIZE = 4.5 * 1024 * 1024;
const JPEG_QUALITIES = [0.82, 0.76, 0.7, 0.64, 0.58, 0.52];

async function optimizeImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  if (file.size <= TARGET_IMAGE_SIZE) return file;

  const bitmap = await createImageBitmap(file);
  try {
    let smallestBlob: Blob | null = null;
    for (const maxEdge of [MAX_IMAGE_EDGE, 2000, 1800, 1600, 1400]) {
      const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext("2d");
      if (!context) continue;
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

      for (const quality of JPEG_QUALITIES) {
        const compressedBlob = await new Promise<Blob | null>((resolve) => {
          canvas.toBlob(resolve, "image/jpeg", quality);
        });
        if (!compressedBlob) continue;
        if (!smallestBlob || compressedBlob.size < smallestBlob.size) smallestBlob = compressedBlob;
        if (compressedBlob.size <= TARGET_IMAGE_SIZE) break;
      }
      if (smallestBlob && smallestBlob.size <= TARGET_IMAGE_SIZE) break;
    }
    if (!smallestBlob || smallestBlob.size >= file.size) return file;
    const baseName =
      file.name.replace(/\.[^.]+$/, "") || "signed-leave-document";
    return new File([smallestBlob], `${baseName}.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } finally {
    bitmap.close();
  }
}

function UploadButton({ compressing }: { compressing: boolean }) {
  const { pending } = useFormStatus();
  const busy = pending || compressing;

  return (
    <button
      type="submit"
      disabled={busy}
      className="inline-flex items-center rounded-lg bg-[#005a3c] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#044e3f] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {compressing ? (
        <>
          <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          Đang tối ưu ảnh...
        </>
      ) : pending ? (
        <>
          <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          Đang tải giấy lên...
        </>
      ) : (
        <>
          <Upload className="mr-1.5 h-4 w-4" />
          Nộp giấy đã ký
        </>
      )}
    </button>
  );
}

export default function LeaveDocumentForm({
  requestId,
  compact = false,
}: {
  requestId: string;
  compact?: boolean;
}) {
  const initialState: LeaveActionState = {};
  const [state, formAction] = useFormState(
    uploadLeaveDocumentAction,
    initialState,
  );
  const [compressing, setCompressing] = useState(false);
  const [localError, setLocalError] = useState("");
  const [selectedFileName, setSelectedFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const confirmedSubmitRef = useRef(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (confirmedSubmitRef.current) {
      confirmedSubmitRef.current = false;
      return;
    }

    const form = event.currentTarget;
    const file = fileInputRef.current?.files?.[0];
    if (!file || file.type === "application/pdf") return;

    event.preventDefault();
    setCompressing(true);
    setLocalError("");
    let shouldSubmit = false;
    try {
      const optimizedFile = await optimizeImage(file);
      if (optimizedFile.size > MAX_IMAGE_SIZE) {
        setLocalError("Ảnh không thể nén xuống dưới 5 MB. Vui lòng chọn ảnh có độ phân giải thấp hơn hoặc chụp lại giấy ở khoảng cách gần hơn.");
        return;
      }
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(optimizedFile);
      if (fileInputRef.current) fileInputRef.current.files = dataTransfer.files;
      setSelectedFileName(optimizedFile.name);
      shouldSubmit = true;
    } catch {
      if (file.size > MAX_IMAGE_SIZE) {
        setLocalError("Thiết bị không thể nén ảnh này xuống dưới 5 MB. Vui lòng chọn ảnh khác.");
        return;
      }
      shouldSubmit = true;
    } finally {
      setCompressing(false);
      if (shouldSubmit) {
        confirmedSubmitRef.current = true;
        form.requestSubmit();
      }
    }
  }

  return (
    <form
      action={formAction}
      onSubmit={handleSubmit}
      encType="multipart/form-data"
      className={
        compact
          ? "space-y-4"
          : "space-y-3 rounded-xl border border-teal-200 bg-white p-5"
      }
    >
      <input type="hidden" name="requestId" value={requestId} />
      <div>
        <label
          htmlFor={`signed-leave-document-${requestId}`}
          className="mb-1 block text-xs font-semibold text-slate-800"
        >
          Ảnh hoặc PDF giấy xin nghỉ đã ký
        </label>
        <input
          ref={fileInputRef}
          id={`signed-leave-document-${requestId}`}
          name="documentFile"
          type="file"
          accept="application/pdf,image/png,image/jpeg,.pdf,.png,.jpg,.jpeg"
          required
          onChange={(event) =>
            setSelectedFileName(event.target.files?.[0]?.name || "")
          }
          className="block w-full text-xs text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-emerald-50 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-[#005a3c]"
        />
        <p className="mt-1 flex items-center gap-1 text-[11px] text-slate-500">
          <Sparkles className="h-3 w-3 text-teal-600" />
          Ảnh sẽ tự thu nhỏ và chuyển sang JPEG; dung lượng sau nén tối đa 5 MB.
          PDF được giữ nguyên và tối đa 50 MB.
        </p>
        {selectedFileName && (
          <p className="mt-1 truncate text-[11px] font-medium text-teal-700">
            Tệp sẵn sàng: {selectedFileName}
          </p>
        )}
      </div>

      {(state.error || localError) && (
        <div className="flex items-center rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700">
          <AlertCircle className="mr-1.5 h-4 w-4 shrink-0" />
          <span>{state.error || localError}</span>
        </div>
      )}

      <UploadButton compressing={compressing} />
    </form>
  );
}
