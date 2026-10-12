import { useMemo, useState } from 'react';
import { Check, Crown, Loader2, User } from 'lucide-react';

const ITEMS_PER_PAGE = 24;

export default function AnikotoCatalog({ items, kind, currentAvatar, isLoading, error, selectedItemId, onSelect }) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const categories = useMemo(() => [...new Set(items.map(item => item.category))].sort(), [items]);
  const filteredData = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter(item => (!category || item.category === category)
      && (!query || `${item.item_name} ${item.category}`.toLowerCase().includes(query)));
  }, [items, search, category]);
  const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);
  const currentPage = Math.max(1, Math.min(page, totalPages));
  const currentItems = filteredData.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const firstItem = filteredData.length ? (currentPage - 1) * ITEMS_PER_PAGE + 1 : 0;
  const lastItem = Math.min(currentPage * ITEMS_PER_PAGE, filteredData.length);

  if (isLoading) {
    return <div role="status" className="flex items-center justify-center gap-2 py-16 text-sm text-white/60"><Loader2 size={18} className="animate-spin" /> Loading customization catalog…</div>;
  }
  if (error) {
    return <div role="alert" className="rounded-xl border border-red-400/20 bg-red-400/5 p-4 text-sm text-red-300">{error} Close and reopen customization to retry.</div>;
  }

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <input
          type="search"
          aria-label={`Search ${kind}`}
          placeholder={`Search ${kind}…`}
          value={search}
          onChange={event => { setSearch(event.target.value); setPage(1); }}
          className="w-full rounded-lg border border-white/10 bg-[#111] px-3 py-2 text-sm text-white placeholder:text-white/35 focus:border-cyan-300/50 focus:outline-none"
        />
        <select
          aria-label={`${kind} category`}
          value={category}
          onChange={event => { setCategory(event.target.value); setPage(1); }}
          className="w-full rounded-lg border border-white/10 bg-[#111] px-3 py-2 text-sm text-white focus:border-cyan-300/50 focus:outline-none"
        >
          <option value="">All categories</option>
          {categories.map(value => <option key={value} value={value}>{value}</option>)}
        </select>
        <p className="text-xs text-white/40">Showing {firstItem}–{lastItem} of {filteredData.length} {kind} · Prices in Mana</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3" aria-label={`${kind} catalog`}>
        {currentItems.map(item => (
          <button
            key={item.id}
            type="button"
            aria-label={`Select ${item.item_name}`}
            aria-pressed={selectedItemId === item.id}
            onClick={() => onSelect(item)}
            className={`relative min-w-0 cursor-pointer rounded-xl border p-3 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a855f7] ${selectedItemId === item.id
              ? 'border-[#a855f7] ring-2 ring-[#a855f7] bg-white/5'
              : 'border-white/10 bg-white/[0.02] hover:border-purple-400/50 hover:bg-white/5'}`}
          >
            {selectedItemId === item.id && (
              <span className="absolute right-2 top-2 z-10 rounded-full bg-[#a855f7] p-1 text-white" aria-hidden="true">
                <Check size={12} strokeWidth={3} />
              </span>
            )}
            {item.animated_image_url ? (
              <div className="relative mx-auto mb-3 aspect-square w-full max-w-28">
                <div className="absolute inset-3 flex items-center justify-center overflow-hidden rounded-full bg-white/5">
                  {currentAvatar
                    ? <img src={currentAvatar} alt="" width="88" height="88" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                    : <User size={36} className="text-white/30" aria-hidden="true" />}
                </div>
                <img
                  src={item.animated_image_url}
                  alt={item.item_name}
                  width="112"
                  height="112"
                  loading="lazy"
                  decoding="async"
                  className="pointer-events-none absolute inset-0 h-full w-full object-contain"
                />
              </div>
            ) : (
              <div className="mb-3 flex min-h-20 items-center justify-center">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-xs font-semibold text-cyan-200">
                  <Crown size={14} className="shrink-0" aria-hidden="true" /> {item.item_name}
                </span>
              </div>
            )}
            <h3 className="text-xs font-semibold text-white">{item.item_name}</h3>
            <p className="mt-1 text-[11px] text-white/40">{item.category}</p>
            <p className="mt-2 text-xs text-cyan-200">{item.price_mana.toLocaleString()} Mana</p>
          </button>
        ))}
      </div>
      {filteredData.length === 0 && <p role="status" className="py-8 text-center text-sm text-white/50">No {kind} match your search.</p>}
      {totalPages > 1 && (
        <nav aria-label={`${kind} pages`} className="flex items-center justify-between gap-3 text-xs">
          <button type="button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)} className="rounded-lg bg-white/5 px-3 py-2 text-white/70 hover:bg-white/10 disabled:opacity-30">Previous</button>
          <span className="text-white/40">Page {currentPage} of {totalPages}</span>
          <button type="button" disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)} className="rounded-lg bg-white/5 px-3 py-2 text-white/70 hover:bg-white/10 disabled:opacity-30">Next</button>
        </nav>
      )}
    </div>
  );
}
