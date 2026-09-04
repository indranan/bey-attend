import { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MapPin, Clock8, Users, ExternalLink, ArrowLeft, Trophy, AlertTriangle, BookOpen, Loader2 } from 'lucide-react';
import UserAvatar from './UserAvatar';
import PublicNavbar from './PublicNavbar';
import GoogleSignInButton from './GoogleSignInButton';
import { AuthContext } from '../context/AuthContext';
import { getFromGas, postToGas } from '../utils/api';
import toast from 'react-hot-toast';

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.4, ease: 'easeOut' }
  })
};

const formatTanggalIndonesia = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  }).format(date);
};

const getEventDisplayTime = (event) => {
  if (!event) return '';

  const tanggal = formatTanggalIndonesia(event.tanggal_event);
  const waktu = event.waktu_event || event.waktu || '';

  if (tanggal && waktu) {
    return `${tanggal} • ${waktu}`;
  }

  return tanggal || waktu;
};

const getEventDateOnly = (event) => {
  if (!event) return '';
  return formatTanggalIndonesia(event.tanggal_event || '');
};

const getEventTimeOnly = (event) => {
  if (!event) return '';
  return event.waktu_event || event.waktu || '';
};

export default function EventDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [eventDetail, setEventDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAttending, setIsAttending] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const { user, login, currentPlayer } = useContext(AuthContext);

  const handleLogin = async (userData) => {
    try {
      await login(userData);
      toast.success('Berhasil masuk. Kamu sekarang bisa check-in.');
    } catch (error) {
      console.error('Gagal login dari halaman event:', error);
      toast.error('Login gagal. Silakan coba lagi.');
    }
  };

  useEffect(() => {
    let cancelled = false;
    const fetchDetail = async () => {
      if (!id) {
        setEventDetail(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      const data = await getFromGas('getEventDetail', true, { eventId: String(id) });
      if (!cancelled) {
        setEventDetail(data || null);
        setLoading(false);
      }
    };
    fetchDetail();
    return () => { cancelled = true; };
  }, [id]);

  const event = eventDetail?.event || null;
  const participants = Array.isArray(eventDetail?.participants) ? eventDetail.participants : [];
  const count = Number(eventDetail?.count || 0);
  const results = Array.isArray(eventDetail?.results) ? eventDetail.results : [];
  const matchups = Array.isArray(eventDetail?.matchups) ? eventDetail.matchups : [];
  const isMatch = event && String(event.id) === String(id);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white">
        <PublicNavbar />
        <div className="max-w-5xl mx-auto px-6 pt-20 pb-12">
          <div className="text-center py-20">
            <div className="inline-block w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Memuat data event...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!isMatch || !event) {
    return (
      <div className="min-h-screen bg-gray-950 text-white">
        <PublicNavbar />
        <div className="max-w-5xl mx-auto px-6 pt-20 pb-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-20"
          >
            <CalendarIcon className="text-gray-700 mx-auto mb-4" size={48} />
            <h2 className="text-2xl font-black text-gray-400 uppercase italic tracking-tighter mb-2">
              Event Tidak Ditemukan
            </h2>
            <p className="text-sm text-gray-600 font-bold mb-8">
              Event yang kamu cari tidak tersedia atau sudah berakhir.
            </p>
            <motion.button
              type="button"
              onClick={() => navigate('/events')}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-500 px-8 py-4 rounded-2xl font-black uppercase italic text-sm shadow-2xl shadow-blue-600/40 hover:shadow-blue-500/60 transition-all"
            >
              <ArrowLeft size={18} />
              Back to Events
            </motion.button>
          </motion.div>
        </div>
      </div>
    );
  }

  const hasResults = results.length > 0;
  const isCompleted = hasResults || String(event.status || '').toLowerCase() === 'selesai';
  const eventStatus = String(event?.status || '').toLowerCase().trim();
  const tournamentStatus = String(event?.tournament_status || '').toLowerCase().trim() || 'not_started';
  const isLive = eventStatus === 'aktif';
  const isUpcoming = eventStatus === 'upcoming';

  const currentUserId = String(user?.sub || '').trim();
  const isCheckedIn = participants.some(
    (p) => String(p.googleId || '').trim() === currentUserId
  );

  const handleAttend = async () => {
    if (!event?.id || !user?.sub) return;
    setIsAttending(true);
    try {
      const res = await postToGas('attendance', {
        eventId: event.id,
        googleId: user.sub,
        nickname: currentPlayer?.nickname || user?.name || 'Blader',
        email: user?.email || '',
        foto: user?.picture || ''
      });
      if (res?.status === 'success') {
        toast?.success?.('Ready to Battle!');
        setEventDetail(prev => prev ? {
          ...prev,
          count: (prev.count || 0) + 1,
          participants: [
            ...(prev.participants || []),
            {
              googleId: user.sub,
              nama: currentPlayer?.nickname || user?.name || 'Blader',
              email: user?.email || '',
              foto: user?.picture || ''
            }
          ]
        } : prev);
      } else {
        toast?.error?.(res?.message || 'Gagal mengirim absensi');
      }
    } catch {
      toast?.error?.('Gagal mengirim absensi');
    } finally {
      setIsAttending(false);
    }
  };

  const handleCancelAttendance = async () => {
    if (!event?.id || !user?.sub) return;
    setIsCancelling(true);
    try {
      const res = await postToGas('cancelAttendance', {
        eventId: event.id,
        googleId: user.sub
      });
      if (res?.status === 'success') {
        toast?.success?.('Berhasil batal hadir');
        setEventDetail(prev => prev ? { ...prev, count: Math.max((prev.count || 0) - 1, 0), participants: (prev.participants || []).filter(p => String(p.googleId || '').trim() !== currentUserId) } : prev);
      } else {
        toast?.error?.(res?.message || 'Gagal membatalkan kehadiran');
      }
    } catch {
      toast?.error?.('Gagal membatalkan kehadiran');
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <PublicNavbar />

      <div className="max-w-5xl mx-auto px-6 pt-20 pb-12">
        {/* Top Back Button */}
        <motion.button
          type="button"
          onClick={() => navigate('/events')}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="inline-flex items-center gap-2 text-gray-500 hover:text-white transition-colors text-[10px] font-black uppercase tracking-widest mb-8"
        >
          <ArrowLeft size={16} />
          Back to Events
        </motion.button>

        {/* Hero Event */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-10"
        >
          <div className="bg-gray-900/80 backdrop-blur-sm rounded-[2.5rem] border border-white/5 overflow-hidden">
            <div className="p-6 md:p-8">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <span className={`inline-block px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                        isLive ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                        isUpcoming ? 'bg-gray-500/20 text-gray-400 border border-gray-500/30' :
                        'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                      }`}>
                        {isLive ? 'LIVE EVENT' : isUpcoming ? 'UPCOMING' : 'COMPLETED'}
                      </span>
                      {isLive && (
                        <span className={`inline-block px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                          tournamentStatus === 'not_started' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' :
                          tournamentStatus === 'running' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                          tournamentStatus === 'finished' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' :
                          'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                        }`}>
                          {tournamentStatus === 'not_started' ? 'CHECK-IN OPEN' :
                           tournamentStatus === 'running' ? 'TOURNAMENT RUNNING' :
                           tournamentStatus === 'finished' ? 'TOURNAMENT FINISHED' :
                           String(tournamentStatus).toUpperCase()}
                        </span>
                      )}
                    </div>
                   <h1 className="text-2xl md:text-4xl font-black italic uppercase tracking-tight leading-tight">
                     {event.nama}
                   </h1>
                 </div>
                <div className="flex items-center gap-2 text-gray-400">
                  <Users size={18} />
                  <span className="text-sm font-black">{count} Bladers</span>
                </div>
              </div>
            </div>

            <div className="absolute -right-10 -top-10 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
          </div>
        </motion.div>

        {/* Your Attendance */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="mb-10"
        >
          <div className="bg-gray-900/80 backdrop-blur-sm rounded-[2.5rem] border border-white/5 p-6 md:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
              <h2 className="text-lg font-black uppercase italic tracking-tight">Your Attendance</h2>
              {isLive && (
                <div className="flex items-center gap-2 text-gray-400">
                  <Users size={18} />
                  <span className="text-sm font-black">{count} Players</span>
                </div>
              )}
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                {isUpcoming && (
                  <p className="text-sm text-gray-400 font-bold">Pendaftaran dibuka saat acara/event dimulai.</p>
                )}
                {isCompleted && (
                  <p className="text-sm text-gray-400 font-bold">Attendance Closed</p>
                )}
                {isLive && tournamentStatus === 'finished' && (
                  <p className="text-sm text-gray-400 font-bold">Attendance Closed</p>
                )}
                {isLive && tournamentStatus === 'running' && !isCheckedIn && (
                  <p className="text-sm text-gray-400 font-bold">Check-in closed. Tournament has started.</p>
                )}
                {isLive && tournamentStatus !== 'started' && tournamentStatus !== 'finished' && !user && (
                  <p className="text-sm text-gray-400 font-bold">Sign in to join this event.</p>
                )}
                {isLive && tournamentStatus !== 'started' && tournamentStatus !== 'finished' && user && !isCheckedIn && (
                  <p className="text-sm text-gray-400 font-bold">Ready to battle? Check in now.</p>
                )}
                {isLive && user && isCheckedIn && (
                  <div className="flex items-center gap-2 text-green-400 font-black">
                    <div className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" />
                    You&apos;re checked in
                  </div>
                )}
              </div>
              <div>
                {isUpcoming && (
                  <span className="inline-block px-4 py-2 rounded-full bg-gray-500/20 text-gray-400 border border-gray-500/30 text-[10px] font-black uppercase tracking-widest">
                    Upcoming
                  </span>
                )}
                {isCompleted && (
                  <span className="inline-block px-4 py-2 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 text-[10px] font-black uppercase tracking-widest">
                    Completed
                  </span>
                )}
                {isLive && !user && (
                  <GoogleSignInButton
                    onLogin={handleLogin}
                    label="Sign In to Join"
                    className="!bg-gradient-to-r !from-primary !to-blue-500 !border-0 !px-6 !py-3 !h-auto !rounded-2xl !font-black !uppercase !italic !text-sm !text-white !shadow-lg !shadow-primary/30"
                  />
                )}
                {isLive && tournamentStatus !== 'running' && tournamentStatus !== 'finished' && user && !isCheckedIn && (
                  <motion.button
                    type="button"
                    onClick={handleAttend}
                    disabled={isAttending}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="inline-flex items-center gap-2 bg-gradient-to-r from-primary to-blue-500 px-6 py-3 rounded-2xl font-black uppercase italic text-sm shadow-lg shadow-primary/30 transition-all disabled:opacity-50"
                  >
                    {isAttending ? <Loader2 className="animate-spin" size={14} /> : 'I\'m Ready!'}
                  </motion.button>
                )}
                {isLive && user && isCheckedIn && tournamentStatus !== 'running' && tournamentStatus !== 'finished' && (
                  <motion.button
                    type="button"
                    onClick={handleCancelAttendance}
                    disabled={isCancelling}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="inline-flex items-center gap-2 bg-red-500/20 border border-red-300/30 text-red-100 px-6 py-3 rounded-2xl font-black uppercase italic text-sm transition-all hover:bg-red-500 hover:text-white disabled:opacity-50"
                  >
                    {isCancelling ? '...' : 'Cancel Attendance'}
                  </motion.button>
                )}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Event Overview */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mb-10"
        >
          <div className="bg-gray-900/80 backdrop-blur-sm rounded-[2.5rem] border border-white/5 p-6 md:p-8">
            <h2 className="text-lg font-black uppercase italic tracking-tight mb-6">Event Overview</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <InfoCard label="PLAYERS" value={`${count} Players`} />
                {event.lokasi && <InfoCard label="LOCATION" value={event.lokasi} />}
                {getEventDateOnly(event) && <InfoCard label="DATE" value={getEventDateOnly(event)} />}
                {getEventTimeOnly(event) && <InfoCard label="START TIME" value={getEventTimeOnly(event)} />}
              </div>
          </div>
        </motion.div>

        {/* Event Rules */}
        {eventDetail?.rule ? (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18 }}
            className="mb-10"
          >
            <div className="bg-gray-900/80 backdrop-blur-sm rounded-[2.5rem] border border-white/5 p-6 md:p-8">
              <h2 className="text-lg font-black uppercase italic tracking-tight mb-4">Event Rules</h2>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Rule:</span>
                  <span className="text-sm font-black text-white">{eventDetail.rule.title || eventDetail.rule.nama}</span>
                </div>
                {eventDetail.rule.periode && (
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Periode:</span>
                    <span className="text-xs font-bold text-gray-400">{eventDetail.rule.periode}</span>
                  </div>
                )}
              </div>

              <div className="mt-6">
                <motion.button
                  type="button"
                  onClick={() => navigate(`/rules/${event.rule_id}`)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="inline-flex items-center justify-center bg-gradient-to-r from-purple-600 to-purple-500 px-8 py-4 rounded-2xl font-black uppercase italic text-sm shadow-2xl shadow-purple-600/40 hover:shadow-purple-500/60 transition-all"
                >
                  View Full Rule →
                </motion.button>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18 }}
            className="mb-10"
          >
            <div className="bg-gray-900/80 backdrop-blur-sm rounded-[2.5rem] border border-white/5 p-6 md:p-8">
              <h2 className="text-lg font-black uppercase italic tracking-tight mb-2">Event Rules</h2>
              <p className="text-sm text-gray-400 font-bold">Aturan event belum ditentukan.</p>
            </div>
          </motion.div>
        )}

        {/* Tournament */}
        {event.challongeUrl && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-10"
          >
            <div className="bg-gray-900/80 backdrop-blur-sm rounded-[2.5rem] border border-white/5 p-6 md:p-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center">
                  <Trophy className="text-yellow-400" size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase italic tracking-tight">Tournament</h3>
                  <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">
                    Managed via Challonge
                  </p>
                </div>
              </div>

              <p className="text-sm font-bold text-gray-300 mb-6">
                Bracket dan pertandingan turnamen dikelola melalui Challonge.
              </p>

              <motion.a
                href={event.challongeUrl}
                target="_blank"
                rel="noopener noreferrer"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-500 px-8 py-4 rounded-2xl font-black uppercase italic text-sm shadow-2xl shadow-blue-600/40 hover:shadow-blue-500/60 transition-all"
              >
                <ExternalLink size={18} />
                Open Challonge
              </motion.a>
            </div>
          </motion.div>
        )}

        {/* Matchups */}
        {matchups.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.19 }}
            className="mb-10"
          >
            <div className="bg-gray-900/80 backdrop-blur-sm rounded-[2.5rem] border border-white/5 p-6 md:p-8">
              <div className="flex items-center justify-between gap-4 mb-6">
                <div>
                  <h3 className="text-sm font-black uppercase italic tracking-tight">Matchups</h3>
                  <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest mt-1">
                    Pairing pemain dari bracket tournament
                  </p>
                </div>
                <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest">
                  {matchups.length} Matches
                </span>
              </div>

              <div className="space-y-3">
                {matchups.map((m) => {
                  const isLower = Number(m.round) < 0 || m.bracket === 'LOWER';
                  const completed = m.is_completed || m.state === 'complete' || m.state === 'completed';
                  return (
                    <div
                      key={m.match_id}
                      className={`rounded-2xl border p-4 md:p-5 ${completed ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-white/5 bg-white/[0.02]'}`}
                    >
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <span className={`text-[9px] font-black uppercase tracking-widest ${isLower ? 'text-orange-400' : 'text-blue-400'}`}>
                          {isLower ? `LOWER BRACKET ${Math.abs(Number(m.round) || 1)}` : `ROUND ${m.round || 1}`}
                          {m.display_match_number ? ` • MATCH ${m.display_match_number}` : ''}
                        </span>
                        <span className={`text-[8px] font-black uppercase tracking-widest ${completed ? 'text-emerald-400' : 'text-gray-600'}`}>
                          {completed ? 'COMPLETED' : 'OPEN'}
                        </span>
                      </div>

                      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                        <p className="min-w-0 text-sm md:text-base font-black text-white truncate text-right">{m.player1_name}</p>
                        <span className="text-[9px] font-black italic text-red-400">VS</span>
                        <p className="min-w-0 text-sm md:text-base font-black text-white truncate">{m.player2_name}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}

        {/* Final Results */}
        {hasResults && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-10"
          >
            <div className="bg-gray-900/80 backdrop-blur-sm rounded-[2.5rem] border border-white/5 p-6 md:p-8">
              <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
                <div>
                  <h3 className="text-sm font-black uppercase italic tracking-tight">Final Results</h3>
                  <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest mt-1">
                    POIN LIGA = poin klasemen berdasar posisi akhir &nbsp;|&nbsp; W-L = jumlah menang-kalah &nbsp;|&nbsp; FINISH = total poin hasil pertandingan
                  </p>
                </div>
              </div>

              {/* Column Headers */}
              <div className="grid grid-cols-[auto_1fr_auto_auto_auto] md:grid-cols-[auto_1fr_auto_auto_auto] gap-x-6 gap-y-2 items-center mb-2">
                <div className="flex-shrink-0 w-8 text-center">
                  <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">POS</span>
                </div>
                <div className="min-w-0">
                  <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">BLADER</span>
                </div>
                <div className="flex-shrink-0 text-right">
                  <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">POIN LIGA</span>
                </div>
                <div className="flex-shrink-0 text-right w-14">
                  <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">W-L</span>
                </div>
                <div className="flex-shrink-0 text-right w-14">
                  <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">FINISH</span>
                </div>
              </div>

              {/* Divider */}
              <div className="grid grid-cols-[auto_1fr_auto_auto_auto] md:grid-cols-[auto_1fr_auto_auto_auto] gap-x-6 gap-y-2 items-center mb-1">
                <div className="col-span-full h-px bg-white/5" />
              </div>

              {/* Results Rows */}
              <div className="grid grid-cols-[auto_1fr_auto_auto_auto] md:grid-cols-[auto_1fr_auto_auto_auto] gap-x-6 gap-y-2 items-center">
                {results.map((r, idx) => {
                  const rank = idx + 1;
                  const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null;
                  const isTop = rank <= 3;
                  return (
                    <div
                      key={idx}
                      className="contents"
                    >
                      <div className="flex-shrink-0 w-8 text-center">
                        {medal ? <span className="text-xl">{medal}</span> : <span className="text-xs font-black text-gray-500">{String(rank).padStart(2, '0')}</span>}
                      </div>
                      <div className="min-w-0">
                        <p className={`tracking-tight truncate ${isTop ? 'text-sm font-black' : 'text-xs font-black text-gray-300'}`}>{r.nama}</p>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <p className={`font-black text-white italic ${isTop ? 'text-base' : 'text-sm'}`}>{r.point}</p>
                      </div>
                      <div className="flex-shrink-0 text-right w-14">
                        <p className={`font-bold text-gray-400 ${isTop ? 'text-sm' : 'text-xs'}`}>{r.winLoss}</p>
                      </div>
                      <div className="flex-shrink-0 text-right w-14">
                        <p className={`font-bold text-gray-400 ${isTop ? 'text-sm' : 'text-xs'}`}>{r.pointFinish}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}

        {/* Registered Bladers */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="mb-10"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center">
              <Users className="text-orange-400" size={20} />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase italic tracking-tight">Registered Bladers</h3>
              <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">
                {participants.length} Players
              </p>
            </div>
          </div>

          <div className="bg-gray-900/80 backdrop-blur-sm rounded-[2.5rem] border border-white/5 overflow-hidden">
            {participants.length > 0 ? (
              <div className="divide-y divide-white/5">
                {participants.map((p, index) => (
                  <motion.div
                    key={p.googleId || p.email || index}
                    custom={index}
                    variants={fadeUp}
                    initial="hidden"
                    animate="visible"
                    className="flex items-center gap-4 px-6 py-4 hover:bg-white/5 transition-all"
                  >
                    <div className="flex-shrink-0 w-10 text-center">
                      <span className="text-sm font-black text-gray-500">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                    </div>

                    <div className="flex-shrink-0">
                      <UserAvatar
                        src={p.foto}
                        name={p.nama}
                        className="w-10 h-10 rounded-xl border-2 border-white/10 object-cover"
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black tracking-tight truncate">
                        {p.nama}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Users className="text-gray-700 mx-auto mb-4" size={36} />
                <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest">
                  Belum ada peserta terdaftar.
                </p>
              </div>
            )}
          </div>
        </motion.div>

        {/* Back Button */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-10 text-center"
        >
          <button
            type="button"
            onClick={() => navigate('/events')}
            className="inline-flex items-center gap-2 text-gray-500 hover:text-white transition-colors text-[10px] font-black uppercase tracking-widest"
          >
            <ArrowLeft size={16} />
            Back to Events
          </button>
        </motion.div>
      </div>
    </div>
  );
}

function InfoCard({ label, value }) {
  return (
    <div className="bg-gray-800/50 rounded-2xl border border-white/5 p-4">
      <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">
        {label}
      </p>
      <p className="text-sm font-black text-white leading-snug break-words line-clamp-2">
        {value}
      </p>
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
