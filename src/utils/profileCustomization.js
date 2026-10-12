export const PROFILE_CUSTOMIZATION_PREFIX = 'tenzora_profile_customization:';

export function getProfileCustomizationKey(userOrAccountId) {
  if (typeof userOrAccountId === 'string' && userOrAccountId.startsWith(PROFILE_CUSTOMIZATION_PREFIX)) {
    return userOrAccountId;
  }
  const accountId = typeof userOrAccountId === 'object'
    ? userOrAccountId?._id || userOrAccountId?.id || userOrAccountId?.username
    : userOrAccountId;
  return `${PROFILE_CUSTOMIZATION_PREFIX}${accountId || 'guest'}`;
}

export function getProfileCustomization(userOrAccountId) {
  if (typeof window === 'undefined') return { avatar: null, frame: null, title: null };

  try {
    const saved = JSON.parse(window.localStorage.getItem(getProfileCustomizationKey(userOrAccountId)) || 'null');
    return {
      avatar: typeof saved?.avatar === 'string' ? saved.avatar : null,
      frame: saved?.frame && typeof saved.frame === 'object' ? saved.frame : null,
      title: saved?.title && typeof saved.title === 'object' ? saved.title : null,
    };
  } catch {
    return { avatar: null, frame: null, title: null };
  }
}

export function getCurrentProfileAppearance(user) {
  const saved = getProfileCustomization(user);
  return {
    avatar: saved.avatar || user?.avatar || '',
    frame: saved.frame || user?.userFrame || user?.frame || null,
    title: saved.title || user?.userTitle || user?.title || null,
  };
}

// Build the exact wire shape expected by chat, comment, and community APIs.
// This reads localStorage at call time, so a submission always uses the latest
// modal save instead of a stale render-time snapshot.
export function getCurrentProfilePayload(user) {
  const appearance = getCurrentProfileAppearance(user);
  return {
    avatar: appearance.avatar,
    userFrame: appearance.frame,
    userTitle: appearance.title,
  };
}
