import { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Edit3, Trash2, X, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { getBeybladeParts, getMyDecks, createDeck, updateDeck, toggleDeckActive, deleteDeck, fixLegacyDeckRow } from '../utils/api';
import { getPartImage, getComboName as getComboNameShared, normalizePartType, getBladeRules } from '../utils/deckUtils';

const isLegacyPartId = (part) => {
  if (!part?.partId) return false;
  return !/^[A-Z]{2}\d{3}$/i.test(String(part.partId).trim());
};

const PART_TYPE_IMAGE_SCALE = {
  'LOCK_CHIP': 'scale-[1.6] group-hover:scale-[1.8]',
  'LOCK CHIP': 'scale-[1.6] group-hover:scale-[1.8]',
  'BLADE': 'scale-[1.5] group-hover:scale-[1.65]',
  'ASSIST_BLADE': 'scale-[1.65] group-hover:scale-[1.8]',
  'ASSIST BLADE': 'scale-[1.65] group-hover:scale-[1.8]',
  'RATCHET': 'scale-[1.7] group-hover:scale-[1.85]',
  'BIT': 'scale-[1.6] group-hover:scale-[1.8]'
};

const getPartImageScale = (partType) => {
  return PART_TYPE_IMAGE_SCALE[partType] || 'scale-[1.6] group-hover:scale-[1.8]';
};

const getEquipmentLayout = (parts, system) => {
  const count = parts.length;
  const rowHeight = 'grid-auto-rows-[120px] sm:grid-auto-rows-[135px] md:grid-auto-rows-[190px]';

  if (count === 0) return { slots: [], gridClass: `grid grid-cols-2 gap-3 sm:gap-4 ${rowHeight}`, wrapperClass: '' };

  const bladeIndex = parts.findIndex(p => p.partType === 'BLADE');
  const hasBlade = bladeIndex !== -1;

  if (count === 2) {
    return {
      slots: parts.map(p => ({ ...p, gridClass: 'col-span-1 row-span-1' })),
      gridClass: `grid grid-cols-2 gap-3 sm:gap-4 ${rowHeight}`
    };
  }

  if (count === 3 && hasBlade) {
    const slots = parts.map((p, i) => {
      if (i === bladeIndex) return { ...p, gridClass: 'col-span-1 row-span-2' };
      return { ...p, gridClass: 'col-span-1 row-span-1' };
    });
    return { slots, gridClass: `grid grid-cols-2 gap-3 sm:gap-4 ${rowHeight}` };
  }

  if (count === 4) {
    return {
      slots: parts.map(p => ({ ...p, gridClass: 'col-span-1 row-span-1' })),
      gridClass: `grid grid-cols-2 gap-3 sm:gap-4 ${rowHeight}`
    };
  }

  if (count === 5 && system === 'CX') {
    const blade = parts.find(p => p.partType === 'BLADE');
    const others = parts.filter(p => p.partType !== 'BLADE');
    const slots = [];
    if (blade) {
      slots.push({ ...blade, gridClass: 'col-span-1 row-span-2' });
    }
    others.forEach(p => slots.push({ ...p, gridClass: 'col-span-1 row-span-1' }));
    return { slots, gridClass: `grid grid-cols-2 gap-3 sm:gap-4 ${rowHeight}` };
  }

  if (count >= 6) {
    return {
      slots: parts.map(p => ({ ...p, gridClass: 'col-span-1 row-span-1' })),
      gridClass: `grid grid-cols-2 gap-3 sm:gap-4 ${rowHeight}`
    };
  }

  return {
    slots: parts.map(p => ({ ...p, gridClass: 'col-span-1 row-span-1' })),
    gridClass: `grid grid-cols-2 gap-3 sm:gap-4 ${rowHeight}`
  };
};

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.4, ease: 'easeOut' }
  })
};

const emptyDeckForm = {
  deckName: '',
  system: 'BX',
  lockChip: '',
  blade: '',
  overBlade: '',
  assistBlade: '',
  ratchet: '',
  bit: '',
  description: '',
  isActive: 'TRUE'
};

const PartSlot = ({ label, partId, onClick, partsMap, gridClass = '' }) => {
  const part = partsMap[partId];
  const scaleClasses = getPartImageScale(normalizePartType(part?.partType));

  return (
    <div
      onClick={onClick}
      className={`
        relative bg-black/40 border border-gray-700 hover:border-blue-500
        rounded-xl flex flex-col items-center justify-between
        cursor-pointer transition-all active:scale-95 overflow-hidden group
        p-3 sm:p-4 min-h-0 w-full max-w-[190px] justify-self-center
        ${gridClass}
      `}
    >
      <span className="text-[9px] sm:text-[10px] text-gray-500 font-black uppercase tracking-widest">{label}</span>
      {part ? (
        <div className="flex-1 w-full flex items-center justify-center overflow-hidden min-h-0">
          <img
            src={getPartImage(part)}
            alt={part.name}
            loading="lazy"
            className={`w-full h-full object-contain ${scaleClasses} drop-shadow-lg transition-transform`}
          />
        </div>
      ) : (
        <div className="flex-1 w-full flex items-center justify-center min-h-0">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gray-800/50 flex items-center justify-center text-gray-400 group-hover:bg-blue-500/20 group-hover:text-blue-400 transition-all">
            <Plus size={24} className="sm:w-7 sm:h-7" />
          </div>
        </div>
      )}
      <span className="text-[10px] sm:text-xs text-white font-bold truncate w-full text-center">{part ? part.name : 'Select'}</span>
    </div>
  );
};

