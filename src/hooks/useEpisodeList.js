import { useState, useMemo, useEffect } from "react";

export const EPISODES_PER_PAGE = 50;

function episodeNumber(value) {
  if (typeof value === "number" || typeof value === "string") {
    const number = Number(value);
    return Number.isInteger(number) && number > 0 ? number : null;
  }

  if (!value || typeof value !== "object") return null;

  const titleMatch = String(value.title ?? value.name ?? "").match(/(?:episode|ep)\s*(\d+)/i);
  const number = Number(value.number ?? value.episode ?? value.mal_id ?? titleMatch?.[1]);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function hasAired(episode) {
  if (!episode || typeof episode !== "object") return true;
  const airDate = episode.airDate ?? episode.airdate ?? episode.aired;
  const timestamp = airDate ? new Date(airDate).getTime() : NaN;
  return !Number.isFinite(timestamp) || timestamp <= Date.now();
}

function episodeNumbersFrom(source) {
  if (!Array.isArray(source)) return [];
  return source.filter(hasAired).map((episode, index) => episodeNumber(episode) || index + 1);
}

function episodeNumbersFromMap(source) {
  if (!source || typeof source !== "object" || Array.isArray(source)) return [];
  return Object.entries(source)
    .filter(([, episode]) => hasAired(episode))
    .map(([number]) => episodeNumber(number))
    .filter(Boolean);
}

/**
 * Build the selectable episode numbers from all provider/catalog shapes.
 * Providers do not agree on whether episode data is an array or a count, so
 * the highest trustworthy number wins. This also keeps airing series from
 * falling back to episode 1 just because they have no nextAiringEpisode.
 */
export function buildEpisodeNumbers({ anime, episodeMetadata, episodeCount, malEpisodes, tmdbEpisodes, kitsuEpisodes }) {
  const metadataNumbers = [
    ...episodeNumbersFrom(anime?.episodeList),
    ...episodeNumbersFrom(anime?.episodes),
    ...episodeNumbersFrom(anime?.streamingEpisodes),
    ...episodeNumbersFrom(episodeMetadata),
    ...episodeNumbersFrom(malEpisodes),
    ...episodeNumbersFromMap(tmdbEpisodes),
    ...episodeNumbersFromMap(kitsuEpisodes),
  ];

  const declaredCounts = [
    episodeCount,
    anime?.episodeCount,
    typeof anime?.episodes === "number" || typeof anime?.episodes === "string" ? anime.episodes : null,
  ]
    .map(Number)
    .filter(number => Number.isFinite(number) && number > 0);

  // A known next airing episode limits planned season totals to aired episodes.
  // Actual metadata can still extend the list when the schedule is stale.
  const nextEpisode = episodeNumber(anime?.nextAiringEpisode?.episode);
  const declaredCount = declaredCounts.reduce((highest, number) => Math.max(highest, number), 0);
  const airedCount = nextEpisode ? nextEpisode - 1 : declaredCount;
  const count = Math.floor(metadataNumbers.reduce((highest, number) => Math.max(highest, number), Math.max(airedCount, 1)));
  return Array.from({ length: count }, (_, index) => index + 1);
}

/**
 * useEpisodeList
 * Handles computing the total episodes list, filtering by search query,
 * filtering out filler episodes, and managing pagination state.
 */
export function useEpisodeList({
  anime,
  episodeMetadata,
  episodeCount,
  malEpisodes,
  tmdbEpisodes,
  kitsuEpisodes,
  activeEpisode,
  setActiveEpisode,
  id,
  fillerData,
  hideFillerEpisodes,
}) {
  const [episodePage, setEpisodePage] = useState(0);
  const [episodeSearchQuery, setEpisodeSearchQuery] = useState("");
  const [isEpisodeSearchOpen, setIsEpisodeSearchOpen] = useState(false);

  // Reset or set active episode when navigating to a different anime
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const targetEp = parseInt(params.get("ep")) || 1;

    setTimeout(() => {
      setActiveEpisode(targetEp);
      setEpisodePage(0);
    }, 0);
  }, [id, setActiveEpisode]);

  // Auto-jump to the correct page when active episode changes
  useEffect(() => {
    const targetPage = Math.floor((activeEpisode - 1) / EPISODES_PER_PAGE);
    setTimeout(() => setEpisodePage(targetPage), 0);
  }, [activeEpisode]);

  const episodesList = useMemo(() => {
    if (!anime) return [];

    return buildEpisodeNumbers({
      anime,
      episodeMetadata,
      episodeCount,
      malEpisodes,
      tmdbEpisodes,
      kitsuEpisodes,
    });
  }, [anime, episodeMetadata, episodeCount, malEpisodes, tmdbEpisodes, kitsuEpisodes]);

  const filteredEpisodes = useMemo(() => {
    let result = episodesList;

    // Filter out filler episodes if the toggle is ON
    if (hideFillerEpisodes && fillerData) {
      result = result.filter(ep => {
        const epData = fillerData[ep];
        if (!epData) return true;
        // Don't hide the episode if the user is currently watching it
        if (ep === activeEpisode) return true;
        
        // Only hide Pure Filler or Recap (NOT Mixed Canon)
        const isPureFiller = (epData.isFiller || epData.isRecap) && !epData.isMixed;
        return !isPureFiller;
      });
    }

    if (!episodeSearchQuery) return result;
    
    // Filter by search query
    const query = episodeSearchQuery.toLowerCase().trim();
    return result.filter((ep) => {
      const epStr = String(ep);
      const jikanData = malEpisodes?.find((e) => e.mal_id === ep);
      const title = (jikanData?.title || "").toLowerCase();
      return epStr.includes(query) || title.includes(query);
    });
  }, [episodesList, episodeSearchQuery, malEpisodes, hideFillerEpisodes, fillerData, activeEpisode]);

  const isSearching = episodeSearchQuery.trim().length > 0;
  const effectiveTotalPages = isSearching
    ? Math.ceil(filteredEpisodes.length / EPISODES_PER_PAGE)
    : Math.ceil(episodesList.length / EPISODES_PER_PAGE);

  // Clamp episodePage when effective pages change
  useEffect(() => {
    if (effectiveTotalPages > 0 && episodePage >= effectiveTotalPages) {
      setTimeout(() => setEpisodePage(effectiveTotalPages - 1), 0);
    } else if (effectiveTotalPages === 0 && episodePage !== 0) {
      setTimeout(() => setEpisodePage(0), 0);
    }
  }, [effectiveTotalPages, episodePage]);

  return {
    episodesList,
    filteredEpisodes,
    episodePage,
    setEpisodePage,
    episodeSearchQuery,
    setEpisodeSearchQuery,
    isEpisodeSearchOpen,
    setIsEpisodeSearchOpen,
    EPISODES_PER_PAGE
  };
}
