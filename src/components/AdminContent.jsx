import { useState } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { ShieldCheck } from 'lucide-react';

const AdminContent = ({ onCreateEvent, onResetArena, onGenerateTournament, onUpdatePoints, onToggleNickname, nicknameAllowed, leaderboard, isSubmitting, eventId }) => {
  const [format, setFormat] = useState('weekly'); // 'weekly' | 'final'
  const [selectedId, setSelectedId] = useState('');
  const [point, setPoint] = useState('');
  const [pointFinish, setPointFinish] = useState('');

  const players = Array.isArray(leaderboard) ? leaderboard : [];

  const handleSavePoints = async () => {
    if (!selectedId) return toast.error('Pilih pemain dulu!');
    const res = await onUpdatePoints({
      googleId: selectedId,
      point: Number(point) || 0,
      pointFinish: Number(pointFinish) || 0
    });
    if (res?.status === 'success') {
      setSelectedId(''); setPoint(''); setPointFinish('');
    }
  };

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6 pb-20">
      <div className="px-2">
        <h2 className="text-xl font-black italic uppercase tracking-tighter dark:text-white">Admin Panel</h2>
        <p className="text-[10px] text-red-500 font-black uppercase tracking-widest mt-1 italic tracking-tighter dark:text-white">Otoritas Penyelenggara</p>
      </div>
      <div className="bg-white dark:bg-dark-card rounded-[2.5rem] p-8 border border-gray-100 dark:border-gray-800 shadow-xl space-y-4">
        <div className="text-center border-b border-gray-100 dark:border-gray-800 pb-4">
          <h3 className="text-xs font-black uppercase italic dark:text-gray-400">Event Management</h3>
        </div>
        <button type="button" onClick={onCreateEvent} disabled={isSubmitting} className="w-full py-4 bg-primary dark:text-white rounded-2xl font-black uppercase italic text-xs shadow-lg shadow-primary/30 active:scale-95 transition-all">Buat Event Baru</button>
        <button type="button" onClick={onResetArena} disabled={isSubmitting} className="w-full py-4 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-white rounded-2xl font-black uppercase italic text-xs active:scale-95 transition-all">Reset Arena Status</button>

        <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
          <p className="text-[10px] font-black uppercase italic text-gray-400 mb-2 text-center">Format Turnamen</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setFormat('weekly')}
              className={`py-3 rounded-2xl font-black uppercase italic text-xs transition-all active:scale-95 ${format === 'weekly' ? 'bg-primary text-white shadow-lg shadow-primary/30' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}
            >
              Weekly (Swiss)
            </button>
            <button
              type="button"
              onClick={() => setFormat('final')}
              className={`py-3 rounded-2xl font-black uppercase italic text-xs transition-all active:scale-95 ${format === 'final' ? 'bg-red-600 text-white shadow-lg shadow-red-600/30' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}
            >
              Final (Double Elim)
            </button>
          </div>
          <p className="text-[9px] text-gray-400 text-center mt-2 leading-tight">
            {format === 'weekly'
              ? 'Swiss • Tie break: menang pertandingan, poin, head-to-head'
              : 'Double Elimination • Grand Finals 1 Match'}
          </p>
          <button
            type="button"
            onClick={() => onGenerateTournament(format)}
            disabled={isSubmitting || !eventId}
            className="w-full py-4 bg-red-600 text-white rounded-2xl font-black uppercase italic text-xs shadow-lg shadow-red-600/30 active:scale-95 transition-all disabled:opacity-50 mt-2"
          >
            {isSubmitting ? 'Generating...' : 'Generate Bracket Turnamen'}
          </button>
        </div>

        <div className="border-t border-gray-100 dark:border-gray-800 pt-4 space-y-3">
          <p className="text-[10px] font-black uppercase italic text-gray-400 mb-2 text-center">Update Poin Pemain</p>
          <select
            value={selectedId}
            onChange={(e) => {
              const id = e.target.value;
              setSelectedId(id);
              const p = players.find((x) => x.googleId === id);
              setPoint(p ? String(p.point ?? 0) : '');
              setPointFinish(p ? String(p.pointFinish ?? 0) : '');
            }}
            className="w-full p-3 bg-gray-100 dark:bg-gray-800 rounded-xl text-center font-bold outline-none border-2 border-transparent focus:border-primary dark:text-white text-xs"
          >
            <option value="">— Pilih Pemain —</option>
            {players.map((p) => (
              <option key={p.googleId} value={p.googleId}>{p.name}</option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <input
              value={point}
              onChange={(e) => setPoint(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="Point"
              inputMode="numeric"
              className="w-full p-3 bg-gray-100 dark:bg-gray-800 rounded-xl text-center font-bold outline-none border-2 border-transparent focus:border-primary dark:text-white text-xs"
            />
            <input
              value={pointFinish}
              onChange={(e) => setPointFinish(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="Point Finish"
              inputMode="numeric"
              className="w-full p-3 bg-gray-100 dark:bg-gray-800 rounded-xl text-center font-bold outline-none border-2 border-transparent focus:border-primary dark:text-white text-xs"
            />
          </div>
          <button
            type="button"
            onClick={handleSavePoints}
            disabled={isSubmitting || !selectedId}
            className="w-full py-3 bg-primary dark:text-white rounded-2xl font-black uppercase italic text-xs shadow-lg shadow-primary/30 active:scale-95 transition-all disabled:opacity-50"
          >
            {isSubmitting ? 'Menyimpan...' : 'Simpan Poin'}
          </button>
        </div>

        <div className="border-t border-gray-100 dark:border-gray-800 pt-4 space-y-2">
          <p className="text-[10px] font-black uppercase italic text-gray-400 text-center">Izin Ganti Nickname</p>
          <button
            type="button"
            onClick={onToggleNickname}
            disabled={isSubmitting}
            className={`w-full py-3 rounded-2xl font-black uppercase italic text-xs shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 ${nicknameAllowed ? 'bg-green-500 text-white shadow-green-500/30' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200'}`}
          >
            <ShieldCheck size={14} />
            {nicknameAllowed ? 'Nickname Terbuka (klik untuk tutup)' : 'Nickname Ditutup (klik untuk buka)'}
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default AdminContent;
