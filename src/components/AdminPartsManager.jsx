import { useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCcw, ToggleLeft, ToggleRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { createBeybladePart, getBeybladeParts, toggleBeybladePart } from '../utils/api';
import { normalizePartType, getPartImage } from '../utils/deckUtils';

const PART_TYPES = ['BLADE', 'OVER_BLADE', 'ASSIST_BLADE', 'LOCK_CHIP', 'RATCHET', 'BIT'];

export default function AdminPartsManager({ user }) {
  const [parts, setParts] = useState([]);
  const [type, setType] = useState('BLADE');
  const [system, setSystem] = useState('ALL');
  const [name, setName] = useState('');
  const [hasOverBlade, setHasOverBlade] = useState(false);
  const [integratedRatchet, setIntegratedRatchet] = useState(false);
  const [integratedRatchetBit, setIntegratedRatchetBit] = useState(false);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await getBeybladeParts();
      setParts(Array.isArray(res?.parts) ? res.parts : []);
    } catch (e) {
      console.error(e);
      toast.error('Gagal memuat part');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => { load(); }, 0);
    return () => clearTimeout(timer);
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return parts.filter((p) => !q || `${p.partId} ${p.name}`.toLowerCase().includes(q));
  }, [parts, search]);

  const handleCreate = async () => {
    if (!name.trim()) { toast.error('Nama part wajib diisi'); return; }
    setSaving(true);
    try {
      const res = await createBeybladePart({
        googleId: user?.sub || '',
        partType: type,
        system,
        name: name.trim(),
        isActive: true,
        hasOverBlade: type === 'BLADE' && hasOverBlade,
        integratedRatchet: type === 'BLADE' && integratedRatchet && !integratedRatchetBit,
        integratedRatchetBit: type === 'BLADE' && integratedRatchetBit,
      });
      if (res?.status !== 'success') throw new Error(res?.message || 'Gagal membuat part');
      toast.success(`Part ${res.partId} berhasil dibuat`);
      setName('');
      setHasOverBlade(false);
      setIntegratedRatchet(false);
      setIntegratedRatchetBit(false);
      await load();
    } catch (e) {
      console.error(e);
      toast.error(e.message || 'Gagal membuat part');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (part) => {
    try {
      const res = await toggleBeybladePart({
        googleId: user?.sub || '',
        partId: part.partId,
        isActive: !part.isActive,
      });
      if (res?.status !== 'success') throw new Error(res?.message || 'Gagal mengubah status');
      setParts((prev) => prev.map((p) => p.partId === part.partId ? { ...p, isActive: !p.isActive } : p));
    } catch (e) {
      console.error(e);
      toast.error(e.message || 'Gagal mengubah status part');
    }
  };

  return (
    <section className="rounded-[2rem] border border-white/10 bg-gray-900/70 p-5 md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-cyan-400">Beyblade Parts</p>
          <h3 className="mt-1 text-xl font-black uppercase italic text-white">Part Inventory</h3>
          <p className="mt-1 text-[9px] font-bold uppercase tracking-wide text-gray-500">Tambah part tanpa mengetik Part ID. ID dibuat otomatis per kategori.</p>
        </div>
        <button type="button" onClick={load} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[9px] font-black uppercase tracking-widest text-gray-300 hover:bg-white/10"><RefreshCcw size={13} className="inline mr-1" /> Refresh</button>
      </div>

      <div className="mt-5 grid grid-cols-1 md:grid-cols-4 gap-3">
        <select value={type} onChange={(e) => setType(e.target.value)} className="rounded-xl border border-white/10 bg-gray-950 px-3 py-3 text-xs font-black text-white outline-none">
          {PART_TYPES.map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
        </select>
        <select value={system} onChange={(e) => setSystem(e.target.value)} className="rounded-xl border border-white/10 bg-gray-950 px-3 py-3 text-xs font-black text-white outline-none">
          {['ALL', 'BX', 'UX', 'CX'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama part" className="rounded-xl border border-white/10 bg-gray-950 px-3 py-3 text-xs font-bold text-white outline-none md:col-span-1" />
        <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-2">
          <label className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-[9px] font-black uppercase tracking-widest ${type === 'BLADE' && system === 'CX' ? 'border-white/10 bg-gray-950 text-gray-300' : 'border-white/5 bg-gray-900/50 text-gray-600'}`}>
            <input type="checkbox" checked={hasOverBlade} disabled={type !== 'BLADE' || system !== 'CX'} onChange={(e) => setHasOverBlade(e.target.checked)} />
            Has Over Blade
          </label>
          <label className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-[9px] font-black uppercase tracking-widest ${type === 'BLADE' ? 'border-white/10 bg-gray-950 text-gray-300' : 'border-white/5 bg-gray-900/50 text-gray-600'}`}>
            <input type="checkbox" checked={integratedRatchet} disabled={type !== 'BLADE' || system !== 'UX' || integratedRatchetBit} onChange={(e) => setIntegratedRatchet(e.target.checked)} />
            Integrated Ratchet
          </label>
          <label className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-[9px] font-black uppercase tracking-widest ${type === 'BLADE' ? 'border-white/10 bg-gray-950 text-gray-300' : 'border-white/5 bg-gray-900/50 text-gray-600'}`}>
            <input type="checkbox" checked={integratedRatchetBit} disabled={type !== 'BLADE' || system !== 'ALL'} onChange={(e) => { setIntegratedRatchetBit(e.target.checked); if (e.target.checked) setIntegratedRatchet(false); }} />
            Integrated Ratchet + Bit
          </label>
        </div>
        <button type="button" disabled={saving} onClick={handleCreate} className="rounded-xl bg-cyan-500 px-4 py-3 text-[9px] font-black uppercase tracking-widest text-gray-950 hover:bg-cyan-400 disabled:opacity-50"><Plus size={14} className="inline mr-1" /> {saving ? 'Saving...' : 'Tambah Part'}</button>
      </div>

      <div className="mt-4">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari Part ID / nama" className="w-full rounded-xl border border-white/10 bg-gray-950 px-3 py-3 text-xs font-bold text-white outline-none" />
      </div>

      <div className="mt-4 max-h-[360px] overflow-y-auto space-y-2 pr-1">
        {loading ? <div className="py-10 text-center text-[9px] font-black uppercase tracking-widest text-gray-600">Memuat part...</div> : filtered.map((part) => {
          const normalized = normalizePartType(part.partType);
          return <div key={part.partId} className="flex items-center gap-3 rounded-2xl border border-white/5 bg-black/20 p-3">
            <div className="h-12 w-12 rounded-xl bg-gray-950 border border-white/5 flex items-center justify-center overflow-hidden">
              {getPartImage(part) ? <img src={getPartImage(part)} alt={part.name} className="h-full w-full object-contain" /> : <span className="text-[9px] font-black text-gray-700">NO IMG</span>}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-black text-white truncate">{part.name}</p>
              <p className="text-[8px] font-black uppercase tracking-widest text-gray-500">{part.partId} • {normalized} • {part.system || 'ALL'}</p>
            </div>
            <button type="button" onClick={() => handleToggle(part)} className={`shrink-0 p-2 rounded-xl ${part.isActive ? 'bg-green-500/10 text-green-300' : 'bg-gray-800 text-gray-500'}`} title="Toggle active">
              {part.isActive ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
            </button>
          </div>;
        })}
      </div>
    </section>
  );
}
