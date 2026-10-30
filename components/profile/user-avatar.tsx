'use client';

import { useEffect, useState } from 'react';

let avatarBlobRequest: { userId: string; promise: Promise<Blob | null> } | null = null;

function loadAvatarBlob(userId: string): Promise<Blob | null> {
  if (!avatarBlobRequest || avatarBlobRequest.userId !== userId) {
    const promise = fetch('/api/profile/avatar', { cache: 'no-store' })
      .then((response) => response.ok ? response.blob() : null)
      .catch(() => null);
    avatarBlobRequest = { userId, promise };
  }
  return avatarBlobRequest.promise;
}

export default function UserAvatar({
  userId,
  name,
  className = '',
}: {
  userId: string;
  name: string;
  className?: string;
}) {
  const [version, setVersion] = useState(0);
  const [imageSrc, setImageSrc] = useState<string | null>(null);

  useEffect(() => {
    const refreshAvatar = () => {
      avatarBlobRequest = null;
      setImageSrc(null);
      setVersion(Date.now());
    };
    window.addEventListener('profile-avatar-updated', refreshAvatar);
    return () => window.removeEventListener('profile-avatar-updated', refreshAvatar);
  }, []);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    setImageSrc(null);

    loadAvatarBlob(userId)
      .then((blob) => {
        if (!active || !blob) return;
        objectUrl = URL.createObjectURL(blob);
        setImageSrc(objectUrl);
      })
      .catch(() => undefined);

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [userId, version]);

  return (
    <span className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden ${className}`}>
      <span className="font-bold">{name.slice(0, 2).toUpperCase()}</span>
      {imageSrc && <img src={imageSrc} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover" />}
    </span>
  );
}
