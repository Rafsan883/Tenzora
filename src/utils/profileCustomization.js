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
