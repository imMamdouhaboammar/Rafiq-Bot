import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ProfileImageViewerProps {
  open: boolean;
  imageUrl?: string;
  alt: string;
  onClose: () => void;
}

const ProfileImageViewer: React.FC<ProfileImageViewerProps> = ({ open, imageUrl, alt, onClose }) => {
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open || !imageUrl) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
      role="dialog" aria-label="عرض صورة البروفايل"
      aria-modal="true"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute left-4 top-4 grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
        title="إغلاق"
      >
        <X size={24} />
      </button>
      <img
        src={imageUrl}
        alt={alt}
        className="max-h-[88vh] max-w-[92vw] rounded-2xl object-contain shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      />
    </div>
  );
};

export default ProfileImageViewer;
