import { useState, useEffect, useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Trophy, MapPin, Clock8, Users, ChevronDown, Crown, Medal, Star } from 'lucide-react';
import UserAvatar from './UserAvatar';
import PublicNavbar from './PublicNavbar';
import { getActiveDecksByGoogleId, getBeybladeParts } from '../utils/api';
import logoLalapan from '../assets/icon.png';
import { useNavigate } from 'react-router-dom';

const PART_IMAGE_GLOB = import.meta.glob('../assets/beyblade/**/*.png', { eager: true, query: '?url', import: 'default' });
const PART_IMAGE_GLOB_LOWERCASE = Object.fromEntries(
  Object.entries(PART_IMAGE_GLOB).map(([key, url]) => [key.toLowerCase(), url])
);

const PART_TYPE_TO_FOLDER = {
  'BLADE': 'blade',
  'METAL BLADE': 'blade',
  'MAIN BLADE': 'blade',
  'OVER_BLADE': 'over-blade',
  'OVER BLADE': 'over-blade',
  'ASSIST': 'assist-blade',
  'ASSIST_BLADE': 'assist-blade',
  'ASSIST BLADE': 'assist-blade',
  'LOCK_CHIP': 'lock-chip',
  'LOCK CHIP': 'lock-chip',
  'RATCHET': 'ratchet',
  'BIT': 'bit'
};

const getPartImage = (part) => {
  if (!part || !part.partId) return '';

  const normalizedType = String(part.partType || '')
    .trim()
    .toUpperCase();

  const folder = PART_TYPE_TO_FOLDER[normalizedType];
  if (!folder) return '';

  const partIdKey = `../assets/beyblade/${folder}/${part.partId}.png`;
  const partIdLower = partIdKey.toLowerCase();

  if (PART_IMAGE_GLOB_LOWERCASE[partIdLower]) {
    return PART_IMAGE_GLOB_LOWERCASE[partIdLower];
  }

  if (part.name) {
    const nameKey = `../assets/beyblade/${folder}/${String(part.name).trim()}.png`;
    const nameLower = nameKey.toLowerCase();

    if (PART_IMAGE_GLOB_LOWERCASE[nameLower]) {
      return PART_IMAGE_GLOB_LOWERCASE[nameLower];
    }
  }

  return '';
};

const getChampionComboName = (deck) => {
  if (!deck) return '';

  const getName = (part) => part?.name || part?.partId || '';

  return [
    getName(deck.lockChip),
    getName(deck.blade),
    getName(deck.overBlade),
    getName(deck.assistBlade),
    getName(deck.ratchet),
    getName(deck.bit)
  ].filter(Boolean).join(' ');
};

const normalizePartType = (type) => {
  const value = String(type || '').trim().toUpperCase();

  const aliases = {
    'MAIN BLADE': 'BLADE',
    'METAL BLADE': 'BLADE',
    'ASSIST': 'ASSIST_BLADE',
    'ASSIST BLADE': 'ASSIST_BLADE',
    'LOCK CHIP': 'LOCK_CHIP',
    'OVER BLADE': 'OVER_BLADE',
  };

  return aliases[value] || value;
};

const hydrateChampionPart = (part, partsMap) => {
  if (!part?.partId) return null;

  const partId = String(part.partId).trim();
  const dbPart =
    partsMap[partId] ||
    partsMap[partId.toUpperCase()] ||
    partsMap[partId.toLowerCase()];

  if (dbPart) {
    return {
      ...dbPart,
      ...part,
      // Data inventory adalah source of truth untuk name/type.
      name: dbPart.name || part.name || partId,
      partType: dbPart.partType || part.partType || '',
      isActive: dbPart.isActive ?? part.isActive,
    };
  }

  // Fallback agar asset tetap bisa dicari untuk data lama yang
  // hanya membawa part_id.
  const prefix = partId.substring(0, 2).toUpperCase();
  const inferredType = {
    BL: 'BLADE',
    OB: 'OVER_BLADE',
    AB: 'ASSIST_BLADE',
    LC: 'LOCK_CHIP',
    RT: 'RATCHET',
    BT: 'BIT',
  }[prefix];

  return {
    ...part,
    partId,
    partType: normalizePartType(part.partType || inferredType),
    name: part.name || partId,
  };
};

