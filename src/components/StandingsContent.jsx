import { motion } from 'framer-motion';
import { Trophy } from 'lucide-react';
import UserAvatar from './UserAvatar';

const StandingsContent = ({ leaderboard, user, onSelect }) => {
  const getStatusIcon = (status) => {
    const s = String(status).toLowerCase();
    if (s === 'up') return <span className="text-green-500 text-[10px] font-bold">▲</span>;
    if (s === 'down') return <span className="text-red-500 text-[10px] font-bold">▼</span>;
    return <span className="text-gray-400 text-[10px]">●</span>;
  };

  if (!Array.isArray(leaderboard) || leaderboard.length === 0) {
    return (
      <div className="text-center p-12 bg-white dark:bg-dark-card rounded-[2.5rem] border border-gray-800 dark:text-white">
        <Trophy className="text-gray-700 mx-auto mb-4 opacity-20" size={48} />
        <p className="text-gray-500 font-black uppercase italic tracking-widest text-xs">Klasemen Belum Tersedia</p>
      </div>
    );
  }

  const sortedLeaderboard = [...leaderboard].sort((a, b) => {
    const ptsA = Number(a.point) || 0;
    const ptsB = Number(b.point) || 0;
    if (ptsB !== ptsA) return ptsB - ptsA;
    const finA = Number(a.pointFinish) || 0;
    const finB = Number(b.pointFinish) || 0;
    return finB - finA;
  });

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full max-w-md md:max-w-2xl lg:max-w-4xl mx-auto p-6 space-y-6 pb-20">
      <div className="text-center">
        <h2 className="text-2xl font-black italic uppercase tracking-tighter dark:text-white leading-none">KLASEMEN LIGA</h2>
        <p className="text-[10px] text-primary font-black uppercase tracking-[0.3em] mt-2 italic dark:text-white">Peringkat Blader Season Ini</p>
      </div>
      <div className="bg-white dark:bg-dark-card rounded-[2.5rem] overflow-hidden border border-gray-100 dark:border-gray-800 shadow-2xl">
        <table className="w-full text-left border-collapse">
          <thead className="bg-gray-50 dark:bg-gray-900/50">
            <tr>
              <th className="px-2 py-3 md:px-4 md:py-4 text-[9px] font-black uppercase text-gray-400 italic">Rank</th>
              <th className="px-2 py-3 md:px-4 md:py-4 text-[9px] font-black uppercase text-gray-400 italic">Blader</th>
              <th className="px-2 py-3 md:px-4 md:py-4 text-center text-[9px] font-black uppercase text-gray-400 italic">Pts</th>
              <th className="px-2 py-3 md:px-4 md:py-4 text-center text-[9px] font-black uppercase text-gray-400 italic">Fin</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {sortedLeaderboard.map((item, index) => {
              const rank = index + 1;
              const isMe = item.googleId === user?.sub;
              return (
                <tr
                  key={index}
                  onClick={() => onSelect?.(item)}
                  className={`${isMe ? 'bg-primary/10' : ''} transition-colors cursor-pointer select-none active:scale-[0.99]`}
                >
                  <td className="px-2 py-3 md:px-4 md:py-4">
                    <div className="flex flex-col items-center gap-1">
                      <div className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-black shadow-sm ${
                        rank === 1 ? 'bg-yellow-400 text-black shadow-yellow-400/40' :
                        rank === 2 ? 'bg-gray-300 text-black' :
                        rank === 3 ? 'bg-orange-500 dark:text-white' :
                        'bg-gray-100 dark:bg-gray-800 text-gray-400'
                      }`}>{rank}</div>
                      {getStatusIcon(item.status)}
                    </div>
                  </td>
                  <td className="px-2 py-3 md:px-4 md:py-4">
                    <div className="flex items-center gap-3">
                      <UserAvatar src={item.foto} name={item.name} className="w-10 h-10 rounded-xl object-cover border-2 border-gray-800 shadow-md" />
                      <p className={`text-xs font-black text-[15px] tracking-tighter leading-none ${isMe ? 'text-primary' : 'dark:text-white'}`}>{item.name}</p>
                    </div>
                  </td>
                  <td className="px-2 py-3 md:px-4 md:py-4 text-center font-black text-primary italic">{item.point}</td>
                  <td className="px-2 py-3 md:px-4 md:py-4 text-center font-bold text-gray-400 text-[10px]">{item.pointFinish}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
};

export default StandingsContent;
