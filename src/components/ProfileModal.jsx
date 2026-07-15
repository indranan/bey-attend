import { motion, AnimatePresence } from 'framer-motion';
import { Swords, ScrollText, X } from 'lucide-react';

const ProfileModal = ({ player, loading, onClose }) => {
  const open = Boolean(player);
  const foto = player?.foto || `https://ui-avatars.com/api/?name=${player?.name || 'B'}`;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.85, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.85, opacity: 0, y: 20 }}
            transition={{ type: 'spring', stiffness: 260, damping: 22 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-white dark:bg-dark-card rounded-[2.5rem] p-7 shadow-2xl border border-gray-100 dark:border-gray-800 text-center relative"
          >
            <button
              type="button"
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 active:scale-90 transition-all"
            >
              <X size={16} />
            </button>

            {loading ? (
              <div className="py-16 text-gray-400 font-black uppercase tracking-widest text-xs">Memuat...</div>
            ) : (
              <>
                <div className="relative w-28 h-28 mx-auto mb-4">
                  <img
                    src={foto}
                    referrerPolicy="no-referrer"
                    className="w-full h-full rounded-[2rem] border-4 border-primary shadow-lg object-cover"
                    alt="avatar"
                  />
                  <div className="absolute -bottom-2 -right-2 bg-primary text-white p-2 rounded-xl shadow-lg">
                    <Swords size={16} />
                  </div>
                </div>

                <h2 className="text-2xl font-black italic tracking-tighter">{player?.name}</h2>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em] mb-4">
                  {player?.role || 'Blader'}
                </p>

                {/* Battle Cry / Slogan */}
                <p className="text-primary font-black italic text-sm px-4 mb-5 leading-snug">
                  &ldquo;{player?.slogan || 'No slogan yet.'}&rdquo;
                </p>

                {/* Catatan / Gaya main */}
                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-2xl p-4 text-left mb-4">
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">
                    <ScrollText size={12} /> Catatan / Gaya Main
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-200 leading-relaxed">
                    {player?.catatan || '—'}
                  </p>
                </div>

                {/* Rank / Points / Points Finish */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-primary/10 rounded-2xl py-3">
                    <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Rank</p>
                    <p className="text-lg font-black text-primary italic">#{player?.rank ?? '-'}</p>
                  </div>
                  <div className="bg-primary/10 rounded-2xl py-3">
                    <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Points</p>
                    <p className="text-lg font-black text-primary italic">{player?.point ?? 0}</p>
                  </div>
                  <div className="bg-primary/10 rounded-2xl py-3">
                    <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Fin</p>
                    <p className="text-lg font-black text-primary italic">{player?.pointFinish ?? 0}</p>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ProfileModal;
