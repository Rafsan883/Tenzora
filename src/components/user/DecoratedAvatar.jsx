import { UserCircle } from 'lucide-react';

const SIZE_CLASSES = {
  xs: 'h-6 w-6',
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-12 w-12',
  profile: 'h-[104px] w-[104px]',
};

function getFrameUrl(frame) {
  if (typeof frame === 'string') return frame;
  return frame?.animated_image_url || frame?.imageUrl || frame?.url || '';
}

function getTitleText(title) {
  if (typeof title === 'string') return title;
  return title?.item_name || title?.name || title?.label || '';
}

function getFrameLabel(frame) {
  if (typeof frame === 'string') return 'Avatar frame';
  return frame?.item_name || frame?.name || frame?.label || 'Avatar frame';
}

export default function DecoratedAvatar({
  avatar,
  frame,
  title,
  userFrame,
  userTitle,
  user,
  size = 'md',
  sizeClassName = '',
  alt = 'Avatar',
  fallbackText = '',
  className = '',
  imageClassName = '',
  showTitle = true,
}) {
  const resolvedFrame = userFrame || frame || user?.userFrame || user?.frame;
  const resolvedTitle = userTitle || title || user?.userTitle || user?.title;
  const frameUrl = getFrameUrl(resolvedFrame);
  const titleText = getTitleText(resolvedTitle);
  const frameLabel = getFrameLabel(resolvedFrame);
  const resolvedSize = sizeClassName || SIZE_CLASSES[size] || SIZE_CLASSES.md;
  const initial = fallbackText.trim().charAt(0).toUpperCase() || <UserCircle size={18} aria-hidden="true" />;

  return (
    <span className={`relative isolate inline-flex shrink-0 overflow-visible ${resolvedSize} ${className}`}>
      <span className="relative z-0 block h-full w-full overflow-hidden rounded-full border border-white/10 bg-neutral-800">
        {avatar ? (
          <img src={avatar} alt={alt} className={`h-full w-full object-cover ${imageClassName}`} loading="lazy" decoding="async" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-white/60">
            {initial}
          </span>
        )}
      </span>
      {frameUrl && (
        <img
          src={frameUrl}
          alt={`${frameLabel} avatar frame`}
          className="pointer-events-none absolute -left-[10%] -top-[10%] z-10 h-[120%] w-[120%] max-w-none object-contain"
          loading="lazy"
          decoding="async"
        />
      )}
      {showTitle && titleText && (
        <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-1 max-w-[12rem] -translate-x-1/2 truncate whitespace-nowrap rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2 py-0.5 text-[9px] font-bold leading-tight text-cyan-200">
          {titleText}
        </span>
      )}
    </span>
  );
}
