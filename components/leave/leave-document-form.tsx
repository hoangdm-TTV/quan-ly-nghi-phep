'use client';

import { FormEvent, useRef, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { AlertCircle, Loader2, Upload, Sparkles } from 'lucide-react';
import { uploadLeaveDocumentAction, LeaveActionState } from '@/lib/leave/actions';

const MAX_IMAGE_EDGE = 2200;
const JPEG_QUALITY = 0.82;

async function optimizeImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file;

  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));

    const context = canvas.getContext('2d');
    if (!context) return file;
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const compressedBlob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY);
    });

    if (!compressedBlob || compressedBlob.size >= file.size) return file;

    const baseName = file.name.replace(/\.[^.]+$/, '') || 'signed-leave-document';
    return new File([compressedBlob], `${baseName}.jpg`, {
      type: 'image/jpeg',
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
      className="inline-flex items-center rounded-lg bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
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

export default function LeaveDocumentForm({ requestId }: { requestId: string }) {
  const initialState: LeaveActionState = {};
  const [state, formAction] = useFormState(uploadLeaveDocumentAction, initialState);
  const [compressing, setCompressing] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const confirmedSubmitRef = useRef(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (confirmedSubmitRef.current) {
      confirmedSubmitRef.current = false;
      return;
    }

    const file = fileInputRef.current?.files?.[0];
    if (!file || file.type === 'application/pdf') return;

    event.preventDefault();
    setCompressing(true);
    try {
      const optimizedFile = await optimizeImage(file);
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(optimizedFile);
      if (fileInputRef.current) fileInputRef.current.files = dataTransfer.files;
      setSelectedFileName(optimizedFile.name);
    } catch {
      // Nếu thiết bị không hỗ trợ nén, vẫn cho phép upload file gốc.
    } finally {
      setCompressing(false);
      confirmedSubmitRef.current = true;
      event.currentTarget.requestSubmit();
    }
  }

  return (
    <form
      action={formAction}
      onSubmit={handleSubmit}
      encType="multipart/form-data"
      className="space-y-3 rounded-xl border border-teal-200 bg-white p-5"
    >
      <input type="hidden" name="requestId" value={requestId} />
      <div>
        <label htmlFor="signed-leave-document" className="mb-1 block text-xs font-semibold text-slate-800">
          Ảnh hoặc PDF giấy xin nghỉ đã ký
        </label>
        <input
          ref={fileInputRef}
          id="signed-leave-document"
          name="documentFile"
          type="file"
          accept="application/pdf,image/png,image/jpeg,.pdf,.png,.jpg,.jpeg"
          required
          onChange={(event) => setSelectedFileName(event.target.files?.[0]?.name || '')}
          className="block w-full text-xs text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-teal-50 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-teal-700"
        />
        <p className="mt-1 flex items-center gap-1 text-[11px] text-slate-500">
          <Sparkles className="h-3 w-3 text-teal-600" />
          Ảnh sẽ tự thu nhỏ và chuyển sang JPEG để upload nhanh hơn; tối đa 50 MB. PDF được giữ nguyên.
        </p>
        {selectedFileName && <p className="mt-1 truncate text-[11px] font-medium text-teal-700">Tệp sẵn sàng: {selectedFileName}</p>}
      </div>

      {state.error && (
        <div className="flex items-center rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700">
          <AlertCircle className="mr-1.5 h-4 w-4 shrink-0" />
          <span>{state.error}</span>
        </div>
      )}

      <UploadButton compressing={compressing} />
    </form>
  );
}
