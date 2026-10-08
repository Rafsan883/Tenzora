import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getTenzoraBrandSchema, updateMetaTags, updateStructuredData, clearStructuredData } from "../utils/seo";
import { resolveAnimeProvider } from "../services/seoCatalog";
import { isUsefulEpisode } from "../../seoCatalogModel.mjs";

/**
 * useWatchSEO
 * Updates page meta tags and Schema.org structured data
 * whenever the anime or active episode changes.
 * Cleans up on unmount.
 */
export function useWatchSEO({ anime, activeEpisode, getTitle, id, isMal, canonicalUrl = null, indexable = true }) {
  const { data: seoCatalog } = useQuery({
    queryKey: ["seoCatalogWatch", isMal ? "mal" : "anilist", id],
    queryFn: ({ signal }) => resolveAnimeProvider(isMal ? "mal" : "anilist", id, signal),
    enabled: Boolean(anime && id),
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    if (!anime) return;

    const currentPath = window.location.pathname;
    const queryParams = new URLSearchParams(window.location.search);
    const episodeRequested = /^\/anime\/[^/]+\/episode\/\d+$/u.test(currentPath) || queryParams.has("ep");
    const episodeMeta = seoCatalog?.episodes?.find(item => Number(item.number) === Number(activeEpisode));
    const episodeIndexable = !episodeRequested || !seoCatalog || isUsefulEpisode(episodeMeta);
    const seriesUrl = seoCatalog?.canonicalUrl
      || canonicalUrl?.replace(/\/episode\/\d+$/u, "")
      || null;
    const resolvedCanonicalUrl = seriesUrl
      ? `${seriesUrl}${episodeRequested && episodeIndexable ? `/episode/${activeEpisode}` : ""}`
      : canonicalUrl;
    const effectiveIndexable = indexable && episodeIndexable;
    const title = getTitle(anime.title) || "Watch Anime";
    const coverImage =
      anime.bannerImage ||
      anime.coverImage?.extraLarge ||
      anime.coverImage?.large;
    const descText = anime.description
      ? anime.description.replace(/<[^>]+>/g, "").substring(0, 160)
      : "Watch this anime online for free in high quality.";

    const epTitle = `Episode ${activeEpisode}`;
    const pageTitle = `Watch ${title} ${epTitle} English Sub/Dub`;
    const pageKeywords = `${title}, ${title} ${epTitle}, watch ${title} online, ${title} english sub, ${title} english dub, tenzora, free anime streaming`;

    // Update Meta Tags
    updateMetaTags({
      title: pageTitle,
      description: `Watch ${title} ${epTitle} English Sub/Dub in High Quality. ${descText}`,
      image: coverImage,
      keywords: pageKeywords,
      type: "video.episode",
      noindex: !effectiveIndexable,
      // Playback parameters remain functional but are not canonical URLs.
      url: resolvedCanonicalUrl || `/watch/${id}`,
      anilistId: isMal ? null : id,
      malId: anime?.idMal || (isMal ? id : null),
      episode: activeEpisode,
    });

    // Generate truthful series/episode structured data. VideoObject is added
    // by the edge renderer only when unique episode metadata is available.
    const schema = {
        "@context": "https://schema.org",
        "@graph": [
          ...getTenzoraBrandSchema(),
          {
            "@type": "TVEpisode",
            "@id": `${resolvedCanonicalUrl || window.location.href}#episode`,
            episodeNumber: activeEpisode,
            name: `${title} - ${epTitle}`,
            image: coverImage,
            url: resolvedCanonicalUrl || window.location.href,
            partOfSeries: {
              "@type": "TVSeries",
              name: title,
              image: coverImage,
              description: descText,
              url: seriesUrl || `${import.meta.env.VITE_SITE_URL || "https://tenzora.top"}/anime/${id}`,
              publisher: { "@id": "https://tenzora.top/#organization" },
            },
          },
        ],
      };

    updateStructuredData(schema);

    // Cleanup when leaving component
    return () => {
      clearStructuredData();
      updateMetaTags({
        title: "Watch Free Anime Online, Stream Subbed & Dubbed HD",
        description:
          "TenZora is the best website to watch anime online for free. Watch trending, popular, and new releases with SUB, DUB in HD quality. No Ads Guaranteed! WATCH NOW!",
        url: "/",
      });
    };
  }, [anime, activeEpisode, getTitle, id, isMal, canonicalUrl, indexable, seoCatalog]);
}
