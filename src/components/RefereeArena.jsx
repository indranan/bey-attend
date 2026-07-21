import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Trophy, Swords, RotateCcw, Maximize, Minimize, Smartphone, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { getOpenMatches, submitMatchScore, startTournament, getActiveEvent, postToGas } from '../utils/api';
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
  const [tournamentType, setTournamentType] = useState('');
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
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportSheetName, setExportSheetName] = useState('');
  const [activeEventName, setActiveEventName] = useState(null);
  const [activeEventWaktu, setActiveEventWaktu] = useState('');
  const [isSearching, setIsSearching] = useState(true);
  const [lastFetchTs, setLastFetchTs] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const LEAGUE_POINTS_DISTRIBUTION = [20, 17, 15, 13, 11, 9, 8, 7, 6, 5, 4, 3, 2, 1, 1, 1];

  const bgmRef = useRef(typeof Audio !== "undefined" ? new Audio('/bgm.mp3') : null);
  const mwinRef = useRef(typeof Audio !== "undefined" ? new Audio('/mwin.mp3') : null);
  const waitPlayerReadyRef = useRef(typeof Audio !== "undefined" ? new Audio('/waitplayerready.mp3') : null);
  const duckingTimeoutRef = useRef(null);
  const BGM_BASE_VOLUME = 0.7;
  const BGM_DUCK_VOLUME = 0.08;
  const DUCK_DURATION = 2000;

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
    const bgmScore = bgmRef.current;
    const bgmWinner = mwinRef.current;
    const bgmReady = waitPlayerReadyRef.current;

    if (bgmWinner) bgmWinner.loop = false;
    if (bgmScore) bgmScore.loop = true;
    if (bgmReady) bgmReady.loop = true;

    const isBothReady = readyPlayers.p1 && readyPlayers.p2;

    let activeAudio = null;

    if (hudPhase === 'SCORE') {
      if (!isBothReady && bgmReady) {
        activeAudio = bgmReady;
      } else if (isBothReady && bgmScore) {
        activeAudio = bgmScore;
      }
    } else if (hudPhase === 'PREVIEW' && bgmWinner) {
      activeAudio = bgmWinner;
    }

    const allAudios = [bgmScore, bgmWinner, bgmReady];
    allAudios.forEach(audio => {
      if (audio && audio !== activeAudio) {
        audio.pause();
        audio.currentTime = 0;
      }
    });

    if (activeAudio) {
      if (activeAudio === bgmScore) activeAudio.volume = BGM_BASE_VOLUME;
      else if (activeAudio === bgmReady) activeAudio.volume = 0.5;
      else if (activeAudio === bgmWinner) activeAudio.volume = 1;
      activeAudio.play().catch(e => console.warn("Autoplay blocked:", e));
    }

    return () => {
      allAudios.forEach(audio => {
        if (audio) {
          audio.pause();
        }
      });
    };
  }, [hudPhase, state, selectedMatch, readyPlayers]);

  useEffect(() => {
    if (showIntro) {
      const readySfx = new Audio('/readyset.mp3');
      readySfx.volume = 0.8;
      readySfx.play().catch(err => console.warn("Readyset SFX autoplay blocked:", err));
    }
  }, [showIntro]);

  useEffect(() => {
    const loadActiveEvent = async () => {
      setIsSearching(true);
      try {
        const res = await getActiveEvent();
        if (res?.status === 'success' && res.challongeUrl) {
          setActiveEventName(res.eventName || null);
          setActiveEventWaktu(res.waktu || '');
          setTournamentUrl(res.challongeUrl);
          await handleFetchMatches(res.challongeUrl);
        } else {
          setActiveEventName(null);
          setActiveEventWaktu('');
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

  const handleFetchMatches = async (urlOrBackground, maybeBackground, forceRefresh = false) => {
    const isBackground = typeof urlOrBackground === 'boolean' ? urlOrBackground : (maybeBackground || false);
    const rawUrl = typeof urlOrBackground === 'string' ? urlOrBackground : tournamentUrl;
    const slug = extractTournamentSlug(rawUrl);
    if (!slug) return toast.error('Masukkan Tournament URL/Slug!');
    setTournamentUrl(slug);

    const now = Date.now();
    if (now - lastFetchTs < 5000 && isBackground) {
      return;
    }
    setLastFetchTs(now);

    if (!isBackground) {
      setLoading(true);
    }
    try {
      const result = await getOpenMatches(slug, forceRefresh);
      const res = result.data;
      if (res?.status === 'success') {
        setParticipants(res.participants || []);
        const participantMap = {};
        if (res.participants && Array.isArray(res.participants)) {
          res.participants.forEach(p => {
            participantMap[String(p.id)] = p.name;
          });
        }
        const formattedMatches = (res.matches || []).map(match => ({
          ...match,
          player1_name: participantMap[String(match.player1_id)] || 'TBD',
          player2_name: participantMap[String(match.player2_id)] || 'TBD'
        }));
        setMatches([...formattedMatches].sort((a, b) => (a.suggested_play_order ?? 0) - (b.suggested_play_order ?? 0)));
        setCompletedMatches(res.completedMatches || []);
        setTournamentState(res.tournamentState || '');
        setTournamentType(res.tournamentType || '');
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

  const handleSyncMatches = async () => {
    if (!tournamentUrl) {
      toast.error('URL Challonge tidak ditemukan pada event aktif.');
      return;
    }

    setIsSyncing(true);
    try {
      const response = await postToGas('manualSync', {
        tournamentUrl: tournamentUrl
      });

      if (response?.status === 'success') {
        await handleFetchMatches(tournamentUrl);
        toast.success('Berhasil menyinkronkan data dengan Challonge!');
      } else {
        toast.error(response?.message || 'Gagal sync');
      }
    } catch (err) {
      toast.error('Gagal terhubung ke server saat sinkronisasi.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleOpenExport = () => {
    const defaultName = activeEventName || 'Rekap Turnamen';
    setExportSheetName(defaultName);
    setShowExportModal(true);
  };

  const executeExport = async () => {
    if (!exportSheetName.trim()) return;
    setIsExporting(true);
    try {
      const result = await postToGas('exportStandings', {
        sheetName: exportSheetName.trim(),
        payload: liveStandings,
        optionalPoints: optionalPoints,
      });
      if (result?.status === 'success') {
        toast.success(result.message || 'Berhasil rekap ke spreadsheet!');
        setShowExportModal(false);
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
        setTournamentState('underway');
        setMatches([]);
        setParticipants([]);
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

    const bgm = bgmRef.current;
    if (bgm) {
      bgm.volume = BGM_DUCK_VOLUME;
      if (duckingTimeoutRef.current) clearTimeout(duckingTimeoutRef.current);
      duckingTimeoutRef.current = setTimeout(() => {
        if (bgmRef.current) bgmRef.current.volume = BGM_BASE_VOLUME;
      }, DUCK_DURATION);
    }

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
        setMatches(prev => prev.filter(m => m.match_id !== selectedMatch.match_id));
        handleFetchMatches(tournamentUrl, false, true);
        await new Promise(resolve => setTimeout(resolve, 2500));
      } else {
        toast.error(res?.message || 'Gagal submit skor');
      }
    } catch {
      toast.error('Gagal terhubung ke server');
    } finally {
      setSubmitting(false);
    }
  };

  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const updateFullscreenState = () => {
      setIsFullscreen(!!(document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement));
    };
    document.addEventListener('fullscreenchange', updateFullscreenState);
    document.addEventListener('webkitfullscreenchange', updateFullscreenState);
    document.addEventListener('msfullscreenchange', updateFullscreenState);
    return () => {
      document.removeEventListener('fullscreenchange', updateFullscreenState);
      document.removeEventListener('webkitfullscreenchange', updateFullscreenState);
      document.removeEventListener('msfullscreenchange', updateFullscreenState);
    };
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        const elem = document.documentElement;
        if (elem.requestFullscreen) await elem.requestFullscreen();
        else if (elem.webkitRequestFullscreen) await elem.webkitRequestFullscreen();
        else if (elem.msRequestFullscreen) await elem.msRequestFullscreen();
        if (window.screen && window.screen.orientation && window.screen.orientation.lock) {
          try { await window.screen.orientation.lock('landscape'); } catch (e) { console.warn('Screen orientation lock failed:', e); }
        }
      } else {
        if (document.exitFullscreen) await document.exitFullscreen();
        else if (document.webkitExitFullscreen) await document.webkitExitFullscreen();
        else if (document.msExitFullscreen) await document.msExitFullscreen();
      }
    } catch (err) {
      console.error(`Error attempting to enable fullscreen: ${err.message}`);
    }
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

  const getLiveStandings = (participantList, completedMatchList) => {
    const standingsMap = {};
    (participantList || []).forEach(p => {
      const data = p.participant ? p.participant : p;
      if (data && data.id != null) {
        const idKey = String(data.id);
        standingsMap[idKey] = {
          id: idKey,
          name: data.name || data.display_name || 'Unknown',
          wins: 0,
          losses: 0,
          ties: 0,
          pts: 0,
          pointFinish: 0,
          final_rank: Number(data.final_rank) || 0
        };
      }
    });

    (completedMatchList || []).forEach(m => {
      const match = m.match ? m.match : m;
      const state = match.state || m.state;
      if (state === 'complete' || state === 'completed') {
        const wId = match.winner_id != null ? String(match.winner_id) : null;
        const p1Id = match.player1_id != null ? String(match.player1_id) : null;
        const p2Id = match.player2_id != null ? String(match.player2_id) : null;
        let lId = match.loser_id != null ? String(match.loser_id) : null;
        if (wId && !lId) {
          if (wId === p1Id) lId = p2Id;
          else if (wId === p2Id) lId = p1Id;
        }

        if (wId && standingsMap[wId]) standingsMap[wId].wins += 1;
        if (lId && standingsMap[lId]) standingsMap[lId].losses += 1;

        const p1Score = Number(match.player1_score) || 0;
        const p2Score = Number(match.player2_score) || 0;
        if (p1Id && standingsMap[p1Id]) {
          standingsMap[p1Id].pointFinish += p1Score;
          standingsMap[p1Id].pts += p1Score;
        }
        if (p2Id && standingsMap[p2Id]) {
          standingsMap[p2Id].pointFinish += p2Score;
          standingsMap[p2Id].pts += p2Score;
        }
      }
    });

    const standings = Object.values(standingsMap);
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

  const liveStandings = getLiveStandings(participants, completedMatches);

  return (
      <div className="min-h-screen bg-transparent text-blue-400 font-mono">
      {/* STATE 1: MATCH SELECTOR */}
      {state === 'selector' && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-md mx-auto p-6 space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-3xl md:text-4xl font-black text-white italic tracking-wider uppercase mb-1 drop-shadow-md">REFEREE HUD</h2>
            <p className="text-[10px] md:text-xs font-bold text-slate-400 tracking-[0.3em] uppercase mb-8">Arena Scoreboard // Challonge Link</p>
          </div>

          <div className="w-full p-6 md:p-8 rounded-[2rem] bg-slate-800/30 border border-white/5 shadow-sm flex flex-col items-center">
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
              <div className="flex flex-col items-center justify-center w-full gap-2">
                <p className="text-[10px] font-black text-blue-400/60 uppercase tracking-widest">Arena Scoreboard</p>
                <p className="text-[10px] md:text-xs font-bold text-slate-500 tracking-[0.2em] uppercase">Active Event</p>
                <p className="text-xl lg:text-2xl font-black text-green-400 drop-shadow-[0_0_10px_rgba(74,222,128,0.4)] tracking-wide uppercase text-center px-4">{activeEventName}</p>
                {activeEventWaktu && (
                  <p className="text-xs font-bold text-blue-300/80 tracking-wider uppercase">
                    {activeEventWaktu}
                  </p>
                )}
                <button
                  type="button"
                  onClick={handleSyncMatches}
                  disabled={isSyncing || loading}
                  title="Refresh data"
                  className="flex items-center justify-center gap-2 px-5 py-2 mt-2 rounded-full bg-slate-800/80 border border-slate-600 hover:bg-blue-600 hover:border-blue-400 transition-colors text-xs font-bold text-slate-300 hover:text-white uppercase tracking-widest disabled:opacity-50"
                >
                  {isSyncing ? <RefreshCw className="animate-spin" size={16} /> : '🔄 SYNC MATCHES'}
                </button>
              </div>
            )}
          </div>

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
                      className="w-full p-5 md:p-6 rounded-3xl bg-slate-800/30 border border-white/5 hover:border-white/10 hover:bg-slate-700/40 transition-all duration-300 flex flex-col gap-1 cursor-pointer group"
                    >
                      <div className="w-full flex flex-col items-center justify-center border-b border-white/5 pb-3 mb-3">
                        <span className="text-xs lg:text-sm font-black text-blue-400 tracking-widest uppercase mb-1">
                          {m.round < 0 ? `LOWER BRACKET ${-m.round}` : `ROUND ${m.round}`} • MATCH {m.suggested_play_order ?? idx + 1}
                        </span>
                      </div>
                      <div className="flex flex-col items-center justify-center w-full text-center mt-2">
                        <p className="text-lg md:text-xl font-black text-white group-hover:text-blue-300 transition-colors tracking-tight text-center">{m.player1_name}</p>
                        <p className="text-xs font-bold italic text-red-500/80 my-1 text-center">VS</p>
                        <p className="text-lg md:text-xl font-black text-white group-hover:text-blue-300 transition-colors tracking-tight text-center">{m.player2_name}</p>
                      </div>
                    </button>
                  ))}
                </motion.div>
              )}

              {tournamentState === 'underway' && !loading && Array.isArray(matches) && matches.length === 0 && (
                <div className="w-full max-w-2xl mx-auto bg-slate-900/50 border border-slate-700 border-dashed rounded-2xl p-8 lg:p-12 flex flex-col items-center justify-center gap-3 mt-4">
                  <span className="text-4xl lg:text-5xl opacity-50 mb-2">📭</span>
                  <p className="text-slate-400 font-bold tracking-widest uppercase text-xs lg:text-sm text-center">
                    No Open Matches Available
                  </p>
                  <p className="text-slate-500 text-[10px] lg:text-xs text-center max-w-xs">
                    API returned empty matches. Please check your Challonge bracket state (are matches pending or waiting to be started?).
                  </p>
                </div>
              )}

              {(tournamentState === 'underway' || tournamentState === 'complete' || tournamentState === 'awaiting_review') && !loading && liveStandings.length > 0 && (
                <>
                  <div className="mt-8 w-full max-w-2xl mx-auto">
                    <h3 className="text-xl text-yellow-400 font-bold mb-4 tracking-widest">KLASEMEN LIGA</h3>
                  <div className="overflow-x-auto w-full">
                    <table className="w-full text-sm text-left text-gray-300 border-collapse">
                      <thead>
                        <tr className="border-b-2 border-blue-900">
                          <th className="py-4 px-4 text-[10px] font-black text-blue-400 uppercase tracking-wider text-center">Posisi</th>
                          <th className="py-4 px-4 text-[10px] font-black text-blue-400 uppercase tracking-wider text-center">Pemain</th>
                          <th className="py-4 px-4 text-[10px] font-black text-blue-400 uppercase tracking-wider text-center whitespace-nowrap">W - L</th>
                          <th className="py-4 px-4 text-[10px] font-black text-blue-400 uppercase tracking-wider text-center">Point Finish</th>
                          <th className="py-4 px-4 text-[10px] font-black text-blue-400 uppercase tracking-wider text-center">Opsional Point</th>
                          <th className="py-4 px-4 text-[10px] font-black text-blue-400 uppercase tracking-wider text-center">Poin Liga</th>
                        </tr>
                      </thead>
                      <tbody>
                        {liveStandings.map((p, i) => (
                          <tr key={p.id} className="border-b border-blue-900 hover:bg-slate-800/50 transition-colors">
                            <td className="py-3 px-4 text-center">
                              <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-black ${i === 0 ? 'bg-yellow-400 text-black' : i === 1 ? 'bg-gray-300 text-black' : i === 2 ? 'bg-orange-400 text-black' : 'bg-blue-400/20 text-blue-400'}`}>
                                {i + 1}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-left">
                              <div className="flex-1 min-w-[110px] text-left px-2">
                                <span className="font-black text-blue-300 tracking-tighter text-sm md:text-base whitespace-nowrap block truncate">{p.name}</span>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-center font-mono text-xs font-bold whitespace-nowrap">
                              {`${p.wins} - ${p.losses}`}
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
                    onClick={handleOpenExport}
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

      {showExportModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-[#1e293b] rounded-[2rem] p-6 shadow-2xl border border-slate-700">
            <h3 className="text-lg font-black text-white italic uppercase tracking-tighter mb-2">
              REKAP KE SPREADSHEET
            </h3>
            <p className="text-xs text-gray-400 mb-4">
              Nama Sheet tujuan akan disesuaikan otomatis dengan nama event aktif.
            </p>

            <label className="text-[10px] font-black text-blue-500 uppercase ml-2 mb-1 block italic tracking-widest">
              Nama Target Sheet
            </label>
            <input
              type="text"
              value={exportSheetName}
              onChange={(e) => setExportSheetName(e.target.value)}
              className="w-full bg-slate-800 text-gray-200 rounded-full px-4 py-3 font-bold outline-none border border-slate-600 focus:border-blue-400 transition-all mb-6"
            />

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowExportModal(false)}
                className="flex-1 py-3 bg-gray-700 text-gray-300 rounded-xl font-black uppercase italic text-xs active:scale-95 transition-all"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={executeExport}
                disabled={isExporting || !exportSheetName.trim()}
                className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-black uppercase italic text-xs shadow-lg shadow-emerald-900/50 active:scale-95 transition-all flex justify-center items-center disabled:opacity-50"
              >
                {isExporting ? 'Mengirim...' : 'Rekap Sekarang'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STATE 2: SCOREBOARD HUD */}
      {state === 'hud' && selectedMatch && (
        <>
          <div className={`fixed inset-0 z-[999] bg-[#0a0a0a] overflow-hidden flex items-center justify-center ${isFullscreen ? 'w-screen h-screen' : ''}`}>
            <button
              type="button"
              onClick={toggleFullscreen}
              className="absolute top-4 right-4 z-50 p-3 rounded-full bg-slate-900/90 border border-slate-700 text-slate-400 hover:text-white hover:border-blue-500 transition-colors"
              title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
            >
              {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
            </button>
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
              className="absolute inset-0 z-50 flex items-center justify-center w-full h-full overflow-y-auto bg-black/95 backdrop-blur-md p-4 lg:p-8"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, type: 'spring' }}
            >
              {/* CONTAINER UTAMA (Max Width membatasi agar tidak mepet layar) */}
              <div className="w-full max-w-4xl mx-auto flex flex-col items-center justify-center py-4 lg:py-0">
                
                {/* HEADER PEMENANG */}
                <div className="flex flex-col items-center justify-center mb-4 lg:mb-10 w-full">
                  <h2 className="text-[30px] lg:text-sm font-bold text-green-500 tracking-[0.3em] lg:tracking-[0.5em] uppercase mb-2 animate-pulse text-center">
                    Match Winner
                  </h2>
                  <div className="flex flex-row items-center justify-center gap-3 lg:gap-6 text-3xl lg:text-7xl font-black text-yellow-400 drop-shadow-[0_0_15px_rgba(250,204,21,0.6)] italic tracking-tight w-full px-4">
                    <motion.div
                      className="text-yellow-400 drop-shadow-[0_0_50px_rgba(250,204,21,0.6)] flex items-center flex-shrink-0"
                      animate={{ y: [0, -6, 0] }}
                      transition={{ repeat: Infinity, duration: 2 }}
                    >
                      <Trophy className="w-8 h-8 lg:w-16 lg:h-16"/>
                    </motion.div>
                    <p className="truncate max-w-full text-center text-5xl lg:text-8xl">{winnerName}</p>
                  </div>
                </div>

                {/* SCOREBOARD: FLEX-1 BALANCING */}
                <div className="w-full flex flex-row items-stretch justify-center gap-3 lg:gap-8 px-2 lg:px-0">
                  
                  {/* PLAYER 1 CARD */}
                  <div className="flex-1 bg-slate-900/80 border border-slate-700 rounded-2xl lg:rounded-[2rem] p-3 py-5 lg:p-8 flex flex-col items-center justify-center gap-3 lg:gap-6 shadow-xl overflow-hidden min-w-0">
                    <p className="text-[9px] lg:text-xs font-bold text-slate-500 tracking-widest uppercase">Player 1</p>
                    <p className="text-sm lg:text-2xl font-black text-white text-center leading-tight truncate w-full px-1">{selectedMatch.player1_name}</p>
                    <div className="flex items-center gap-3 lg:gap-6 mt-1 lg:mt-2">
                      <motion.button
                        whileTap={{ scale: 0.8 }}
                        onClick={() => adjustPreviewScore('p1', -1)}
                        className="w-10 h-10 lg:w-14 lg:h-14 bg-slate-800 border-2 border-slate-600 rounded-lg lg:rounded-2xl flex items-center justify-center text-lg lg:text-2xl font-bold text-slate-300 hover:bg-blue-600 hover:border-blue-400 hover:text-white transition-all flex-shrink-0"
                      >
                        -
                      </motion.button>
                      <span className="text-3xl lg:text-5xl font-black text-white w-8 lg:w-16 text-center">{previewScores?.p1 ?? 0}</span>
                      <motion.button
                        whileTap={{ scale: 0.8 }}
                        onClick={() => adjustPreviewScore('p1', 1)}
                        className="w-10 h-10 lg:w-14 lg:h-14 bg-slate-800 border-2 border-slate-600 rounded-lg lg:rounded-2xl flex items-center justify-center text-lg lg:text-2xl font-bold text-slate-300 hover:bg-blue-600 hover:border-blue-400 hover:text-white transition-all flex-shrink-0"
                      >
                        +
                      </motion.button>
                    </div>
                  </div>

                  {/* SEPARATOR (Desktop Only) */}
                  <div className="hidden lg:flex flex-col justify-center items-center">
                     <span className="text-5xl font-black text-slate-600 pb-12">:</span>
                  </div>

                  {/* PLAYER 2 CARD */}
                  <div className="flex-1 bg-slate-900/80 border border-slate-700 rounded-2xl lg:rounded-[2rem] p-3 py-5 lg:p-8 flex flex-col items-center justify-center gap-3 lg:gap-6 shadow-xl overflow-hidden min-w-0">
                    <p className="text-[9px] lg:text-xs font-bold text-slate-500 tracking-widest uppercase">Player 2</p>
                    <p className="text-sm lg:text-2xl font-black text-white text-center leading-tight truncate w-full px-1">{selectedMatch.player2_name}</p>
                    <div className="flex items-center gap-3 lg:gap-6 mt-1 lg:mt-2">
                      <motion.button
                        whileTap={{ scale: 0.8 }}
                        onClick={() => adjustPreviewScore('p2', -1)}
                        className="w-10 h-10 lg:w-14 lg:h-14 bg-slate-800 border-2 border-slate-600 rounded-lg lg:rounded-2xl flex items-center justify-center text-lg lg:text-2xl font-bold text-slate-300 hover:bg-blue-600 hover:border-blue-400 hover:text-white transition-all flex-shrink-0"
                      >
                        -
                      </motion.button>
                      <span className="text-3xl lg:text-5xl font-black text-white w-8 lg:w-16 text-center">{previewScores?.p2 ?? 0}</span>
                      <motion.button
                        whileTap={{ scale: 0.8 }}
                        onClick={() => adjustPreviewScore('p2', 1)}
                        className="w-10 h-10 lg:w-14 lg:h-14 bg-slate-800 border-2 border-slate-600 rounded-lg lg:rounded-2xl flex items-center justify-center text-lg lg:text-2xl font-bold text-slate-300 hover:bg-blue-600 hover:border-blue-400 hover:text-white transition-all flex-shrink-0"
                      >
                        +
                      </motion.button>
                    </div>
                  </div>

                </div>

                {/* ACTION BUTTONS */}
                <div className="w-full flex flex-row gap-3 lg:gap-6 mt-6 lg:mt-12 px-2 lg:px-0">
                  <motion.button
                    type="button"
                    onClick={resetMatch}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.95 }}
                    className="flex-1 py-3 lg:py-5 bg-slate-800 rounded-xl lg:rounded-2xl border-2 border-slate-600 text-slate-300 text-xs lg:text-sm font-bold tracking-widest hover:bg-slate-700 transition-colors uppercase"
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    type="button"
                    onClick={handleSubmit}
                    disabled={submitting}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.95 }}
                    className="flex-[2] py-3 lg:py-5 bg-blue-600 rounded-xl lg:rounded-2xl border border-blue-500 text-white text-xs lg:text-sm font-black tracking-widest hover:bg-blue-500 shadow-[0_0_20px_rgba(37,99,235,0.4)] transition-all active:scale-95 uppercase flex items-center justify-center gap-2 lg:gap-3 disabled:opacity-50"
                  >
                    {submitting ? <Loader2 className="animate-spin w-4 h-4 lg:w-5 lg:h-5"/> : <Trophy className="w-4 h-4 lg:w-5 lg:h-5"/>}
                    <span className="truncate">{submitting ? 'Submitting...' : 'Submit Score'}</span>
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
                            <p className="text-xs lg:text-sm font-black text-blue-400 tracking-widest uppercase mb-1">{match.round < 0 ? `LOWER BRACKET ${-match.round}` : `ROUND ${match.round}`} • MATCH {match.identifier || match.suggested_play_order || index + 1}</p>
                            <p className="text-xl lg:text-2xl font-black text-white group-hover:text-blue-300 transition-colors tracking-tight truncate">{match.player1_name}</p>
                            <p className="text-sm font-bold italic text-red-500/80 my-1">VS</p>
                            <p className="text-xl lg:text-2xl font-black text-white group-hover:text-blue-300 transition-colors tracking-tight truncate">{match.player2_name}</p>
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
