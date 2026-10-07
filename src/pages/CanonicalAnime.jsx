import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { resolveAnimeSlug } from '../services/seoCatalog';
import AnimeDetails from './AnimeDetails';

export default function CanonicalAnime() {
  const { slug } = useParams();
  const { data: catalog, isLoading } = useQuery({
    queryKey: ['seoCatalogAnime', slug],
    queryFn: ({ signal }) => resolveAnimeSlug(slug, signal),
    enabled: Boolean(slug),
    staleTime: 1000 * 60 * 5,
  });

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="w-10 h-10 border-4 border-discord-600 border-t-transparent flex items-center justify-center rounded-full animate-spin" /></div>;
  }

  return <AnimeDetails resolvedCatalog={catalog} />;
}
