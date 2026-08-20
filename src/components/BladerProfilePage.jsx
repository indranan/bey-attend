import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Users, Trophy, Calendar, ExternalLink } from 'lucide-react';
import PublicNavbar from './PublicNavbar';
import { getBladerProfile } from '../utils/api';
import PublicDeckShowcase from './PublicDeckShowcase';

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.4, ease: 'easeOut' }
  })
};

const getRoleBadge = (role) => {
  const r = String(role || '').toLowerCase();
  if (r === 'admin') return { label: 'ADMIN', color: 'bg-red-500/20 text-red-400 border-red-500/30' };
  return { label: 'BLADER', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' };
};

const getMovementBadge = (status) => {
  const s = String(status || '').toLowerCase().trim();
  if (s === 'up') return { label: '↑ UP', color: 'text-green-400' };
  if (s === 'down') return { label: '↓ DOWN', color: 'text-red-400' };
  if (s === 'stay') return { label: '→ STAY', color: 'text-gray-400' };
  if (s === 'new') return { label: '★ NEW', color: 'text-yellow-400' };
  return null;
};

export default function BladerProfilePage() {
  const { profileId } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);



  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      try {
        const res = await getBladerProfile(profileId);
        if (res?.status === 'success') {
          setProfile(res);
        } else {
          setProfile(null);
        }
      } catch (err) {
        console.error('[BLADER PROFILE API ERROR]', err);
        setProfile(null);
      } finally {
        setLoading(false);
      }
    };
    if (profileId) fetchProfile();
  }, [profileId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white">
        <PublicNavbar />
        <div className="max-w-6xl mx-auto px-6 pt-20 pb-12">
          <div className="text-center py-20">
            <div className="inline-block w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Loading profile...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-950 text-white">
        <PublicNavbar />
        <div className="max-w-6xl mx-auto px-6 pt-20 pb-12 text-center">
          <h1 className="text-2xl font-black text-red-400 uppercase italic tracking-tighter mb-4">
            {profileId ? 'BLADER NOT FOUND' : 'MISSING PROFILE ID'}
          </h1>
          <p className="text-xs text-gray-500 font-bold mb-6">
            {profileId ? `Profile ID "${profileId}" tidak ditemukan di database.` : 'Tidak ada profile ID di URL.'}
          </p>
          <button
            type="button"
            onClick={() => navigate('/bladers')}
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-2xl font-black uppercase italic text-sm shadow-lg shadow-blue-600/30 hover:shadow-blue-500/50 transition-all active:scale-95"
          >
            <ArrowLeft size={16} /> BACK TO BLADERS
          </button>
        </div>
      </div>
    );
  }

  const { player, leaderboard, tournamentSummary, recentResults } = profile || {};
  const safePlayer = player || {};
  const safeLeaderboard = leaderboard || {};
  const safeTournamentSummary = tournamentSummary || {};
  const safeRecentResults = Array.isArray(recentResults) ? recentResults : [];

  const roleBadge = getRoleBadge(safePlayer.role);
  const movementBadge = getMovementBadge(safeLeaderboard?.status);
  const isUnranked = safeLeaderboard?.rank === null || safeLeaderboard?.rank === undefined;

  return (
    <div className="min-h-screen bg-gray-950 text-white overflow-x-hidden">
      {/* Background Grid Pattern - matching Landing Page */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '60px 60px'
        }}
      />

      <PublicNavbar />

      <div className="max-w-6xl mx-auto px-6 pt-24 pb-16">
        {/* Back Navigation */}
        <motion.button
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={() => navigate('/bladers')}
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors group"
        >
          <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
          <span className="text-[10px] font-black uppercase tracking-widest">Back to Bladers</span>
        </motion.button>

        {/* Profile Header - Compact, matching Landing Page card style */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gray-900/80 backdrop-blur-sm rounded-[2rem] border border-white/5 p-6 md:p-8 shadow-2xl mb-6"
        >
          <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              <div className="absolute -inset-1 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-full blur opacity-60" />
              {safePlayer.photoUrl ? (
                <img
                  src={safePlayer.photoUrl}
                  alt={safePlayer.nickname}
                  className="relative w-24 h-24 md:w-28 md:h-28 rounded-full object-cover border-2 border-white/10"
                />
              ) : (
                <div className="relative w-24 h-24 md:w-28 md:h-28 rounded-full bg-gray-800 border-2 border-white/10 flex items-center justify-center text-gray-400">
                  <Users size={40} />
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 text-center md:text-left">
              <div className="flex flex-col md:flex-row items-center gap-3 mb-2">
                <h1 className="text-2xl md:text-3xl font-black text-white uppercase italic tracking-tighter">
                  {safePlayer.nickname || 'Unknown Blader'}
                </h1>
                <span className={`inline-block px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${roleBadge.color}`}>
                  {roleBadge.label}
                </span>
              </div>
              {safePlayer.slogan && (
                <p className="text-sm text-gray-400 italic mt-1">
                  &ldquo;{safePlayer.slogan}&rdquo;
                </p>
              )}
            </div>
          </div>
        </motion.div>

        {/* Stats - Compact single row */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gray-900/80 backdrop-blur-sm rounded-[2rem] border border-white/5 p-6 md:p-8 shadow-2xl mb-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center">
                <Trophy className="text-yellow-400" size={20} />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase italic tracking-tight">Current Rank</h3>
                <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Leaderboard Position</p>
              </div>
            </div>
            {movementBadge && (
              <span className={`text-[10px] font-black uppercase tracking-widest ${movementBadge.color}`}>
                {movementBadge.label}
              </span>
            )}
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 bg-gray-800/40 rounded-2xl border border-white/5">
              <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">Rank</p>
              <p className="text-2xl font-black text-white">
                {isUnranked ? '--' : '#' + safeLeaderboard.rank}
              </p>
            </div>
            <div className="text-center p-4 bg-gray-800/40 rounded-2xl border border-white/5">
              <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">Points</p>
              <p className="text-2xl font-black text-white">
                {safeLeaderboard?.point || 0}
                <span className="text-xs text-gray-400 ml-1">PTS</span>
              </p>
            </div>
            <div className="text-center p-4 bg-gray-800/40 rounded-2xl border border-white/5">
              <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">Finish</p>
              <p className="text-2xl font-black text-white">
                {safeLeaderboard?.pointFinish || 0}
                <span className="text-xs text-gray-400 ml-1">FIN</span>
              </p>
            </div>
          </div>
        </motion.div>

        {/* Recent Results */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gray-900/80 backdrop-blur-sm rounded-[2rem] border border-white/5 p-6 md:p-8 shadow-2xl mb-6"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center">
                <Calendar className="text-blue-400" size={20} />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase italic tracking-tight">Recent Results</h3>
                <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Tournament History</p>
              </div>
            </div>
            {safeTournamentSummary?.tournamentsPlayed > 0 && (
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">
                {safeTournamentSummary.tournamentsPlayed} Played
              </span>
            )}
          </div>

          {safeRecentResults.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest">No tournament results yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {safeRecentResults.map((result, idx) => (
                <motion.div
                  key={result.eventId + idx}
                  custom={idx}
                  variants={fadeUp}
                  initial="hidden"
                  animate="visible"
                  className="group flex flex-col md:flex-row md:items-center gap-4 p-4 bg-gray-800/40 rounded-2xl border border-white/5 hover:border-white/10 transition-all"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-white truncate group-hover:text-blue-300 transition-colors">
                      {result.eventName}
                    </p>
                    {result.eventDate && (
                      <p className="text-[10px] text-gray-500 font-bold mt-0.5">
                        {result.eventDate}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Rank</p>
                      <p className="text-sm font-black text-white">#{result.rank}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Points</p>
                      <p className="text-sm font-black text-white">{result.point} <span className="text-[10px] text-gray-400">PTS</span></p>
                    </div>
                    <div className="text-center">
                      <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Finish</p>
                      <p className="text-sm font-black text-white">{result.pointFinish} <span className="text-[10px] text-gray-400">FIN</span></p>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate(`/events/${result.eventId}`)}
                      className="inline-flex items-center gap-1 bg-blue-600/20 text-blue-400 border border-blue-500/30 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600/30 transition-colors flex-shrink-0"
                    >
                      <ExternalLink size={12} /> VIEW
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>

        {/* ACTIVE DECKS — same visual language as Landing Page */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-gray-900/80 backdrop-blur-sm rounded-[2rem] border border-white/5 p-6 md:p-8 shadow-2xl mb-6"
        >
          <div className="mb-6">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-yellow-400">Active Decks</p>
            <h3 className="mt-1 text-xl font-black uppercase italic text-white">Combo Deck</h3>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mt-1">3 deck aktif terakhir milik blader ini</p>
          </div>
          <PublicDeckShowcase decks={Array.isArray(profile.decks) ? profile.decks.slice(0, 3) : []} />
        </motion.div>
      </div>
    </div>
  );
}
