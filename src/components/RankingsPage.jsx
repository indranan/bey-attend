import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Search, Sparkles, Target } from 'lucide-react';
import UserAvatar from './UserAvatar';
import PublicNavbar from './PublicNavbar';

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.4, ease: 'easeOut' }
  })
};

const RankBadge = ({ rank, size = 'md' }) => {
  const config = {
    1: { bg: 'bg-yellow-400', text: 'text-black', border: 'border-yellow-400', shadow: 'shadow-[0_0_15px_rgba(250,204,21,0.5)]', icon: '👑' },
    2: { bg: 'bg-gray-300', text: 'text-black', border: 'border-gray-300', shadow: 'shadow-[0_0_12px_rgba(209,213,219,0.4)]', icon: '🥈' },
    3: { bg: 'bg-orange-500', text: 'text-white', border: 'border-orange-500', shadow: 'shadow-[0_0_12px_rgba(249,115,22,0.4)]', icon: '🥉' },
  };

  const c = config[rank] || { bg: 'bg-gray-700', text: 'text-gray-300', border: 'border-gray-600', shadow: '', icon: '' };

  const sizeClasses = size === 'lg'
    ? 'w-12 h-12 text-lg'
    : 'w-8 h-8 text-xs';

  return (
    <div className={`inline-flex items-center justify-center rounded-xl border ${c.bg} ${c.text} ${c.border} ${c.shadow} font-black ${sizeClasses}`}>
      {rank}
    </div>
  );
};

