import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import Hls from 'hls.js';
import Plyr from 'plyr';
import 'plyr/dist/plyr.css';

const VideoPlayer = forwardRef(function VideoPlayer({ src, type, poster, subtitles = [], onEnded, onTimeUpdate, onReady, onPlay, onPause, onSeeked, onError, initialTime = 0, disableControls = false }, ref) {
  const videoRef = useRef(null);
  const callbacks = useRef({});
  useEffect(() => { callbacks.current = { onEnded, onTimeUpdate, onReady, onPlay, onPause, onSeeked, onError }; }, [onEnded, onTimeUpdate, onReady, onPlay, onPause, onSeeked, onError]);
  useImperativeHandle(ref, () => ({
    getCurrentTime: () => videoRef.current?.currentTime || 0,
    getDuration: () => videoRef.current?.duration || 0,
    seek: seconds => { if (videoRef.current && Number.isFinite(seconds)) videoRef.current.currentTime = Math.max(0, seconds); },
    play: () => videoRef.current?.play()?.catch(() => {}),
    pause: () => videoRef.current?.pause(),
    get paused() { return videoRef.current?.paused ?? true; },
  }), []);
  useEffect(() => {
    const video = videoRef.current;
    if (!video || typeof src !== 'string' || !src) return;
    let hls, player;
    const handlers = {
      ended: () => callbacks.current.onEnded?.(),
      timeupdate: () => callbacks.current.onTimeUpdate?.(video.currentTime, video.duration),
      play: () => callbacks.current.onPlay?.(),
      pause: () => callbacks.current.onPause?.(),
      seeked: () => callbacks.current.onSeeked?.(),
      error: () => callbacks.current.onError?.('mediaError'),
      loadedmetadata: () => {
        if (initialTime > 0) video.currentTime = Number.isFinite(video.duration) ? Math.min(initialTime, video.duration) : initialTime;
        callbacks.current.onReady?.();
      },
    };
    for (const [event, listener] of Object.entries(handlers)) video.addEventListener(event, listener);
    const initPlayer = () => {
      if (player) return;
      player = new Plyr(video, { captions: { active: true, update: true, language: 'en' }, keyboard: { global: false, focused: !disableControls }, controls: disableControls ? [] : ['play-large', 'play', 'progress', 'current-time', 'mute', 'volume', 'captions', 'settings', 'pip', 'fullscreen'] });
    };
    if ((type === 'hls' || src.includes('.m3u8')) && Hls.isSupported()) {
      hls = new Hls();
      hls.attachMedia(video);
      hls.loadSource(src);
      hls.on(Hls.Events.MANIFEST_PARSED, initPlayer);
      hls.on(Hls.Events.ERROR, (_event, data) => { if (data.fatal) callbacks.current.onError?.(data.type === Hls.ErrorTypes.NETWORK_ERROR ? 'network' : 'playback'); });
    } else {
      video.src = src;
      initPlayer();
    }
    return () => {
      for (const [event, listener] of Object.entries(handlers)) video.removeEventListener(event, listener);
      hls?.destroy();
      player?.destroy();
      video.pause();
      video.removeAttribute('src');
      video.load();
    };
  }, [src, type, initialTime, disableControls]);
  return <div className="w-full h-full bg-black"><video ref={videoRef} playsInline controls={!disableControls} crossOrigin="anonymous" poster={poster} className="w-full h-full">
    {subtitles.map((sub, index) => (sub.url || sub.file) && <track key={sub.url || sub.file} kind="subtitles" label={sub.label || sub.language || `Language ${index + 1}`} srcLang={sub.lang || 'und'} src={sub.url || sub.file} default={sub.default || index === 0} />)}
  </video></div>;
});
export default VideoPlayer;
