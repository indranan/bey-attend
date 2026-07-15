import { motion } from 'framer-motion';

const ParticipantList = ({ participants, onSelect }) => (
  <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} className='dark:text-white'>
    <div className="flex justify-between items-center mb-6 px-1 dark:text-white">
      <h3 className="text-xs font-black uppercase italic tracking-widest text-gray-400 dark:text-white">Bladers on Arena</h3>
      <span className="bg-primary/10 text-primary text-[10px] font-black px-3 py-1 rounded-full dark:text-white">{participants?.length || 0} Bladers</span>
    </div>
    <div className="grid gap-4 dark:text-white">
      {participants?.map((p, i) => (
        <motion.div
          key={i}
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: i * 0.05 }}
          onClick={() => onSelect?.(p)}
          className="flex items-center gap-4 bg-white dark:bg-dark-card p-4 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800 dark:text-white cursor-pointer active:scale-[0.98] transition-transform hover:border-primary/40"
        >
          <img src={p.foto} referrerPolicy="no-referrer" className="w-12 h-12 rounded-2xl object-cover border-2 border-gray-50 dark:border-gray-700 shadow-sm dark:text-white" alt="" />
          <div className="flex-1 dark:text-white">
            <p className="font-black text-[15px] dark:text-gray-100 tracking-tighter leading-none mb-1 dark:text-white">{p.nama}</p>
            <p className="text-[9px] text-primary font-black uppercase tracking-[0.2em] italic leading-tight dark:text-white">Ranked Blader</p>
          </div>
          <div className="w-2.5 h-2.5 bg-green-500 rounded-full shadow-[0_0_12px_rgba(34,197,94,0.8)] animate-pulse" />
        </motion.div>
      ))}
    </div>
  </motion.section>
);

export default ParticipantList;
