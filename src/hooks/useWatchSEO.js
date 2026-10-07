import { useEffect } from "react";
import { getTenzoraBrandSchema, updateMetaTags, updateStructuredData, clearStructuredData } from "../utils/seo";

/**
 * useWatchSEO
 * Updates page meta tags and Schema.org structured data
 * whenever the anime or active episode changes.
 * Cleans up on unmount.
 */
export function useWatchSEO({ anime, activeEpisode, getTitle, id, isMal, canonicalUrl = null }) {
  useEffect(() => {
    if (!anime) return;

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
      // Playback parameters remain functional but are not canonical URLs.
      url: canonicalUrl || `/watch/${id}`,
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
            "@id": `${canonicalUrl || window.location.href}#episode`,
            episodeNumber: activeEpisode,
            name: `${title} - ${epTitle}`,
            image: coverImage,
            url: canonicalUrl || window.location.href,
            partOfSeries: {
              "@type": "TVSeries",
              name: title,
              image: coverImage,
              description: descText,
              url: `${import.meta.env.VITE_SITE_URL || "https://tenzora.top"}/anime/${id}`,
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
  }, [anime, activeEpisode, getTitle, id, isMal, canonicalUrl]);
}
