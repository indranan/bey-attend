import { motion } from 'framer-motion';
import { MapPin, Clock8, Users, Loader2, ExternalLink } from 'lucide-react';

const EventCard = ({ event, participants, count, user, onAttend, onCancel, isSubmitting, challongeUrl }) => {
  const isCheckedIn = (participants || event?.participants || [])?.some(
    (p) => (p.email || '').trim().toLowerCase() === (user?.email || '').trim().toLowerCase()
  );

  if (!event) {
    return (
      <div className="text-center p-12 bg-white dark:bg-dark-card rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-gray-800 dark:text-white">
        <Users className="text-gray-300 mx-auto mb-4" size={48} />
        <h3 className="font-black text-gray-400 uppercase italic tracking-widest tracking-tighter dark:text-white">Arena Kosong</h3>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-8 dark:text-white">
      <div className="bg-primary p-7 rounded-[2.5rem] dark:text-white shadow-xl shadow-primary/30 relative overflow-hidden text-center sm:text-left">
        <div className="relative z-10 dark:text-white">
          <span className="text-[10px] font-black uppercase tracking-[0.3em] bg-white/20 px-3 py-1 rounded-full dark:text-white">Arena Active</span>
          <h2 className="text-3xl font-black mt-4 mb-4 uppercase italic tracking-tighter leading-none dark:text-white">{event.nama}</h2>
          <div className="flex items-center justify-center sm:justify-start gap-2 text-xs font-bold opacity-80 mb-2 italic dark:text-white"><MapPin size={16} /> {event.lokasi}</div>
          <div className="flex items-center justify-center sm:justify-start gap-2 text-xs font-bold opacity-80 mb-8 italic dark:text-white"><Clock8 size={16} /> {event.waktu || '20.00 WIB'}</div>
          {challongeUrl && (
            <motion.a
              href={challongeUrl}
              target="_blank"
              rel="noopener noreferrer"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-md px-5 py-2.5 rounded-2xl text-white font-black text-xs uppercase italic tracking-tighter hover:bg-white/30 transition-all mb-4"
            >
              <ExternalLink size={14} />
              Lihat Bracket Turnamen (Challonge)
            </motion.a>
          )}
          <div className="flex justify-between items-end text-left dark:text-white">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1 dark:text-white">Bladers Ready</p>
              <div className="flex items-center gap-2 dark:text-white"><Users size={20} /><span className="text-2xl font-black italic dark:text-white">{count}</span></div>
            </div>
            {isCheckedIn ? (
              <div className="flex flex-col items-end gap-3">
                <div className="bg-white/20 backdrop-blur-md px-6 py-3 rounded-2xl text-center min-w-[170px]">
                  <div className="flex items-center justify-center gap-2 text-white/90 text-sm font-semibold">
                    <div className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" />
                    You&apos;re checked in
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onCancel}
                  disabled={isSubmitting}
                  className="w-full py-3 rounded-2xl bg-red-500/20 border border-red-300/30 text-red-100 font-bold text-sm transition-all hover:bg-red-500 hover:text-white active:scale-95 disabled:opacity-50"
                >
                  {isSubmitting ? '...' : 'Cancel Attendance'}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={onAttend}
                disabled={isSubmitting}
                className="bg-white text-primary px-8 py-4 rounded-2xl font-black shadow-xl uppercase italic tracking-tighter text-sm disabled:opacity-50 active:scale-95 transition-all"
              >
                {isSubmitting ? <Loader2 className="animate-spin" /> : 'I\'m Ready!'}
              </button>
            )}
          </div>
        </div>
        <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
      </div>
    </motion.div>
  );
};

export default EventCard;
