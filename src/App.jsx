import { useContext, useEffect, useState } from 'react';
import { AuthContext } from './context/AuthContext';
import GoogleSignInButton from './components/GoogleSignInButton';
import UserAvatar from './components/UserAvatar';
import PullToRefresh from 'react-simple-pull-to-refresh';
import { AnimatePresence, motion } from 'framer-motion';
import {
  LogOut, Loader2, MapPin, Trophy, UserCircle, ShieldCheck, Swords, Minimize, BookOpen
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { getFromGas, postToGas, updateBio, uploadProfilePhoto, updatePoints, createTournament, startTournament, randomizeParticipants } from './utils/api';
import CancelModal from './components/CancelModal';
import CreateEventModal from './components/CreateEventModal';
import EventCard from './components/EventCard';
import ParticipantList from './components/ParticipantList';
import StandingsContent from './components/StandingsContent';
import AdminContent from './components/AdminContent';
import ProfileContent from './components/ProfileContent';
import Rule from './components/Rule';
import ProfileModal from './components/ProfileModal';
import RefereeArena from './components/RefereeArena';

export default function App() {
  const { user, login, logout, updateUser } = useContext(AuthContext);

  const isValidUser = Boolean(user && user.sub && user.email);

  useEffect(() => {
    const root = document.getElementById('root');
    if (root?.style) {
      root.style.paddingTop = 'env(safe-area-inset-top)';
      root.style.paddingBottom = 'env(safe-area-inset-bottom)';
    }
  }, []);

  const [data, setData] = useState({ event: null, participants: [], count: 0, challongeUrl: '' });
  const [leaderboard, setLeaderboard] = useState([]);
  const [blader, setBlader] = useState(null);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUpdatingPoints, setIsUpdatingPoints] = useState(false);
  const [isOnboarding, setIsOnboarding] = useState(false);
  const [initError, setInitError] = useState(null);
  const [newNickname, setNewNickname] = useState('');
  const [activeTab, setActiveTab] = useState('arena');
  const [showEventModal, setShowEventModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [modalProfile, setModalProfile] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(!!(document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('webkitfullscreenchange', onFullscreenChange);
    document.addEventListener('msfullscreenchange', onFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', onFullscreenChange);
      document.removeEventListener('msfullscreenchange', onFullscreenChange);
    };
  }, []);

  const exitFullscreen = async () => {
    try {
      if (document.exitFullscreen) await document.exitFullscreen();
      else if (document.webkitExitFullscreen) await document.webkitExitFullscreen();
      else if (document.msExitFullscreen) await document.msExitFullscreen();
    } catch (err) {
      console.error("Gagal keluar dari fullscreen:", err);
    }
  };

  const refreshEvent = async () => {
    try {
      const res = await getFromGas('getEvent');
      if (res) setData(res);
    } catch (err) {
      console.error('Gagal fetch event:', err);
    }
  };

  const refreshLeaderboard = async () => {
    try {
      const res = await getFromGas('getLeaderboard', true);
      if (res && Array.isArray(res)) setLeaderboard(res);
    } catch (err) {
      console.error('Gagal fetch leaderboard:', err);
    }
  };

  const checkProfile = async () => {
    try {
      const res = await getFromGas(`getBlader&googleId=${user.sub}`);
      if (res?.registered) {
        setBlader(res);
        setIsOnboarding(false);
        if (res.foto) {
          updateUser({ ...user, picture: res.foto });
        }
      } else {
        setIsOnboarding(true);
      }
    } catch (err) {
      console.error('Gagal fetch profile:', err);
      throw err;
    }
  };

  const withTimeout = (promise, ms, label) => {
    return Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout: '+label+' (> '+ms+'ms)')), ms))
    ]);
  };

  const initApp = async () => {
    setLoading(true);
    setInitError(null);
    try {
      await Promise.all([
        withTimeout(checkProfile(), 30000, 'checkProfile'),
        withTimeout(getFromGas('getSettings').then(setSettings), 30000, 'getSettings'),
        withTimeout(refreshEvent(), 30000, 'refreshEvent'),
        withTimeout(refreshLeaderboard(), 30000, 'refreshLeaderboard'),
      ]);
    } catch (err) {
      console.error('Gagal inisialisasi app:', err);
      setInitError('Gagal memuat data. Periksa koneksi internet.');
    } finally {
      setLoading(false);
    }
  };

  const retryInit = async () => {
    await initApp();
  };

  const handleRefresh = async () => {
    window.location.reload();
  };

  useEffect(() => {
    if (user) initApp();
    else setLoading(false);
  }, [user]);

  const handleCreateProfile = async () => {
    if (newNickname.length < 3 || newNickname.length > 20) return toast.error('Nickname: 3 - 20 karakter!');
    setIsSubmitting(true);
    const checkRes = await getFromGas(`checkNickname&nickname=${newNickname}`);
    if (!checkRes?.available) {
      setIsSubmitting(false);
      return toast.error('Nickname sudah digunakan!');
    }
    const payload = { googleId: user.sub, email: user.email, googleName: user.name, nickname: newNickname, photoUrl: user.picture };
    const res = await postToGas('createProfile', payload);
    if (res?.status === 'success' || res) {
      toast.success(`Welcome, Blader ${newNickname}!`);
      await checkProfile();
    } else {
      toast.error('Gagal mendaftar');
    }
    setIsSubmitting(false);
  };

  const handleAttend = async () => {
    setIsSubmitting(true);
    const payload = { eventId: data.event.id, googleId: user.sub, nickname: blader.nickname, email: user.email, foto: blader?.photo || user.picture };
    const res = await postToGas('attendance', payload);
    if (res?.status === 'success') {
      toast.success('Ready to Battle!');
      refreshEvent();
    } else {
      toast.error(res?.message || 'Gagal mengirim absensi');
    }
    setIsSubmitting(false);
  };

  const handleSubmitEvent = async (formData) => {
    if (!formData.nama || !formData.lokasi) return toast.error('Isi semua data!');
    setIsSubmitting(true);
    const res = await postToGas('createEvent', formData);
    if (res?.status === 'success') {
      toast.success('Event Baru Aktif!');
      setShowEventModal(false);
      refreshEvent();
    } else {
      toast.error('Gagal terhubung ke server');
    }
    setIsSubmitting(false);
  };

  const handleGenerateTournament = async (opts = {}) => {
    const { format = 'weekly', swissRounds } = opts;
    if (!data?.event?.id) return toast.error('Tidak ada event aktif!');
    setIsGenerating(true);
    try {
      const challongeFormat = format === 'final' ? 'double elimination' : 'swiss';
      const createRes = await createTournament(data.event.id, challongeFormat, format === 'weekly' ? Number(swissRounds) || 3 : undefined);

      if (createRes?.status !== 'success') {
        toast.error(createRes?.message || 'Gagal generate turnamen');
        return;
      }

      const tournamentUrl = createRes.challongeUrl || data.event?.challongeUrl;

      if (format === 'weekly') {
        const loadingToast = toast.loading('Mengacak urutan pemain dan membuat bracket...');
        const randomizeRes = await randomizeParticipants({ tournament_url: tournamentUrl });
        if (randomizeRes?.status !== 'success') {
          toast.dismiss(loadingToast);
          toast.error(randomizeRes?.message || 'Gagal mengacak peserta');
          return;
        }
        const startRes = await startTournament({ tournament_url: tournamentUrl });
        toast.dismiss(loadingToast);
        if (startRes?.status === 'success') {
          toast.success('Turnamen Weekly Dimulai!');
          refreshEvent();
        } else {
          toast.error(startRes?.message || 'Gagal memulai turnamen');
        }
      } else {
        const loadingToast = toast.loading('Membuat bracket Final Double Elim...');
        const startRes = await startTournament({ tournament_url: tournamentUrl });
        toast.dismiss(loadingToast);
        if (startRes?.status === 'success') {
          toast.success('Turnamen Final Dimulai!');
          refreshEvent();
        } else {
          toast.error(startRes?.message || 'Gagal memulai turnamen');
        }
      }
    } catch {
      toast.error('Gagal generate turnamen');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCancelAttend = async () => {
    setIsSubmitting(true);
    const payload = { eventId: data.event.id, googleId: user.sub };
    const res = await postToGas('cancelAttendance', payload);
    if (res?.status === 'success') {
      toast.success('Berhasil batal hadir');
      refreshEvent();
    } else {
      toast.error(res?.message || 'Gagal membatalkan kehadiran');
    }
    setIsSubmitting(false);
  };

  const handleUpdateNickname = async (newNick) => {
    setIsSubmitting(true);
    const payload = { googleId: user.sub, newNickname: newNick };
    const res = await postToGas('updateNickname', payload);
    if (res?.status === 'success') {
      toast.success('Nickname diupdate!');
      await checkProfile();
    } else {
      toast.error('Gagal update');
    }
    setIsSubmitting(false);
  };

  const handleUpdateBio = async ({ slogan, catatan }) => {
    setIsSubmitting(true);
    const res = await updateBio({ googleId: user.sub, slogan, catatan });
    if (res?.status === 'success') {
      toast.success('Bio tersimpan!');
      await checkProfile();
    } else {
      toast.error(res?.message || 'Gagal simpan bio');
    }
    setIsSubmitting(false);
    return res;
  };

  const handleUploadPhoto = async (base64) => {
    setIsSubmitting(true);
    const res = await uploadProfilePhoto({ googleId: user.sub, base64 });
    if (res?.status === 'success') {
      toast.success('Foto profil diupdate!');
      await checkProfile();
      refreshLeaderboard();
      refreshEvent(); // agar foto di daftar peserta Arena ikut berubah
      // Update state global user agar foto di navbar (pojok kiri atas) langsung reaktif
      if (res.photoUrl) updateUser({ ...user, picture: res.photoUrl });
    } else {
      toast.error('Gagal upload foto');
    }
    setIsSubmitting(false);
  };

  const handleUpdatePoints = async ({ googleId, point, pointFinish }) => {
    setIsUpdatingPoints(true);
    const res = await updatePoints({ googleId, point, pointFinish });
    if (res?.status === 'success') {
      toast.success('Poin pemain diupdate!');
      refreshLeaderboard();
    } else {
      toast.error(res?.message || 'Gagal update poin');
    }
    setIsUpdatingPoints(false);
  };

  const handleToggleNickname = async () => {
    setIsSubmitting(true);
    const res = await postToGas('toggleNicknameSetting');
    if (res?.status === 'success') {
      toast.success('Pengaturan ganti nickname diupdate!');
      const s = await getFromGas('getSettings');
      if (s) setSettings(s);
    } else {
      toast.error(res?.message || 'Gagal update pengaturan');
    }
    setIsSubmitting(false);
  };

  const openProfile = (player) => {
    const lbIndex = leaderboard.findIndex((l) => l.googleId === player.googleId);
    const lb = lbIndex !== -1 ? leaderboard[lbIndex] : {};

    setModalProfile({
      googleId: player.googleId,
      name: player.nama || player.name || lb.name,
      foto: player.foto || lb.foto,
      slogan: lb.slogan || '',
      catatan: lb.catatan || '',
      rank: lbIndex !== -1 ? lbIndex + 1 : '-',
      point: lb.point ?? 0,
      pointFinish: lb.pointFinish ?? 0,
      role: lb.role || ''
    });
    setModalLoading(true);

    if (player.googleId) {
      getFromGas(`getBlader&googleId=${player.googleId}`).then(b => {
        if (b?.registered) {
          setModalProfile(prev => prev ? {
            ...prev,
            slogan: b.slogan || prev.slogan,
            catatan: b.catatan || prev.catatan,
            foto: b.photo || prev.foto,
            role: b.role || prev.role
          } : null);
        }
        setModalLoading(false);
      }).catch(() => {
        setModalLoading(false);
      });
    } else {
      setModalLoading(false);
    }
  };

  const closeProfile = () => {
    setModalProfile(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-dark-bg dark:text-white">
        <Loader2 className="animate-spin text-primary dark:text-white" size={40} />
      </div>
    );
  }

  if (initError && isValidUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-dark-bg p-6 text-center dark:text-white">
        <div className="w-full max-sm bg-white dark:bg-dark-card p-10 rounded-[2.5rem] shadow-xl border border-gray-100 dark:border-gray-800">
          <p className="text-red-500 font-black text-sm mb-4">{initError}</p>
          <button
            type="button"
            onClick={retryInit}
            className="px-6 py-3 bg-primary text-white rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 transition-all"
          >
            Coba Lagi
          </button>
        </div>
      </div>
    );
  }

  if (!isValidUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-dark-bg p-6 text-center dark:text-white">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-sm bg-white dark:bg-dark-card p-10 rounded-[2.5rem] shadow-xl border border-gray-100 dark:border-gray-800 dark:text-white">
          <Trophy className="text-primary mx-auto mb-4 dark:text-white" size={48} />
          <h1 className="text-3xl font-black text-primary mb-2 italic uppercase tracking-tighter dark:text-white">Lalapan Beyblade X lamongan</h1>
          <p className="text-gray-400 text-[10px] mb-8 font-black uppercase tracking-[0.3em] italic leading-tight dark:text-white">Blader Identity Presence</p>
          <div className="flex flex-col items-center gap-3">
            <GoogleSignInButton
              onLogin={async (userData) => {
                try {
                  await login(userData);
                  toast.success('Login Google berhasil!');
                } catch (err) {
                  console.error('Google login error:', err);
                  const msg = err?.message || '';
                  if (msg.includes('server_error') || msg.includes('500')) {
                    toast.error('Login Google gagal: Server error. Pastikan localhost di-whitelist di Google Cloud Console.');
                  } else {
                    toast.error('Login Google gagal: ' + msg);
                  }
                }
              }}
            />
          </div>
        </motion.div>
      </div>
    );
  }

  if (isOnboarding) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-dark-bg p-6 text-center dark:text-white">
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="max-w-sm w-full bg-white dark:bg-dark-card p-8 rounded-[2.5rem] shadow-2xl border border-gray-100 dark:border-gray-800">
          <UserCircle size={48} className="mx-auto text-primary mb-2" />
          <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase italic tracking-tighter">New Blader</h2>
          <p className="text-[10px] text-gray-500 dark:text-gray-400 font-black uppercase tracking-widest mb-8">Apa nickname Battle-mu?</p>
          <div className="space-y-6">
            <input
              type="text"
              value={newNickname}
              onChange={(e) => setNewNickname(e.target.value.replace(/[^a-zA-Z0-9_\s]/g, '').replace(/\s{2,}/g, ' '))}
              placeholder="Ex: Mail Basikal"
              className="w-full p-4 bg-gray-100 dark:bg-gray-800 rounded-2xl font-black text-center text-gray-900 dark:text-white border-2 border-transparent focus:border-primary outline-none transition-all"
            />
            <button
              type="button"
              onClick={handleCreateProfile}
              disabled={isSubmitting || newNickname.length < 3}
              className="w-full bg-primary dark:text-white py-4 rounded-2xl font-black shadow-lg shadow-primary/30 uppercase italic tracking-widest disabled:opacity-50 active:scale-95 transition-all"
            >
              {isSubmitting ? 'Registering...' : 'Start Journey'}
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-bg transition-colors duration-500 pb-28 pt-[max(env(safe-area-inset-top),1.5rem)] dark:text-white overflow-y-auto">
      <CreateEventModal
        show={showEventModal}
        onClose={() => setShowEventModal(false)}
        onSubmit={handleSubmitEvent}
        isSubmitting={isSubmitting}
      />
      <CancelModal
        show={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        onConfirm={() => {
          setShowCancelModal(false);
          handleCancelAttend();
        }}
        isSubmitting={isSubmitting}
      />
      <ProfileModal player={modalProfile} loading={modalLoading} onClose={closeProfile} />
      <Toaster position="top-center" />

      <nav className="w-full max-w-md md:max-w-3xl lg:max-w-5xl mx-auto px-4 flex justify-between items-center sticky top-0 pt-[max(env(safe-area-inset-top),1rem)] bg-gray-50 dark:bg-dark-bg backdrop-blur-lg z-50 dark:text-white">
        <div className="flex items-center gap-3 dark:text-white">
          <UserAvatar src={user.picture} name={user.name} className="w-11 h-11 rounded-2xl border-2 border-primary dark:text-white" />
          <div>
            <p className="text-[10px] font-black text-primary leading-none uppercase tracking-widest italic mb-0.5 tracking-tighter dark:text-white">Blader Profile</p>
            <p className="font-black text-sm text-gray-800 dark:text-white italic tracking-tighter truncate w-32">{blader?.nickname}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isFullscreen && (
            <button
              type="button"
              onClick={exitFullscreen}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-800 text-gray-300 hover:text-white hover:bg-slate-700 transition-all border border-slate-700"
              title="Keluar Fullscreen"
            >
              <Minimize size={18} />
            </button>
          )}
          <button type="button" onClick={logout} className="p-3 bg-red-100 text-red-600 rounded-2xl dark:bg-red-900/20 active:scale-90 transition-all"><LogOut size={20} /></button>
        </div>
      </nav>

      <PullToRefresh onRefresh={handleRefresh}>
        <main className="w-full max-w-md md:max-w-3xl lg:max-w-5xl mx-auto px-4 dark:text-white">
          {activeTab === 'referee' ? (
            <RefereeArena key="referee" masterPlayers={leaderboard} />
          ) : (
            <AnimatePresence mode="wait">
              {activeTab === 'arena' ? (
                <motion.div key="arena" className="space-y-8 dark:text-white">
                  <EventCard
                    event={data.event}
                    participants={data.participants}
                    count={data.count}
                    user={user}
                    onAttend={handleAttend}
                    onCancel={() => setShowCancelModal(true)}
                    isSubmitting={isSubmitting}
                    challongeUrl={data.event?.challongeUrl}
                  />
                  {data?.event && <ParticipantList participants={data.participants} onSelect={openProfile} />}
                </motion.div>
              ) : activeTab === 'standings' ? (
                <StandingsContent key="standings" leaderboard={leaderboard} user={user} onSelect={openProfile} />
              ) : activeTab === 'rule' ? (
                <Rule key="rule" />
              ) : activeTab === 'admin' ? (
                <AdminContent
                  key="admin"
                  onCreateEvent={() => setShowEventModal(true)}
                  onGenerateTournament={handleGenerateTournament}
                  onUpdatePoints={handleUpdatePoints}
                  onToggleNickname={handleToggleNickname}
                   nicknameAllowed={settings.allow_nickname_change === true || settings.allow_nickname_change === 'true'}
                  leaderboard={leaderboard}
                  isSubmitting={isSubmitting}
                  isGenerating={isGenerating}
                  isUpdatingPoints={isUpdatingPoints}
                  eventId={data?.event?.id}
                />
              ) : (
                <ProfileContent
                  key="profile"
                  blader={blader}
                  user={user}
                  settings={settings}
                  leaderboard={leaderboard}
                  onUpdateNickname={handleUpdateNickname}
                  onUpdateBio={handleUpdateBio}
                   onUploadPhoto={handleUploadPhoto}
                  isSubmitting={isSubmitting}
                />
              )}
            </AnimatePresence>
          )}
        </main>
      </PullToRefresh>

      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[92%] max-w-md md:max-w-3xl lg:max-w-5xl bg-white/80 dark:bg-dark-card/80 backdrop-blur-2xl border border-white/20 dark:border-gray-800 rounded-[2.5rem] p-2 shadow-2xl flex justify-between items-center z-50 dark:text-white">
        <button type="button" onClick={() => setActiveTab('arena')} className={`flex-1 flex flex-col items-center gap-1 py-3 rounded-[2rem] transition-all ${activeTab === 'arena' ? 'bg-primary dark:text-white shadow-lg' : 'text-gray-400'}`}>
          <MapPin size={18} /><span className="text-[8px] font-black uppercase italic tracking-tighter leading-none">Arena</span>
        </button>
        <button type="button" onClick={() => setActiveTab('standings')} className={`flex-1 flex flex-col items-center gap-1 py-3 rounded-[2rem] transition-all ${activeTab === 'standings' ? 'bg-primary dark:text-white shadow-lg' : 'text-gray-400'}`}>
          <Trophy size={18} /><span className="text-[8px] font-black uppercase italic tracking-tighter leading-none">Standings</span>
        </button>
        <button type="button" onClick={() => setActiveTab('rule')} className={`flex-1 flex flex-col items-center gap-1 py-3 rounded-[2rem] transition-all ${activeTab === 'rule' ? 'bg-primary dark:text-white shadow-lg' : 'text-gray-400'}`}>
          <BookOpen size={18} /><span className="text-[8px] font-black uppercase italic tracking-tighter leading-none">Rule</span>
        </button>
        {blader?.role === 'Admin' && (
          <>
            <button type="button" onClick={() => setActiveTab('admin')} className={`flex-1 flex flex-col items-center gap-1 py-3 rounded-[2rem] transition-all ${activeTab === 'admin' ? 'bg-red-500 dark:text-white shadow-lg shadow-red-500/30' : 'text-gray-400'}`}>
              <ShieldCheck size={18} /><span className="text-[8px] font-black uppercase italic tracking-tighter leading-none">Admin</span>
            </button>
            <button type="button" onClick={() => setActiveTab('referee')} className={`flex-1 flex flex-col items-center gap-1 py-3 rounded-[2rem] transition-all ${activeTab === 'referee' ? 'bg-blue-500 dark:text-white shadow-lg shadow-blue-500/30' : 'text-gray-400'}`}>
              <Swords size={18} /><span className="text-[8px] font-black uppercase italic tracking-tighter leading-none">Referee</span>
            </button>
          </>
        )}
        <button type="button" onClick={() => setActiveTab('profile')} className={`flex-1 flex flex-col items-center gap-1 py-3 rounded-[2rem] transition-all ${activeTab === 'profile' ? 'bg-primary dark:text-white shadow-lg' : 'text-gray-400'}`}>
          <UserCircle size={18} /><span className="text-[8px] font-black uppercase italic tracking-tighter leading-none">Profile</span>
        </button>
      </nav>
    </div>
  );
}
