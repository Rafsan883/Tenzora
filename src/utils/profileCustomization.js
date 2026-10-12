export const PROFILE_CUSTOMIZATION_PREFIX = 'tenzora_profile_customization:';

export function getProfileCustomizationKey(userOrAccountId) {
  if (typeof userOrAccountId === 'string' && userOrAccountId.startsWith(PROFILE_CUSTOMIZATION_PREFIX)) {
    return userOrAccountId;
  }
  const accountId = typeof userOrAccountId === 'object'
    ? userOrAccountId?._id || userOrAccountId?.id || userOrAccountId?.profileId || userOrAccountId?.username
    : userOrAccountId;
  return `${PROFILE_CUSTOMIZATION_PREFIX}${accountId || 'guest'}`;
}

export function getProfileCustomization(userOrAccountId) {
  if (typeof window === 'undefined') return { avatar: null, frame: null, title: null };

  const candidateKeys = [getProfileCustomizationKey(userOrAccountId)];
  if (typeof userOrAccountId === 'object' && userOrAccountId) {
    if (userOrAccountId.username) candidateKeys.push(`${PROFILE_CUSTOMIZATION_PREFIX}${userOrAccountId.username}`);
    if (userOrAccountId._id) candidateKeys.push(`${PROFILE_CUSTOMIZATION_PREFIX}${userOrAccountId._id}`);
    if (userOrAccountId.id) candidateKeys.push(`${PROFILE_CUSTOMIZATION_PREFIX}${userOrAccountId.id}`);
    if (userOrAccountId.profileId) candidateKeys.push(`${PROFILE_CUSTOMIZATION_PREFIX}${userOrAccountId.profileId}`);
  }
  candidateKeys.push(`${PROFILE_CUSTOMIZATION_PREFIX}current`);

  for (const key of candidateKeys) {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved && (saved.avatar || saved.frame || saved.title)) {
          return {
            avatar: typeof saved.avatar === 'string' ? saved.avatar : null,
            frame: saved.frame ? saved.frame : null,
            title: saved.title ? saved.title : null,
          };
        }
      }
    } catch {
      // Continue to next key
    }
  }

  // Fallback to cached_user in localStorage if available
  try {
    const rawCached = window.localStorage.getItem('cached_user');
    if (rawCached) {
      const cached = JSON.parse(rawCached);
      if (cached && (cached.avatar || cached.userFrame || cached.frame || cached.userTitle || cached.title)) {
        return {
          avatar: typeof cached.avatar === 'string' ? cached.avatar : null,
          frame: cached.userFrame || cached.frame || null,
          title: cached.userTitle || cached.title || null,
        };
      }
    }
  } catch {
    // Ignore error
  }

  return { avatar: null, frame: null, title: null };
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
    frame: appearance.frame,
    title: appearance.title,
  };
}

