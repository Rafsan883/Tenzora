# Repair verification

Local preview uses an isolated, temporary MongoDB database. See Git history for the published repair changes.

Verified checks:

- 13 backend regression tests: password hashing, Google account creation, profile saves, password/email changes, recovery, token revocation, bans, one-time AniList OAuth state, concurrent list operations, validated imports, and MAL/AniList namespaces.
- 17 integration/regression tests: all twelve watch routes, media headers/Range, redirects/private-network blocking, bounded playlists, subtitle conversion, provider budgets/deadlines, cache isolation, metadata fallbacks, Turnstile verification, and AI event-stream failures.
- Browser smoke: local administrator sign-in and nine pages, including Watch, without application runtime errors.
- Live socket smoke: canonical identities, host-only playback state updates, room switching, protected presence updates, and revoked sessions.
- All eight services respond successfully at their preview/documentation/health addresses.
- Frontend lint: zero errors/warnings. Production build and search-query parser validation pass; large-bundle warnings remain.
- Nine JavaScript package audits report zero vulnerabilities.
- Both Cloudflare Worker deployment bundles pass dry runs. Python metadata syntax passes.

External limitations:

- Stream discovery returned Reanime HLS/embed sources after repairing the metadata fallback. The sampled native HLS playlist could not be played reliably from the upstream provider. Standard playback prefers the provider embed; native/watch-together video playback still requires an accessible compatible source.
- Jikan connections timed out intermittently in this environment. AniList metadata remains usable, with fallback errors bounded.
- Actual email, Google/AniList OAuth, AI generation, Turnstile challenges, and Telegram uploads need owner-configured credentials. Local email recovery/verification links are development-only.
- Previously exposed credentials need rotation. Current-source removal does not clean existing Git history.
- Publication includes substantive source changes and removes tracked dependency/build/cache artifacts. Existing user changes and local installations have been preserved; unrelated line-ending-only changes remain local.

See [LOCAL_PREVIEW.md](LOCAL_PREVIEW.md) for startup, account, ports, and test commands.
