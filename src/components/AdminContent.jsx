import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { ShieldCheck, Plus, Edit, Archive, Play, Square, ExternalLink, Users, Trophy, CalendarDays, Activity, Settings2, RefreshCcw, AlertTriangle, CheckCircle2, XCircle, Eye } from 'lucide-react';
import { getFromGas, saveRule, previewTournamentResultsToLeaderboard, applyTournamentResultsToLeaderboard, findTournamentResultSheet, migratePublicProfileIds } from '../utils/api';
import EditEventModal from './EditEventModal';
import ConfirmModal from './ConfirmModal';
import PublicNavbar from './PublicNavbar';

const AdminContent = ({ onCreateEvent, onGenerateTournament, onUpdatePoints, onToggleNickname, nicknameAllowed, leaderboard, isSubmitting, isGenerating, isUpdatingPoints, eventId, currentEvent, events = [], rules = [], onRefreshRules, onRefreshEvent, onStartEvent, onEndEvent, onFinishTournament, onEditEvent }) => {
  const [format, setFormat] = useState('weekly');
  const [newSwissRounds, setNewSwissRounds] = useState(3);
  const [selectedId, setSelectedId] = useState('');
  const [point, setPoint] = useState('');
  const [pointFinish, setPointFinish] = useState('');

  const [ruleTitle, setRuleTitle] = useState('');
  const [ruleImageUrl, setRuleImageUrl] = useState('');
  const [ruleWarning, setRuleWarning] = useState('');
  const [ruleDetails, setRuleDetails] = useState('');
  const [isSavingRule, setIsSavingRule] = useState(false);

  const [editingRule, setEditingRule] = useState(null);
  const [ruleForm, setRuleForm] = useState({ nama: '', periode: '', title: '', image_url: '', warning: '', details: '', status: 'aktif' });
  const [isSavingManageRule, setIsSavingManageRule] = useState(false);

  const [showEditModal, setShowEditModal] = useState(false);
  const [isProcessingEvent] = useState(false);

  const [syncEventId, setSyncEventId] = useState('');
  const [syncSheetName, setSyncSheetName] = useState('');
  const [syncSheetDetected, setSyncSheetDetected] = useState(false);
  const [syncSheetDetecting, setSyncSheetDetecting] = useState(false);
  const [syncPreview, setSyncPreview] = useState(null);
  const [syncTournamentParticipants, setSyncTournamentParticipants] = useState([]);
  const [syncUnchangedPlayers, setSyncUnchangedPlayers] = useState([]);
  const [syncSummary, setSyncSummary] = useState(null);
  const [syncWarnings, setSyncWarnings] = useState([]);
  const [syncAlreadySynced, setSyncAlreadySynced] = useState([]);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [showApplyConfirm, setShowApplyConfirm] = useState(false);
  const [isApplyLocked] = useState(false);
  const [syncApplyStatus, setSyncApplyStatus] = useState('idle');
  const [syncExcludedPlayers, setSyncExcludedPlayers] = useState(new Set());

  const players = Array.isArray(leaderboard) ? leaderboard : [];

  const normalizedEvents = useMemo(() => {
    return (Array.isArray(events) ? events : []).map(e => ({
      ...e,
      status: String(e.status || '').toLowerCase().trim()
    }));
  }, [events]);

  const activeEventFromList = useMemo(() => {
    return normalizedEvents.find(e => e.status === 'aktif') || null;
  }, [normalizedEvents]);

  const upcomingEventFromList = useMemo(() => {
    return normalizedEvents.find(e => e.status === 'upcoming') || null;
  }, [normalizedEvents]);

  const displayEvent = useMemo(() => {
    if (currentEvent && currentEvent.status) {
      return currentEvent;
    }
    if (activeEventFromList) {
      return activeEventFromList;
    }
    if (upcomingEventFromList) {
      return upcomingEventFromList;
    }
    if (normalizedEvents.length > 0) {
      return normalizedEvents[0];
    }
    return null;
  }, [currentEvent, activeEventFromList, upcomingEventFromList, normalizedEvents]);

  const eventStatus = String(displayEvent?.status || '').toLowerCase().trim();
  const isUpcoming = eventStatus === 'upcoming';
  const isLive = eventStatus === 'aktif';
  const isCompleted = eventStatus === 'selesai';
  const tournamentStatus = String(
    displayEvent?.tournament_status ??
    activeEventFromList?.tournament_status ??
    ''
  ).trim().toLowerCase();

  if (!tournamentStatus) {
    console.warn('[TOURNAMENT STATUS MISSING]', displayEvent);
  }

  const normalizedTournamentStatus = tournamentStatus || 'not_started';

  useEffect(() => {
    console.log('[ADMIN EVENT FINAL]', {
      eventId: displayEvent?.event_id || displayEvent?.id,
      status: displayEvent?.status,
      tournament_status: displayEvent?.tournament_status,
      normalizedTournamentStatus
    });
  }, [displayEvent?.event_id, displayEvent?.status, displayEvent?.tournament_status, normalizedTournamentStatus]);

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

  useEffect(() => {
    const loadRule = async () => {
      try {
        const res = await getFromGas('getRule');
        if (res) {
          setRuleTitle(res.rule_title || '');
          setRuleImageUrl(res.rule_image_url || '');
          setRuleWarning(res.rule_warning || '');
          setRuleDetails(res.rule_details || '');
        }
      } catch (err) {
        console.error('Gagal fetch rule:', err);
      }
    };
    loadRule();
  }, []);

   useEffect(() => {
    const detectSheet = async () => {
      if (!syncEventId) {
        setSyncSheetName('');
        setSyncSheetDetected(false);
        setSyncApplyStatus('idle');
        return;
      }
      setSyncSheetDetecting(true);
      setSyncApplyStatus('idle');
      try {
        const sheetName = await findTournamentResultSheet(syncEventId);
        if (sheetName) {
          setSyncSheetName(sheetName);
          setSyncSheetDetected(true);
        } else {
          setSyncSheetName('');
          setSyncSheetDetected(false);
        }
      } catch (err) {
        console.error('Gagal deteksi sheet hasil tournament:', err);
        setSyncSheetName('');
        setSyncSheetDetected(false);
      } finally {
        setSyncSheetDetecting(false);
      }
    };
    detectSheet();
  }, [syncEventId]);

  useEffect(() => {
    const refreshPreview = async () => {
      if (!syncEventId || !syncSheetName || !syncPreview) {
        return;
      }
      setIsPreviewLoading(true);
      try {
        const res = await previewTournamentResultsToLeaderboard({
          eventId: syncEventId,
          sheetName: syncSheetName,
          excludedGoogleIds: Array.from(syncExcludedPlayers)
        });
        if (res?.status === 'success') {
          setSyncPreview(res.changes || []);
          setSyncTournamentParticipants(res.tournamentParticipants || []);
          setSyncUnchangedPlayers(res.unchangedPlayers || []);
          setSyncSummary(res.summary || null);
          setSyncWarnings(res.warnings || []);
          setSyncAlreadySynced(res.alreadySynced || []);
        }
      } catch {
        // silent refresh
      } finally {
        setIsPreviewLoading(false);
      }
    };
    refreshPreview();
  }, [syncExcludedPlayers, syncEventId, syncSheetName]);

  const handleEditEvent = (formData) => {
    console.log('[ADMIN MUTATION CLICK]', { action: 'editEvent', eventId: formData?.event_id });
    setShowEditModal(false);
    onEditEvent?.(formData);
  };

  const handlePreviewSync = async () => {
    console.log('[ADMIN MUTATION CLICK]', { action: 'previewLeaderboard', eventId: syncEventId });
    if (!syncEventId) return toast.error('Pilih event terlebih dahulu');
    if (!syncSheetName) return toast.error('Sheet hasil tournament tidak ditemukan');
    setIsPreviewLoading(true);
    setSyncPreview(null);
    setSyncTournamentParticipants([]);
    setSyncUnchangedPlayers([]);
    setSyncSummary(null);
    setSyncWarnings([]);
    setSyncAlreadySynced([]);
    setSyncApplyStatus('idle');
    try {
      const res = await previewTournamentResultsToLeaderboard({
        eventId: syncEventId,
        sheetName: syncSheetName,
        excludedGoogleIds: Array.from(syncExcludedPlayers)
      });
      console.log('[ADMIN MUTATION RESPONSE]', { action: 'previewLeaderboard', status: res?.status });
      if (res?.status === 'success') {
        setSyncPreview(res.changes || []);
        setSyncTournamentParticipants(res.tournamentParticipants || []);
        setSyncUnchangedPlayers(res.unchangedPlayers || []);
        setSyncSummary(res.summary || null);
        setSyncWarnings(res.warnings || []);
        setSyncAlreadySynced(res.alreadySynced || []);
        const totalChanges = (res.changes || []).length;
        if (totalChanges > 0) {
          toast.success('Preview selesai. ' + totalChanges + ' perubahan.');
        } else {
          toast('Tidak ada perubahan.', { icon: 'ℹ️' });
        }
      } else {
        toast.error(res?.message || 'Gagal preview leaderboard');
      }
    } catch {
      toast.error('Gagal preview leaderboard');
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const toggleExcludePlayer = (googleId) => {
    setSyncExcludedPlayers(prev => {
      const next = new Set(prev);
      if (next.has(googleId)) {
        next.delete(googleId);
      } else {
        next.add(googleId);
      }
      return next;
    });
  };

  const handleApplySync = async () => {
    console.log('[ADMIN MUTATION CLICK]', { action: 'applyLeaderboard', eventId: syncEventId });
    if (!syncEventId || !syncSheetName) return;
    setIsApplying(true);
    setSyncApplyStatus('processing');
    try {
      const res = await applyTournamentResultsToLeaderboard({
        eventId: syncEventId,
        sheetName: syncSheetName,
        excludedGoogleIds: Array.from(syncExcludedPlayers)
      });
      console.log('[ADMIN MUTATION RESPONSE]', { action: 'applyLeaderboard', status: res?.status });
      if (res?.status === 'success') {
        setSyncApplyStatus('success');
        toast.success('Leaderboard berhasil diperbarui.');
        setSyncPreview(null);
        setSyncTournamentParticipants([]);
        setSyncUnchangedPlayers([]);
        setSyncExcludedPlayers(new Set());
        setSyncSummary(null);
        setSyncWarnings([]);
        setSyncAlreadySynced([]);
        setShowApplyConfirm(false);
        onRefreshEvent?.();
      } else if (res?.status === 'timeout') {
        setSyncApplyStatus('unknown');
        toast.error(res?.message || 'Proses masih berlangsung. Jangan klik Apply lagi.');
      } else {
        setSyncApplyStatus('error');
        toast.error(res?.message || 'Gagal apply leaderboard');
      }
    } catch {
      setSyncApplyStatus('unknown');
      toast.error('Proses mungkin masih berjalan. Jangan menekan Apply lagi.');
    } finally {
      setIsApplying(false);
    }
  };

  const handleCheckSyncStatus = async () => {
    if (!syncEventId) return;
    try {
      const res = await getFromGas('checkTournamentSyncStatus', false, { eventId: syncEventId });
      if (res?.status === 'success') {
        if (res.synced) {
          setSyncApplyStatus('success');
          toast.success('Event ini sudah disinkronkan ke Leaderboard.');
        } else {
          setSyncApplyStatus('idle');
          toast('Belum ada record sync untuk event ini.', { icon: 'ℹ️' });
        }
      } else {
        toast.error(res?.message || 'Gagal cek status sync');
      }
    } catch {
      toast.error('Gagal cek status sync');
    }
  };

  const handleMigratePublicProfileIds = async () => {
    console.log('[ADMIN MUTATION CLICK]', { action: 'migratePublicProfileIds' });
    try {
      const res = await migratePublicProfileIds();
      console.log('[ADMIN MUTATION RESPONSE]', { action: 'migratePublicProfileIds', status: res?.status, updated: res?.updated, skipped: res?.skipped });
      if (res?.status === 'success') {
        toast.success(`Migration selesai. Updated: ${res.updated}, Skipped: ${res.skipped}`);
      } else {
        toast.error(res?.message || 'Gagal migration public profile IDs');
      }
    } catch {
      toast.error('Gagal migration public profile IDs');
    }
  };

  const canApply = syncPreview && syncPreview.length > 0 && syncWarnings.filter(w => w.message && w.message.toLowerCase().includes('error')).length === 0 && !isApplyLocked;

  const handleSaveManageRule = async () => {
    console.log('[ADMIN MUTATION CLICK]', { action: 'saveManageRule', ruleId: editingRule?.rule_id });
    if (!ruleForm.nama.trim()) return toast.error('Nama rule wajib diisi');
    setIsSavingManageRule(true);
    try {
      const res = await saveRule({
        rule_id: editingRule?.rule_id || '',
        ...ruleForm
      });
      console.log('[ADMIN MUTATION RESPONSE]', { action: 'saveManageRule', status: res?.status });
      if (res?.status === 'success') {
        toast.success(editingRule ? 'Rule berhasil diperbarui' : 'Rule berhasil dibuat');
        setEditingRule(null);
        setRuleForm({ nama: '', periode: '', title: '', image_url: '', warning: '', details: '', status: 'aktif' });
        onRefreshRules?.();
      } else {
        toast.error(res?.message || 'Gagal menyimpan rule');
      }
    } catch {
      toast.error('Gagal menyimpan rule');
    } finally {
      setIsSavingManageRule(false);
    }
  };

  const handleArchiveRule = async (ruleId) => {
    console.log('[ADMIN MUTATION CLICK]', { action: 'archiveRule', ruleId });
    try {
      const res = await saveRule({ rule_id: ruleId, status: 'arsip' });
      console.log('[ADMIN MUTATION RESPONSE]', { action: 'archiveRule', status: res?.status });
      if (res?.status === 'success') {
        toast.success('Rule diarsipkan');
        onRefreshRules?.();
      } else {
        toast.error(res?.message || 'Gagal mengarsipkan rule');
      }
    } catch {
      toast.error('Gagal mengarsipkan rule');
    }
  };

  const handleActivateRule = async (ruleId) => {
    console.log('[ADMIN MUTATION CLICK]', { action: 'activateRule', ruleId });
    try {
      const res = await saveRule({ rule_id: ruleId, status: 'aktif' });
      console.log('[ADMIN MUTATION RESPONSE]', { action: 'activateRule', status: res?.status });
      if (res?.status === 'success') {
        toast.success('Rule diaktifkan');
        onRefreshRules?.();
      } else {
        toast.error(res?.message || 'Gagal mengaktifkan rule');
      }
    } catch {
      toast.error('Gagal mengaktifkan rule');
    }
  };

  const startEditRule = (r) => {
    setEditingRule(r);
    setRuleForm({
      nama: r.nama || '',
      periode: r.periode || '',
      title: r.title || '',
      image_url: r.image_url || '',
      warning: r.warning || '',
      details: r.details || '',
      status: r.status || 'aktif'
    });
  };

  const handleSaveRule = async () => {
    console.log('[ADMIN MUTATION CLICK]', { action: 'saveRule' });
    setIsSavingRule(true);
    try {
      const res = await saveRule({
        rule_title: ruleTitle,
        rule_image_url: ruleImageUrl,
        rule_warning: ruleWarning,
        rule_details: ruleDetails
      });
      console.log('[ADMIN MUTATION RESPONSE]', { action: 'saveRule', status: res?.status });
      if (res?.status === 'success') {
        toast.success('Rule berhasil disimpan!');
      } else {
        toast.error(res?.message || 'Gagal menyimpan rule');
      }
    } catch {
      toast.error('Gagal menyimpan rule');
    } finally {
      setIsSavingRule(false);
    }
  };

  const getStatusBadge = () => {
    if (isUpcoming) {
      return {
        label: 'UPCOMING',
        color: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
        dot: 'bg-blue-400'
      };
    }
    if (isLive) {
      return {
        label: 'LIVE',
        color: 'bg-green-500/15 text-green-300 border-green-500/30',
        dot: 'bg-green-400 animate-pulse'
      };
    }
    if (isCompleted) {
      return {
        label: 'COMPLETED',
        color: 'bg-gray-500/15 text-gray-300 border-gray-500/30',
        dot: 'bg-gray-400'
      };
    }
    return {
      label: 'NO EVENT',
      color: 'bg-gray-500/15 text-gray-400 border-gray-500/30',
      dot: 'bg-gray-500'
    };
  };

  const statusBadge = getStatusBadge();
  const shouldShowEvent = !!displayEvent;
  const eventCount = normalizedEvents.length;
  const liveEventCount = normalizedEvents.filter((e) => e.status === 'aktif').length;
  const completedEventCount = normalizedEvents.filter((e) => e.status === 'selesai').length;
  const syncExcludedCount = syncExcludedPlayers instanceof Set ? syncExcludedPlayers.size : 0;
  const syncChangesCount = Array.isArray(syncPreview) ? syncPreview.length : 0;
  const syncUnchangedCount = Array.isArray(syncUnchangedPlayers) ? syncUnchangedPlayers.length : 0;
  const syncTournamentCount = Array.isArray(syncTournamentParticipants) ? syncTournamentParticipants.length : 0;
  const syncWarningCount = Array.isArray(syncWarnings) ? syncWarnings.length : 0;
  const syncAlreadySyncedCount = Array.isArray(syncAlreadySynced) ? syncAlreadySynced.length : 0;

  const formatEventDate = (value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'Asia/Jakarta'
    }).format(date);
  };

  const eventDateLabel = displayEvent?.tanggal_event
    ? formatEventDate(displayEvent.tanggal_event)
    : 'Tanggal belum diisi';
  const eventTimeLabel = displayEvent?.waktu_event || displayEvent?.waktu || 'Jam belum diisi';

  const eventStatusText = isLive
    ? normalizedTournamentStatus === 'running'
      ? 'Tournament sedang berjalan'
      : normalizedTournamentStatus === 'finished'
        ? 'Tournament selesai • event masih aktif'
        : 'Event aktif • tournament belum dimulai'
    : isUpcoming
      ? 'Event siap dimulai'
      : isCompleted
        ? 'Event sudah selesai'
        : 'Belum ada event aktif';

  const quickButton = (base = '') => `inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-[10px] font-black uppercase italic tracking-wide transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed ${base}`;

  return (
    <>
      <PublicNavbar />
      <div className="min-h-screen bg-gray-950 text-white">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          className="mx-auto w-full max-w-6xl space-y-6 px-6 pb-24 pt-24 md:pt-24"
        >
      {/* HEADER */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="px-1 md:px-0"
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1">
              <ShieldCheck size={13} className="text-red-400" />
              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-red-300">Admin Access</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-black italic uppercase tracking-tighter">
              <span className="bg-gradient-to-r from-red-400 via-orange-400 to-red-500 bg-clip-text text-transparent">
                COMMAND CENTER
              </span>
            </h2>
            <p className="mt-2 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">
              Manage events, tournaments, leaderboard & rules
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-gray-900/80 px-3 py-2 text-[9px] font-black uppercase tracking-widest text-gray-400">
              <span className={`h-1.5 w-1.5 rounded-full ${isLive ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`} />
              {isLive ? 'System Live' : 'Standby'}
            </span>
            <button
              type="button"
              onClick={onCreateEvent}
              disabled={isSubmitting}
              className={quickButton('bg-blue-500 text-white shadow-lg shadow-blue-500/20 hover:bg-blue-400')}
            >
              <Plus size={14} /> CREATE EVENT
            </button>
          </div>
        </div>
      </motion.div>

      {/* KPI */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: 'CURRENT EVENT', value: displayEvent?.nama || 'NONE', meta: statusBadge.label, icon: CalendarDays, accent: isLive ? 'text-green-400' : 'text-blue-400' },
          { label: 'PLAYERS', value: String(players.length), meta: 'Leaderboard records', icon: Users, accent: 'text-cyan-400' },
          { label: 'EVENTS', value: String(eventCount), meta: `${liveEventCount} live • ${completedEventCount} completed`, icon: Activity, accent: 'text-violet-400' },
          { label: 'TOURNAMENT', value: isLive ? normalizedTournamentStatus.replace('_', ' ') : 'STANDBY', meta: eventStatusText, icon: Trophy, accent: normalizedTournamentStatus === 'running' ? 'text-orange-400' : 'text-yellow-400' }
        ].map((item, index) => {
          const Icon = item.icon;
          return (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04 }}
              className="rounded-[1.5rem] border border-white/5 bg-gray-900/80 p-4 backdrop-blur-sm"
            >
              <div className="mb-3 flex items-center justify-between">
                <Icon size={16} className={item.accent} />
                <span className="text-[8px] font-black uppercase tracking-widest text-gray-600">{item.label}</span>
              </div>
              <p className="truncate text-lg font-black uppercase text-white">{item.value}</p>
              <p className="mt-1 truncate text-[9px] font-bold uppercase tracking-wide text-gray-500">{item.meta}</p>
            </motion.div>
          );
        })}
      </div>

      {/* CURRENT EVENT + QUICK ACTIONS */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.6fr_0.8fr]">
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-gray-900 via-gray-900 to-gray-950 p-5 md:p-7"
        >
          <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-blue-500/10 blur-3xl" />
          <div className="relative">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-400">Current Event</p>
                <h3 className="mt-1 text-2xl md:text-3xl font-black italic uppercase tracking-tight text-white">
                  {displayEvent?.nama || 'NO ACTIVE EVENT'}
                </h3>
                <p className="mt-2 text-[10px] font-bold uppercase tracking-wide text-gray-500">{eventStatusText}</p>
              </div>
              <span className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-[9px] font-black uppercase tracking-widest ${statusBadge.color}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${statusBadge.dot}`} />
                {statusBadge.label}
              </span>
            </div>

            {shouldShowEvent ? (
              <>
                <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
                    <p className="text-[8px] font-black uppercase tracking-widest text-gray-600">LOCATION</p>
                    <p className="mt-1 text-xs font-black uppercase text-gray-200">{displayEvent?.lokasi || '—'}</p>
                  </div>
                  <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
                    <p className="text-[8px] font-black uppercase tracking-widest text-gray-600">DATE</p>
                    <p className="mt-1 text-xs font-black uppercase text-gray-200">{eventDateLabel}</p>
                  </div>
                  <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
                    <p className="text-[8px] font-black uppercase tracking-widest text-gray-600">TIME</p>
                    <p className="mt-1 text-xs font-black uppercase text-gray-200">{eventTimeLabel}</p>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-gray-400">
                    TOURNAMENT: <span className="text-white">{normalizedTournamentStatus.replace('_', ' ')}</span>
                  </span>
                  {displayEvent?.rule_id && (
                    <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-gray-400">
                      RULE: <span className="text-white">{displayEvent.rule_id}</span>
                    </span>
                  )}
                </div>

                <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {isUpcoming && (
                    <>
                      <button
                        type="button"
                        onClick={() => onStartEvent?.(displayEvent?.event_id || displayEvent?.id || eventId)}
                        disabled={isProcessingEvent || isSubmitting}
                        className={quickButton('bg-green-500 text-white shadow-lg shadow-green-500/20 hover:bg-green-400')}
                      >
                        <Play size={14} /> START EVENT
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowEditModal(true)}
                        disabled={isProcessingEvent || isSubmitting}
                        className={quickButton('border border-white/10 bg-white/5 text-white hover:bg-white/10')}
                      >
                        <Edit size={14} /> EDIT EVENT
                      </button>
                    </>
                  )}

                  {isLive && normalizedTournamentStatus === 'not_started' && (
                    <button
                      type="button"
                      onClick={() => setShowEditModal(true)}
                      disabled={isProcessingEvent || isSubmitting}
                      className={quickButton('border border-white/10 bg-white/5 text-white hover:bg-white/10')}
                    >
                      <Edit size={14} /> EDIT EVENT
                    </button>
                  )}

                  {isLive && normalizedTournamentStatus === 'running' && (
                    <>
                      <button
                        type="button"
                        onClick={() => onFinishTournament?.(displayEvent?.event_id || displayEvent?.id || eventId)}
                        disabled={isProcessingEvent || isSubmitting}
                        className={quickButton('bg-orange-500 text-white shadow-lg shadow-orange-500/20 hover:bg-orange-400')}
                      >
                        <Square size={14} /> FINISH TOURNAMENT
                      </button>
                      <button
                        type="button"
                        onClick={() => onEndEvent?.(displayEvent?.event_id || displayEvent?.id || eventId)}
                        disabled={isProcessingEvent || isSubmitting}
                        className={quickButton('bg-red-500 text-white shadow-lg shadow-red-500/20 hover:bg-red-400')}
                      >
                        <Square size={14} /> END EVENT
                      </button>
                    </>
                  )}

                  {isLive && normalizedTournamentStatus === 'finished' && (
                    <button
                      type="button"
                      onClick={() => onEndEvent?.(displayEvent?.event_id || displayEvent?.id || eventId)}
                      disabled={isProcessingEvent || isSubmitting}
                      className={quickButton('sm:col-span-2 bg-red-500 text-white shadow-lg shadow-red-500/20 hover:bg-red-400')}
                    >
                      <Square size={14} /> END EVENT
                    </button>
                  )}

                  {isCompleted && (
                    <button
                      type="button"
                      onClick={() => window.open(`/events/${eventId}`, '_blank')}
                      className={quickButton('sm:col-span-2 border border-white/10 bg-white/5 text-white hover:bg-white/10')}
                    >
                      <ExternalLink size={14} /> VIEW EVENT
                    </button>
                  )}
                </div>
              </>
            ) : (
              <div className="mt-6 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center">
                <CalendarDays size={28} className="mx-auto mb-3 text-gray-700" />
                <p className="text-xs font-black uppercase tracking-widest text-gray-500">Belum ada event yang tersedia</p>
                <button
                  type="button"
                  onClick={onCreateEvent}
                  disabled={isSubmitting}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-500 px-4 py-2.5 text-[10px] font-black uppercase italic text-white shadow-lg shadow-blue-500/20"
                >
                  <Plus size={13} /> CREATE EVENT
                </button>
              </div>
            )}
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="rounded-[2rem] border border-white/10 bg-gray-900/80 p-5 md:p-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-cyan-400">Quick Actions</p>
              <h3 className="mt-1 text-lg font-black uppercase italic text-white">Operator Tools</h3>
            </div>
            <Settings2 size={18} className="text-gray-600" />
          </div>

          <div className="mt-5 space-y-2">
            <button
              type="button"
              onClick={onCreateEvent}
              disabled={isSubmitting}
              className={quickButton('w-full bg-blue-500 text-white shadow-lg shadow-blue-500/20 hover:bg-blue-400')}
            >
              <Plus size={14} /> CREATE EVENT
            </button>
            <button
              type="button"
              onClick={() => setShowEditModal(true)}
              disabled={isProcessingEvent || isSubmitting || !displayEvent}
              className={quickButton('w-full border border-white/10 bg-white/5 text-white hover:bg-white/10')}
            >
              <Edit size={14} /> EDIT CURRENT EVENT
            </button>
            <button
              type="button"
              onClick={() => onGenerateTournament({ format, swissRounds: newSwissRounds })}
              disabled={isGenerating || !eventId}
              className={quickButton('w-full bg-orange-500 text-white shadow-lg shadow-orange-500/20 hover:bg-orange-400')}
            >
              <Trophy size={14} /> {isGenerating ? 'GENERATING...' : 'GENERATE TOURNAMENT'}
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => document.getElementById('admin-points')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                className={quickButton('border border-white/10 bg-white/5 text-gray-200 hover:bg-white/10')}
              >
                <Users size={14} /> UPDATE POINTS
              </button>
              <button
                type="button"
                onClick={onToggleNickname}
                disabled={isSubmitting}
                className={quickButton(nicknameAllowed ? 'bg-green-500/15 text-green-300 border border-green-500/20' : 'border border-white/10 bg-white/5 text-gray-300')}
              >
                <ShieldCheck size={14} /> {nicknameAllowed ? 'NICKNAME ON' : 'NICKNAME OFF'}
              </button>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-white/5 bg-black/10 p-4">
            <div className="flex items-center justify-between">
              <span className="text-[8px] font-black uppercase tracking-widest text-gray-600">Nickname Permission</span>
              <span className={`text-[9px] font-black uppercase tracking-widest ${nicknameAllowed ? 'text-green-400' : 'text-gray-500'}`}>
                {nicknameAllowed ? 'ENABLED' : 'DISABLED'}
              </span>
            </div>
          </div>
        </motion.section>
      </div>

      {/* TOURNAMENT + PLAYER POINTS */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.16 }}
          className="rounded-[2rem] border border-white/10 bg-gray-900/80 p-5 md:p-6"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-orange-400">Tournament Control</p>
              <h3 className="mt-1 text-lg font-black uppercase italic text-white">Bracket Generator</h3>
              <p className="mt-1 text-[9px] font-bold uppercase tracking-wide text-gray-500">
                Pilih format dan jumlah ronde sebelum generate bracket.
              </p>
            </div>
            <Trophy size={18} className="text-gray-600" />
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setFormat('weekly')}
              className={`rounded-2xl border px-4 py-3 text-left transition-all ${format === 'weekly' ? 'border-blue-500/30 bg-blue-500/10 text-blue-300' : 'border-white/5 bg-white/[0.03] text-gray-500'}`}
            >
              <p className="text-[10px] font-black uppercase italic">WEEKLY</p>
              <p className="mt-1 text-[8px] font-bold uppercase tracking-wide opacity-70">Swiss system</p>
            </button>
            <button
              type="button"
              onClick={() => setFormat('final')}
              className={`rounded-2xl border px-4 py-3 text-left transition-all ${format === 'final' ? 'border-red-500/30 bg-red-500/10 text-red-300' : 'border-white/5 bg-white/[0.03] text-gray-500'}`}
            >
              <p className="text-[10px] font-black uppercase italic">FINAL</p>
              <p className="mt-1 text-[8px] font-bold uppercase tracking-wide opacity-70">Double elimination</p>
            </button>
          </div>

          {format === 'weekly' && (
            <div className="mt-4 rounded-2xl border border-white/5 bg-white/[0.03] p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Swiss Rounds</p>
                  <p className="mt-1 text-[8px] font-bold uppercase tracking-wide text-gray-600">Tie-break: win • points • H2H</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setNewSwissRounds((prev) => Math.max(1, Number(prev) - 1))}
                    className="h-9 w-9 rounded-xl border border-white/10 bg-gray-950 text-lg font-black text-white hover:bg-white/5"
                  >
                    −
                  </button>
                  <div className="flex h-9 min-w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-3 text-sm font-black text-white">
                    {newSwissRounds}
                  </div>
                  <button
                    type="button"
                    onClick={() => setNewSwissRounds((prev) => Number(prev) + 1)}
                    className="h-9 w-9 rounded-xl border border-white/10 bg-gray-950 text-lg font-black text-white hover:bg-white/5"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => onGenerateTournament({ format, swissRounds: newSwissRounds })}
            disabled={isGenerating || !eventId}
            className={quickButton('mt-4 w-full bg-orange-500 text-white shadow-lg shadow-orange-500/20 hover:bg-orange-400')}
          >
            <Trophy size={14} /> {isGenerating ? 'GENERATING...' : 'GENERATE BRACKET'}
          </button>
        </motion.section>

        <motion.section
          id="admin-points"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-[2rem] border border-white/10 bg-gray-900/80 p-5 md:p-6"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-cyan-400">Player Management</p>
              <h3 className="mt-1 text-lg font-black uppercase italic text-white">Update Points</h3>
              <p className="mt-1 text-[9px] font-bold uppercase tracking-wide text-gray-500">Edit leaderboard points manually for a player.</p>
            </div>
            <Users size={18} className="text-gray-600" />
          </div>

          <div className="mt-5 space-y-3">
            <select
              value={selectedId}
              onChange={(e) => {
                const id = e.target.value;
                setSelectedId(id);
                const p = players.find((x) => x.googleId === id);
                setPoint(p ? String(p.point ?? 0) : '');
                setPointFinish(p ? String(p.pointFinish ?? 0) : '');
              }}
              className="w-full rounded-2xl border border-white/10 bg-gray-950 px-4 py-3 text-xs font-black text-white outline-none focus:border-blue-500/50"
            >
              <option value="">— PILIH PEMAIN —</option>
              {players.map((p) => (
                <option key={p.googleId} value={p.googleId}>{p.name}</option>
              ))}
            </select>

            <div className="grid grid-cols-2 gap-2">
              <label className="rounded-2xl border border-white/5 bg-white/[0.03] p-3">
                <span className="text-[8px] font-black uppercase tracking-widest text-gray-600">POINT</span>
                <input
                  value={point}
                  onChange={(e) => setPoint(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="0"
                  inputMode="numeric"
                  className="mt-1 w-full bg-transparent text-lg font-black text-white outline-none"
                />
              </label>
              <label className="rounded-2xl border border-white/5 bg-white/[0.03] p-3">
                <span className="text-[8px] font-black uppercase tracking-widest text-gray-600">POINT FINISH</span>
                <input
                  value={pointFinish}
                  onChange={(e) => setPointFinish(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="0"
                  inputMode="numeric"
                  className="mt-1 w-full bg-transparent text-lg font-black text-white outline-none"
                />
              </label>
            </div>

            <button
              type="button"
              onClick={handleSavePoints}
              disabled={isUpdatingPoints || !selectedId}
              className={quickButton('w-full bg-blue-500 text-white shadow-lg shadow-blue-500/20 hover:bg-blue-400')}
            >
              {isUpdatingPoints ? 'SAVING...' : 'SAVE POINTS'}
            </button>
          </div>
        </motion.section>
      </div>

      {/* LEADERBOARD SYNC */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.24 }}
        className="rounded-[2rem] border border-white/10 bg-gray-900/80 p-5 md:p-7"
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1">
              <RefreshCcw size={12} className="text-cyan-400" />
              <span className="text-[8px] font-black uppercase tracking-widest text-cyan-300">Workflow</span>
            </div>
            <h3 className="mt-3 text-xl md:text-2xl font-black uppercase italic text-white">LEADERBOARD SYNC</h3>
            <p className="mt-1 text-[9px] font-bold uppercase tracking-wide text-gray-500">Tournament result → preview → review → apply</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className={`rounded-full border px-3 py-1.5 text-[8px] font-black uppercase tracking-widest ${syncSheetDetected ? 'border-green-500/20 bg-green-500/10 text-green-300' : 'border-white/10 bg-white/[0.03] text-gray-500'}`}>
              {syncSheetDetected ? 'SHEET READY' : 'SHEET NOT READY'}
            </span>
            {syncApplyStatus !== 'idle' && (
              <span className={`rounded-full border px-3 py-1.5 text-[8px] font-black uppercase tracking-widest ${syncApplyStatus === 'success' ? 'border-green-500/20 bg-green-500/10 text-green-300' : syncApplyStatus === 'error' ? 'border-red-500/20 bg-red-500/10 text-red-300' : 'border-yellow-500/20 bg-yellow-500/10 text-yellow-300'}`}>
                {syncApplyStatus}
              </span>
            )}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-2 md:grid-cols-5">
          {[
            { label: 'PARTICIPANTS', value: syncTournamentCount, icon: Users },
            { label: 'CHANGES', value: syncChangesCount, icon: Activity },
            { label: 'UNCHANGED', value: syncUnchangedCount, icon: CheckCircle2 },
            { label: 'EXCLUDED', value: syncExcludedCount, icon: XCircle },
            { label: 'WARNINGS', value: syncWarningCount, icon: AlertTriangle }
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="rounded-2xl border border-white/5 bg-white/[0.03] p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[8px] font-black uppercase tracking-widest text-gray-600">{item.label}</span>
                  <Icon size={13} className="text-gray-600" />
                </div>
                <p className="mt-2 text-lg font-black text-white">{item.value}</p>
              </div>
            );
          })}
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-[1fr_1.4fr]">
          <div className="space-y-3">
            <div className="rounded-2xl border border-white/5 bg-black/10 p-4">
              <p className="mb-2 text-[8px] font-black uppercase tracking-widest text-gray-600">01 • SELECT EVENT</p>
              <select
                value={syncEventId}
                onChange={(e) => {
                  setSyncEventId(e.target.value);
                  setSyncPreview(null);
                  setSyncWarnings([]);
                  setSyncAlreadySynced([]);
                }}
                className="w-full rounded-2xl border border-white/10 bg-gray-950 px-4 py-3 text-xs font-black text-white outline-none focus:border-cyan-500/40"
              >
                <option value="">— PILIH EVENT —</option>
                {normalizedEvents.map((e) => (
                  <option key={e.event_id || e.id} value={e.event_id || e.id}>{e.nama} ({e.status})</option>
                ))}
              </select>
            </div>

            <div className="rounded-2xl border border-white/5 bg-black/10 p-4">
              <p className="mb-2 text-[8px] font-black uppercase tracking-widest text-gray-600">02 • RESULT SHEET</p>
              {syncSheetDetecting ? (
                <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 px-4 py-3 text-[10px] font-black uppercase text-blue-300">Detecting sheet...</div>
              ) : syncSheetDetected && syncSheetName ? (
                <div className="flex items-center gap-3 rounded-2xl border border-green-500/20 bg-green-500/10 px-4 py-3">
                  <CheckCircle2 size={15} className="text-green-400" />
                  <div className="min-w-0">
                    <p className="text-[8px] font-black uppercase tracking-widest text-green-500">FOUND</p>
                    <p className="truncate text-xs font-black text-green-200">{syncSheetName}</p>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 text-[10px] font-black uppercase text-gray-500">Final results belum tersedia.</div>
              )}
            </div>

            <button
              type="button"
              onClick={handlePreviewSync}
              disabled={isPreviewLoading || !syncEventId || !syncSheetDetected || !syncSheetName}
              className={quickButton('w-full bg-cyan-500 text-gray-950 shadow-lg shadow-cyan-500/20 hover:bg-cyan-400')}
            >
              <Eye size={14} /> {isPreviewLoading ? 'LOADING PREVIEW...' : 'PREVIEW UPDATE'}
            </button>

            <button
              type="button"
              onClick={handleCheckSyncStatus}
              disabled={!syncEventId}
              className={quickButton('w-full border border-white/10 bg-white/5 text-gray-300 hover:bg-white/10')}
            >
              <Activity size={14} /> CHECK SYNC STATUS
            </button>
          </div>

          <div className="rounded-2xl border border-white/5 bg-black/10 p-4 md:p-5">
            <p className="mb-3 text-[8px] font-black uppercase tracking-widest text-gray-600">03 • REVIEW CHANGES</p>

            {syncWarnings.length > 0 && (
              <div className="mb-3 rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={14} className="text-yellow-400" />
                  <p className="text-[9px] font-black uppercase tracking-widest text-yellow-300">Warnings ({syncWarningCount})</p>
                </div>
                <div className="mt-2 space-y-1">
                  {syncWarnings.map((w, i) => (
                    <p key={i} className="text-[10px] text-yellow-200/80">{w.message}</p>
                  ))}
                </div>
              </div>
            )}

            {syncAlreadySynced.length > 0 && (
              <div className="mb-3 rounded-2xl border border-white/10 bg-white/[0.02] p-3">
                <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Already Synced • {syncAlreadySyncedCount}</p>
                <p className="mt-1 text-[9px] font-bold text-gray-600">Player yang sudah pernah diproses tidak akan dihitung ulang.</p>
              </div>
            )}

            {syncSummary ? (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <div className="rounded-xl bg-white/[0.03] p-3"><p className="text-[8px] font-black uppercase text-gray-600">To Sync</p><p className="mt-1 text-lg font-black text-cyan-300">{syncSummary.playersToSync ?? 0}</p></div>
                <div className="rounded-xl bg-white/[0.03] p-3"><p className="text-[8px] font-black uppercase text-gray-600">Receiving Points</p><p className="mt-1 text-lg font-black text-green-300">{syncSummary.playersReceivingPoints ?? 0}</p></div>
                <div className="rounded-xl bg-white/[0.03] p-3"><p className="text-[8px] font-black uppercase text-gray-600">After Update</p><p className="mt-1 text-lg font-black text-white">{syncSummary.leaderboardAfterUpdate ?? 0}</p></div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.01] p-8 text-center">
                <RefreshCcw size={24} className="mx-auto mb-2 text-gray-700" />
                <p className="text-[9px] font-black uppercase tracking-widest text-gray-600">Belum ada preview</p>
                <p className="mt-1 text-[9px] font-bold text-gray-700">Pilih event lalu jalankan Preview Update.</p>
              </div>
            )}

            {(syncPreview?.length > 0 || syncTournamentParticipants.length > 0 || syncUnchangedPlayers.length > 0) && (
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Participants Review</p>
                  <span className="text-[8px] font-black uppercase tracking-widest text-gray-600">{syncTournamentCount} players</span>
                </div>
                <div className="max-h-[340px] space-y-2 overflow-y-auto pr-1">
                  {syncTournamentParticipants.map((c, i) => {
                    const id = String(c.googleId || '').trim();
                    const isExcluded = syncExcludedPlayers.has(id);
                    return (
                      <div key={i} className="flex flex-col gap-3 rounded-2xl border border-white/5 bg-white/[0.03] p-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-black uppercase text-white">{c.displayName || c.nickname || c.nama || c.googleId}</p>
                          <p className="mt-1 text-[8px] font-black uppercase tracking-wide text-gray-600">
                            {c.previousRank ? `#${c.previousRank}` : 'UNRANKED'} → #{c.newRank} • {c.movement?.toUpperCase() || 'STAY'}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 sm:justify-end">
                          <div className="text-right">
                            <p className="text-xs font-black text-white">{c.oldPoint} +{c.addedPoint} = {c.newPoint}</p>
                            <p className="text-[8px] font-black uppercase text-gray-600">+{c.addedPointFinish} finish</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => toggleExcludePlayer(c.googleId)}
                            className={`rounded-xl px-3 py-2 text-[8px] font-black uppercase tracking-wide ${isExcluded ? 'bg-green-500 text-white' : 'bg-red-500/15 text-red-300 border border-red-500/20'}`}
                          >
                            {isExcluded ? 'INCLUDE' : 'EXCLUDE'}
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {syncUnchangedPlayers.map((c, i) => (
                    <div key={`unchanged-${i}`} className="flex flex-col gap-2 rounded-2xl border border-white/5 bg-white/[0.02] p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-black uppercase text-gray-300">{c.displayName || c.nickname || c.nama || c.googleId}</p>
                        <p className="mt-1 text-[8px] font-black uppercase tracking-wide text-gray-600">Unchanged / Did Not Participate</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-black text-gray-300">{c.oldPoint} +{c.addedPoint} = {c.newPoint}</p>
                        <p className="text-[8px] font-black uppercase text-gray-600">+{c.addedPointFinish} finish</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {syncApplyStatus === 'processing' && (
              <div className="mt-4 rounded-2xl border border-blue-500/20 bg-blue-500/10 p-4">
                <div className="flex items-center gap-2">
                  <RefreshCcw size={14} className="animate-spin text-blue-400" />
                  <p className="text-[9px] font-black uppercase tracking-widest text-blue-300">Processing Update</p>
                </div>
                <p className="mt-2 text-[9px] font-bold text-blue-200/80">Sedang memperbarui leaderboard. Jangan tekan Apply lagi.</p>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-blue-950"><div className="h-full w-2/3 animate-pulse rounded-full bg-blue-400" /></div>
              </div>
            )}

            {syncApplyStatus === 'success' && (
              <div className="mt-4 rounded-2xl border border-green-500/20 bg-green-500/10 p-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={15} className="text-green-400" />
                  <p className="text-[9px] font-black uppercase tracking-widest text-green-300">Leaderboard Updated</p>
                </div>
                {syncSummary && (
                  <p className="mt-2 text-[9px] font-bold text-green-200/80">
                    {syncSummary.playersToSync ?? 0} players updated • {syncSummary.excludedPlayers ?? 0} excluded • {syncSummary.unchangedPlayers ?? 0} unchanged
                  </p>
                )}
              </div>
            )}

            {syncApplyStatus === 'error' && (
              <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 p-4">
                <div className="flex items-center gap-2">
                  <XCircle size={15} className="text-red-400" />
                  <p className="text-[9px] font-black uppercase tracking-widest text-red-300">Update Failed</p>
                </div>
                <p className="mt-2 text-[9px] font-bold text-red-200/80">Terjadi kesalahan saat memperbarui leaderboard. Silakan preview ulang.</p>
              </div>
            )}

            {syncApplyStatus === 'unknown' && (
              <div className="mt-4 rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={15} className="text-yellow-400" />
                  <p className="text-[9px] font-black uppercase tracking-widest text-yellow-300">Result Unknown</p>
                </div>
                <p className="mt-2 text-[9px] font-bold text-yellow-200/80">Proses mungkin masih berjalan. Jangan menekan Apply lagi.</p>
                <button type="button" onClick={handleCheckSyncStatus} className="mt-3 rounded-xl bg-yellow-500 px-3 py-2 text-[8px] font-black uppercase tracking-widest text-gray-950">CHECK STATUS</button>
              </div>
            )}

            {isApplyLocked && (
              <div className="mt-4 rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-3">
                <p className="text-[9px] font-black uppercase tracking-widest text-yellow-300">Sync temporarily locked</p>
                <p className="mt-1 text-[9px] font-bold text-yellow-200/70">Leaderboard metadata is being repaired.</p>
              </div>
            )}

            {(syncApplyStatus === 'idle' || syncApplyStatus === 'error') && canApply && (
              <button
                type="button"
                onClick={() => setShowApplyConfirm(true)}
                disabled={isApplying}
                className={quickButton('mt-4 w-full bg-red-500 text-white shadow-lg shadow-red-500/20 hover:bg-red-400')}
              >
                <RefreshCcw size={14} /> {isApplying ? 'APPLYING...' : 'APPLY LEADERBOARD UPDATE'}
              </button>
            )}
          </div>
        </div>
      </motion.section>

      {/* RULES */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28 }}
          className="rounded-[2rem] border border-white/10 bg-gray-900/80 p-5 md:p-6"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-yellow-400">Rule of the Month</p>
              <h3 className="mt-1 text-lg font-black uppercase italic text-white">Featured Rule</h3>
            </div>
            <ShieldCheck size={18} className="text-gray-600" />
          </div>

          <div className="mt-5 rounded-2xl border border-yellow-500/10 bg-yellow-500/5 p-4">
            <p className="text-[8px] font-black uppercase tracking-widest text-yellow-500">CURRENT RULE</p>
            <p className="mt-2 text-lg font-black uppercase text-white">{ruleTitle || 'Belum ada rule aktif'}</p>
            {ruleWarning && <p className="mt-2 text-[9px] font-bold uppercase tracking-wide text-orange-300">{ruleWarning}</p>}
            {ruleDetails && <p className="mt-2 whitespace-pre-line text-[10px] leading-relaxed text-gray-400">{ruleDetails}</p>}
            {ruleImageUrl && (
              <div className="mt-4 overflow-hidden rounded-2xl border border-white/5 bg-black/20">
                <img src={ruleImageUrl.split(/\r?\n/)[0]} alt="Current rule" className="max-h-48 w-full object-cover" />
              </div>
            )}
          </div>

          <div className="mt-4 space-y-3">
            <input value={ruleTitle} onChange={(e) => setRuleTitle(e.target.value)} placeholder="Rule title" className="w-full rounded-2xl border border-white/10 bg-gray-950 px-4 py-3 text-xs font-black text-white outline-none focus:border-yellow-500/40" />
            <textarea value={ruleImageUrl} onChange={(e) => setRuleImageUrl(e.target.value)} placeholder="Image URLs (one per line)" rows={2} className="w-full resize-none rounded-2xl border border-white/10 bg-gray-950 px-4 py-3 text-xs font-bold text-white outline-none focus:border-yellow-500/40" />
            <textarea value={ruleWarning} onChange={(e) => setRuleWarning(e.target.value)} placeholder="Warning" rows={2} className="w-full resize-none rounded-2xl border border-white/10 bg-gray-950 px-4 py-3 text-xs font-bold text-white outline-none focus:border-yellow-500/40" />
            <textarea value={ruleDetails} onChange={(e) => setRuleDetails(e.target.value)} placeholder="Details" rows={4} className="w-full resize-none rounded-2xl border border-white/10 bg-gray-950 px-4 py-3 text-xs font-bold text-white outline-none focus:border-yellow-500/40" />
            <button type="button" onClick={handleSaveRule} disabled={isSavingRule} className={quickButton('w-full bg-yellow-500 text-gray-950 shadow-lg shadow-yellow-500/20 hover:bg-yellow-400')}>
              {isSavingRule ? 'SAVING...' : 'SAVE FEATURED RULE'}
            </button>
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.32 }}
          className="rounded-[2rem] border border-white/10 bg-gray-900/80 p-5 md:p-6"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-violet-400">Rules Management</p>
              <h3 className="mt-1 text-lg font-black uppercase italic text-white">Rule Library</h3>
            </div>
            <Archive size={18} className="text-gray-600" />
          </div>

          <div className="mt-4 max-h-[520px] space-y-2 overflow-y-auto pr-1">
            {Array.isArray(rules) && rules.length > 0 ? rules.map((r) => (
              <div key={r.rule_id || r.nama} className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-black uppercase text-white">{r.nama || 'Untitled Rule'}</p>
                    <p className="mt-1 text-[8px] font-black uppercase tracking-widest text-gray-600">{r.periode || 'No period'}</p>
                  </div>
                  <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[8px] font-black uppercase ${String(r.status).toLowerCase() === 'aktif' ? 'border-green-500/20 bg-green-500/10 text-green-300' : 'border-white/10 bg-white/[0.02] text-gray-500'}`}>
                    {r.status || 'unknown'}
                  </span>
                </div>
                {r.title && <p className="mt-2 text-[10px] font-bold text-gray-500">{r.title}</p>}
                <div className="mt-3 flex flex-wrap gap-2">
                  {String(r.status).toLowerCase() !== 'aktif' && (
                    <button type="button" onClick={() => handleActivateRule(r.rule_id)} className="rounded-xl bg-green-500/10 px-3 py-2 text-[8px] font-black uppercase text-green-300">ACTIVATE</button>
                  )}
                  {String(r.status).toLowerCase() === 'aktif' && (
                    <button type="button" onClick={() => handleArchiveRule(r.rule_id)} className="rounded-xl bg-orange-500/10 px-3 py-2 text-[8px] font-black uppercase text-orange-300">ARCHIVE</button>
                  )}
                  <button type="button" onClick={() => startEditRule(r)} className="rounded-xl bg-white/5 px-3 py-2 text-[8px] font-black uppercase text-gray-300">EDIT</button>
                </div>
              </div>
            )) : (
              <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center">
                <p className="text-[9px] font-black uppercase tracking-widest text-gray-600">No rules available</p>
              </div>
            )}
          </div>

          {editingRule ? (
            <div className="mt-4 space-y-3 rounded-2xl border border-violet-500/20 bg-violet-500/5 p-4">
              <div className="flex items-center justify-between">
                <p className="text-[9px] font-black uppercase tracking-widest text-violet-300">{editingRule?.rule_id ? 'EDIT RULE' : 'CREATE RULE'}</p>
                <button type="button" onClick={() => { setEditingRule(null); setRuleForm({ nama: '', periode: '', title: '', image_url: '', warning: '', details: '', status: 'aktif' }); }} className="text-[8px] font-black uppercase text-gray-500">CANCEL</button>
              </div>
              <input value={ruleForm.nama} onChange={(e) => setRuleForm({ ...ruleForm, nama: e.target.value })} placeholder="Name" className="w-full rounded-xl border border-white/10 bg-gray-950 px-3 py-2.5 text-xs font-bold text-white outline-none" />
              <input value={ruleForm.periode} onChange={(e) => setRuleForm({ ...ruleForm, periode: e.target.value })} placeholder="Period" className="w-full rounded-xl border border-white/10 bg-gray-950 px-3 py-2.5 text-xs font-bold text-white outline-none" />
              <input value={ruleForm.title} onChange={(e) => setRuleForm({ ...ruleForm, title: e.target.value })} placeholder="Title" className="w-full rounded-xl border border-white/10 bg-gray-950 px-3 py-2.5 text-xs font-bold text-white outline-none" />
              <textarea value={ruleForm.image_url} onChange={(e) => setRuleForm({ ...ruleForm, image_url: e.target.value })} placeholder="Image URL" rows={2} className="w-full resize-none rounded-xl border border-white/10 bg-gray-950 px-3 py-2.5 text-xs font-bold text-white outline-none" />
              <textarea value={ruleForm.warning} onChange={(e) => setRuleForm({ ...ruleForm, warning: e.target.value })} placeholder="Warning" rows={2} className="w-full resize-none rounded-xl border border-white/10 bg-gray-950 px-3 py-2.5 text-xs font-bold text-white outline-none" />
              <textarea value={ruleForm.details} onChange={(e) => setRuleForm({ ...ruleForm, details: e.target.value })} placeholder="Details" rows={3} className="w-full resize-none rounded-xl border border-white/10 bg-gray-950 px-3 py-2.5 text-xs font-bold text-white outline-none" />
              <select value={ruleForm.status} onChange={(e) => setRuleForm({ ...ruleForm, status: e.target.value })} className="w-full rounded-xl border border-white/10 bg-gray-950 px-3 py-2.5 text-xs font-bold text-white outline-none">
                <option value="aktif">Aktif</option>
                <option value="arsip">Arsip</option>
                <option value="draft">Draft</option>
              </select>
              <button type="button" onClick={handleSaveManageRule} disabled={isSavingManageRule} className={quickButton('w-full bg-violet-500 text-white shadow-lg shadow-violet-500/20 hover:bg-violet-400')}>
                {isSavingManageRule ? 'SAVING...' : 'SAVE RULE'}
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => setEditingRule({ rule_id: '' })} className={quickButton('mt-4 w-full border border-white/10 bg-white/5 text-gray-300 hover:bg-white/10')}>
              <Plus size={14} /> CREATE NEW RULE
            </button>
          )}
        </motion.section>
      </div>

      {/* UTILITIES */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.36 }}
        className="rounded-[2rem] border border-white/10 bg-gray-900/60 p-5"
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-600">Utilities</p>
            <h3 className="mt-1 text-base font-black uppercase italic text-white">Maintenance Tools</h3>
            <p className="mt-1 text-[9px] font-bold uppercase tracking-wide text-gray-600">Gunakan hanya saat diperlukan untuk maintenance data.</p>
          </div>
          <button
            type="button"
            onClick={handleMigratePublicProfileIds}
            className={quickButton('border border-white/10 bg-white/5 text-gray-300 hover:bg-white/10')}
          >
            <Settings2 size={14} /> GENERATE MISSING PROFILE IDS
          </button>
        </div>
      </motion.section>

      <EditEventModal
        show={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSubmit={handleEditEvent}
        isSubmitting={isProcessingEvent}
        initialData={{
          event_id: displayEvent?.event_id || displayEvent?.id || eventId,
          id: displayEvent?.id || displayEvent?.event_id || eventId,
          nama: displayEvent?.nama || '',
          lokasi: displayEvent?.lokasi || '',
          tanggal_event: displayEvent?.tanggal_event || '',
          waktu_event: displayEvent?.waktu_event || displayEvent?.waktu || '',
          rule_id: displayEvent?.rule_id || ''
        }}
      />

      <ConfirmModal
        show={showApplyConfirm}
        onClose={() => setShowApplyConfirm(false)}
        onConfirm={handleApplySync}
        title="Apply leaderboard update?"
        message={`Event: ${syncEventId}${syncSummary ? `\nTournament Participants: ${syncSummary.tournamentParticipants}\nPlayers to Sync: ${syncSummary.playersToSync}\nExcluded: ${syncSummary.excludedPlayers}\nLeaderboard After Update: ${syncSummary.leaderboardAfterUpdate}\nPlayers Receiving Points: ${syncSummary.playersReceivingPoints}\nUnchanged Players: ${syncSummary.unchangedPlayers}` : ''}\n\nPastikan hasil tournament sudah final. Update akan menambah poin ke leaderboard periode aktif.`}
        confirmLabel="APPLY UPDATE"
        isSubmitting={isApplying}
        variant="danger"
      />
        </motion.div>
      </div>
    </>
  );
};

export default AdminContent;
