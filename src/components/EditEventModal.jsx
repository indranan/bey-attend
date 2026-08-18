import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, ChevronDown } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { getRules } from '../utils/api';

const PRESET_NAMA = ['Lalapan Week X Bulan - Liga 2026', 'Lalapan Final Bulan - Liga 2026', 'Lalapan Casual Play Today'];
const PRESET_LOKASI = ['Pasar Tingkat Lamongan', 'Cafe Fvorsten Lamongan', 'Saglam'];
const ZONA_OPTIONS = ['WIB', 'WITA', 'WIT'];

const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

const formatTanggalIndonesia = (isoDate) => {
  if (!isoDate) return '';
  const d = new Date(isoDate + 'T00:00:00');
  const hari = HARI[d.getDay()];
  const tgl = d.getDate();
  const bulan = BULAN[d.getMonth()];
  const tahun = d.getFullYear();
  return `${hari}, ${tgl} ${bulan} ${tahun}`;
};

const parseTanggalIndonesia = (formatted) => {
  if (!formatted) return '';
  const map = {};
  BULAN.forEach((b, i) => { map[b.toLowerCase()] = String(i + 1).padStart(2, '0'); });
  const match = formatted.match(/(\d{1,2})\s+(Januari|Februari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|November|Desember)\s+(\d{4})/i);
  if (!match) return formatted;
  const day = String(match[1]).padStart(2, '0');
  const month = map[match[2].toLowerCase()] || '01';
  const year = match[3];
  return `${year}-${month}-${day}`;
};