const MovementBadge = ({ status }) => {
  const normalizedStatus = String(status || 'stay').toLowerCase().trim();
  const config = {
    up: { label: '↑ UP', className: 'border-green-400/30 bg-green-400/10 text-green-300' },
    down: { label: '↓ DOWN', className: 'border-red-400/30 bg-red-400/10 text-red-300' },
    stay: { label: '→ STAY', className: 'border-white/10 bg-white/5 text-gray-400' },
    new: { label: '★ NEW', className: 'border-yellow-300/30 bg-yellow-400/10 text-yellow-200' },
  };
  const movement = config[normalizedStatus] || config.stay;

  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[8px] font-black uppercase tracking-wider ${movement.className}`}>
      {movement.label}
    </span>
  );
};

export default function RankingsPage({ leaderboard = [], currentUser = null }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('Season 2026');

  const sortedLeaderboard = useMemo(() => {
    if (!Array.isArray(leaderboard)) return [];
    return [...leaderboard].sort((a, b) => {
      const ptsA = Number(a.point) || 0;
      const ptsB = Number(b.point) || 0;
      if (ptsB !== ptsA) return ptsB - ptsA;
      const finA = Number(a.pointFinish) || 0;
      const finB = Number(b.pointFinish) || 0;
      return finB - finA;
    });
  }, [leaderboard]);

  const filteredLeaderboard = useMemo(() => {
    let data = sortedLeaderboard;

    if (filterType === 'Month') {
      data = [];
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      data = data.filter(item => item.name?.toLowerCase().includes(q));
    }

    return data;
  }, [sortedLeaderboard, searchQuery, filterType]);

  const top3 = filteredLeaderboard.slice(0, 3);
  const rest = filteredLeaderboard.slice(3);

  const isCurrentUser = (item) => {
    if (!currentUser) return false;
    if (item.googleId && currentUser.sub && item.googleId === currentUser.sub) return true;
    if (item.email && currentUser.email && item.email === currentUser.email) return true;
    return false;
  };

  const currentUserStanding = sortedLeaderboard.find((item) => isCurrentUser(item));
  const currentUserRank = currentUserStanding ? sortedLeaderboard.indexOf(currentUserStanding) + 1 : null;
  const podiumOrder = [top3[1], top3[0], top3[2]].filter(Boolean);

  return (
    <div className="min-h-screen bg-gray-950 text-white select-none">
      <PublicNavbar />
      <div className="max-w-5xl mx-auto px-6 pt-20 pb-12">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-blue-600/20 via-gray-900 to-yellow-500/10 px-6 py-9 text-center shadow-2xl shadow-black/20 mb-8"
        >
          <div className="absolute -top-16 -left-16 w-44 h-44 rounded-full bg-blue-500/20 blur-3xl" />
          <div className="absolute -bottom-20 -right-10 w-48 h-48 rounded-full bg-yellow-400/15 blur-3xl" />
          <div className="relative">
            <div className="mx-auto mb-3 flex w-fit items-center gap-2 rounded-full border border-yellow-300/20 bg-yellow-400/10 px-3 py-1 text-[9px] font-black uppercase tracking-[0.2em] text-yellow-300">
              <Sparkles size={12} /> Hall of Bladers
            </div>
          <h1 className="text-3xl md:text-5xl font-black italic uppercase tracking-tighter mb-2">
            <span className="bg-gradient-to-r from-yellow-400 via-orange-400 to-yellow-500 bg-clip-text text-transparent">
              OFFICIAL RANKINGS
            </span>
          </h1>
          <p className="text-xs font-black text-gray-500 uppercase tracking-[0.2em]">
            Peringkat Blader Terbaik Saat Ini
          </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-left">
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-2.5">
                <p className="text-[8px] font-black uppercase tracking-widest text-gray-500">Total Blader</p>
                <p className="mt-0.5 text-lg font-black italic text-white">{sortedLeaderboard.length}</p>
              </div>
              {currentUserStanding && (
                <div className="flex items-center gap-3 rounded-2xl border border-blue-400/30 bg-blue-500/15 px-4 py-2.5">
                  <Target size={18} className="text-blue-300" />
                  <div>
                    <p className="text-[8px] font-black uppercase tracking-widest text-blue-200/60">Posisimu</p>
                    <p className="mt-0.5 text-lg font-black italic text-white">#{currentUserRank} <span className="text-xs text-blue-200">· {currentUserStanding.point ?? 0} PTS</span></p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Search & Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-10 space-y-4"
        >
          {/* Search Bar */}
          <div className="relative max-w-md mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
            <input
              type="text"
              placeholder="Cari nama Blader..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-gray-900/80 border border-white/10 rounded-2xl text-sm font-bold text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 transition-colors"
            />
          </div>

          {/* Filter Buttons */}
          <div className="flex items-center justify-center gap-2">
            {[
              { key: 'Season 2026', label: 'Season 2026' },
              { key: 'Month', label: 'Month', disabled: true },
              { key: 'All Time', label: 'All Time' }
            ].map((filter) => (
              <button
                key={filter.key}
                type="button"
                onClick={() => !filter.disabled && setFilterType(filter.key)}
                disabled={filter.disabled}
                className={`px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
                  filterType === filter.key
                    ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30'
                    : filter.disabled
                      ? 'bg-gray-900/50 text-gray-600 border border-white/5 cursor-not-allowed'
                      : 'bg-gray-900/80 text-gray-400 border border-white/10 hover:text-white hover:border-white/20'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Top 3 Podium */}
        {top3.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="grid grid-cols-1 gap-4 md:grid-cols-3 md:items-end md:gap-5 mb-10"
          >
            {podiumOrder.map((item, index) => {
              const rank = top3.indexOf(item) + 1;
              const isMe = isCurrentUser(item);

              const cardColors = {
                1: 'border-yellow-500/40 bg-gradient-to-br from-yellow-500/10 to-orange-500/5 shadow-[0_0_30px_rgba(250,204,21,0.15)]',
                2: 'border-gray-400/30 bg-gradient-to-br from-gray-400/10 to-gray-500/5 shadow-[0_0_20px_rgba(209,213,219,0.1)]',
                3: 'border-orange-500/30 bg-gradient-to-br from-orange-600/10 to-orange-700/5 shadow-[0_0_20px_rgba(249,115,22,0.1)]',
              };

              return (
                <motion.div
                  key={item.googleId || item.name || index}
                  custom={rank}
                  variants={fadeUp}
                  initial="hidden"
                  animate="visible"
                  className={`relative p-6 rounded-[2rem] border ${cardColors[rank] || 'border-gray-700 bg-gray-900/50'} backdrop-blur-sm transition-all hover:-translate-y-1 ${rank === 1 ? 'md:pb-9 md:pt-8' : 'md:pb-6'} ${rank === 1 ? 'md:order-2' : rank === 2 ? 'md:order-1' : 'md:order-3'}`}
                >
                  {rank === 1 && <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-yellow-300 to-transparent" />}
                  {isMe && (
                    <div className="absolute -top-3 left-1/2 z-10 -translate-x-1/2">
                      <span className="px-3 py-1 bg-blue-500 text-white text-[9px] font-black uppercase tracking-widest rounded-full shadow-lg shadow-blue-500/50">
                        YOU
                      </span>
                    </div>
                  )}

                  <div className="flex flex-col items-center text-center">
                    <div className="mb-1 flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.18em] text-gray-400">
                      {rank === 1 ? 'Champion' : `Rank ${rank}`}
                    </div>
                    <RankBadge rank={rank} size="lg" />

                    <div className="mt-4 mb-3">
                      <UserAvatar
                        src={item.foto}
                        name={item.name}
                        className="w-20 h-20 md:w-24 md:h-24 rounded-2xl border-4 border-white/10 object-cover shadow-xl"
                      />
                    </div>

                    <h3 className="text-base md:text-lg font-black tracking-tight truncate max-w-full">
                      {item.name}
                    </h3>
                    <div className="mt-2">
                      <MovementBadge status={item.status} />
                    </div>

                    <div className="mt-3 flex items-center gap-4">
                      <div className="text-center">
                        <p className="text-2xl font-black text-white italic tabular-nums">{item.point ?? 0}</p>
                        <p className="text-[9px] text-gray-500 font-black uppercase tracking-wider">Pts</p>
                      </div>
                      <div className="w-px h-8 bg-white/10" />
                      <div className="text-center">
                        <p className="text-2xl font-black text-gray-300 italic">{item.pointFinish ?? 0}</p>
                        <p className="text-[9px] text-gray-500 font-black uppercase tracking-wider">Fin</p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}

        {/* Rank 4+ List */}
        {rest.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="overflow-hidden rounded-[2rem] border border-white/10 bg-gray-900/80 backdrop-blur-sm shadow-xl shadow-black/10"
          >
            <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.03] px-5 py-4 md:px-6">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-300">Leaderboard</p>
                <h2 className="mt-0.5 text-sm font-black uppercase italic tracking-tight text-white">Peringkat lainnya</h2>
              </div>
              <div className="flex items-center gap-5 text-right text-[8px] font-black uppercase tracking-widest text-gray-500">
                <span>Poin</span>
                <span className="w-12">Finish</span>
              </div>
            </div>
            <div className="divide-y divide-white/5">
              {rest.map((item, index) => {
                const rank = index + 4;
                const isMe = isCurrentUser(item);

                return (
                  <motion.div
                    key={item.googleId || item.name || index}
                    custom={index}
                    variants={fadeUp}
                    initial="hidden"
                    animate="visible"
                    className={`flex items-center gap-3 px-4 py-4 transition-all md:px-6 ${
                      isMe ? 'bg-blue-600/20 border-l-4 border-blue-400' : 'hover:bg-white/[0.04]'
                    }`}
                  >
                    {/* Rank */}
                    <div className="flex-shrink-0 w-10 text-center">
                      <RankBadge rank={rank} />
                    </div>

                    {/* Avatar */}
                    <div className="flex-shrink-0">
                      <UserAvatar
                        src={item.foto}
                        name={item.name}
                        className="w-11 h-11 rounded-2xl border-2 border-white/10 object-cover"
                      />
                    </div>

                    {/* Name */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-black tracking-tight truncate">{item.name}</p>
                        {isMe && (
                          <span className="px-2 py-0.5 bg-blue-500 text-white text-[8px] font-black uppercase tracking-widest rounded-md shadow-md">
                            YOU
                          </span>
                        )}
                        <MovementBadge status={item.status} />
                      </div>
                    </div>

                    {/* Points */}
                    <div className="flex-shrink-0 text-right">
                      <p className="text-lg font-black text-white italic tabular-nums">{item.point ?? 0}</p>
                      <p className="text-[8px] text-gray-500 font-black uppercase tracking-wider">Pts</p>
                    </div>

                    {/* Finish */}
                    <div className="flex-shrink-0 text-right w-16">
                      <p className="text-sm font-bold text-gray-400">{item.pointFinish ?? 0}</p>
                      <p className="text-[8px] text-gray-600 font-black uppercase tracking-wider">Fin</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Empty State */}
        {filteredLeaderboard.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-20"
          >
            <Search className="text-gray-700 mx-auto mb-4" size={48} />
            <p className="text-sm font-black text-gray-600 uppercase tracking-widest">
              {searchQuery ? 'Blader tidak ditemukan' : 'Belum ada data klasemen'}
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
