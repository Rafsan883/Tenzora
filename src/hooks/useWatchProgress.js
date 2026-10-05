import { useRef, useEffect, useCallback } from 'react';
import { updateProgress } from '../services/progressService';
import { isPlayerMessage } from '../utils/playerMessages';

export function useWatchProgress({ user, anime, id, activeEpisode, getTitle, setGlobalProgress, iframeRef }) {
  const captured = useRef({ time: 0, duration: 0, dirty: false });
  const persistRef = useRef(() => {});
  const onTimeUpdate = useCallback((time, duration) => {
    if (!Number.isFinite(time) || time < 0) return;
    captured.current.time = Math.floor(time);
    if (Number.isFinite(duration) && duration > 0) captured.current.duration = Math.floor(duration);
    captured.current.dirty = true;
    persistRef.current();
  }, []);

  useEffect(() => {
    if (!anime || !id || !activeEpisode) return;
    const frame = { time: 0, duration: 0, dirty: false };
    captured.current = frame;
    let lastSave = 0;
    let active = true;
    const image = anime.coverImage || anime.image;
    const base = {
      animeId: anime.isMAL && !anime.anilistId ? `mal:${id}` : String(anime.anilistId || anime.id || id), episode: activeEpisode, title: getTitle(anime.title),
      coverImage: typeof image === 'string' ? image : image?.extraLarge || image?.large || image?.medium,
      anilistId: anime.anilistId || (!anime.isMAL ? anime.id : undefined),
      idMal: anime.idMal,
      isMAL: Boolean(anime.isMAL && !anime.anilistId),
    };
    const persist = (force = false) => {
      if (!frame.dirty || frame.time <= 5 || (!force && Date.now() - lastSave < 30000)) return;
      lastSave = Date.now();
      frame.dirty = false;
      const data = { ...base, currentTime: frame.time, duration: frame.duration, updatedAt: Date.now() };
      if (!user) {
        setGlobalProgress(prev => [data, ...prev.filter(p => p.animeId !== data.animeId)].slice(0, 100));
        return;
      }
      if (force) {
        const token = localStorage.getItem('token');
        if (token) void fetch(`${import.meta.env.VITE_BACKEND_API || ''}/progress/save`, {
          method: 'POST', keepalive: true,
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'x-api': 'true' },
          body: JSON.stringify(data),
        }).catch(() => {});
      } else {
        void updateProgress(data.animeId, data.episode, data.currentTime, data.duration, data.title, data.coverImage, data.anilistId, { idMal: data.idMal, isMAL: data.isMAL }).then(result => {
          if (active && result.success) setGlobalProgress(prev => [result.progress, ...prev.filter(p => p.animeId !== result.progress.animeId)].slice(0, 100));
          if (!result.success) frame.dirty = true;
        }).catch(() => { frame.dirty = true; });
      }
    };
    persistRef.current = persist;
    const leave = () => persist(true);
    const visibility = () => { if (document.visibilityState === 'hidden') leave(); };
    window.addEventListener('pagehide', leave);
    window.addEventListener('beforeunload', leave);
    document.addEventListener('visibilitychange', visibility);
    const interval = setInterval(() => persist(), 30000);
    return () => {
      active = false;
      persist(true);
      clearInterval(interval);
      window.removeEventListener('pagehide', leave);
      window.removeEventListener('beforeunload', leave);
      document.removeEventListener('visibilitychange', visibility);
      persistRef.current = () => {};
    };
  }, [user, anime, id, activeEpisode, getTitle, setGlobalProgress]);

  useEffect(() => {
    const capture = event => {
      if (!isPlayerMessage(event, iframeRef)) return;
      let data = event.data;
      if (typeof data === 'string') { try { data = JSON.parse(data); } catch { return; } }
      if (!data || typeof data !== 'object') return;
      const number = values => values.find(value => typeof value === 'number' && Number.isFinite(value) && value >= 0);
      const time = number([data.currentTime, data.time, data.seconds, data.position, data.data?.currentTime, data.value?.currentTime]);
      const duration = number([data.duration, data.totalTime, data.data?.duration, data.value?.duration]);
      if (time !== undefined) onTimeUpdate(time, duration);
    };
    window.addEventListener('message', capture);
    return () => window.removeEventListener('message', capture);
  }, [iframeRef, onTimeUpdate]);
  return { onTimeUpdate };
}
