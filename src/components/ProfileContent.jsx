import { useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Edit3, Loader2 } from 'lucide-react';

const ProfileContent = ({ blader, user, settings, leaderboard, onUpdateNickname, isSubmitting }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editNick, setEditNick] = useState(blader?.nickname || '');

  const myRankIndex = leaderboard.findIndex((item) => item.googleId === user?.sub);
  const myRank = myRankIndex !== -1 ? myRankIndex + 1 : '--';
  const myStats = myRankIndex !== -1 ? leaderboard[myRankIndex] : null;

  const handleSave = async () => {
    if (editNick.length < 3) return;
    await onUpdateNickname(editNick);
    setIsEditing(false);
  };

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
      <div className="bg-white dark:bg-dark-card rounded-[2.5rem] p-8 text-center shadow-sm border border-gray-100 dark:border-gray-800 dark:text-white">
        <div className="relative w-24 h-24 mx-auto mb-4">
          <img src={user.picture} referrerPolicy="no-referrer" className="w-full h-full rounded-3xl border-4 border-primary shadow-lg object-cover" alt="profile" />
          <div className="absolute -bottom-2 -right-2 bg-primary dark:text-white p-2 rounded-xl"><Trophy size={16} /></div>
        </div>
        {isEditing ? (
          <div className="space-y-3 dark:text-white">
            <input
              value={editNick}
              onChange={(e) => setEditNick(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
              className="w-full p-3 bg-gray-100 dark:bg-gray-800 rounded-xl text-center font-bold outline-none border-2 border-primary dark:text-white"
            />
            <div className="flex gap-2 text-sm">
              <button type="button" onClick={() => setIsEditing(false)} className="flex-1 py-2 bg-gray-200 dark:bg-gray-700 rounded-xl font-bold dark:text-white">Batal</button>
              <button type="button" onClick={handleSave} className="flex-1 py-2 bg-primary dark:text-white rounded-xl font-bold">
                {isSubmitting ? <Loader2 className="animate-spin mx-auto" size={18} /> : 'Simpan'}
              </button>
            </div>
          </div>
        ) : (
          <div>
            <h2 className="text-2xl font-black italic tracking-tighter dark:text-white">{blader?.nickname}</h2>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em] mb-4">{blader?.role || 'Blader'}</p>
            {settings.allow_nickname_change === 'true' && (
              <button type="button" onClick={() => setIsEditing(true)} className="text-[10px] font-black text-primary border-2 border-primary/20 px-6 py-2 rounded-full flex items-center gap-2 mx-auto hover:bg-primary/5 transition-all">
                <Edit3 size={12} /> GANTI NICKNAME
              </button>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3 text-center dark:text-white">
        <div className="bg-white dark:bg-dark-card p-4 rounded-[1.5rem] border border-gray-100 dark:border-gray-800 shadow-sm">
          <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Rank</p>
          <p className="text-lg font-black text-primary italic uppercase italic">#{myRank}</p>
        </div>
        <div className="bg-white dark:bg-dark-card p-4 rounded-[1.5rem] border border-gray-100 dark:border-gray-800 shadow-sm">
          <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Points</p>
          <p className="text-lg font-black text-primary italic uppercase italic">{myStats?.point || 0}</p>
        </div>
        <div className="bg-white dark:bg-dark-card p-4 rounded-[1.5rem] border border-gray-100 dark:border-gray-800 shadow-sm">
          <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Points Finish</p>
          <p className="text-lg font-black text-primary italic uppercase italic">{myStats?.pointFinish || 0}</p>
        </div>
      </div>
    </motion.div>
  );
};

export default ProfileContent;