const EditEventModal = ({ show, onClose, onSubmit, isSubmitting, initialData = {}, rules = [] }) => {
  const [nama, setNama] = useState(initialData.nama || '');
  const [lokasi, setLokasi] = useState(initialData.lokasi || '');
  const [tanggal, setTanggal] = useState(() => parseTanggalIndonesia(initialData.tanggal_event || ''));
  const [jam, setJam] = useState(() => {
    if (!initialData.waktu_event) return '19:30';
    const parts = String(initialData.waktu_event).trim().split(' ');
    return parts[0] || '19:30';
  });
  const [zona, setZona] = useState(() => {
    if (!initialData.waktu_event) return 'WIB';
    const parts = String(initialData.waktu_event).trim().split(' ');
    return parts[1] || 'WIB';
  });
  const [openNama, setOpenNama] = useState(false);
  const [openLokasi, setOpenLokasi] = useState(false);
  const [selectedRuleId, setSelectedRuleId] = useState(initialData.rule_id || '');
  const [openRule, setOpenRule] = useState(false);
  const namaRef = useRef(null);
  const lokasiRef = useRef(null);
  const ruleRef = useRef(null);

  useEffect(() => {
    if (show) {
      setNama(initialData.nama || '');
      setLokasi(initialData.lokasi || '');
      setTanggal(parseTanggalIndonesia(initialData.tanggal_event || ''));
      const waktuParts = String(initialData.waktu_event || '').trim().split(' ');
      setJam(waktuParts[0] || '19:30');
      setZona(waktuParts[1] || 'WIB');
      setSelectedRuleId(initialData.rule_id || '');
    }
  }, [show, initialData]);

  useEffect(() => {
    const handler = (e) => {
      if (namaRef.current && !namaRef.current.contains(e.target)) setOpenNama(false);
      if (lokasiRef.current && !lokasiRef.current.contains(e.target)) setOpenLokasi(false);
      if (ruleRef.current && !ruleRef.current.contains(e.target)) setOpenRule(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSubmit = () => {
    if (!nama.trim() || !lokasi.trim() || !tanggal) return;
    const formattedDate = formatTanggalIndonesia(tanggal);
    const finalWaktu = `${formattedDate} ${jam} ${zona}`;
    onSubmit({
      eventId: initialData.event_id || initialData.id,
      nama: nama.trim(),
      lokasi: lokasi.trim(),
      tanggal_event: formattedDate,
      waktu_event: `${jam} ${zona}`,
      rule_id: selectedRuleId || ''
    });
  };

  const renderCustomSelect = (value, onChange, options, isOpen, setIsOpen, ref, placeholder) => (
    <div className="relative" ref={ref}>
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={(e) => { onChange(e.target.value); setIsOpen(true); }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className="w-full bg-[#1e293b] text-gray-200 rounded-full px-4 py-3 pr-10 font-bold outline-none border border-slate-700 focus:border-blue-400 transition-all"
          autoComplete="off"
        />
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-400 pointer-events-none"
        >
          <ChevronDown size={16} />
        </button>
      </div>
      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-[#1e293b] border border-slate-700 rounded-2xl shadow-xl shadow-black/40 overflow-hidden">
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => { onChange(opt); setIsOpen(false); }}
              className={`w-full text-left px-4 py-2.5 text-sm font-bold transition-colors ${
                value === opt ? 'text-blue-400 bg-slate-800/60' : 'text-gray-300 hover:bg-slate-800/40 hover:text-blue-300'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return (
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
                  EDIT EVENT
                </h3>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest mt-2 italic">
                  Reschedule / Edit
                </p>
              </div>

              <div>
                <label className="text-[10px] font-black text-primary uppercase ml-2 mb-1 block italic tracking-widest">Nama Event</label>
                {renderCustomSelect(nama, setNama, PRESET_NAMA, openNama, setOpenNama, namaRef, 'Lalapan Week ...')}
              </div>

              <div>
                <label className="text-[10px] font-black text-primary uppercase ml-2 mb-1 block italic tracking-widest">Lokasi</label>
                {renderCustomSelect(lokasi, setLokasi, PRESET_LOKASI, openLokasi, setOpenLokasi, lokasiRef, 'Pilih lokasi...')}
              </div>

              <div>
                <label className="text-[10px] font-black text-primary uppercase ml-2 mb-1 block italic tracking-widest">Tanggal</label>
                <input
                  type="date"
                  value={tanggal}
                  onChange={(e) => setTanggal(e.target.value)}
                  className="w-full bg-[#1e293b] text-gray-200 rounded-full px-4 py-3 font-bold outline-none border border-slate-700 focus:border-blue-400 transition-all [color-scheme:dark]"
                />
                {tanggal && (
                  <p className="text-[10px] text-blue-400 font-bold mt-1 ml-2 italic">
                    {formatTanggalIndonesia(tanggal)}
                  </p>
                )}
              </div>

              <div>
                <label className="text-[10px] font-black text-primary uppercase ml-2 mb-1 block italic tracking-widest">Jam</label>
                <div className="flex gap-2">
                  <input
                    type="time"
                    value={jam}
                    onChange={(e) => setJam(e.target.value)}
                    className="flex-1 bg-[#1e293b] text-gray-200 rounded-full px-4 py-3 font-bold outline-none border border-slate-700 focus:border-blue-400 transition-all [color-scheme:dark]"
                  />
                  <select
                    value={zona}
                    onChange={(e) => setZona(e.target.value)}
                    className="bg-[#1e293b] text-gray-200 rounded-full px-4 py-3 font-bold outline-none border border-slate-700 focus:border-blue-400 transition-all w-28"
                  >
                    {ZONA_OPTIONS.map((z) => (
                      <option key={z} value={z} className="bg-[#1e293b]">{z}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-primary uppercase ml-2 mb-1 block italic tracking-widest">Rule</label>
                <div className="relative" ref={ruleRef}>
                  <div className="relative">
                    <input
                      type="text"
                      value={rules.find(r => r.rule_id === selectedRuleId) ? `${selectedRuleId} — ${rules.find(r => r.rule_id === selectedRuleId).nama} — ${rules.find(r => r.rule_id === selectedRuleId).periode}` : ''}
                      onChange={() => {}}
                      onFocus={() => setOpenRule(true)}
                      placeholder="Pilih rule..."
                      className="w-full bg-[#1e293b] text-gray-200 rounded-full px-4 py-3 pr-10 font-bold outline-none border border-slate-700 focus:border-blue-400 transition-all"
                      autoComplete="off"
                    />
                    <button
                      type="button"
                      onClick={() => setOpenRule(!openRule)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-400 pointer-events-none"
                    >
                      <ChevronDown size={16} />
                    </button>
                  </div>
                  {openRule && (
                    <div className="absolute z-50 w-full mt-2 bg-[#1e293b] border border-slate-700 rounded-2xl shadow-xl shadow-black/40 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => { setSelectedRuleId(''); setOpenRule(false); }}
                        className="w-full text-left px-4 py-2.5 text-sm font-bold text-gray-500 hover:bg-slate-800/40 transition-colors"
                      >
                        Tanpa Rule
                      </button>
                      {rules.map((r) => (
                        <button
                          key={r.rule_id}
                          type="button"
                          onClick={() => { setSelectedRuleId(r.rule_id); setOpenRule(false); }}
                          className={`w-full text-left px-4 py-2.5 text-sm font-bold transition-colors ${
                            selectedRuleId === r.rule_id ? 'text-blue-400 bg-slate-800/60' : 'text-gray-300 hover:bg-slate-800/40 hover:text-blue-300'
                          }`}
                        >
                          {r.rule_id} — {r.nama} — {r.periode}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
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
                  onClick={handleSubmit}
                  disabled={isSubmitting || !nama.trim() || !lokasi.trim() || !tanggal}
                  className="flex-1 py-4 bg-primary dark:text-white rounded-2xl font-black uppercase italic text-xs shadow-lg shadow-primary/30 active:scale-95 transition-all disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 className="animate-spin mx-auto" size={16} /> : 'Simpan'}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default EditEventModal;
