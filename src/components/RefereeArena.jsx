import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Trophy, Swords, RotateCcw, Maximize, Smartphone } from 'lucide-react';
import toast from 'react-hot-toast';
import { getOpenMatches, submitMatchScore, startTournament, updateSwissRounds, getActiveEvent, postToGas } from '../utils/api';
import MatchIntro from './MatchIntro';

const initialState = {
  state: 'selector',
  tournamentUrl: '',
  participants: [],
  matches: [],
  selectedMatch: null,
  scores: { p1: 0, p2: 0 },
  launchFails: { p1: 0, p2: 0 },
  winLimit: 4,
  swapped: false,
  showReady: false,
  countdown: 3,
  countdownText: '',
  submitting: false,
  previewScores: null,
};

export default function RefereeArena() {
  const [state, setState] = useState(initialState.state);
  const [tournamentUrl, setTournamentUrl] = useState(initialState.tournamentUrl);
  const [participants, setParticipants] = useState(initialState.participants);
  const [matches, setMatches] = useState(initialState.matches);
  const [selectedMatch, setSelectedMatch] = useState(initialState.selectedMatch);
  const [scores, setScores] = useState(initialState.scores);
  const [scoreHistory, setScoreHistory] = useState([]);
  const [launchFails, setLaunchFails] = useState(initialState.launchFails);
  const [winLimit, setWinLimit] = useState(initialState.winLimit);
  const [swapped, setSwapped] = useState(initialState.swapped);
  const [isSwapped, setIsSwapped] = useState(false);
  const [showReady, setShowReady] = useState(initialState.showReady);
  const [countdown, setCountdown] = useState(initialState.countdown);
  const [countdownText, setCountdownText] = useState('');
  const [submitting, setSubmitting] = useState(initialState.submitting);
  const [previewScores, setPreviewScores] = useState(initialState.previewScores);
  const [loading, setLoading] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [swissRounds, setSwissRounds] = useState('');
  const [hudPhase, setHudPhase] = useState('READY');
  const [showIntro, setShowIntro] = useState(false);
  const [readyPlayers, setReadyPlayers] = useState({ p1: false, p2: false });
  const [scoreEvent, setScoreEvent] = useState(null);
  const [p1Fails, setP1Fails] = useState(0);
  const [p2Fails, setP2Fails] = useState(0);
  const [isPortrait, setIsPortrait] = useState(false);
  const [tournamentState, setTournamentState] = useState('');
  const [completedMatches, setCompletedMatches] = useState([]);
  const [optionalPoints, setOptionalPoints] = useState({});
  const [isExporting, setIsExporting] = useState(false);
  const [activeEventName, setActiveEventName] = useState(null);
  const [isSearching, setIsSearching] = useState(true);
  const LEAGUE_POINTS_DISTRIBUTION = [20, 17, 15, 13, 11, 9, 8, 7, 6, 5, 4, 3, 2, 1, 1, 1];

  const resetMatch = useCallback(() => {
    setScores({ p1: 0, p2: 0 });
    setLaunchFails({ p1: 0, p2: 0 });
    setSwapped(false);
    setShowReady(false);
    setCountdown(3);
    setPreviewScores(null);
    setHudPhase('READY');
    setReadyPlayers({ p1: false, p2: false });
  }, []);

  useEffect(() => {
    const mql = window.matchMedia('(orientation: portrait)');
    setIsPortrait(mql.matches);
    const handler = (e) => setIsPortrait(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    const loadActiveEvent = async () => {
      setIsSearching(true);
      try {
        const res = await getActiveEvent();
        if (res?.status === 'success' && res.challongeUrl) {
          setActiveEventName(res.eventName || null);
          setTournamentUrl(res.challongeUrl);
          await handleFetchMatches(res.challongeUrl);
        } else {
          setActiveEventName(null);
        }
      } catch (err) {
        console.error('Gagal load active event:', err);
        setActiveEventName(null);
      } finally {
        setIsSearching(false);
      }
    };
    loadActiveEvent();
  }, []);

  const extractTournamentSlug = (input) => {
    const raw = input.trim().replace(/\/+$/, '');
    if (!raw) return '';

    if (raw.includes('challonge.com')) {
      let url;
      try {
        url = new URL(raw);
      } catch {
        return raw;
      }

      const hostname = url.hostname.toLowerCase();
      const pathname = url.pathname;

      if (hostname !== 'challonge.com' && hostname !== 'www.challonge.com') {
        const subdomain = hostname.replace(/\.challonge\.com$/, '');
        const slug = pathname.split('/').filter(Boolean).pop() || '';
        return slug ? `${subdomain}-${slug}` : subdomain;
      }

      const segments = pathname.split('/').filter(Boolean);
      return segments.pop() || '';
    }

    return raw;
  };

  const handleFetchMatches = async (urlOrBackground, maybeBackground) => {
    const isBackground = typeof urlOrBackground === 'boolean' ? urlOrBackground : (maybeBackground || false);
    const rawUrl = typeof urlOrBackground === 'string' ? urlOrBackground : tournamentUrl;
    const slug = extractTournamentSlug(rawUrl);
    if (!slug) return toast.error('Masukkan Tournament URL/Slug!');
    setTournamentUrl(slug);
    if (!isBackground) {
      setLoading(true);
    }
    try {
      const result = await getOpenMatches(slug);
      const res = result.data;
      if (res?.status === 'success') {
        setParticipants(res.participants || []);
        setMatches(res.matches || []);
        setCompletedMatches(res.completedMatches || []);
        setTournamentState(res.tournamentState || '');
        setSwissRounds(res.swissRounds != null ? res.swissRounds : '');
      } else {
        toast.error(res?.message || 'Gagal fetch data');
      }
    } catch {
      toast.error('Gagal terhubung ke server');
    } finally {
      if (!isBackground) {
        setLoading(false);
      }
    }
  };

  const handleExportStandings = async () => {
    const sheetName = window.prompt("Masukkan nama Sheet tujuan (contoh: Juli Week 3):", "Juli Week 3");
    if (!sheetName || !sheetName.trim()) return;

    setIsExporting(true);
    try {
      const result = await postToGas('exportStandings', {
        sheetName: sheetName.trim(),
        payload: leagueStandings,
        optionalPoints: optionalPoints,
      });
      if (result?.status === 'success') {
        toast.success(result.message || 'Berhasil rekap ke spreadsheet!');
      } else {
        toast.error(result?.message || 'Gagal export standings');
      }
    } catch (err) {
      toast.error('Gagal terhubung ke server');
    } finally {
      setIsExporting(false);
    }
  };

  const handleStartTournament = async () => {
    const slug = tournamentUrl;
    if (!slug) return;
    setIsStarting(true);
    try {
      const res = await startTournament({ tournament_url: slug });
      if (res?.status === 'success') {
        toast.success('Turnamen Dimulai!');
        await new Promise(resolve => setTimeout(resolve, 2500));
        await handleFetchMatches(tournamentUrl);
      } else {
        toast.error(res?.message || 'Gagal start tournament');
      }
    } catch {
      toast.error('Gagal terhubung ke server');
    } finally {
      setIsStarting(false);
    }
  };

  const handleUpdateSwissRounds = async () => {
    const slug = tournamentUrl;
    if (!slug) return toast.error('URL turnamen kosong');
    try {
      const res = await updateSwissRounds({ tournament_url: slug, swiss_rounds: swissRounds });
      if (res?.status === 'success') {
        toast.success('Swiss Rounds berhasil disimpan: ' + swissRounds);
      } else {
        toast.error(res?.message || 'Gagal update Swiss Rounds');
      }
    } catch {
      toast.error('Gagal terhubung ke server');
    }
  };

  const handleSelectMatch = (match) => {
    setSelectedMatch(match);
    setScores({ p1: 0, p2: 0 });
    setLaunchFails({ p1: 0, p2: 0 });
    setSwapped(false);
    setShowReady(false);
    setCountdown(3);
    setPreviewScores(null);
    setHudPhase('READY');
    setReadyPlayers({ p1: false, p2: false });
    setState('hud');
  };

  const handleAddScore = (side, points) => {
    setScoreHistory(prev => [...prev, { player: side === 'p1' ? 1 : 2, points }]);
    setScores(prev => {
      const next = { ...prev, [side]: prev[side] + points };
      if (state === 'hud' && selectedMatch && hudPhase === 'SCORE') {
        if (next.p1 >= winLimit || next.p2 >= winLimit) {
          setPreviewScores({ p1: next.p1, p2: next.p2 });
          setHudPhase('PREVIEW');
        }
      }
      return next;
    });
  };

  const triggerScoreAnimation = (player, finishType, points, colorHex, audioSrc) => {
    new Audio(audioSrc).play().catch(e => console.log(e));
    setScoreEvent({ type: finishType, player, colorHex });
    setTimeout(() => {
      handleAddScore(player === 1 ? 'p1' : 'p2', points);
      setScoreEvent(null);
    }, 2000);
  };

  useEffect(() => {
    let timer;
    if (p1Fails === 2) {
      timer = setTimeout(() => {
        handleAddScore('p2', 1);
        toast.success('Launch Fail! Player 2 mendapat +1 poin');
        setP1Fails(0);
      }, 1000);
    } else if (p2Fails === 2) {
      timer = setTimeout(() => {
        handleAddScore('p1', 1);
        toast.success('Launch Fail! Player 1 mendapat +1 poin');
        setP2Fails(0);
      }, 1000);
    }
    return () => clearTimeout(timer);
  }, [p1Fails, p2Fails]);

  const handleUndo = () => {
    if (scoreHistory.length === 0) return;
    const lastAction = scoreHistory[scoreHistory.length - 1];
    if (lastAction.player === 1) {
      setScores(prev => ({ ...prev, p1: Math.max(0, prev.p1 - lastAction.points) }));
    } else {
      setScores(prev => ({ ...prev, p2: Math.max(0, prev.p2 - lastAction.points) }));
    }
    setScoreHistory(prev => prev.slice(0, -1));
  };

  const handleLaunchFail = (side) => {
    setLaunchFails(prev => {
      const newCount = prev[side] + 1;
      if (newCount >= 2) {
        const opponent = side === 'p1' ? 'p2' : 'p1';
        setScores(s => ({ ...s, [opponent]: s[opponent] + 1 }));
        toast.success('Launch Fail! Lawan mendapat +1 poin');
        return { ...prev, [side]: 0 };
      } else {
        toast('Launch Fail ' + newCount + '/2');
        return { ...prev, [side]: newCount };
      }
    });
  };

  const handleSwap = () => {
    setSwapped(s => !s);
  };

  const playReadySfx = () => { new Audio('/buttonReadyKlik.mp3').play().catch(e => console.log(e)); };
  const playTransitionSfx = () => { new Audio('/transisiReady.mp3').play().catch(e => console.log(e)); };

  const handlePlayerReady = (side) => {
    setReadyPlayers(prev => {
      const next = { ...prev, [side]: true };
      return next;
    });
  };

  useEffect(() => {
    if (readyPlayers.p1 && readyPlayers.p2) {
      playTransitionSfx();
      const timer = setTimeout(() => {
        setShowIntro(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [readyPlayers.p1, readyPlayers.p2]);

  useEffect(() => {
    if (hudPhase !== 'COUNTDOWN' || countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          clearInterval(timer);
          setTimeout(() => {
            setHudPhase('SCORE');
          }, 1200);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [hudPhase, countdown]);

  const adjustPreviewScore = (side, delta) => {
    if (!previewScores) return;
    setPreviewScores(prev => {
      const next = { ...prev, [side]: Math.max(0, prev[side] + delta) };
      return next;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!previewScores || !selectedMatch) return;
    const p1Score = previewScores.p1;
    const p2Score = previewScores.p2;
    const winnerId = p1Score > p2Score ? String(selectedMatch.player1_id) : p2Score > p1Score ? String(selectedMatch.player2_id) : '';

    if (!winnerId) return toast.error('Skor seri? Tentukan winner_id atau pastikan ada yang menang');

    setSubmitting(true);
    try {
      const res = await submitMatchScore({
        tournament_url: tournamentUrl.trim(),
        match_id: selectedMatch.match_id,
        scores_csv: `${p1Score}-${p2Score}`,
        winner_id: winnerId,
      });
      if (res?.status === 'success') {
        toast.success('Skor berhasil dikirim ke Challonge!');
        setPreviewScores(null);
        resetMatch();
        setHudPhase('POST_MATCH');
        await new Promise(resolve => setTimeout(resolve, 2500));
        await handleFetchMatches(true);
      } else {
        toast.error(res?.message || 'Gagal submit skor');
      }
    } catch {
      toast.error('Gagal terhubung ke server');
    } finally {
      setSubmitting(false);
    }
  };

  const forceFullscreen = () => {
    const el = document.documentElement;
    if (el.requestFullscreen) el.requestFullscreen().catch(() => { });
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
  };

  const winnerName = previewScores
    ? previewScores.p1 > previewScores.p2
      ? selectedMatch?.player1_name
      : previewScores.p2 > previewScores.p1
        ? selectedMatch?.player2_name
        : null
    : null;

  const displayMatch = (match, side) => {
    if (!match) return { name: '-', id: '' };
    if (!swapped) return side === 'left' ? { name: match.player1_name, id: match.player1_id } : { name: match.player2_name, id: match.player2_id };
    return side === 'left' ? { name: match.player2_name, id: match.player2_id } : { name: match.player1_name, id: match.player1_id };
  };

  const leftPlayer = displayMatch(selectedMatch, 'left');
  const rightPlayer = displayMatch(selectedMatch, 'right');
  const leftScore = swapped ? scores.p2 : scores.p1;
  const rightScore = swapped ? scores.p1 : scores.p2;
  const leftFails = swapped ? launchFails.p2 : launchFails.p1;
  const rightFails = swapped ? launchFails.p1 : launchFails.p2;
  const leftFailSide = swapped ? 'p2' : 'p1';
  const rightFailSide = swapped ? 'p1' : 'p2';

  const computeStandings = (participantList, completedMatchList) => {
    const validMatches = (completedMatchList || []).filter(m => m && m.state === 'complete');
    const statsById = {};
    participantList.forEach(p => {
      statsById[p.id] = { id: p.id, name: p.name || p.display_name || 'Unknown', wins: 0, losses: 0, ties: 0, pointFinish: 0 };
    });

    validMatches.forEach(m => {
      const p1 = statsById[m.player1_id];
      const p2 = statsById[m.player2_id];
      const csv = (m.scores_csv || '').trim();
      if (!csv) return;

      const sets = csv.split(',').map(s => s.trim()).filter(Boolean);
      let p1Games = 0;
      let p2Games = 0;
      sets.forEach(set => {
        const parts = set.split('-').map(Number);
        if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
          p1Games += parts[0];
          p2Games += parts[1];
        }
      });

      if (p1) p1.pointFinish += p1Games;
      if (p2) p2.pointFinish += p2Games;

      if (p1Games > p2Games) {
        if (p1) p1.wins += 1;
        if (p2) p2.losses += 1;
      } else if (p2Games > p1Games) {
        if (p2) p2.wins += 1;
        if (p1) p1.losses += 1;
      } else {
        if (p1) p1.ties += 1;
        if (p2) p2.ties += 1;
      }
    });

    const standings = Object.values(statsById);
    standings.forEach(s => {
      s.isTied = standings.some(other => other.id !== s.id && other.wins === s.wins && other.pointFinish === s.pointFinish);
    });

    standings.sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (b.pointFinish !== a.pointFinish) return b.pointFinish - a.pointFinish;
      const optA = optionalPoints[a.id] || 0;
      const optB = optionalPoints[b.id] || 0;
      return optB - optA;
    });

    return standings;
  };

  const leagueStandings = computeStandings(participants, completedMatches);

  return (
    <div className="min-h-screen bg-black text-blue-400 font-mono">
      {/* STATE 1: MATCH SELECTOR */}
      {state === 'selector' && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-md mx-auto p-6 space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-black italic tracking-tighter text-blue-400">REFEREE HUD</h2>
            <p className="text-[10px] text-blue-400/60 font-black uppercase tracking-[0.3em]">Arena Scoreboard // Challonge Link</p>
          </div>

          <div className="bg-gray-900 border border-blue-400/20 rounded-[2rem] p-6 space-y-4">
            {isSearching && (
              <div className="text-center">
                <p className="text-sm font-black uppercase tracking-widest text-orange-400 animate-pulse">MENCARI EVENT AKTIF...</p>
              </div>
            )}
            {!isSearching && !activeEventName && (
              <div className="text-center">
                <p className="text-sm font-black uppercase tracking-widest text-red-500">TIDAK ADA EVENT AKTIF SAAT INI</p>
              </div>
            )}
            {!isSearching && activeEventName && (
              <div className="text-center">
                <p className="text-[10px] font-black text-blue-400/60 uppercase tracking-widest mb-1">Arena Scoreboard</p>
                <div className="flex items-center justify-center gap-2">
                  <p className="text-lg font-black uppercase tracking-widest text-green-400">ACTIVE EVENT: {activeEventName}</p>
                  <button
                    type="button"
                    onClick={() => handleFetchMatches(tournamentUrl)}
                    disabled={loading}
                    title="Refresh data"
                    className="p-1.5 rounded-lg border border-blue-400/40 text-blue-400 hover:bg-blue-400/10 active:scale-95 transition-all disabled:opacity-50"
                  >
                    🔄
                  </button>
                </div>
              </div>
            )}
          </div>

          {!loading && Array.isArray(matches) && matches.length > 0 && (
            <div className="bg-gray-900 border border-blue-400/20 rounded-[2rem] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-black text-blue-400/80 uppercase tracking-widest">Swiss Rounds</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    value={swissRounds}
                    onChange={(e) => setSwissRounds(Math.max(1, Number(e.target.value) || 1))}
                    className="w-16 p-2 bg-black border-2 border-blue-400/30 rounded-xl text-blue-400 font-black text-center text-sm outline-none focus:border-blue-400"
                  />
                  <button
                    type="button"
                    onClick={handleUpdateSwissRounds}
                    className="px-3 py-2 bg-blue-400 text-black rounded-xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all"
                  >
                    SIMPAN
                  </button>
                </div>
              </div>
            </div>
          )}

          {loading && (
            <div className="text-center py-8">
              <Loader2 className="animate-spin text-blue-400 mx-auto mb-3" size={32} />
              <p className="text-[10px] text-blue-400/60 font-black uppercase tracking-widest">Mengambil data turnamen...</p>
            </div>
          )}

          {!selectedMatch && (
            <div className="flex flex-col items-center w-full max-w-2xl mx-auto mt-8">
              {!loading && (!matches || matches.length === 0) && (!participants || participants.length === 0) && (
                <div className="mt-8 text-slate-500 text-center border border-slate-800 p-8 rounded-xl w-full">
                  <p>Belum ada data turnamen. Pastikan ada event berstatus 'aktif' di spreadsheet.</p>
                </div>
              )}

              {tournamentState === 'pending' && !loading && Array.isArray(participants) && participants.length > 0 && (!Array.isArray(matches) || matches.length === 0) && (
                <div className="mt-8 flex flex-col items-center w-full max-w-2xl mx-auto">
                  <h3 className="text-xl text-green-400 font-bold mb-4 tracking-widest">PARTICIPANTS (NOT STARTED)</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 w-full mb-8">
                    {participants.map((p, index) => (
                      <div key={index} className="border-2 border-blue-500/50 bg-slate-900/50 p-4 rounded-lg shadow-[0_0_15px_rgba(59,130,246,0.3)] text-center text-white font-semibold">
                        {p.name || (p.participant && p.participant.name) || "Unknown Player"}
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={handleStartTournament}
                    disabled={isStarting}
                    className="bg-red-600 hover:bg-red-500 text-white font-black py-4 px-10 rounded-xl shadow-[0_0_20px_rgba(220,38,38,0.8)] text-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isStarting ? 'MENGAKTIFKAN ARENA...' : '🚀 START TOURNAMENT'}
                  </button>
                </div>
              )}

              {tournamentState === 'underway' && !loading && Array.isArray(matches) && matches.length > 0 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full space-y-3">
                  <p className="text-[10px] font-black text-blue-400/60 uppercase tracking-widest px-2">Open Matches ({matches.length})</p>
                  {matches.map((m, idx) => (
                    <button
                      key={m.match_id}
                      type="button"
                      onClick={() => handleSelectMatch(m)}
                      className="w-full p-4 bg-gray-900 border border-blue-400/20 rounded-2xl text-left active:scale-[0.98] transition-all hover:border-blue-400/50"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-black text-sm text-blue-400 tracking-tighter">Partai {idx + 1}</p>
                          <p className="font-black text-sm text-blue-400 tracking-tighter">{m.player1_name}</p>
                          <p className="text-[10px] text-blue-400/40 font-bold uppercase tracking-widest">VS</p>
                          <p className="font-black text-sm text-blue-400 tracking-tighter">{m.player2_name}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[9px] text-blue-400/40 font-black uppercase">Babak {m.round}</p>
                          <p className="text-[9px] text-blue-400/40 font-black uppercase">#{m.match_id}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </motion.div>
              )}

              {(tournamentState === 'complete' || tournamentState === 'awaiting_review') && !loading && leagueStandings.length > 0 && (
                <>
                  <div className="mt-8 w-full max-w-2xl mx-auto">
                    <h3 className="text-xl text-yellow-400 font-bold mb-4 tracking-widest">KLASEMEN LIGA</h3>
                  <div className="overflow-x-auto w-full">
                    <table className="w-full text-sm text-left text-gray-300 border-collapse">
                      <thead>
                        <tr className="border-b-2 border-blue-900">
                          <th className="py-4 px-4 text-[10px] font-black text-blue-400 uppercase tracking-wider text-center">Posisi</th>
                          <th className="py-4 px-4 text-[10px] font-black text-blue-400 uppercase tracking-wider text-center">Pemain</th>
                          <th className="py-4 px-4 text-[10px] font-black text-blue-400 uppercase tracking-wider text-center">W-L-T</th>
                          <th className="py-4 px-4 text-[10px] font-black text-blue-400 uppercase tracking-wider text-center">Point Finish</th>
                          <th className="py-4 px-4 text-[10px] font-black text-blue-400 uppercase tracking-wider text-center">Opsional Point</th>
                          <th className="py-4 px-4 text-[10px] font-black text-blue-400 uppercase tracking-wider text-center">Poin Liga</th>
                        </tr>
                      </thead>
                      <tbody>
                        {leagueStandings.map((p, i) => (
                          <tr key={p.id} className="border-b border-blue-900 hover:bg-slate-800/50 transition-colors">
                            <td className="py-3 px-4 text-center">
                              <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-black ${i === 0 ? 'bg-yellow-400 text-black' : i === 1 ? 'bg-gray-300 text-black' : i === 2 ? 'bg-orange-400 text-black' : 'bg-blue-400/20 text-blue-400'}`}>
                                {i + 1}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center font-black text-blue-300 tracking-tighter">{p.name}</td>
                            <td className="py-3 px-4 text-center font-mono text-xs">
                              {`${p.wins} - ${p.losses} - ${p.ties}`}
                            </td>
                            <td className="py-3 px-4 text-center font-mono text-xs">
                              {p.pointFinish}
                            </td>
                            <td className="py-3 px-4 text-center">
                              {p.isTied ? (
                                <input
                                  type="number"
                                  min="0"
                                  value={optionalPoints[p.id] || ''}
                                  onChange={(e) => setOptionalPoints(prev => ({ ...prev, [p.id]: parseInt(e.target.value, 10) || 0 }))}
                                  className="w-16 bg-slate-900 border border-blue-900 rounded px-2 py-1 text-center text-xs text-blue-300 focus:outline-none focus:border-blue-400"
                                />
                              ) : (
                                <span className="text-slate-600">-</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-center font-black text-lg text-yellow-400">
                              {LEAGUE_POINTS_DISTRIBUTION[i] || 0}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="flex justify-center mt-6 mb-8">
                  <button
                    type="button"
                    onClick={handleExportStandings}
                    disabled={isExporting}
                    className="w-full max-w-md py-4 px-6 rounded-xl font-black text-lg tracking-widest border-2 border-green-400 text-green-400 bg-green-400/10 hover:bg-green-400/20 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isExporting ? 'MEREKAP...' : '📤 REKAP KE SPREADSHEET'}
                  </button>
                </div>
                </>
              )}

            </div>
          )}
        </motion.div>
      )}

      {/* STATE 2: SCOREBOARD HUD */}
      {state === 'hud' && selectedMatch && (
        <>
          <div className="fixed inset-0 z-[999] bg-[#0a0a0a] overflow-hidden flex items-center justify-center">
          {isPortrait && (
            <div className="fixed inset-0 z-[1000] bg-black/95 flex flex-col items-center justify-center p-8 text-center">
              <Smartphone size={64} className="text-yellow-400 mb-4 animate-bounce" />
              <h2 className="text-2xl font-black text-yellow-400 mb-2">SILAKAN PUTAR HP</h2>
              <p className="text-sm text-yellow-400/80 font-bold">Putar perangkat Anda ke posisi Landscape (Tidur) untuk memimpin pertandingan</p>
            </div>
          )}

          {hudPhase === 'READY' && (
            <div className="w-full h-full relative overflow-hidden">
              {/* Center console line */}
              <div className="absolute left-1/2 top-0 bottom-0 w-px bg-slate-800 -translate-x-1/2 z-40" />

              {/* EXIT button on center line (top) */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedMatch(null);
                  setScoreHistory([]);
                  resetMatch();
                  setState('selector');
                  handleFetchMatches(tournamentUrl);
                }}
                className="absolute top-8 left-1/2 -translate-x-1/2 z-50 px-6 py-2 bg-slate-900/90 rounded-full border border-slate-700 text-xs tracking-widest text-slate-400 hover:text-white"
              >
                EXIT
              </button>

              {/* SWAP button dead center */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsSwapped(prev => !prev);
                }}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 rounded-full bg-slate-900 border border-slate-700 p-4 hover:border-blue-500 hover:text-blue-400 text-slate-400 transition-colors"
              >
                ⇆
              </button>

              <div className={`flex w-full h-full transition-all duration-500 ${isSwapped ? 'flex-row-reverse' : 'flex-row'}`}>
                <motion.div
                  layout
                  whileTap={{ scale: 0.98 }}
                  onClick={() => { playReadySfx(); setReadyPlayers(prev => ({...prev, p1: true})); }}
                  className="flex-1 flex flex-col items-center justify-center relative p-8 cursor-pointer"
                >
                  <div className={`w-32 h-32 sm:w-40 sm:h-40 rounded-full border-4 flex items-center justify-center transition-all ${readyPlayers.p1 ? 'border-blue-400 bg-blue-400/30 shadow-[0_0_40px_rgba(96,165,250,0.5)]' : 'border-blue-400/50 bg-gray-900'}`}>
                    <span className="text-5xl md:text-7xl font-black text-white drop-shadow-[0_0_15px_#3b82f6] italic">{leftPlayer.name.charAt(0)}</span>
                  </div>
                  <h3 className="text-2xl md:text-4xl font-black text-white tracking-tight drop-shadow-[0_0_10px_rgba(59,130,246,0.5)] mb-4 md:mb-8 z-10">{leftPlayer.name}</h3>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    onClick={(e) => { e.stopPropagation(); handlePlayerReady('p1'); playReadySfx(); }}
                    className={`w-3/4 max-w-sm py-8 rounded-2xl border-2 tracking-[0.3em] font-bold text-sm md:text-lg uppercase backdrop-blur-sm transition-colors ${readyPlayers.p1 ? 'border-blue-500 text-blue-100 bg-blue-600/30 drop-shadow-[0_0_15px_#2563EB]' : 'border-slate-600 text-blue-100 bg-slate-800/80 animate-pulse'}`}
                  >
                    {readyPlayers.p1 ? 'READY ✓' : 'TAP TO READY'}
                  </motion.button>
                </motion.div>

                <motion.div
                  layout
                  whileTap={{ scale: 0.98 }}
                  onClick={() => { playReadySfx(); setReadyPlayers(prev => ({...prev, p2: true})); }}
                  className="flex-1 flex flex-col items-center justify-center relative p-8 cursor-pointer"
                >
                  <div className={`w-32 h-32 sm:w-40 sm:h-40 rounded-full border-4 flex items-center justify-center transition-all ${readyPlayers.p2 ? 'border-blue-400 bg-blue-400/30 shadow-[0_0_40px_rgba(96,165,250,0.5)]' : 'border-blue-400/50 bg-gray-900'}`}>
                    <span className="text-5xl md:text-7xl font-black text-white drop-shadow-[0_0_15px_#3b82f6] italic">{rightPlayer.name.charAt(0)}</span>
                  </div>
                  <h3 className="text-2xl md:text-4xl font-black text-white tracking-tight drop-shadow-[0_0_10px_rgba(59,130,246,0.5)] mb-4 md:mb-8 z-10">{rightPlayer.name}</h3>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    onClick={(e) => { e.stopPropagation(); handlePlayerReady('p2'); playReadySfx(); }}
                    className={`w-3/4 max-w-sm py-8 rounded-2xl border-2 tracking-[0.3em] font-bold text-sm md:text-lg uppercase backdrop-blur-sm transition-colors ${readyPlayers.p2 ? 'border-blue-500 text-blue-100 bg-blue-600/30 drop-shadow-[0_0_15px_#2563EB]' : 'border-slate-600 text-blue-100 bg-slate-800/80 animate-pulse'}`}
                  >
                    {readyPlayers.p2 ? 'READY ✓' : 'TAP TO READY'}
                  </motion.button>
                </motion.div>
              </div>
            </div>
          )}

          <MatchIntro
            show={showIntro}
            audioSrc="/suara-announcer.mp3"
            onFinish={() => {
              setShowIntro(false);
              setHudPhase('SCORE');
            }}
          />

          {hudPhase === 'SCORE' && (
            <div className="fixed inset-0 z-[999] bg-slate-950 overflow-hidden flex items-center justify-center">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(30,58,138,0.15)_0%,transparent_70%)]" />

              <div className="relative w-full h-full flex items-stretch justify-center px-2 sm:px-6 py-2 sm:py-4 pb-6 sm:pb-8">
                <div className="w-full max-w-7xl grid grid-cols-3 gap-2 sm:gap-6 items-stretch">

                  {/* PANEL KIRI - PLAYER 1 */}
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-full border-t-2 border-b-2 border-blue-500 bg-blue-900/20 py-1.5 text-center">
                      <p className="text-[10px] sm:text-xs font-black text-blue-400 uppercase tracking-[0.2em]">Player 1</p>
                      <h3 className="text-sm sm:text-base font-black text-blue-300 tracking-tighter leading-tight">{leftPlayer.name}</h3>
                    </div>

                    <div className="flex-1 flex flex-col justify-center gap-1.5 w-full max-w-[220px] mx-auto">
                      {[
                        { key: 'spin', label: 'SPIN FINISH', points: 1, border: 'border-blue-500/50', hover: 'hover:bg-blue-500/20 hover:shadow-[0_0_15px_rgba(59,130,246,0.6)]', point: 'text-blue-400', colorHex: '#3b82f6', audioSrc: '/finish.mp3' },
                        { key: 'over', label: 'OVER FINISH', points: 2, border: 'border-emerald-500/50', hover: 'hover:bg-emerald-500/20 hover:shadow-[0_0_15px_rgba(16,185,129,0.6)]', point: 'text-emerald-400', colorHex: '#22c55e', audioSrc: '/finish.mp3' },
                        { key: 'burst', label: 'BURST FINISH', points: 2, border: 'border-fuchsia-500/50', hover: 'hover:bg-fuchsia-500/20 hover:shadow-[0_0_15px_rgba(217,70,239,0.6)]', point: 'text-fuchsia-400', colorHex: '#d946ef', audioSrc: '/finish.mp3' },
                        { key: 'xtreme', label: 'XTREME FINISH', points: 3, border: 'border-yellow-500/50', hover: 'hover:bg-yellow-500/20 hover:shadow-[0_0_15px_rgba(234,179,8,0.6)]', point: 'text-yellow-400', colorHex: '#eab308', audioSrc: '/finish.mp3' },
                      ].map(btn => (
                        <button
                          key={btn.key}
                          type="button"
                          onClick={() => triggerScoreAnimation(1, btn.label, btn.points, btn.colorHex, btn.audioSrc)}
                          className={`w-full flex items-center justify-between px-3 sm:px-4 py-2 sm:py-3 bg-black/60 border text-blue-300 font-semibold text-base sm:text-lg uppercase tracking-wider rounded-none active:scale-95 transition-all ${btn.border} ${btn.hover}`}
                        >
                          <span>{btn.label}</span>
                          <span className={`${btn.point} text-xl sm:text-2xl font-bold`}>+{btn.points}</span>
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-2 mt-2">
                      {[0, 1].map(i => (
                        <div key={i} className={`w-4 h-4 rounded-full border ${i < p1Fails ? 'bg-red-600 border-red-500 shadow-[0_0_8px_rgba(220,38,38,0.6)]' : 'border-blue-700'}`} />
                      ))}
                       <button
                         type="button"
                         onClick={() => setP1Fails(prev => Math.min(prev + 1, 2))}
                        className="px-3 py-1 bg-red-900/30 border border-red-700 text-red-400 text-xs font-black uppercase tracking-widest rounded-none hover:bg-red-600/30 active:scale-95 transition-all"
                      >
                        FAIL
                      </button>
                    </div>
                  </div>

                  {/* PANEL TENGAH */}
                  <div className="flex flex-col items-center justify-center gap-2 sm:gap-3">
                    <div className="w-full border-x-4 border-blue-500 bg-blue-900/10 px-3 sm:px-6 py-1.5 text-center">
                      <p className="text-[10px] sm:text-xs font-black text-blue-400 uppercase tracking-[0.3em]">Babak {selectedMatch?.round ?? 1}</p>
                      <div className="text-xs text-slate-400">RACE TO {winLimit}</div>
                    </div>

                    <div className="flex items-center justify-center gap-2 sm:gap-4">
                      <span className="text-5xl sm:text-8xl md:text-9xl font-black text-blue-400 drop-shadow-[0_0_20px_rgba(59,130,246,0.8)] leading-none">{leftScore}</span>
                      <span className="text-2xl sm:text-4xl font-black text-blue-400/40">:</span>
                      <span className="text-5xl sm:text-8xl md:text-9xl font-black text-blue-400 drop-shadow-[0_0_20px_rgba(59,130,246,0.8)] leading-none">{rightScore}</span>
                    </div>

                    <button
                      type="button"
                      onClick={handleUndo}
                      disabled={scoreHistory.length === 0}
                      className="w-full max-w-xs py-2 sm:py-3 bg-black/60 border border-orange-600 text-orange-400 font-black text-[10px] sm:text-xs uppercase tracking-widest rounded-none hover:bg-orange-600/30 hover:shadow-[0_0_15px_rgba(234,88,12,0.5)] active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      UNDO
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedMatch(null);
                        setScoreHistory([]);
                        resetMatch();
                        setState('selector');
                        handleFetchMatches(tournamentUrl);
                      }}
                      className="mt-2 text-sm text-slate-500 hover:text-slate-300 font-mono tracking-widest uppercase"
                    >
                      ← Back to Matches
                    </button>
                  </div>

                  {/* PANEL KANAN - PLAYER 2 */}
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-full border-t-2 border-b-2 border-blue-500 bg-blue-900/20 py-1.5 text-center">
                      <p className="text-[10px] sm:text-xs font-black text-blue-400 uppercase tracking-[0.2em]">Player 2</p>
                      <h3 className="text-sm sm:text-base font-black text-blue-300 tracking-tighter leading-tight">{rightPlayer.name}</h3>
                    </div>

                    <div className="flex-1 flex flex-col justify-center gap-1.5 w-full max-w-[220px] mx-auto">
                      {[
                        { key: 'spin', label: 'SPIN FINISH', points: 1, border: 'border-blue-500/50', hover: 'hover:bg-blue-500/20 hover:shadow-[0_0_15px_rgba(59,130,246,0.6)]', point: 'text-blue-400', colorHex: '#3b82f6', audioSrc: '/finish.mp3' },
                        { key: 'over', label: 'OVER FINISH', points: 2, border: 'border-emerald-500/50', hover: 'hover:bg-emerald-500/20 hover:shadow-[0_0_15px_rgba(16,185,129,0.6)]', point: 'text-emerald-400', colorHex: '#22c55e', audioSrc: '/finish.mp3' },
                        { key: 'burst', label: 'BURST FINISH', points: 2, border: 'border-fuchsia-500/50', hover: 'hover:bg-fuchsia-500/20 hover:shadow-[0_0_15px_rgba(217,70,239,0.6)]', point: 'text-fuchsia-400', colorHex: '#d946ef', audioSrc: '/finish.mp3' },
                        { key: 'xtreme', label: 'XTREME FINISH', points: 3, border: 'border-yellow-500/50', hover: 'hover:bg-yellow-500/20 hover:shadow-[0_0_15px_rgba(234,179,8,0.6)]', point: 'text-yellow-400', colorHex: '#eab308', audioSrc: '/finish.mp3' },
                      ].map(btn => (
                        <button
                          key={btn.key}
                          type="button"
                          onClick={() => triggerScoreAnimation(2, btn.label, btn.points, btn.colorHex, btn.audioSrc)}
                          className={`w-full flex items-center justify-between px-3 sm:px-4 py-2 sm:py-3 bg-black/60 border text-blue-300 font-semibold text-base sm:text-lg uppercase tracking-wider rounded-none active:scale-95 transition-all ${btn.border} ${btn.hover}`}
                        >
                          <span>{btn.label}</span>
                          <span className={`${btn.point} text-xl sm:text-2xl font-bold`}>+{btn.points}</span>
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-2 mt-2">
                      {[0, 1].map(i => (
                        <div key={i} className={`w-4 h-4 rounded-full border ${i < p2Fails ? 'bg-red-600 border-red-500 shadow-[0_0_8px_rgba(220,38,38,0.6)]' : 'border-blue-700'}`} />
                      ))}
                       <button
                         type="button"
                         onClick={() => setP2Fails(prev => Math.min(prev + 1, 2))}
                        className="px-3 py-1 bg-red-900/30 border border-red-700 text-red-400 text-xs font-black uppercase tracking-widest rounded-none hover:bg-red-600/30 active:scale-95 transition-all"
                      >
                        FAIL
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {hudPhase === 'PREVIEW' && (
            <motion.div
              className="absolute inset-0 z-50 flex flex-col items-center justify-start lg:justify-center w-full h-full overflow-y-auto bg-black/95 backdrop-blur-md p-4 lg:p-8 pt-8 lg:pt-0"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, type: 'spring' }}
            >
              <div className="w-full max-w-5xl flex flex-col items-center my-auto">
                {/* Header Pemenang */}
                <div className="flex flex-col items-center justify-center mb-4 lg:mb-8 mt-2 lg:mt-0">
                  <h2 className="text-sm lg:text-2xl font-bold tracking-[0.4em] text-green-400 mb-2 lg:mb-6 uppercase">
                    Match Winner
                  </h2>
                  <div className="flex items-center justify-center gap-4 lg:gap-8">
                    <motion.div
                      className="text-yellow-400 drop-shadow-[0_0_15px_#facc15] flex items-center"
                      animate={{ y: [0, -8, 0] }}
                      transition={{ repeat: Infinity, duration: 2 }}
                    >
                      <Trophy className="w-12 h-12 lg:w-24 lg:h-24"/>
                    </motion.div>
                    <p className="text-4xl lg:text-8xl font-black italic text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-yellow-600 drop-shadow-[0_0_20px_rgba(234,179,8,0.5)] uppercase leading-none pt-2">
                      {winnerName}
                    </p>
                  </div>
                </div>

                <div className="w-full max-w-4xl mt-3 lg:mt-8 bg-slate-900/50 border border-slate-700/50 rounded-2xl p-3 lg:p-8 backdrop-blur-sm shadow-2xl flex flex-col">
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-center flex-1">
                      <p className="text-[10px] text-blue-400/60 font-black uppercase tracking-widest mb-1">P1</p>
                      <p className="text-xs lg:text-base font-black tracking-tighter mb-4">{selectedMatch.player1_name}</p>
                      <div className="flex items-center justify-center gap-2">
                        <motion.button
                          whileTap={{ scale: 0.8 }}
                          onClick={() => adjustPreviewScore('p1', -1)}
                          className="w-8 h-8 lg:w-12 lg:h-12 flex items-center justify-center rounded-lg bg-slate-800 border border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors text-lg lg:text-2xl font-bold"
                        >
                          -
                        </motion.button>
                        <span className="text-4xl lg:text-6xl font-black text-blue-400 drop-shadow-[0_0_15px_#3b82f6] w-24 text-center">{previewScores?.p1 ?? 0}</span>
                        <motion.button
                          whileTap={{ scale: 0.8 }}
                          onClick={() => adjustPreviewScore('p1', 1)}
                          className="w-8 h-8 lg:w-12 lg:h-12 flex items-center justify-center rounded-lg bg-slate-800 border border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors text-lg lg:text-2xl font-bold"
                        >
                          +
                        </motion.button>
                      </div>
                    </div>
                    <span className="text-2xl font-black text-blue-400/30">:</span>
                    <div className="text-center flex-1">
                      <p className="text-[10px] text-blue-400/60 font-black uppercase tracking-widest mb-1">P2</p>
                      <p className="text-xs lg:text-base font-black tracking-tighter mb-4">{selectedMatch.player2_name}</p>
                      <div className="flex items-center justify-center gap-2">
                        <motion.button
                          whileTap={{ scale: 0.8 }}
                          onClick={() => adjustPreviewScore('p2', -1)}
                          className="w-8 h-8 lg:w-12 lg:h-12 flex items-center justify-center rounded-lg bg-slate-800 border border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors text-lg lg:text-2xl font-bold"
                        >
                          -
                        </motion.button>
                        <span className="text-4xl lg:text-6xl font-black text-blue-400 drop-shadow-[0_0_15px_#3b82f6] w-24 text-center">{previewScores?.p2 ?? 0}</span>
                        <motion.button
                          whileTap={{ scale: 0.8 }}
                          onClick={() => adjustPreviewScore('p2', 1)}
                          className="w-8 h-8 lg:w-12 lg:h-12 flex items-center justify-center rounded-lg bg-slate-800 border border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors text-lg lg:text-2xl font-bold"
                        >
                          +
                        </motion.button>
                      </div>
                    </div>
                  </div>
                  <p className="text-center text-[10px] text-blue-400/40 font-black uppercase tracking-widest mt-4">Score CSV: {(previewScores?.p1 ?? 0)}-{(previewScores?.p2 ?? 0)}</p>
                </div>

                <div className="w-full max-w-4xl flex gap-4 mt-3 lg:mt-6 mb-8">
                  <motion.button
                    type="button"
                    onClick={resetMatch}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.95 }}
                    className="flex-1 py-2 lg:py-5 rounded-xl border border-slate-700 bg-slate-900/80 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors uppercase tracking-widest font-bold text-xs lg:text-lg"
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    type="button"
                    onClick={handleSubmit}
                    disabled={submitting}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.95 }}
                    animate={!submitting ? { boxShadow: ['0 0 20px #2563EB', '0 0 40px #2563EB', '0 0 20px #2563EB'] } : {}}
                    transition={!submitting ? { repeat: Infinity, duration: 2 } : {}}
                    className="flex-[2] py-2 lg:py-5 rounded-xl bg-blue-600 text-white uppercase tracking-widest font-black text-xs lg:text-lg shadow-lg shadow-blue-500/40 border border-blue-500 hover:bg-blue-500 transition-colors flex items-center justify-center gap-3 disabled:opacity-50"
                  >
                    {submitting ? <Loader2 className="animate-spin" size={18}/> : <Trophy size={18}/>}
                    {submitting ? 'Submitting...' : 'Submit to Challonge'}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}

          {hudPhase === 'POST_MATCH' && (
            <div className="w-full h-full min-h-screen flex flex-col items-center p-4 md:p-8 overflow-y-auto">
              <h2 className="text-2xl sm:text-3xl font-black text-green-400 mb-1 tracking-tighter">SKOR BERHASIL DISIMPAN!</h2>
              <p className="text-sm md:text-base font-bold text-slate-400 tracking-widest uppercase mt-4 mb-8">Pilih Pertandingan Selanjutnya</p>

              <div className="w-full flex flex-col gap-4 max-w-lg mx-auto">
                {(() => {
                  const remainingMatches = matches ? matches.filter(m => m.match_id !== selectedMatch?.match_id) : [];

                  if (loading) {
                    return (
                      <div className="text-center py-10">
                        <Loader2 className="animate-spin text-blue-400 mx-auto mb-3" size={32} />
                        <p className="text-[10px] text-blue-400/60 font-black uppercase tracking-widest">Memuat sisa pertandingan...</p>
                      </div>
                    );
                  }

                  if (remainingMatches.length > 0) {
                    return remainingMatches.map((match, index) => (
                      <button
                        key={match.match_id}
                        type="button"
                        onClick={() => {
                          setSelectedMatch(match);
                          setScores({ p1: 0, p2: 0 });
                          setLaunchFails({ p1: 0, p2: 0 });
                          setSwapped(false);
                          setShowReady(false);
                          setCountdown(3);
                          setPreviewScores(null);
                          setReadyPlayers({ p1: false, p2: false });
                          setHudPhase('READY');
                        }}
                        className="w-full max-w-2xl p-5 md:p-6 rounded-2xl bg-slate-900 border border-slate-700 hover:border-blue-500 hover:bg-slate-800 transition-all duration-300 flex flex-col gap-2 cursor-pointer shadow-lg hover:shadow-blue-500/20 group"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs md:text-sm font-black text-blue-400 tracking-widest uppercase mb-1">BABAK {match.round} • MATCH {index + 1}</p>
                            <p className="text-xl md:text-2xl font-black text-white group-hover:text-blue-300 transition-colors tracking-tight truncate">{match.player1_name}</p>
                            <p className="text-sm font-bold italic text-red-500/80 my-1">VS</p>
                            <p className="text-xl md:text-2xl font-black text-white group-hover:text-blue-300 transition-colors tracking-tight truncate">{match.player2_name}</p>
                          </div>
                          <div className="text-right ml-4">
                          </div>
                        </div>
                      </button>
                    ));
                  }

                  return (
                    <div className="text-center text-blue-300 py-10">
                      <p className="text-lg font-black mb-2">MEMPERBARUI ARENA BRACKET...</p>
                      <p className="text-xs text-blue-400/60">Sinkronisasi dalam proses. Jangan tutup layar</p>
                    </div>
                  );
                })()}
              </div>

              <button
                type="button"
                onClick={() => {
                  setSelectedMatch(null);
                  setScoreHistory([]);
                  resetMatch();
                  setState('selector');
                  handleFetchMatches(tournamentUrl);
                }}
                className="mt-6 w-full sm:w-auto px-8 py-3 bg-gray-900 border border-red-500/50 text-red-400 font-black text-xs uppercase tracking-widest rounded-2xl active:scale-95 transition-all hover:bg-red-600 hover:text-white hover:border-red-500"
              >
                Exit Referee Mode
              </button>
              
              <div className="mt-4">
                <button
                  onClick={() => handleFetchMatches(true)}
                  className="px-4 py-2 bg-blue-400/10 border border-blue-400/30 text-blue-400 text-[10px] font-black uppercase tracking-widest rounded-xl active:scale-95 transition-all hover:bg-blue-400/20"
                >
                  🔄 REFRESH DATA
                </button>
              </div>
            </div>
          )}
        </div>

        {scoreEvent && (
          <AnimatePresence>
            <motion.div
              className="fixed inset-0 z-[999] bg-black flex items-center justify-center overflow-hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {(() => {
                const [word1, word2] = scoreEvent.type.split(' ');
                const isStacked = scoreEvent.type === 'BURST FINISH' || scoreEvent.type === 'XTREME FINISH';
                return (
                  <motion.div
                    className="flex flex-col items-center justify-center italic font-black uppercase tracking-widest leading-none drop-shadow-2xl"
                    style={{ WebkitTextStroke: `4px ${scoreEvent.colorHex}`, color: 'transparent' }}
                    initial={{ x: scoreEvent.player === 1 ? '-100vw' : '100vw', opacity: 0, skewX: scoreEvent.player === 1 ? -15 : 15 }}
                    animate={{ x: 0, opacity: 1, skewX: 0 }}
                    exit={{ scale: 1.5, opacity: 0 }}
                    transition={{ type: 'spring', damping: 15, stiffness: 100 }}
                  >
                    {isStacked ? (
                      <>
                        <span style={{ fontSize: '15vw', marginBottom: '-2vw' }}>{word1}</span>
                        <span style={{ fontSize: '12vw' }}>{word2}</span>
                      </>
                    ) : (
                      <span style={{ fontSize: '10vw' }}>{scoreEvent.type}</span>
                    )}
                  </motion.div>
                );
              })()}
            </motion.div>
          </AnimatePresence>
        )}
      </>
      )}
    </div>
  );
}
