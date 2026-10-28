'use client';

import { useEffect, useRef, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Camera, ImagePlus, Loader2 } from 'lucide-react';
import { ProfileActionState, updateProfileAvatarAction } from '@/lib/profile/actions';

function SaveAvatarButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#005a3c] px-3.5 py-2 text-xs font-bold text-white transition-colors hover:bg-[#044e3f] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
      {pending ? 'Đang cập nhật...' : 'Cập nhật ảnh'}
    </button>
  );
}

export default function AvatarUploadForm() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState('');
  const [fileName, setFileName] = useState('');
  const [state, formAction] = useFormState<ProfileActionState | null, FormData>(updateProfileAvatarAction, null);

  useEffect(() => {
    if (!state?.success) return;
    setPreview('');
    setFileName('');
    if (fileRef.current) fileRef.current.value = '';
    window.dispatchEvent(new Event('profile-avatar-updated'));
    router.refresh();
  }, [state, router]);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  return (
    <form action={formAction} className="w-full space-y-3 text-left">
      <label htmlFor="profile-avatar-file" className="block text-xs font-semibold text-slate-700">
        Ảnh đại diện
      </label>
      <input
        ref={fileRef}
        id="profile-avatar-file"
        name="avatarFile"
        type="file"
        accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
        required
        onChange={(event) => {
          const file = event.target.files?.[0];
          setFileName(file?.name || '');
          setPreview((current) => {
            if (current) URL.revokeObjectURL(current);
            return file ? URL.createObjectURL(file) : '';
          });
        }}
        className="sr-only"
      />
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-[#005a3c] transition-colors hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
        >
          <ImagePlus className="h-4 w-4" />
          Chọn ảnh
        </button>
        <span className="min-w-0 truncate text-xs text-slate-500">
          {fileName || 'Chưa chọn ảnh'}
        </span>
      </div>
      <p className="text-[11px] text-slate-500">JPEG, PNG hoặc WEBP; tối đa 5 MB.</p>
      {preview && <img src={preview} alt="Xem trước ảnh đại diện" className="h-20 w-20 rounded-2xl border border-slate-200 object-cover" />}
      {state?.error && <p role="alert" className="text-xs font-medium text-rose-700">{state.error}</p>}
      {state?.success && <p role="status" className="text-xs font-medium text-emerald-700">Đã cập nhật ảnh đại diện.</p>}
      <SaveAvatarButton />
    </form>
  );
}
