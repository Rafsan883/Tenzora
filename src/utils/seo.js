import { getSeoUrlPolicy, setResolvedSeoPolicy } from "./seoPolicy";

export const SEO_SITE_URL = "https://tenzora.top";

export function getTenzoraBrandSchema() {
  return [
    {
      "@type": "Organization",
      "@id": `${SEO_SITE_URL}/#organization`,
      name: "TenZora",
      alternateName: ["Tenzora"],
      url: `${SEO_SITE_URL}/`,
      logo: { "@type": "ImageObject", url: `${SEO_SITE_URL}/logo.png` },
      image: `${SEO_SITE_URL}/og-image.png`,
      description: "TenZora is an independent anime streaming and discovery platform at tenzora.top.",
      knowsAbout: ["anime streaming", "anime discovery", "anime episodes", "anime movies"],
      brand: { "@id": `${SEO_SITE_URL}/#brand` },
    },
    {
      "@type": "Brand",
      "@id": `${SEO_SITE_URL}/#brand`,
      name: "TenZora",
      url: `${SEO_SITE_URL}/`,
      logo: `${SEO_SITE_URL}/logo.png`,
    },
    {
      "@type": "WebSite",
      "@id": `${SEO_SITE_URL}/#website`,
      name: "TenZora",
      alternateName: ["Tenzora"],
      url: `${SEO_SITE_URL}/`,
      publisher: { "@id": `${SEO_SITE_URL}/#organization` },
      potentialAction: {
        "@type": "SearchAction",
        target: `${SEO_SITE_URL}/browse?search={search_term_string}`,
        "query-input": "required name=search_term_string",
      },
    },
  ];
}

export const updateMetaTags = ({
  title,
  description,
  image,
  url,
  keywords,
  type = "website",
  noindex = false,
  anilistId = null,
  malId = null,
  episode = null,
}) => {
  const setMeta = ({ name = null, property = null, content }) => {
    const selectors = [
      name ? `meta[name="${name}"]` : null,
      property ? `meta[property="${property}"]` : null,
    ].filter(Boolean);
    const tags = selectors.flatMap(selector => [...document.querySelectorAll(selector)]);
    if (!tags.length) {
      const tag = document.createElement("meta");
      tag.setAttribute(name ? "name" : "property", name || property);
      document.head.appendChild(tag);
      tags.push(tag);
    }
    tags.forEach(tag => tag.setAttribute("content", content));
  };

  // Update Title
  if (title) {
    const fullTitle = `${title} - TenZora`;
    document.title = fullTitle;
    setMeta({ name: "title", content: fullTitle });
    setMeta({ property: "og:title", content: fullTitle });
    setMeta({ name: "twitter:title", property: "twitter:title", content: fullTitle });
  }

  // Update Description
  if (description) {
    setMeta({ name: "description", content: description });
    setMeta({ property: "og:description", content: description });
    setMeta({ name: "twitter:description", property: "twitter:description", content: description });
  }

  // Update Keywords/
  if (keywords) {
    setMeta({ name: "keywords", content: keywords });
  }

  // Update OG Type
  setMeta({ property: "og:type", content: type });

  // Update Image
  if (image) {
    setMeta({ property: "og:image", content: image });
    setMeta({ name: "twitter:image", property: "twitter:image", content: image });
  }

  // Update URL
  if (url) {
    const policy = getSeoUrlPolicy();
    // SEO identities always use the production host, even in preview builds.
    const fullUrl = url.startsWith("http")
      ? `${SEO_SITE_URL}${new URL(url).pathname}`
      : policy.canonicalUrl;
    if (url.startsWith("http")) setResolvedSeoPolicy(fullUrl, noindex);
    setMeta({ property: "og:url", content: fullUrl });
    setMeta({ name: "twitter:url", property: "twitter:url", content: fullUrl });

    // Update Canonical
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute("href", fullUrl);
  }

  // --- MALSYNC COMPATIBILITY ---
  // Helper to update or create meta tags by name AND property
  const setMetaTags = (name, content) => {
    if (!content) {
      document.querySelector(`meta[name="${name}"]`)?.remove();
      document.querySelector(`meta[property="${name}"]`)?.remove();
      return;
    }

    // Set by name
    let nameTag = document.querySelector(`meta[name="${name}"]`);
    if (!nameTag) {
      nameTag = document.createElement('meta');
      nameTag.setAttribute('name', name);
      document.head.appendChild(nameTag);
    }
    nameTag.setAttribute("content", content);

    // Set by property (some extensions prefer this)
    let propTag = document.querySelector(`meta[property="${name}"]`);
    if (!propTag) {
      propTag = document.createElement('meta');
      propTag.setAttribute('property', name);
      document.head.appendChild(propTag);
    }
    propTag.setAttribute("content", content);
  };

  // Support for specific tracking IDs (anilist-id, mal-id)
  setMetaTags("anilist-id", anilistId);
  setMetaTags("mal-id", malId);
  setMetaTags("anime-id", anilistId || malId); // Common fallback
  setMetaTags("episode", episode);
  setMetaTags("episode-number", episode); // Variation

  // Handle NoIndex for Private Pages
  const policy = getSeoUrlPolicy();
  const robotTags = [...document.querySelectorAll('meta[name="robots"]')];
  if (!robotTags.length) {
    const robotsTag = document.createElement('meta');
    robotsTag.setAttribute('name', 'robots');
    document.head.appendChild(robotsTag);
    robotTags.push(robotsTag);
  }
  robotTags.forEach((robotsTag) => {
    robotsTag.setAttribute("content", noindex || policy.noindex ? "noindex, follow" : "index, follow");
  });
};

export const updateStructuredData = (schemaData) => {
  // Find existing schema tag
  let script = document.querySelector('script[data-dynamic-schema]');

  if (!script) {
    // If not found, create a new one (don't touch the base schema from index.html)
    script = document.createElement('script');
    script.setAttribute('type', 'application/ld+json');
    script.setAttribute('data-dynamic-schema', 'true');
    document.head.appendChild(script);
  }

  script.textContent = JSON.stringify(schemaData);
};

export const clearStructuredData = () => {
  const script = document.querySelector('script[data-dynamic-schema]');
  if (script) {
    script.remove();
  }
};
