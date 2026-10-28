'use client';

import { useEffect, useState } from 'react';

export default function UserAvatar({
  name,
  className = '',
}: {
  name: string;
  className?: string;
}) {
  const [version, setVersion] = useState(0);
  const [imageSrc, setImageSrc] = useState<string | null>(null);

  useEffect(() => {
    const refreshAvatar = () => {
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

    fetch(`/api/profile/avatar?v=${version}`, { cache: 'no-store' })
      .then((response) => response.ok ? response.blob() : null)
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
  }, [version]);

  return (
    <span className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden ${className}`}>
      <span className="font-bold">{name.slice(0, 2).toUpperCase()}</span>
      {imageSrc && <img src={imageSrc} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover" />}
    </span>
  );
}