const hydrateChampionDeck = (deck, partsMap) => {
  if (!deck) return deck;

  return {
    ...deck,
    lockChip: hydrateChampionPart(deck.lockChip, partsMap),
    blade: hydrateChampionPart(deck.blade, partsMap),
    overBlade: hydrateChampionPart(deck.overBlade, partsMap),
    assistBlade: hydrateChampionPart(deck.assistBlade, partsMap),
    ratchet: hydrateChampionPart(deck.ratchet, partsMap),
    bit: hydrateChampionPart(deck.bit, partsMap),
  };
};

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.6, ease: 'easeOut' }
  })
};

const pulseGlow = {
  animate: {
    opacity: [0.4, 1, 0.4],
    scale: [1, 1.05, 1],
    transition: { duration: 2, repeat: Infinity, ease: 'easeInOut' }
  }
};

const getRankConfig = (index) => {
  if (index === 0) return {
    label: '1st',
    color: 'text-yellow-400',
    bg: 'bg-gradient-to-br from-yellow-500/20 to-orange-500/10',
    border: 'border-yellow-500/40',
    shadow: 'shadow-[0_0_30px_rgba(234,179,8,0.25)]',
    icon: <Crown className="text-yellow-400" size={20} />
  };
  if (index === 1) return {
    label: '2nd',
    color: 'text-gray-300',
    bg: 'bg-gradient-to-br from-gray-400/15 to-gray-500/10',
    border: 'border-gray-400/30',
    shadow: 'shadow-[0_0_20px_rgba(156,163,175,0.15)]',
    icon: <Medal className="text-gray-300" size={18} />
  };
  return {
    label: '3rd',
    color: 'text-orange-500',
    bg: 'bg-gradient-to-br from-orange-600/15 to-orange-700/10',
    border: 'border-orange-500/30',
    shadow: 'shadow-[0_0_20px_rgba(249,115,22,0.15)]',
    icon: <Star className="text-orange-500" size={18} />
  };
};

