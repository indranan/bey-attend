import { motion, AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';

const CreateEventModal = ({ show, onClose, form, setForm, onSubmit, isSubmitting }) => (
  <AnimatePresence>
    {show && (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="relative w-full max-w-sm bg-white dark:bg-dark-card rounded-[2.5rem] p-8 shadow-2xl border border-gray-100 dark:border-gray-800"
        >
          <div className="space-y-4">
            <div className="text-center mb-6">
              <h3 className="text-xl font-black italic uppercase tracking-tighter text-gray-900 dark:text-white leading-none">
                New Arena Event
              </h3>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest mt-2 italic">
                Konfigurasi Turnamen
              </p>
            </div>

            <div>
              <label className="text-[10px] font-black text-primary uppercase ml-2 mb-1 block italic tracking-widest">Nama Event</label>
              <input
                type="text"
                placeholder="Contoh: Liga Beyblade X"
                className="w-full p-4 bg-gray-100 dark:bg-gray-800 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-primary text-gray-900 dark:text-white transition-all"
                value={form.nama}
                onChange={(e) => setForm({ ...form, nama: e.target.value })}
                autoComplete="off"
              />
            </div>

            <div>
              <label className="text-[10px] font-black text-primary uppercase ml-2 mb-1 block italic tracking-widest">Lokasi</label>
              <input
                type="text"
                placeholder="Contoh: Arena Pasar Tingkat"
                className="w-full p-4 bg-gray-100 dark:bg-gray-800 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-primary text-gray-900 dark:text-white transition-all"
                value={form.lokasi}
                onChange={(e) => setForm({ ...form, lokasi: e.target.value })}
                autoComplete="off"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-4 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-2xl font-black uppercase italic text-xs active:scale-95 transition-all"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={onSubmit}
                disabled={isSubmitting || !form.nama || !form.lokasi}
                className="flex-1 py-4 bg-primary dark:text-white rounded-2xl font-black uppercase italic text-xs shadow-lg shadow-primary/30 active:scale-95 transition-all disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 className="animate-spin mx-auto" size={16} /> : 'Aktifkan'}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    )}
  </AnimatePresence>
);

export default CreateEventModal;