export default function MyDecks({ user }) {
  const [allDecks, setAllDecks] = useState([]);
  const [parts, setParts] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // STATE BARU: Menggantikan showForm untuk Inline Editing
  const [isAddingNew, setIsAddingNew] = useState(false);
  
  const [editingDeck, setEditingDeck] = useState(null);
  const [form, setForm] = useState(emptyDeckForm);
  const [filter, setFilter] = useState('active');
  const [counts, setCounts] = useState({ active: 0, reserve: 0, total: 0 });
  const [processingDeckId, setProcessingDeckId] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditingDeckId, setIsEditingDeckId] = useState(null);
  const [activePicker, setActivePicker] = useState(null);
  const [deckToDelete, setDeckToDelete] = useState(null);
  const [showInlineDiscardConfirm, setShowInlineDiscardConfirm] = useState(false);
  
  const initialFormRef = useRef(null);
  const deckNameRef = useRef(null);

  const googleId = user?.sub || '';

  const partsMap = useMemo(() => {
    const map = {};
    parts.forEach(p => {
      if (p.partId) map[p.partId] = p;
    });
    return map;
  }, [parts]);


  // Part yang sudah dipakai oleh ACTIVE deck lain milik user ini
  // tidak boleh dipilih lagi. Deck yang sedang diedit dikecualikan.
  const usedActivePartIds = useMemo(() => {
    const used = new Set();
    const editingId = editingDeck?.deckId || null;

    allDecks
      .filter(deck => deck.isActive && deck.deckId !== editingId)
      .forEach(deck => {
        [
          deck.lockChip,
          deck.blade,
          deck.overBlade,
          deck.assistBlade,
          deck.ratchet,
          deck.bit
        ].forEach(part => {
          const id = String(part?.partId || '').trim();
          if (id) used.add(id.toUpperCase());
        });
      });

    return used;
  }, [allDecks, editingDeck?.deckId]);

  const isPartUsedByAnotherActiveDeck = (partId) => {
    const id = String(partId || '').trim();
    return id ? usedActivePartIds.has(id.toUpperCase()) : false;
  };

  const fetchDecks = async () => {
    try {
      const res = await getMyDecks({ filter: 'all', googleId });
      if (res?.status === 'success') {
        const decksList = Array.isArray(res.decks) ? res.decks : [];
        setAllDecks(decksList);
        if (res.counts) setCounts(res.counts);
      }
    } catch (err) {
      console.error('Gagal fetch decks:', err);
    }
  };

  const fetchParts = async () => {
    try {
      const res = await getBeybladeParts();
      if (res?.status === 'success') {
        const partsList = Array.isArray(res.parts) ? res.parts : [];
        setParts(partsList);
      }
    } catch (err) {
      console.error('Gagal fetch parts:', err);
    }
  };

  useEffect(() => {
    if (!activePicker) return;

    const originalOverflow = document.body.style.overflow;

    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [activePicker]);

  useEffect(() => {
    const load = async () => {
      if (!googleId) return;
      setLoading(true);
      try {
        await Promise.all([fetchDecks(), fetchParts()]);
      } catch (err) {
        console.error('Gagal fetch data:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [googleId]);

  const visibleDecks = useMemo(() => {
    if (filter === 'active') return allDecks.filter(d => d.isActive);
    if (filter === 'reserve') return allDecks.filter(d => !d.isActive);
    return allDecks;
  }, [allDecks, filter]);

  const resetForm = () => {
    setForm(emptyDeckForm);
    setEditingDeck(null);
    setIsEditingDeckId(null);
    setIsAddingNew(false);
    initialFormRef.current = null;
    setShowInlineDiscardConfirm(false);
    setActivePicker(null);
  };

  const openCreate = () => {
    const initial = { ...emptyDeckForm, isActive: counts.active < 3 ? 'TRUE' : 'FALSE' };
    setForm(initial);
    initialFormRef.current = JSON.stringify(initial);
    setIsAddingNew(true);
    setIsEditingDeckId(null);
    setEditingDeck(null);
    setTimeout(() => {
      if (deckNameRef.current) deckNameRef.current.focus();
    }, 100);
  };

  const openEdit = (deck) => {
    setEditingDeck(deck);
    setIsEditingDeckId(deck.deckId);
    setIsAddingNew(false);
    const editBlade = deck.blade?.partId ? parts.find(p => p.partId === deck.blade.partId) : null;
    const editRules = getBladeRules(editBlade || deck.blade);
    const editSystem = deck.system || 'BX';
    const initial = {
      deckName: deck.deckName || '',
      system: editSystem,
      lockChip: editSystem === 'CX' ? (deck.lockChip?.partId || '') : '',
      blade: deck.blade?.partId || '',
      overBlade: editSystem === 'CX' && editRules.hasOverBlade ? (deck.overBlade?.partId || '') : '',
      assistBlade: editSystem === 'CX' ? (deck.assistBlade?.partId || '') : '',
      ratchet: editRules.integratedRatchet || editRules.integratedRatchetBit ? '' : (deck.ratchet?.partId || ''),
      bit: editRules.integratedRatchetBit ? '' : (deck.bit?.partId || ''),
      description: deck.description || '',
      isActive: deck.isActive ? 'TRUE' : 'FALSE'
    };
    setForm(initial);
    initialFormRef.current = JSON.stringify(initial);
  };

  const isFormDirty = () => {
    if (!initialFormRef.current) return false;
    return JSON.stringify(form) !== initialFormRef.current;
  };

  const handleCloseAttempt = () => {
    if (isFormDirty()) {
      setShowInlineDiscardConfirm(true);
    } else {
      closeForm();
    }
  };

  const closeForm = () => {
    resetForm();
  };

  const handleSystemChange = (newSystem) => {
    setForm(prev => ({
      ...prev,
      system: newSystem,
      lockChip: newSystem === 'CX' ? prev.lockChip : '',
      overBlade: newSystem === 'CX' ? prev.overBlade : '',
      assistBlade: newSystem === 'CX' ? prev.assistBlade : '',
    }));
  };

  const getComboName = () => getComboNameShared({
    system: form.system,
    lockChip: partsMap[form.lockChip],
    blade: partsMap[form.blade],
    overBlade: partsMap[form.overBlade],
    assistBlade: partsMap[form.assistBlade],
    ratchet: partsMap[form.ratchet],
    bit: partsMap[form.bit],
  });

  const selectedBlade = form.blade ? partsMap[form.blade] : null;
  const selectedBit = form.bit ? partsMap[form.bit] : null;

  const bladeRules = getBladeRules(selectedBlade);
  const bitRules = getBladeRules(selectedBit);

  const needsOverBlade =
    form.system === 'CX' && bladeRules.hasOverBlade;

  // Ratchet wajib disembunyikan bila:
  // 1) Blade sudah punya Ratchet bawaan, atau
  // 2) Blade sudah punya Ratchet + Bit bawaan, atau
  // 3) Bit yang dipilih sendiri sudah membawa Ratchet.
  const needsRatchet =
    !bladeRules.integratedRatchet &&
    !bladeRules.integratedRatchetBit &&
    !bitRules.integratedRatchet &&
    !bitRules.integratedRatchetBit;

  // Bit tetap dipilih kecuali Blade sendiri sudah include Ratchet + Bit.
  const needsBit = !bladeRules.integratedRatchetBit;

  const renderEquipmentSlots = () => {
    const fieldOrder = [
      { key: 'lockChip', label: 'Lock Chip', type: 'LOCK_CHIP' },
      { key: 'blade', label: 'Blade', type: 'BLADE' },
      { key: 'overBlade', label: 'Over Blade', type: 'OVER_BLADE' },
      { key: 'assistBlade', label: 'Assist Blade', type: 'ASSIST_BLADE' },
      { key: 'ratchet', label: 'Ratchet', type: 'RATCHET' },
      { key: 'bit', label: 'Bit', type: 'BIT' }
    ];

    const availableFields = fieldOrder.filter(f => {
      if (f.type === 'LOCK_CHIP' || f.type === 'ASSIST_BLADE') return form.system === 'CX';
      if (f.type === 'OVER_BLADE') return needsOverBlade;
      if (f.type === 'RATCHET') return needsRatchet;
      if (f.type === 'BIT') return needsBit;
      return true;
    });

    const parts = availableFields.map(f => ({
      partId: form[f.key],
      partType: f.type,
      label: f.label,
      fieldKey: f.key
    })).filter(p => p.partId || true);

    const layout = getEquipmentLayout(parts, form.system);

    if (layout.slots.length === 0) return null;

    return (
      <div className="w-full max-w-[400px] mx-auto">
        <div className={layout.gridClass}>
          {layout.slots.map((slot, idx) => {
            const originalField = availableFields.find(f => f.type === slot.partType);
            const partId = originalField ? form[originalField.key] : '';
            return (
              <PartSlot
                key={slot.fieldKey || idx}
                label={slot.label}
                partId={partId}
                onClick={() => setActivePicker(originalField?.key || '')}
                partsMap={partsMap}
                gridClass={slot.gridClass}
              />
            );
          })}
        </div>
      </div>
    );
  };

  const validateForm = () => {
    const { deckName, system, lockChip, blade, overBlade, assistBlade, ratchet, bit } = form;
    if (!deckName.trim()) return 'Deck name wajib diisi';

    // Saat ACTIVE, satu part tidak boleh digunakan oleh dua active deck.
    if (form.isActive === 'TRUE') {
      const selectedIds = [
        ['Lock Chip', lockChip],
        ['Blade', blade],
        ['Over Blade', overBlade],
        ['Assist Blade', assistBlade],
        ['Ratchet', ratchet],
        ['Bit', bit]
      ];

      const duplicate = selectedIds.find(([, id]) => isPartUsedByAnotherActiveDeck(id));
      if (duplicate) {
        return `${duplicate[0]} ${duplicate[1]} sudah dipakai oleh active deck lain`;
      }
    }
    if (!['BX', 'UX', 'CX'].includes(system)) return 'System harus BX, UX, atau CX';
    if (!blade || !partsMap[blade]) return 'Blade wajib diisi';

    const rules = getBladeRules(partsMap[blade]);

    if (system === 'CX') {
      if (!lockChip || !partsMap[lockChip]) return 'Lock Chip wajib diisi';
      if (!assistBlade || !partsMap[assistBlade]) return 'Assist Blade wajib diisi';
      if (rules.hasOverBlade && (!overBlade || !partsMap[overBlade])) return 'Blade ini membutuhkan Over Blade';
      if (!rules.hasOverBlade && overBlade) return 'Blade ini tidak memiliki Over Blade';
    } else if (lockChip || assistBlade || overBlade) {
      return 'Lock Chip, Over Blade, dan Assist Blade hanya untuk CX';
    }

    const selectedBit = bit ? partsMap[bit] : null;
    const bitRules = getBladeRules(selectedBit);

    if (rules.integratedRatchetBit) {
      if (ratchet || bit) return 'Blade ini sudah memiliki Ratchet + Bit bawaan';
    } else if (rules.integratedRatchet) {
      if (ratchet) return 'Blade ini sudah memiliki Ratchet bawaan';

      if (selectedBit && (bitRules.integratedRatchet || bitRules.integratedRatchetBit)) {
        return 'Blade ini sudah memiliki Ratchet bawaan, jadi Bit dengan Ratchet bawaan tidak boleh dipakai';
      }

      if (!bit || !partsMap[bit]) return 'Bit wajib diisi';
    } else if (bitRules.integratedRatchetBit) {
      if (ratchet) return 'Bit ini sudah memiliki Ratchet + Bit bawaan';
      if (!bit || !partsMap[bit]) return 'Bit wajib diisi';
    } else if (bitRules.integratedRatchet) {
      if (ratchet) return 'Bit ini sudah memiliki Ratchet bawaan';
      if (!bit || !partsMap[bit]) return 'Bit wajib diisi';
    } else {
      if (!ratchet || !partsMap[ratchet]) return 'Ratchet wajib diisi';
      if (!bit || !partsMap[bit]) return 'Bit wajib diisi';
    }
    return null;
  };

  const handleSubmit = async () => {
    const validationError = validateForm();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setIsCreating(true);
    try {
      const payload = {
        deckName: form.deckName.trim(),
        system: form.system,
        lockChip: form.lockChip,
        blade: form.blade,
        overBlade: form.overBlade,
        assistBlade: form.assistBlade,
        ratchet: form.ratchet,
        bit: form.bit,
        description: form.description.trim(),
        isActive: form.isActive,
        googleId: googleId
      };

      let res;
      if (editingDeck) {
        res = await updateDeck({ ...payload, deckId: editingDeck.deckId });
      } else {
        res = await createDeck(payload);
      }

      if (res?.status === 'success') {
        toast.success(editingDeck ? 'Deck berhasil diperbarui' : 'Deck berhasil dibuat');
        closeForm();
        await fetchDecks();
      } else {
        toast.error(res?.message || 'Gagal menyimpan deck');
      }
    } catch (err) {
      console.error('[DECK SAVE ERROR]', err);
      toast.error(err?.message || 'Gagal menyimpan deck');
    } finally {
      setIsCreating(false);
    }
  };

  const handleToggleActive = async (deck) => {
    setProcessingDeckId(deck.deckId);
    try {
      const res = await toggleDeckActive({ deckId: deck.deckId, googleId });
      if (res?.status === 'success') {
        toast.success(res.message || 'Status deck berhasil diubah');
        await fetchDecks();
      } else {
        toast.error(res?.message || 'Gagal mengubah status deck');
      }
    } catch {
      toast.error('Gagal mengubah status deck');
    } finally {
      setProcessingDeckId(null);
    }
  };

  const handleFixDeckRow = async (deckId) => {
    try {
      const res = await fixLegacyDeckRow(deckId);
      if (res?.status === 'success' && res.rowChanged) {
        toast.success(`Deck ${deckId} diperbaiki: ${res.updates.length} field diperbarui`);
        await fetchDecks();
      } else if (res?.status === 'success') {
        toast.info('Deck sudah menggunakan part_id, tidak ada yang diubah');
      } else {
        toast.error(res?.message || 'Gagal memperbaiki deck');
      }
    } catch {
      toast.error('Gagal memperbaiki deck');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deckToDelete) return;
    setIsCreating(true);
    try {
      const res = await deleteDeck({ deckId: deckToDelete, googleId });
      if (res?.status === 'success') {
        toast.success('Deck berhasil dihapus!');
        setDeckToDelete(null);
        await fetchDecks();
      } else {
        toast.error(res?.message || 'Gagal menghapus deck');
      }
    } catch {
      toast.error('Terjadi kesalahan saat menghapus');
    } finally {
      setIsCreating(false);
    }
  };

  const getFilteredParts = (type, system) => {
    const normalizedType = normalizePartType(type);

    return parts.filter(p => {
      if (normalizePartType(p.partType) !== normalizedType) return false;
      if (!p.isActive) return false;

      if (system !== 'ALL' && p.system !== 'ALL' && p.system !== system) {
        return false;
      }

      // Jangan tampilkan part yang sudah dipakai active deck lain.
      // Part yang sedang dipakai deck yang sedang diedit tetap boleh dipilih.
      if (isPartUsedByAnotherActiveDeck(p.partId)) {
        return false;
      }

      // Blade/Bit compatibility: jangan pasangkan dua komponen
      // yang sama-sama membawa Ratchet bawaan.
      if (
        normalizedType === 'BIT' &&
        (bladeRules.integratedRatchet || bladeRules.integratedRatchetBit)
      ) {
        const candidateRules = getBladeRules(p);
        if (candidateRules.integratedRatchet || candidateRules.integratedRatchetBit) {
          return false;
        }
      }

      return true;
    });
  };

  const normalizeDeckParts = (deck) => {
    const fieldMap = [
      { key: 'lockChip', partType: 'LOCK CHIP' },
      { key: 'blade', partType: 'BLADE' },
      { key: 'overBlade', partType: 'OVER BLADE' },
      { key: 'assistBlade', partType: 'ASSIST BLADE' },
      { key: 'ratchet', partType: 'RATCHET' },
      { key: 'bit', partType: 'BIT' }
    ];

    const parts = [];
    fieldMap.forEach(({ key, partType }) => {
      const part = deck[key];
      if (!part) return;
      parts.push({
        ...part,
        partType: normalizePartType(part.partType || partType),
        variant: part.variant || ''
      });
    });
    return parts;
  };

  const getDeckComboName = (deck) => {
    const deckParts = normalizeDeckParts(deck);
    return deckParts.map(p => p.name).filter(Boolean).join(' ');
  };

  // KOMPONEN INLINE FORM: Diekstrak agar bisa dipanggil saat Add maupun Edit
  const renderInlineForm = (titleText) => (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-800">
        <h3 className="text-base font-black text-white tracking-tight">{titleText}</h3>
        <button onClick={handleCloseAttempt} className="text-gray-500 hover:text-white transition-colors">
          <X size={20} />
        </button>
      </div>

      {/* Desktop: two columns | Mobile: single column */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] gap-4 lg:gap-5 items-start">
        {/* LEFT: Deck information */}
        <div className="space-y-4 lg:space-y-3">
          <div>
            <label className="text-[10px] font-black text-gray-500 uppercase ml-2 mb-1 block tracking-widest">Deck Name</label>
            <input
              ref={deckNameRef}
              value={form.deckName}
              onChange={(e) => setForm(prev => ({ ...prev, deckName: e.target.value }))}
              placeholder="Ex: Sharkscale Attack"
              maxLength={50}
              className="w-full p-3 bg-gray-900 rounded-xl text-center font-bold outline-none border-2 border-transparent focus:border-blue-500 text-white text-xs"
            />
          </div>

          <div>
            <label className="text-[10px] font-black text-gray-500 uppercase ml-2 mb-1 block tracking-widest">System</label>
            <div className="grid grid-cols-3 gap-2">
              {['BX', 'UX', 'CX'].map(sys => (
                <button
                  key={sys}
                  type="button"
                  onClick={() => handleSystemChange(sys)}
                  className={`py-3 lg:py-2.5 rounded-xl font-black uppercase italic text-xs transition-all active:scale-95 ${
                    form.system === sys
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                      : 'bg-gray-900 text-gray-500'
                  }`}
                >
                  {sys}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-black text-gray-500 uppercase ml-2 mb-1 block tracking-widest">Status</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setForm(prev => ({ ...prev, isActive: 'TRUE' }))}
                disabled={counts.active >= 3 && form.isActive !== 'TRUE'}
                className={`py-2 rounded-xl font-black uppercase italic text-[10px] transition-all active:scale-95 ${
                  form.isActive === 'TRUE'
                    ? 'bg-green-500 text-white shadow-lg shadow-green-500/30'
                    : 'bg-gray-900 text-gray-500'
                }`}
              >
                ACTIVE
              </button>
              <button
                type="button"
                onClick={() => setForm(prev => ({ ...prev, isActive: 'FALSE' }))}
                className={`py-2 rounded-xl font-black uppercase italic text-[10px] transition-all active:scale-95 ${
                  form.isActive === 'FALSE'
                    ? 'bg-gray-500 text-white shadow-lg shadow-gray-500/30'
                    : 'bg-gray-900 text-gray-500'
                }`}
              >
                RESERVE
              </button>
            </div>
            {counts.active >= 3 && form.isActive === 'TRUE' && (
              <p className="text-[9px] text-red-400 font-black uppercase tracking-widest mt-1">Maximum 3 active decks reached</p>
            )}
          </div>

          <div>
            <label className="text-[10px] font-black text-gray-500 uppercase ml-2 mb-1 block tracking-widest">Description (Optional)</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Ex: Aggressive combo, good for attack..."
              rows={2}
              className="w-full p-3 bg-gray-900 rounded-xl font-bold outline-none border-2 border-transparent focus:border-blue-500 text-white text-xs resize-none"
            />
          </div>

          {getComboName() && (
            <div className="bg-gray-900 rounded-xl p-3 text-center">
              <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1">Combo Preview</p>
              <p className="text-sm font-black text-white italic">{getComboName()}</p>
            </div>
          )}
        </div>

        {/* RIGHT: Equipment / Beyblade configuration */}
        <div className="bg-gray-900/50 p-4 lg:p-3 rounded-xl border border-white/5">
          <label className="text-[10px] font-black text-gray-500 uppercase block tracking-widest mb-3 text-center">Equipment Slots</label>
          {renderEquipmentSlots()}
        </div>
      </div>

      {/* Action Buttons */}
      {showInlineDiscardConfirm ? (
        <div className="mt-4 p-4 rounded-xl border border-red-500/30 bg-red-500/5">
          <p className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-1">Unsaved Changes</p>
          <p className="text-xs text-gray-400 font-bold mb-3">Your changes haven't been saved.</p>
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={() => setShowInlineDiscardConfirm(false)}
              disabled={isCreating}
              className="flex-1 py-2.5 bg-gray-800 text-gray-300 rounded-xl font-black uppercase italic text-[10px] shadow-lg active:scale-95 transition-all disabled:opacity-50"
            >
              Keep Editing
            </button>
            <button
              type="button"
              onClick={closeForm}
              disabled={isCreating}
              className="flex-1 py-2.5 bg-red-500 text-white rounded-xl font-black uppercase italic text-[10px] shadow-lg shadow-red-500/20 active:scale-95 transition-all disabled:opacity-50"
            >
              Discard Changes
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex gap-3 pt-3 border-t border-gray-800">
          <button
            type="button"
            onClick={handleCloseAttempt}
            disabled={isCreating}
            className="flex-1 py-3 bg-gray-800 text-gray-300 rounded-xl font-black uppercase italic text-xs shadow-lg active:scale-95 transition-all disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isCreating}
            className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-black uppercase italic text-xs shadow-lg shadow-blue-500/30 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isCreating ? <Loader2 className="animate-spin" size={16} /> : (editingDeck ? 'Save Changes' : 'Create Deck')}
          </button>
        </div>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="bg-white dark:bg-dark-card rounded-[2.5rem] p-8 shadow-sm border border-gray-100 dark:border-gray-800 text-center">
        <Loader2 className="animate-spin mx-auto text-blue-500 mb-2" size={24} />
        <p className="text-xs text-gray-400 font-bold">Loading decks...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-dark-card rounded-[2.5rem] p-6 md:p-8 shadow-sm border border-gray-100 dark:border-gray-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-lg font-black italic uppercase tracking-tight dark:text-white">My Decks</h2>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">
              {counts.active} / 3 ACTIVE · {counts.reserve} RESERVE
            </p>
          </div>
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <button
              type="button"
              onClick={openCreate}
              disabled={isAddingNew}
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-2xl font-black uppercase italic text-xs shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 transition-all active:scale-95 disabled:opacity-50"
            >
              <Plus size={14} /> {counts.active >= 3 ? 'ADD RESERVE DECK' : 'ADD DECK'}
            </button>
          </div>
        </div>

        <div className="flex gap-2 mb-6">
          {['active', 'reserve', 'all'].map(tab => (
            <button
              key={tab}
              type="button"
              onClick={() => setFilter(tab)}
              className={`flex-1 py-2 rounded-xl font-black uppercase italic text-[10px] transition-all active:scale-95 ${
                filter === tab
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {tab === 'active' ? `ACTIVE (${counts.active})` : tab === 'reserve' ? `RESERVE (${counts.reserve})` : `ALL (${counts.total})`}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6">
          {/* AREA INLINE ADD: Tampil di urutan paling atas jika isAddingNew bernilai true */}
          <AnimatePresence>
            {isAddingNew && (
              <motion.div
                initial={{ opacity: 0, height: 0, y: -20 }}
                animate={{ opacity: 1, height: 'auto', y: 0 }}
                exit={{ opacity: 0, height: 0, y: -20 }}
                className="overflow-hidden"
              >
                <div className="p-5 bg-[#161b22] rounded-2xl border-2 border-blue-500 shadow-2xl shadow-blue-500/20 mb-2">
                  {renderInlineForm('CREATE NEW DECK')}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* AREA DATA DECK ATAU EMPTY STATE */}
          {visibleDecks.length === 0 && !isAddingNew ? (
            <div className="text-center py-12">
              <p className="text-sm text-gray-400 font-bold mb-4">
                {filter === 'active' ? 'No active decks yet.' : filter === 'reserve' ? 'No reserve decks yet.' : 'No decks yet.'}
              </p>
              <button
                type="button"
                onClick={openCreate}
                className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-2xl font-black uppercase italic text-xs shadow-lg shadow-blue-500/30 transition-all active:scale-95"
              >
                <Plus size={14} /> {counts.active >= 3 ? 'ADD RESERVE DECK' : 'ADD DECK'}
              </button>
            </div>
          ) : (
            <AnimatePresence>
              {visibleDecks.map((deck, idx) => {
                
                // AREA INLINE EDIT: Menggantikan kartu display dengan form jika deck ini sedang diedit
                if (isEditingDeckId === deck.deckId) {
                  return (
                    <motion.div
                      key={`edit-${deck.deckId}`}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="p-5 bg-[#161b22] rounded-2xl border-2 border-blue-500 shadow-2xl shadow-blue-500/20"
                    >
                      {renderInlineForm(`EDITING: ${deck.deckName}`)}
                    </motion.div>
                  );
                }

                // Render Kartu Visual Deck Normal (Sama seperti sebelumnya)
                const deckParts = normalizeDeckParts(deck);
                const comboName = getDeckComboName(deck);
                const legacyParts = deckParts.filter(isLegacyPartId);
                if (legacyParts.length) {
                  console.log('[LEGACY PART ID]', { deckId: deck.deckId, parts: legacyParts.map(p => ({ partId: p.partId, name: p.name })) });
                }
                const isProcessing = processingDeckId === deck.deckId;

                console.log('[DECK IMAGE DATA]', {
                  deckId: deck.deckId,
                  parts: deckParts.map(part => ({
                    partId: part.partId,
                    name: part.name,
                    partType: part.partType,
                    imageUrl: part.imageUrl
                  }))
                });

                const visualParts = deckParts ? [...deckParts] : [];
                const bladeIndex = visualParts.findIndex(p => (p.partType || '').toUpperCase() === 'BLADE');
                if (bladeIndex > 0) {
                  const temp = visualParts[0];
                  visualParts[0] = visualParts[bladeIndex];
                  visualParts[bladeIndex] = temp;
                }

                return (
                  <motion.div
                    key={deck.deckId}
                    custom={idx}
                    variants={fadeUp}
                    initial="hidden"
                    animate="visible"
                    className={`flex flex-col lg:flex-row gap-6 p-5 bg-[#161b22] rounded-2xl border border-gray-800 shadow-xl relative transition-all ${
                      isProcessing ? 'border-blue-500/50 opacity-90' : ''
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setDeckToDelete(deck.deckId)}
                      className="absolute top-4 right-4 p-2 text-gray-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all z-10"
                      title="Delete Deck"
                    >
                      <Trash2 size={16} />
                    </button>
                    {/* LEFT: Dynamic Visual Grid */}
                    <div className="grid grid-cols-2 gap-3 w-full lg:w-[45%]">
                      {visualParts.length === 0 ? (
                        <div className="col-span-2 flex items-center justify-center p-8 bg-black/30 rounded-xl border border-white/5">
                          <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">No visual parts available.</p>
                        </div>
                        ) : (
                          visualParts.map((part, pIdx) => {
                            const isHero = pIdx === 0;
                            return (
                              <div
                                key={part.partId || pIdx}
                                className={`${isHero ? 'col-span-2 lg:col-span-1 lg:row-span-2 bg-black/30 rounded-xl p-4 relative overflow-hidden flex items-center justify-center border border-white/5 aspect-square lg:aspect-auto min-h-[250px] group' : 'col-span-1 bg-black/30 rounded-xl p-3 relative overflow-hidden flex items-center justify-center border border-white/5 aspect-square group'}`}
                              >
                                {getPartImage(part) ? (
                                  <img
                                    src={getPartImage(part)}
                                    alt={part.name}
                                    className={`w-full h-full object-contain ${isHero ? 'drop-shadow-2xl transition-transform duration-300 scale-[1.5] group-hover:scale-[1.65]' : 'drop-shadow-xl transition-transform duration-300 scale-[1.6] group-hover:scale-[1.8]'}`}
                                    onError={(e) => { e.target.style.display = 'none'; }}
                                  />
                                ) : (
                                  <div className="w-full h-full min-h-[80px] flex items-center justify-center text-gray-400 text-2xl font-black">
                                    {part.name?.charAt(0) || '?'}
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                    </div>

                    {/* RIGHT: Detail */}
                    <div className="flex flex-col w-full lg:w-[55%] gap-3">
                      <div>
                        <h3 className="text-base font-black text-white tracking-tight">{deck.deckName}</h3>
                        <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-0.5">{deck.system}</p>
                        {comboName && (
                          <p className="text-sm text-gray-300 font-bold italic mt-1 truncate" title={comboName}>
                            {comboName}
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        {deckParts.map((part, pIdx) => (
                          <div key={part.partId || pIdx} className="flex items-center gap-3 p-2.5 bg-black/20 rounded-xl border border-white/5">
                            <div className="w-12 h-12 flex-shrink-0 bg-gray-800/80 rounded-lg border border-white/5 flex items-center justify-center overflow-hidden relative">
                              {getPartImage(part) ? (
                                <img src={getPartImage(part)} alt={part.name} className="w-full h-full object-contain scale-[1.3] drop-shadow-md" onError={(e) => { e.target.style.display = 'none'; }} />
                              ) : (
                                <span className="text-gray-400 text-xs font-black">{part.name?.charAt(0) || '?'}</span>
                              )}
                            </div>
                            <div className="flex flex-col min-w-0">
                              <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{part.partType}</p>
                              <p className="text-sm font-black text-white truncate">{part.name}</p>
                              {part.variant && (
                                <p className="text-[10px] text-gray-400 font-bold">{part.variant}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="mt-auto pt-3">
                        <div className="flex flex-row gap-3">
                          {legacyParts.length > 0 && (
                            <button
                              type="button"
                              onClick={() => handleFixDeckRow(deck.deckId)}
                              disabled={isProcessing}
                              className="flex-1 py-2.5 bg-red-600 text-white rounded-xl font-black uppercase italic text-[10px] shadow-lg shadow-red-500/20 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-1"
                            >
                              FIX
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => openEdit(deck)}
                            disabled={isProcessing}
                            className="flex-1 py-2.5 bg-blue-500 text-white rounded-xl font-black uppercase italic text-[10px] shadow-lg shadow-blue-500/20 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-1"
                          >
                            <Edit3 size={12} /> EDIT
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleActive(deck)}
                            disabled={isProcessing}
                            className={`flex-1 py-2.5 rounded-xl font-black uppercase italic text-[10px] shadow-lg active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-1 ${
                              deck.isActive
                                ? 'bg-orange-500 text-white shadow-orange-500/20'
                                : 'bg-green-500 text-white shadow-green-500/20'
                            }`}
                          >
                            {isProcessing ? (
                              <Loader2 className="animate-spin" size={12} />
                            ) : (
                              <>
                                {deck.isActive ? 'DEACTIVATE' : 'ACTIVATE'}
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </div>
      </div>

      {/* Inventory Picker (Viewport-Locked Bottom Sheet) */}
      {activePicker && createPortal(
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-end md:items-center justify-center bg-black/80 backdrop-blur-sm"
            onClick={() => setActivePicker(null)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-full max-w-3xl bg-[#161b22] md:rounded-3xl rounded-t-3xl border border-gray-800 shadow-2xl flex flex-col h-[80dvh]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 z-10 p-4 border-b border-gray-800 flex justify-between items-center bg-[#161b22] rounded-t-3xl">
                <h3 className="text-sm font-black text-white uppercase tracking-widest">Select {activePicker.replace(/([A-Z])/g, ' $1').trim()}</h3>
                <button 
                  onClick={() => setActivePicker(null)} 
                  className="p-3 rounded-full hover:bg-gray-800 text-gray-400 active:scale-95 transition-all"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 content-start [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:bg-gray-600 [&::-webkit-scrollbar-track]:bg-transparent">
                {getFilteredParts(
                  activePicker === 'lockChip' ? 'LOCK_CHIP' : activePicker === 'overBlade' ? 'OVER_BLADE' : activePicker === 'assistBlade' ? 'ASSIST_BLADE' : activePicker.toUpperCase(), 
                  form.system
                ).map(part => (
                  <div 
                    key={part.partId} 
                    onClick={() => {
                      if (isPartUsedByAnotherActiveDeck(part.partId)) {
                        toast.error('Part ini sudah dipakai oleh active deck lain.');
                        return;
                      }

                      // Jangan izinkan Bit yang membawa Ratchet dipasang
                      // pada Blade yang juga sudah membawa Ratchet.
                      if (activePicker === 'bit') {
                        const candidateRules = getBladeRules(part);

                        if (
                          (bladeRules.integratedRatchet || bladeRules.integratedRatchetBit) &&
                          (candidateRules.integratedRatchet || candidateRules.integratedRatchetBit)
                        ) {
                          toast.error('Bit ini sudah memiliki Ratchet bawaan dan tidak kompatibel dengan Blade pilihanmu.');
                          return;
                        }
                      }

                      setForm(prev => {
                        const next = { ...prev, [activePicker]: part.partId };

                        if (activePicker === 'blade') {
                          const rules = getBladeRules(part);

                          if (next.system !== 'CX' || !rules.hasOverBlade) {
                            next.overBlade = '';
                          }

                          if (rules.integratedRatchetBit) {
                            next.ratchet = '';
                            next.bit = '';
                          } else if (rules.integratedRatchet) {
                            next.ratchet = '';

                            // Bila Bit sebelumnya ternyata juga membawa Ratchet,
                            // kosongkan agar user memilih Bit yang kompatibel.
                            const currentBit = partsMap[next.bit];
                            const currentBitRules = getBladeRules(currentBit);

                            if (
                              currentBit &&
                              (currentBitRules.integratedRatchet || currentBitRules.integratedRatchetBit)
                            ) {
                              next.bit = '';
                            }
                          }
                        }

                        if (activePicker === 'bit') {
                          const rules = getBladeRules(part);

                          // Bit yang membawa Ratchet otomatis menghapus Ratchet manual.
                          if (rules.integratedRatchet || rules.integratedRatchetBit) {
                            next.ratchet = '';
                          }
                        }

                        return next;
                      });

                      setActivePicker(null);
                    }}
                    className="bg-black/40 rounded-xl p-3 flex flex-col items-center cursor-pointer hover:bg-blue-600/20 border border-transparent hover:border-blue-500/50 transition-all active:scale-95 active:border-blue-500/50"
                  >
                    <div className="w-full aspect-square flex items-center justify-center overflow-hidden mb-2">
                      <img src={getPartImage(part)} alt={part.name} loading="lazy" className="w-full h-full object-contain scale-[1.5] drop-shadow-md" />
                    </div>
                    <span className="text-[10px] sm:text-xs font-bold text-gray-300 text-center truncate w-full">{part.name}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        </AnimatePresence>,
        document.body
      )}

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deckToDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 backdrop-blur-sm"
            onClick={() => setDeckToDelete(null)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-[#161b22] border border-gray-800 rounded-2xl p-6 shadow-2xl max-w-sm w-full mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-sm font-black text-red-500 mb-2">Delete Deck?</h3>
              <p className="text-xs text-gray-400 font-bold mb-4">Aksi ini tidak dapat dibatalkan. Yakin ingin menghapus deck ini selamanya?</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setDeckToDelete(null)}
                  disabled={isCreating}
                  className="flex-1 py-3 lg:py-2.5 bg-gray-800 text-gray-300 rounded-xl font-black uppercase italic text-[10px] shadow-lg active:scale-95 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteConfirm}
                  disabled={isCreating}
                  className="flex-1 py-2.5 bg-red-600 text-white rounded-xl font-black uppercase italic text-[10px] shadow-lg shadow-red-500/20 active:scale-95 transition-all flex justify-center"
                >
                  {isCreating ? <Loader2 className="animate-spin" size={14} /> : 'Delete'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}