export default function LandingPage({ leaderboard = [], currentEvent = null, isLoadingPublic = false, onGoogleLogin }) {
  const [isScrolled, setIsScrolled] = useState(false);
  const top3Ref = useRef(null);
  const eventRef = useRef(null);
  const highlightRef = useRef(null);
  const ctaRef = useRef(null);
  const [championDecks, setChampionDecks] = useState([]);
  const [championDeckLoading, setChampionDeckLoading] = useState(false);
  const navigate = useNavigate();

  const sortedLeaderboard = Array.isArray(leaderboard)
    ? [...leaderboard].sort((a, b) => {
      const ptsA = Number(a.point) || 0;
      const ptsB = Number(b.point) || 0;
      if (ptsB !== ptsA) return ptsB - ptsA;
      const finA = Number(a.pointFinish) || 0;
      const finB = Number(b.pointFinish) || 0;
      return finB - finA;
    })
    : [];
  const top3 = sortedLeaderboard.slice(0, 3);
  const totalBladers = Array.isArray(leaderboard) ? leaderboard.length : 0;
  const champion = Array.isArray(leaderboard)
    ? leaderboard.find(item => Number(item?.rank) === 1) || sortedLeaderboard[0] || null
    : null;

  useEffect(() => {
    let cancelled = false;

    const loadChampionDecks = async () => {
      const googleId = champion?.googleId || champion?.google_id;
      if (!googleId) {
        setChampionDecks([]);
        return;
      }

      setChampionDeckLoading(true);
      try {
        const [response, partsResponse] = await Promise.all([
          getActiveDecksByGoogleId(googleId),
          getBeybladeParts(),
        ]);

        if (cancelled) return;

        const partsList = Array.isArray(partsResponse?.parts)
          ? partsResponse.parts
          : [];

        const partsMap = {};
        partsList.forEach((part) => {
          if (!part?.partId) return;
          const id = String(part.partId).trim();
          partsMap[id] = part;
          partsMap[id.toUpperCase()] = part;
          partsMap[id.toLowerCase()] = part;
        });

        const decks = Array.isArray(response?.decks)
          ? response.decks.map((deck) => hydrateChampionDeck(deck, partsMap))
          : [];

        setChampionDecks(decks);
      } catch (error) {
        if (cancelled) return;
        console.error('Gagal memuat deck juara:', error);
        setChampionDecks([]);
      } finally {
        if (!cancelled) setChampionDeckLoading(false);
      }
    };

    loadChampionDecks();
    return () => { cancelled = true; };
  }, [champion?.googleId, champion?.google_id]);

  const scrollToSection = (ref) => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 text-white overflow-x-hidden font-sans">
      {/* Background Grid Pattern */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '60px 60px'
        }}
      />

      <PublicNavbar onGoogleLogin={onGoogleLogin} />

      {/* ===== HERO SECTION ===== */}
      <section className="relative pt-32 pb-20 md:pt-40 md:pb-32 px-6 overflow-hidden">
        {/* Radial Gradient Background */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(37,99,235,0.15)_0%,transparent_60%)] pointer-events-none" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[100px] pointer-events-none" />

        <div className="relative z-10 max-w-6xl mx-auto flex flex-col-reverse md:flex-row items-center justify-between gap-12 lg:gap-20">
          {/* Kolom Kiri - Teks & Tombol */}
          <div className="flex-1 text-center md:text-left">
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.8 }}
              className="text-[10px] sm:text-xs font-black text-gray-400 uppercase tracking-[0.3em] mb-4"
            >
              Selamat Datang Di
            </motion.p>

            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.8 }}
              className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black italic uppercase tracking-tighter leading-[0.85] py-2 mb-6"
            >
              <span className="py-2 pr-4 bg-gradient-to-r from-white via-blue-100 to-gray-300 bg-clip-text text-transparent">
                LALAPAN
              </span>
              <br />
              <span className="py-2 pr-4 bg-gradient-to-r from-blue-400 via-blue-500 to-purple-500 bg-clip-text text-transparent">
                BEYBLADE
              </span>
              <br />
              <span className="py-2 pr-4 text-3xl sm:text-4xl md:text-5xl font-black italic tracking-tight text-gray-400">
                LAMONGAN
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.8 }}
              className="text-sm md:text-base font-bold text-gray-400 mb-2 max-w-2xl leading-relaxed"
            >
              Community Beyblade X Regional Lamongan
            </motion.p>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.8 }}
              className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-8 md:mb-10 max-w-xl"
            >
              Arena • Rankings • Events • Bladers
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.8 }}
              className="flex flex-col sm:flex-row items-center justify-center md:justify-start gap-4"
            >
              <button
                type="button"
                onClick={() => scrollToSection(top3Ref)}
                className="group relative px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-500 rounded-2xl font-black uppercase italic text-sm shadow-2xl shadow-blue-600/40 hover:shadow-blue-500/60 hover:scale-105 active:scale-95 transition-all duration-300 overflow-hidden"
              >
                <span className="relative z-10 flex items-center gap-2">
                  <Trophy size={18} />
                  View Ranking
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </button>

              <button
                type="button"
                onClick={() => scrollToSection(eventRef)}
                className="group relative px-8 py-4 bg-transparent border-2 border-white/10 rounded-2xl font-black uppercase italic text-sm text-gray-300 hover:border-white/30 hover:text-white hover:scale-105 active:scale-95 transition-all duration-300 overflow-hidden"
              >
                <span className="relative z-10 flex items-center gap-2">
                  <MapPin size={18} />
                  Next Event
                </span>
              </button>
            </motion.div>
          </div>

          {/* Kolom Kanan - Visual Logo */}
          <div className="flex-1 relative flex flex-col justify-center items-center w-full">
            <div className="relative">
              <div className="absolute w-64 h-64 md:w-96 md:h-96 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full blur-[100px] opacity-20 animate-pulse" />
              <motion.img
                src={logoLalapan}
                alt="Lalapan Beyblade"
                className="relative w-64 h-64 md:w-96 md:h-96 object-contain drop-shadow-[0_0_30px_rgba(59,130,246,0.6)]"
                animate={{ y: [0, -20, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              />
            </div>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/30"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
              </span>
              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-400">System Online</span>
            </motion.div>
          </div>
        </div>

        {/* Scroll Indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5, duration: 1 }}
          className="flex flex-col items-center gap-2 mt-16"
        >
          <span className="text-[9px] font-black text-gray-600 uppercase tracking-[0.3em]">Scroll</span>
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            className="w-5 h-8 rounded-full border-2 border-gray-700 flex items-start justify-center p-1"
          >
            <motion.div
              animate={{ y: [0, 10, 0], opacity: [1, 0.3, 1] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
              className="w-1 h-2 bg-gray-500 rounded-full"
            />
          </motion.div>
        </motion.div>
      </section>

      {/* ===== QUICK ACCESS & LIVE DATA ===== */}
      <section className="relative py-16 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* TOP 3 LEADERBOARD CARD */}
            <motion.div
              ref={top3Ref}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-80px' }}
              className="bg-gray-900/80 backdrop-blur-sm rounded-[2rem] border border-white/5 p-6 md:p-8 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center">
                    <Trophy className="text-yellow-400" size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black uppercase italic tracking-tight">Top 3 Bladers</h3>
                    <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Peringkat Saat Ini</p>
                  </div>
                </div>
                <span className="text-[10px] font-black text-yellow-400 uppercase tracking-wider animate-pulse">
                  Live
                </span>
              </div>

              <div className="space-y-3">
                {isLoadingPublic ? (
                  <div className="text-center py-10">
                    <div className="inline-block w-6 h-6 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin mb-3" />
                    <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Memuat Data Klasemen...</p>
                  </div>
                ) : top3.length === 0 ? (
                  <div className="text-center py-10">
                    <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Belum ada data klasemen</p>
                  </div>
                ) : (
                  top3.map((item, index) => {
                    const rankConfig = getRankConfig(index);
                    return (
                      <motion.div
                        key={item.name}
                        custom={index}
                        variants={fadeUp}
                        initial="hidden"
                        animate="visible"
                        whileHover={{ scale: 1.02, y: -2 }}
                        className={`relative flex items-center gap-4 p-4 rounded-2xl border ${rankConfig.bg} ${rankConfig.border} ${rankConfig.shadow} transition-all cursor-default`}
                      >
                        <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gray-900/60 border border-white/5 flex flex-col items-center justify-center">
                          <span className={`text-lg font-black ${rankConfig.color}`}>{rankConfig.label}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <UserAvatar
                              src={item.foto}
                              name={item.name}
                              className="w-8 h-8 rounded-lg border-2 border-gray-700 object-cover"
                            />
                            <p className="text-sm font-black tracking-tight truncate">{item.name}</p>
                          </div>
                          {item.slogan && (
                            <p className="text-[9px] text-gray-500 font-bold mt-1 truncate italic">
                              &ldquo;{item.slogan}&rdquo;
                            </p>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-lg font-black text-white italic">{item.point ?? 0}</p>
                          <p className="text-[8px] text-gray-500 font-black uppercase tracking-wider">Pts</p>
                        </div>
                        {index === 0 && (
                          <div className="absolute -top-2 -right-2">
                            <div className="w-8 h-8 rounded-full bg-yellow-500 flex items-center justify-center shadow-lg shadow-yellow-500/50">
                              {rankConfig.icon}
                            </div>
                          </div>
                        )}
                      </motion.div>
                    );
                  })
                )}
              </div>

              <div className="mt-4 pt-4 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => {
                    navigate('/ranking');
                    window.scrollTo(0, 0);
                  }}
                  className="w-full py-3 rounded-xl bg-gray-800/50 border border-white/5 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-white hover:border-white/10 transition-all"
                >
                  Lihat Klasemen Lengkap
                </button>
              </div>
            </motion.div>

            {/* NEXT MATCH / EVENT CARD */}
            <motion.div
              ref={eventRef}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-80px' }}
              className="bg-gray-900/80 backdrop-blur-sm rounded-[2rem] border border-white/5 p-6 md:p-8 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center">
                    <MapPin className="text-blue-400" size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black uppercase italic tracking-tight">Event Aktif</h3>
                    <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Jadwal Turnamen</p>
                  </div>
                </div>
                {currentEvent && (
                  <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/30">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                    </span>
                    <span className="text-[9px] font-black text-green-400 uppercase tracking-wider">Live</span>
                  </span>
                )}
              </div>

              {isLoadingPublic ? (
                <div className="text-center py-14 bg-gray-900/40 rounded-[1.5rem] border border-dashed border-gray-800">
                  <div className="inline-block w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mb-3" />
                  <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Mencari Jadwal Arena...</p>
                </div>
              ) : currentEvent ? (
                <div className="relative bg-gradient-to-br from-blue-900/40 to-gray-900/40 rounded-[1.5rem] p-6 border border-blue-500/20 overflow-hidden">
                  <div className="absolute -right-6 -top-6 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
                  <div className="relative z-10">
                    <span className="inline-block px-3 py-1 rounded-full bg-blue-500/20 text-blue-400 text-[9px] font-black uppercase tracking-widest mb-4">
                      Arena Active
                    </span>
                    <h4 className="text-xl md:text-2xl font-black italic uppercase tracking-tight leading-tight mb-4">
                      {currentEvent.nama}
                    </h4>
                    <div className="space-y-2.5">
                      {currentEvent.lokasi && (
                        <div className="flex items-center gap-2.5 text-xs font-bold text-gray-300">
                          <div className="w-7 h-7 rounded-lg bg-gray-800/80 flex items-center justify-center flex-shrink-0">
                            <MapPin size={14} className="text-gray-400" />
                          </div>
                          <span>{currentEvent.lokasi}</span>
                        </div>
                      )}
                      {currentEvent.waktu && (
                        <div className="flex items-center gap-2.5 text-xs font-bold text-gray-300">
                          <div className="w-7 h-7 rounded-lg bg-gray-800/80 flex items-center justify-center flex-shrink-0">
                            <Clock8 size={14} className="text-gray-400" />
                          </div>
                          <span>{currentEvent.waktu}</span>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          navigate('/events');
                          window.scrollTo(0, 0);
                        }}
                        className="w-full mt-5 py-3 rounded-xl bg-gray-800/50 border border-white/5 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-white hover:border-blue-400/30 hover:bg-blue-500/10 transition-all"
                      >
                        Lihat Detail Event
                      </button>
                      {currentEvent.count !== undefined && (
                        <div className="flex items-center gap-2.5 text-xs font-bold text-gray-300">
                          <div className="w-7 h-7 rounded-lg bg-gray-800/80 flex items-center justify-center flex-shrink-0">
                            <Users size={14} className="text-gray-400" />
                          </div>
                          <span>{currentEvent.count} Bladers Ready</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-14 bg-gray-900/40 rounded-[1.5rem] border border-dashed border-gray-800">
                  <div className="w-16 h-16 rounded-2xl bg-gray-800/50 flex items-center justify-center mx-auto mb-4">
                    <CalendarIcon className="text-gray-600" size={28} />
                  </div>
                  <p className="text-sm font-black text-gray-600 uppercase tracking-wider mb-1">
                    Belum Ada Jadwal
                  </p>
                  <p className="text-[10px] text-gray-700 font-bold uppercase tracking-wider">
                    Turnumen terdekat belum ditentukan
                  </p>
                </div>
              )}

              <div className="mt-4 pt-4 border-t border-white/5">
                <p className="text-[9px] font-black text-gray-600 uppercase tracking-widest text-center">
                  Event dibuat oleh Panitia Lalapan
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ===== CHAMPION DECK SECTION ===== */}
      <section ref={highlightRef} className="relative py-16 px-6">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            className="text-center mb-10"
          >
            <span className="inline-block px-4 py-2 rounded-full bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-[10px] font-black uppercase tracking-[0.2em] mb-4">
              Champion Deck
            </span>
            <h2 className="text-3xl md:text-4xl font-black italic uppercase tracking-tight">
              <span className="bg-gradient-to-r from-yellow-300 via-orange-400 to-yellow-500 bg-clip-text text-transparent">
                Deck Sang Juara
              </span>
            </h2>
            <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mt-3 max-w-2xl mx-auto">
              Build aktif milik blader peringkat #1 pada klasemen saat ini
            </p>
          </motion.div>

          {!champion ? (
            <div className="text-center py-12 bg-gray-900/60 rounded-[1.5rem] border border-white/5">
              <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest">
                Belum ada juara aktif
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                  <UserAvatar
                    src={champion.foto}
                    name={champion.name}
                    className="w-12 h-12 rounded-xl border-2 border-yellow-500/30 object-cover"
                  />
                  <div>
                    <p className="text-[9px] font-black text-yellow-400 uppercase tracking-widest">Rank #1</p>
                    <h3 className="text-xl font-black italic uppercase tracking-tight">{champion.name || 'Unknown Blader'}</h3>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const profileId = champion.publicProfileId || champion.public_profile_id;
                    if (profileId) {
                      navigate(`/bladers/${profileId}`);
                    }
                  }}
                  className="px-5 py-2.5 rounded-xl bg-gray-800/60 border border-white/10 text-[10px] font-black uppercase tracking-widest text-gray-300 hover:text-white hover:border-yellow-500/30 transition-all"
                >
                  Lihat Profil Juara
                </button>
              </div>

              {championDeckLoading ? (
                <div className="text-center py-12 bg-gray-900/60 rounded-[1.5rem] border border-white/5">
                  <div className="inline-block w-6 h-6 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin mb-3" />
                  <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Memuat deck juara...</p>
                </div>
              ) : championDecks.length === 0 ? (
                <div className="text-center py-12 bg-gray-900/60 rounded-[1.5rem] border border-dashed border-gray-800">
                  <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest">
                    Juara belum memiliki deck aktif
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                  {championDecks.map((deck, index) => (
                    <motion.div
                      key={deck.deckId || index}
                      custom={index}
                      variants={fadeUp}
                      initial="hidden"
                      whileInView="visible"
                      viewport={{ once: true, margin: '-40px' }}
                      className="group bg-gray-900/70 backdrop-blur-sm rounded-[1.5rem] p-5 border border-white/5 hover:border-yellow-500/20 transition-all"
                    >
                      <div className="flex items-center justify-between gap-3 mb-4">
                        <div>
                          <p className="text-[9px] font-black text-yellow-400 uppercase tracking-widest">Combo Deck {index + 1}</p>
                          <h4
                            className="text-sm sm:text-base font-black tracking-tight leading-tight line-clamp-2 min-h-[2.5rem] pr-2"
                            title={getChampionComboName(deck) || deck.deckName || 'Unnamed Deck'}
                          >
                            {getChampionComboName(deck) || deck.deckName || 'Unnamed Deck'}
                          </h4>
                        </div>
                        <span className="shrink-0 px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/30 text-[8px] font-black text-green-400 uppercase tracking-widest">
                          {deck.system || 'Beyblade X'}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        {[
                          ['Lock Chip', deck.lockChip],
                          ['Blade', deck.blade],
                          ['Over Blade', deck.overBlade],
                          ['Assist Blade', deck.assistBlade],
                          ['Ratchet', deck.ratchet],
                          ['Bit', deck.bit]
                        ].filter(([, part]) => part).map(([label, part]) => {
                          const image = getPartImage(part);
                          return (
                            <motion.div
                              key={label}
                              whileHover={{ y: -4, scale: 1.015 }}
                              transition={{ type: 'spring', stiffness: 320, damping: 22 }}
                              className="group relative aspect-square min-h-0 rounded-2xl bg-gray-950/70 border border-white/5 overflow-hidden p-4 flex flex-col items-center text-center hover:border-yellow-500/30 hover:bg-gray-950/90 transition-colors"
                            >
                              <div className="relative z-10 w-full shrink-0">
                                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                                  {label}
                                </p>
                              </div>

                              <div className="flex-1 w-full min-h-0 flex items-center justify-center py-2">
                                {image ? (
                                  <img
                                    src={image}
                                    alt={part.name || part.partId}
                                    className="w-32 h-32 sm:w-36 sm:h-36 object-contain drop-shadow-[0_0_18px_rgba(59,130,246,0.22)] transition-transform duration-300 group-hover:scale-[1.08]"
                                    loading="lazy"
                                  />
                                ) : (
                                  <div className="w-16 h-16 rounded-full border border-white/5 bg-gray-900/60 flex items-center justify-center text-[9px] font-black text-gray-700">
                                    NO IMG
                                  </div>
                                )}
                              </div>

                              <div className="relative z-10 w-full shrink-0 pt-1">
                                <p className="text-[12px] sm:text-[13px] font-black text-white uppercase tracking-tight truncate">
                                  {part.name || part.partId}
                                </p>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>

                      {deck.description && (
                        <p className="text-[10px] text-gray-500 font-medium leading-relaxed mt-4">
                          {deck.description}
                        </p>
                      )}
                    </motion.div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* ===== ABOUT US ===== */}
      <section className="relative py-16 px-6">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="bg-gray-900/80 backdrop-blur-sm rounded-[2.5rem] border border-white/5 p-6 md:p-8 shadow-2xl"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              <div className="relative flex items-center justify-center">
                <div className="absolute w-48 h-48 md:w-64 md:h-64 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full blur-2xl opacity-30 animate-pulse" />
                <img
                  src={logoLalapan}
                  alt="Lalapan Beyblade"
                  className="relative w-48 h-48 md:w-64 md:h-64 object-contain drop-shadow-[0_0_15px_rgba(255,255,255,0.15)]"
                />
              </div>
              <div>
                <span className="inline-block px-3 py-1 rounded-full bg-blue-500/20 text-blue-400 text-[9px] font-black uppercase tracking-widest mb-4">
                  Profile Komunitas
                </span>
                <h2 className="text-2xl md:text-3xl font-black italic uppercase tracking-tight mb-4">
                  WE ARE{' '}
                  <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                    LALAPAN BEYBLADE
                  </span>
                </h2>
                <p className="text-sm text-gray-400 font-medium leading-relaxed mb-6">
                  Lalapan Beyblade adalah wadah resmi berkumpulnya para Blader di regional Lamongan. Lebih dari sekadar hobi, ini adalah medan tempur tempat strategi diracik, mekanik diadu, dan persaudaraan ditempa di atas arena.
                </p>
                <div className="flex items-center gap-4">
                  <div>
                    <p className="text-[9px] text-gray-500 font-black uppercase tracking-wider">Established</p>
                    <p className="text-sm font-black text-white">2024</p>
                  </div>
                  <div className="w-px h-8 bg-white/10" />
                  <div>
                    <p className="text-[9px] text-gray-500 font-black uppercase tracking-wider">Homebase</p>
                    <p className="text-sm font-black text-white">Lamongan</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ===== MEMBERSHIP CTA ===== */}
      <section ref={ctaRef} className="relative py-16 px-6">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            variants={fadeUp}
            className="relative bg-gradient-to-br from-blue-900/40 via-gray-900/80 to-purple-900/40 rounded-[2.5rem] p-8 md:p-12 border border-white/10 overflow-hidden"
          >
            {/* Decorative Elements */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-[80px] pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-500/10 rounded-full blur-[60px] pointer-events-none" />

            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="flex-1 text-center md:text-left">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-6">
                  <Users size={14} className="text-blue-400" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-300">
                    Komunitas Resmi
                  </span>
                </div>
                <h3 className="text-3xl md:text-4xl font-black italic uppercase tracking-tight mb-4 leading-tight">
                  Siap Menguasai
                  <span className="block bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                    Arena?
                  </span>
                </h3>
                <p className="text-gray-400 text-sm font-medium max-w-md leading-relaxed">
                  Bergabung dengan ratusan blader di Lamongan. Dapatkan info turnamen mingguan, tips build, dan jadwal kumpul langsung dari grup WhatsApp.
                </p>
              </div>

              <motion.a
                href="#"
                target="_blank"
                rel="noopener noreferrer"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="group relative inline-flex items-center gap-3 px-8 py-5 bg-gradient-to-r from-green-600 to-emerald-500 rounded-2xl font-black uppercase italic text-sm shadow-2xl shadow-green-600/40 hover:shadow-green-500/60 transition-all duration-300 flex-shrink-0"
              >
                <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.365.195 1.88.118.574-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
                <span>Gabung Grup WhatsApp</span>
                <ChevronDown size={16} className="rotate-[-90deg] group-hover:translate-x-0.5 transition-transform" />
              </motion.a>
            </div>

            {/* Trust Badges */}
            <div className="relative z-10 flex flex-wrap items-center justify-center md:justify-start gap-6 mt-8 pt-8 border-t border-white/5">
              <div className="text-center">
                <p className="text-xl font-black text-white">{totalBladers}+</p>
                <p className="text-[9px] font-black text-gray-500 uppercase tracking-wider">Bladers</p>
              </div>
              <div className="w-px h-8 bg-white/5" />
              <div className="text-center">
                <p className="text-xl font-black text-white">Weekly</p>
                <p className="text-[9px] font-black text-gray-500 uppercase tracking-wider">Turnamen</p>
              </div>
              <div className="w-px h-8 bg-white/5" />
              <div className="text-center">
                <p className="text-xl font-black text-white">100%</p>
                <p className="text-[9px] font-black text-gray-500 uppercase tracking-wider">Fair Play</p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="relative border-t border-white/5 bg-gray-950/80 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <img
                  src={logoLalapan}
                  alt="Lalapan Beyblade"
                  className="w-10 h-10 md:w-12 md:h-12 object-contain drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]"
                />
              </div>
              <div>
                <h4 className="text-sm font-black uppercase italic tracking-tight">LALAPAN BEYBLADE</h4>
                <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Lamongan Regional</p>
              </div>
            </div>

            <div className="text-center md:text-right">
              <p className="text-[11px] font-bold text-gray-400 mb-1.5">
                Titik Kumpul :
              </p>
              <p className="text-xs font-black text-gray-300 uppercase tracking-tight italic">
                Pasar Tingkat Lamongan
              </p>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mt-1">
                Setiap Jumat 20.00 WIB
              </p>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest">
              2026 Lalapan Beyblade X Lamongan. All rights reserved.
            </p>
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[9px] font-black text-gray-600 uppercase tracking-wider">System Online</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function CalendarIcon({ size = 28, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <circle cx="8" cy="15" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="12" cy="15" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="16" cy="15" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}
