import { motion } from 'framer-motion';
import { getDeckParts, getPartImage, getComboName } from '../utils/deckUtils';

const imageClass = 'w-32 h-32 sm:w-36 sm:h-36 md:w-40 md:h-40 object-contain drop-shadow-[0_0_18px_rgba(59,130,246,0.22)] transition-transform duration-300 group-hover:scale-[1.08]';

export default function PublicDeckShowcase({ decks = [] }) {
  if (!decks.length) {
    return (
      <div className="text-center py-12 bg-gray-900/60 rounded-[1.5rem] border border-dashed border-gray-800">
        <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Belum memiliki deck aktif</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {decks.slice(0, 3).map((deck, index) => (
        <motion.div key={deck.deckId || index} custom={index} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }} className="group bg-gray-900/70 backdrop-blur-sm rounded-[1.5rem] p-5 border border-white/5 hover:border-yellow-500/20 transition-all">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="min-w-0">
              <p className="text-[9px] font-black text-yellow-400 uppercase tracking-widest">Combo Deck {index + 1}</p>
              <h4 className="text-base font-black tracking-tight truncate" title={getComboName(deck)}>{getComboName(deck) || 'Unnamed Combo'}</h4>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/30 text-[8px] font-black text-green-400 uppercase tracking-widest shrink-0">{deck.system || 'BX'}</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {getDeckParts(deck).map(([label, part]) => {
              const image = getPartImage(part);
              return (
                <motion.div key={`${deck.deckId || index}-${label}`} whileHover={{ y: -4, scale: 1.015 }} transition={{ type: 'spring', stiffness: 320, damping: 22 }} className="group relative aspect-square rounded-2xl bg-gray-950/70 border border-white/5 overflow-hidden p-3.5 flex flex-col items-center text-center hover:border-yellow-500/30 hover:bg-gray-950/90 transition-colors">
                  <p className="text-[10px] sm:text-[11px] font-black text-gray-500 uppercase tracking-widest">{label}</p>
                  <div className="flex-1 w-full min-h-0 flex items-center justify-center py-1">
                    {image ? <img src={image} alt={part.name || part.partId} className={imageClass} loading="lazy" /> : <div className="w-16 h-16 rounded-full border border-white/5 bg-gray-900/60 flex items-center justify-center text-[9px] font-black text-gray-700">NO IMG</div>}
                  </div>
                  <p className="text-[12px] sm:text-[13px] font-black text-white uppercase tracking-tight truncate w-full">{part.name || part.partId}</p>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      ))}
    </div>
  );
}
