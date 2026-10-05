import { useState, useEffect } from 'react';
import { getSchedule } from '../services/api';
import AnimeCard from '../components/common/AnimeCard';
import SkeletonCard from '../components/common/SkeletonCard';
import Navbar from '../components/layout/Navbar';
import Footer from '../components/layout/Footer';
import { Calendar } from 'lucide-react';

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function Schedule() {
  const [activeDay, setActiveDay] = useState(() => (new Date().getDay() + 6) % 7);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (date.getDay() + 6) % 7 + activeDay);
    const end = new Date(date);
    end.setDate(end.getDate() + 1);
    const load = async () => {
      setLoading(true);
      try {
        const result = await getSchedule(Math.floor(date.getTime() / 1000), Math.floor(end.getTime() / 1000));
        if (active) setEntries(result || []);
      } catch { if (active) setEntries([]); }
      finally { if (active) setLoading(false); }
    };
    void load();
    return () => { active = false; };
  }, [activeDay]);
  return <div className="min-h-screen bg-bg text-white">
    <Navbar />
    <main className="container mx-auto pt-24 pb-12 px-4">
      <h1 className="flex gap-3 text-3xl font-bold mb-3"><Calendar /> Estimated Schedule</h1>
      <p className="text-white/50 mb-8">Confirmed airing times for this week, shown in your timezone.</p>
      <div className="flex flex-wrap gap-3 mb-8">{days.map((day, index) => <button key={day} onClick={() => setActiveDay(index)} className={`px-5 py-3 rounded ${activeDay === index ? 'bg-discord-600' : 'bg-white/5'}`}>{day}</button>)}</div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5">
        {loading ? Array.from({ length: 12 }, (_, index) => <SkeletonCard key={index} />) : entries.map(entry => <div key={entry.id}>
          <AnimeCard anime={entry.media} />
          <p className="text-xs text-white/60 mt-2">Episode {entry.episode} • {new Date(entry.airingAt * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
        </div>)}
      </div>
      {!loading && !entries.length && <p className="text-white/50 py-12 text-center">No confirmed airing entries for this day.</p>}
    </main><Footer />
  </div>;
}
