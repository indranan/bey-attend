import { useContext, useEffect, useState } from 'react';
import { AuthContext } from './context/AuthContext';
import { GoogleLogin } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';
import axios from 'axios';
import toast, { Toaster } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LogOut, MapPin, Users, CheckCircle2, Loader2,
  Trophy, UserCircle, Edit3, ShieldCheck
} from 'lucide-react';

const GAS_URL = "https://script.google.com/macros/s/AKfycbzC61Vx388vq9XWsRRxHKs93H7JMwoMNL8hgulqdhmlPlqFjsjY_Xblhon-rNBeWRxjig/exec";

// --- KOMPONEN MODAL (DIPINDAH KE LUAR AGAR TIDAK REFRESH SAAT mengetik) ---
const CreateEventModal = ({ show, onClose, form, setForm, onSubmit, isSubmitting }) => (
  <AnimatePresence>
    {show && (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
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
                New Arena Event
              </h3>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest mt-2 italic">
                Konfigurasi Turnamen
              </p>
            </div>

            <div>
              <label className="text-[10px] font-black text-primary uppercase ml-2 mb-1 block italic tracking-widest">Nama Event</label>
              <input
                type="text"
                placeholder="Contoh: Liga Beyblade X"
                className="w-full p-4 bg-gray-100 dark:bg-gray-800 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-primary text-gray-900 dark:text-white transition-all"
                value={form.nama}
                onChange={(e) => setForm({ ...form, nama: e.target.value })}
                autoComplete="off"
              />
            </div>

            <div>
              <label className="text-[10px] font-black text-primary uppercase ml-2 mb-1 block italic tracking-widest">Lokasi</label>
              <input
                type="text"
                placeholder="Contoh: Arena Pasar Tingkat"
                className="w-full p-4 bg-gray-100 dark:bg-gray-800 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-primary text-gray-900 dark:text-white transition-all"
                value={form.lokasi}
                onChange={(e) => setForm({ ...form, lokasi: e.target.value })}
                autoComplete="off"
              />
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
                onClick={onSubmit}
                disabled={isSubmitting || !form.nama || !form.lokasi}
                className="flex-1 py-4 bg-primary dark:text-white rounded-2xl font-black uppercase italic text-xs shadow-lg shadow-primary/30 active:scale-95 transition-all disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 className="animate-spin mx-auto" size={16} /> : "Aktifkan"}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    )}
  </AnimatePresence>
);

export default function App() {
  const { user, login, logout } = useContext(AuthContext);

  // -- STATES --
  const [data, setData] = useState({ event: null, participants: [], count: 0 });
  const [leaderboard, setLeaderboard] = useState([]);
  const [blader, setBlader] = useState(null);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOnboarding, setIsOnboarding] = useState(false);
  const [newNickname, setNewNickname] = useState("");
  const [activeTab, setActiveTab] = useState('arena');
  const [showEventModal, setShowEventModal] = useState(false);
  const [eventForm, setEventForm] = useState({ nama: '', lokasi: '' });

  // -- INITIAL LOAD --
  useEffect(() => {
    if (user) {
      const initApp = async () => {
        setLoading(true);
        await Promise.all([
          checkProfile(),
          fetchSettings(),
          fetchEventData(),
          fetchLeaderboard()
        ]);
        setLoading(false);
      };
      initApp();
    } else {
      setLoading(false);
    }
  }, [user]);

  // -- API FETCHERS --
  const fetchSettings = async () => {
    try {
      const res = await axios.get(`${GAS_URL}?path=getSettings`);
      setSettings(res.data);
    } catch (err) { console.error("Settings error", err); }
  };

  const fetchEventData = async () => {
    try {
      const res = await axios.get(`${GAS_URL}?path=getEvent`);
      setData(res.data);
    } catch (err) { console.error(err); }
  };

  const fetchLeaderboard = async () => {
    try {
      const res = await axios.get(`${GAS_URL}?path=getLeaderboard`);
      if (res.data && Array.isArray(res.data)) {
        setLeaderboard(res.data);
      } else {
        setLeaderboard([]);
      }
    } catch (err) {
      console.error("Gagal fetch leaderboard:", err);
      setLeaderboard([]);
    }
  };

  const checkProfile = async () => {
    try {
      const res = await axios.get(`${GAS_URL}?path=getBlader&googleId=${user.sub}`);
      if (res.data.registered) {
        setBlader(res.data);
        setIsOnboarding(false);
      } else {
        setIsOnboarding(true);
      }
    } catch (err) { toast.error("Gagal memuat profil Blader"); }
  };

  // -- HANDLERS --
  const handleCreateProfile = async () => {
    if (newNickname.length < 3 || newNickname.length > 20) {
      return toast.error("Nickname: 3 - 20 karakter!");
    }
    setIsSubmitting(true);
    try {
      const checkRes = await axios.get(`${GAS_URL}?path=checkNickname&nickname=${newNickname}`);
      if (!checkRes.data.available) {
        setIsSubmitting(false);
        return toast.error("Nickname sudah digunakan!");
      }
      const payload = {
        googleId: user.sub,
        email: user.email,
        googleName: user.name,
        nickname: newNickname,
        photoUrl: user.picture
      };
      await axios.post(`${GAS_URL}?path=createProfile`, JSON.stringify(payload), {
        headers: { 'Content-Type': 'text/plain' },
      });
      toast.success(`Welcome, Blader ${newNickname}!`);
      await checkProfile();
    } catch (err) {
      toast.error("Gagal mendaftar");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAttend = async () => {
    setIsSubmitting(true);
    try {
      const payload = JSON.stringify({
        eventId: data.event.id,
        googleId: user.sub,
        nickname: blader.nickname,
        email: user.email,
        foto: user.picture
      });
      const res = await axios.post(`${GAS_URL}?path=attendance`, payload, {
        headers: { 'Content-Type': 'text/plain' },
      });
      if (res.data.status === "success") {
        toast.success("Ready to Battle!");
        fetchEventData();
      } else {
        toast.error(res.data.message);
      }
    } catch (err) {
      toast.error("Gagal mengirim absensi");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitEvent = async () => {
    if (!eventForm.nama || !eventForm.lokasi) return toast.error("Isi semua data!");
    setIsSubmitting(true);
    try {
      const payload = JSON.stringify({
        nama: eventForm.nama,
        lokasi: eventForm.lokasi
      });
      const res = await axios.post(`${GAS_URL}?path=createEvent`, payload, {
        headers: { 'Content-Type': 'text/plain' },
      });
      if (res.data.status === "success") {
        toast.success("Event Baru Aktif!");
        setShowEventModal(false);
        fetchEventData();
      }
    } catch (err) {
      toast.error("Gagal terhubung ke server");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetArena = async () => {
    if (!window.confirm("Apakah Anda yakin ingin mengosongkan arena (tutup event)?")) return;
    setIsSubmitting(true);
    try {
      const res = await axios.post(`${GAS_URL}?path=resetArena`, "{}", {
        headers: { 'Content-Type': 'text/plain' },
      });
      if (res.data.status === "success") {
        toast.success("Arena telah dikosongkan!");
        fetchEventData();
      }
    } catch (err) {
      toast.error("Gagal reset arena");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelAttend = async () => {
    if (!window.confirm("Batal hadir dari event ini?")) return;

    setIsSubmitting(true);
    try {
      const payload = JSON.stringify({
        eventId: data.event.id,
        googleId: user.sub
      });

      const res = await axios.post(`${GAS_URL}?path=cancelAttendance`, payload, {
        headers: { 'Content-Type': 'text/plain' },
      });

      if (res.data.status === "success") {
        toast.success("Berhasil batal hadir");
        fetchEventData(); // Refresh daftar blader di arena
      }
    } catch (err) {
      toast.error("Gagal membatalkan kehadiran");
    } finally {
      setIsSubmitting(false);
    }
  };

  // -- SUB-COMPONENTS (TABS) --

  const StandingsContent = () => {
    const getStatusIcon = (status) => {
      const s = String(status).toLowerCase();
      if (s === 'up') return <span className="text-green-500 text-[10px] font-bold">▲</span>;
      if (s === 'down') return <span className="text-red-500 text-[10px] font-bold">▼</span>;
      return <span className="text-gray-400 text-[10px]">●</span>;
    };

    if (!Array.isArray(leaderboard) || leaderboard.length === 0) {
      return (
        <div className="text-center p-12 bg-white dark:bg-dark-card rounded-[2.5rem] border border-gray-800 dark:text-white">
          <Trophy className="text-gray-700 mx-auto mb-4 opacity-20" size={48} />
          <p className="text-gray-500 font-black uppercase italic tracking-widest text-xs">Klasemen Belum Tersedia</p>
        </div>
      );
    }

    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-20">
        <div className="text-center">
          <h2 className="text-2xl font-black italic uppercase tracking-tighter dark:text-white leading-none dark:text-white">KLASEMEN LIGA</h2>
          <p className="text-[10px] text-primary font-black uppercase tracking-[0.3em] mt-2 italic dark:text-white">Peringkat Blader Season Ini</p>
        </div>
        <div className="bg-white dark:bg-dark-card rounded-[2.5rem] overflow-hidden border border-gray-100 dark:border-gray-800 shadow-2xl">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                <th className="p-4 text-[9px] font-black uppercase text-gray-400 italic">Rank</th>
                <th className="p-4 text-[9px] font-black uppercase text-gray-400 italic">Blader</th>
                <th className="p-4 text-center text-[9px] font-black uppercase text-gray-400 italic">Pts</th>
                <th className="p-4 text-center text-[9px] font-black uppercase text-gray-400 italic">Fin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {leaderboard.map((item, index) => {
                const rank = index + 1;
                const isMe = item.googleId === user?.sub;
                return (
                  <tr key={index} className={`${isMe ? 'bg-primary/10' : ''} transition-colors`}>
                    <td className="p-4">
                      <div className="flex flex-col items-center gap-1">
                        <div className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-black shadow-sm ${rank === 1 ? 'bg-yellow-400 text-black shadow-yellow-400/40' : rank === 2 ? 'bg-gray-300 text-black' : rank === 3 ? 'bg-orange-500 dark:text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-400'}`}>{rank}</div>
                        {getStatusIcon(item.status)}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <img src={item.foto || `https://ui-avatars.com/api/?name=${item.name}`} referrerPolicy="no-referrer" className="w-10 h-10 rounded-xl object-cover border-2 border-gray-800 shadow-md" alt="" />
                        <p className={`text-xs font-black uppercase italic tracking-tighter leading-none ${isMe ? 'text-primary' : 'dark:text-white'}`}>{item.name}</p>
                      </div>
                    </td>
                    <td className="p-4 text-center font-black text-primary italic">{item.point}</td>
                    <td className="p-4 text-center font-bold text-gray-400 text-[10px]">{item.pointFinish}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </motion.div>
    );
  };

  const AdminContent = () => (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6 pb-20">
      <div className="px-2">
        <h2 className="text-xl font-black italic uppercase tracking-tighter dark:text-white dark:text-white">Admin Panel</h2>
        <p className="text-[10px] text-red-500 font-black uppercase tracking-widest mt-1 italic tracking-tighter dark:text-white">Otoritas Penyelenggara</p>
      </div>
      <div className="bg-white dark:bg-dark-card rounded-[2.5rem] p-8 border border-gray-100 dark:border-gray-800 shadow-xl space-y-4">
        <div className="text-center border-b border-gray-100 dark:border-gray-800 pb-4">
          <h3 className="text-xs font-black uppercase italic dark:text-gray-400">Event Management</h3>
        </div>
        <button type="button" onClick={() => setShowEventModal(true)} disabled={isSubmitting} className="w-full py-4 bg-primary dark:text-white rounded-2xl font-black uppercase italic text-xs shadow-lg shadow-primary/30 active:scale-95 transition-all">Buat Event Baru</button>
        <button type="button" onClick={handleResetArena} disabled={isSubmitting} className="w-full py-4 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-white rounded-2xl font-black uppercase italic text-xs active:scale-95 transition-all">Reset Arena Status</button>
      </div>
    </motion.div>
  );

  const ProfileContent = () => {
    const [isEditing, setIsEditing] = useState(false);
    const [editNick, setEditNick] = useState(blader?.nickname || "");

    // --- LOGIKA BARU UNTUK RANK & FINISH ---
    // 1. Cari index/urutan blader di dalam leaderboard (+1 karena index mulai dari 0)
    const myRankIndex = leaderboard.findIndex(item => item.googleId === user?.sub);
    const myRank = myRankIndex !== -1 ? myRankIndex + 1 : "--";

    // 2. Ambil data statistik lengkap milik blader yang login
    const myStats = myRankIndex !== -1 ? leaderboard[myRankIndex] : null;

    const handleUpdateNick = async () => {
      if (editNick.length < 3) return toast.error("Terlalu pendek!");
      setIsSubmitting(true);
      try {
        const payload = JSON.stringify({ googleId: user.sub, newNickname: editNick });
        const res = await axios.post(`${GAS_URL}?path=updateNickname`, payload, { headers: { 'Content-Type': 'text/plain' } });
        if (res.data.status === "success") { toast.success("Nickname diupdate!"); await checkProfile(); setIsEditing(false); }
      } catch (err) { toast.error("Gagal update"); }
      finally { setIsSubmitting(false); }
    };

    return (
      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
        {/* Card Profil Utama */}
        <div className="bg-white dark:bg-dark-card rounded-[2.5rem] p-8 text-center shadow-sm border border-gray-100 dark:border-gray-800 dark:text-white">
          <div className="relative w-24 h-24 mx-auto mb-4">
            <img src={user.picture} referrerPolicy="no-referrer" className="w-full h-full rounded-3xl border-4 border-primary shadow-lg object-cover" alt="profile" />
            <div className="absolute -bottom-2 -right-2 bg-primary dark:text-white p-2 rounded-xl"><Trophy size={16} /></div>
          </div>
          {isEditing ? (
            <div className="space-y-3 dark:text-white">
              <input value={editNick} onChange={(e) => setEditNick(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))} className="w-full p-3 bg-gray-100 dark:bg-gray-800 rounded-xl text-center font-bold outline-none border-2 border-primary dark:text-white" />
              <div className="flex gap-2 text-sm">
                <button type="button" onClick={() => setIsEditing(false)} className="flex-1 py-2 bg-gray-200 dark:bg-gray-700 rounded-xl font-bold dark:text-white">Batal</button>
                <button type="button" onClick={handleUpdateNick} className="flex-1 py-2 bg-primary dark:text-white rounded-xl font-bold">{isSubmitting ? <Loader2 className="animate-spin mx-auto" size={18} /> : "Simpan"}</button>
              </div>
            </div>
          ) : (
            <div>
              <h2 className="text-2xl font-black italic uppercase tracking-tighter dark:text-white">{blader?.nickname}</h2>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em] mb-4">{blader?.role || 'Blader'}</p>
              {settings.allow_nickname_change === "true" && (
                <button type="button" onClick={() => setIsEditing(true)} className="text-[10px] font-black text-primary border-2 border-primary/20 px-6 py-2 rounded-full flex items-center gap-2 mx-auto hover:bg-primary/5 transition-all">
                  <Edit3 size={12} /> GANTI NICKNAME
                </button>
              )}
            </div>
          )}
        </div>

        {/* --- GRID STATISTIK BARU (3 KOLOM) --- */}
        <div className="grid grid-cols-3 gap-3 text-center dark:text-white">
          {/* RANK */}
          <div className="bg-white dark:bg-dark-card p-4 rounded-[1.5rem] border border-gray-100 dark:border-gray-800 shadow-sm">
            <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Rank</p>
            <p className="text-lg font-black text-primary italic uppercase italic">#{myRank}</p>
          </div>

          {/* TOTAL POINTS */}
          <div className="bg-white dark:bg-dark-card p-4 rounded-[1.5rem] border border-gray-100 dark:border-gray-800 shadow-sm">
            <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Points</p>
            <p className="text-lg font-black text-primary italic uppercase italic">{myStats?.point || 0}</p>
          </div>

          {/* FINISH POINTS */}
          <div className="bg-white dark:bg-dark-card p-4 rounded-[1.5rem] border border-gray-100 dark:border-gray-800 shadow-sm">
            <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Finish</p>
            <p className="text-lg font-black text-primary italic uppercase italic">{myStats?.pointFinish || 0}</p>
          </div>
        </div>
      </motion.div>
    );
  };

  // -- RENDER CONDITIONALS --
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-dark-bg dark:text-white"><Loader2 className="animate-spin text-primary dark:text-white" size={40} /></div>;

  if (!user) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-dark-bg p-6 text-center dark:text-white">
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-sm bg-white dark:bg-dark-card p-10 rounded-[2.5rem] shadow-xl border border-gray-100 dark:border-gray-800 dark:text-white">
        <Trophy className="text-primary mx-auto mb-4 dark:text-white" size={48} />
        <h1 className="text-3xl font-black text-primary mb-2 italic uppercase tracking-tighter dark:text-white">Lalapan Beyblade X lamongan</h1>
        <p className="text-gray-400 text-[10px] mb-8 font-black uppercase tracking-[0.3em] italic leading-tight dark:text-white">Blader Identity Presence</p>
        <div className="flex justify-center dark:text-white"><GoogleLogin onSuccess={res => login(jwtDecode(res.credential))} theme="filled_blue" shape="pill" /></div>
      </motion.div>
    </div>
  );

  if (isOnboarding) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-dark-bg p-6 text-center">
      <motion.div
        initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        className="max-w-sm w-full bg-white dark:bg-dark-card p-8 rounded-[2.5rem] shadow-2xl border border-gray-100 dark:border-gray-800"
      >
        <UserCircle size={48} className="mx-auto text-primary mb-2" />
        <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase italic tracking-tighter">New Blader</h2>
        <p className="text-[10px] text-gray-500 dark:text-gray-400 font-black uppercase tracking-widest mb-8">Pilih nickname Battle-mu!</p>

        <div className="space-y-6">
          <input
            type="text"
            value={newNickname}
            onChange={(e) => setNewNickname(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
            placeholder="Ex: Dragoon_Storm"
            className="w-full p-4 bg-gray-100 dark:bg-gray-800 rounded-2xl font-black text-center text-gray-900 dark:text-white border-2 border-transparent focus:border-primary outline-none transition-all"
          />
          <button
            type="button"
            onClick={handleCreateProfile}
            disabled={isSubmitting || newNickname.length < 3}
            className="w-full bg-primary dark:text-white py-4 rounded-2xl font-black shadow-lg shadow-primary/30 uppercase italic tracking-widest disabled:opacity-50 active:scale-95 transition-all"
          >
            {isSubmitting ? "Registering..." : "Start Journey"}
          </button>
        </div>
      </motion.div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-bg transition-colors duration-500 pb-28 dark:text-white">
      <CreateEventModal
        show={showEventModal}
        onClose={() => setShowEventModal(false)}
        form={eventForm}
        setForm={setEventForm}
        onSubmit={handleSubmitEvent}
        isSubmitting={isSubmitting}
      />
      <Toaster position="top-center" />
      <nav className="max-w-md mx-auto p-4 flex justify-between items-center sticky top-0 bg-gray-50/80 dark:bg-dark-bg/80 backdrop-blur-lg z-50 dark:text-white">
        <div className="flex items-center gap-3 dark:text-white">
          <img src={user.picture} referrerPolicy="no-referrer" className="w-11 h-11 rounded-2xl border-2 border-primary object-cover dark:text-white" alt="avatar" />
          <div className='dark:text-white'>
            <p className="text-[10px] font-black text-primary leading-none uppercase tracking-widest italic mb-0.5 tracking-tighter dark:text-white">Blader Profile</p>
            <p className="font-black text-sm text-gray-800 dark:text-white uppercase italic tracking-tighter truncate w-32 dark:text-white">{blader?.nickname}</p>
          </div>
        </div>
        <button type="button" onClick={logout} className="p-3 bg-red-100 text-red-600 rounded-2xl dark:bg-red-900/20 active:scale-90 transition-all dark:text-white"><LogOut size={20} /></button>
      </nav>

      <main className="max-w-md mx-auto p-4 dark:text-white">
        <AnimatePresence mode="wait">
          {activeTab === 'arena' ? (
            <motion.div key="arena" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-8 dark:text-white">
              {!data?.event ? (
                <div className="text-center p-12 bg-white dark:bg-dark-card rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-gray-800 dark:text-white">
                  <Users className="text-gray-300 mx-auto mb-4 dark:text-white" size={48} />
                  <h3 className="font-black text-gray-400 uppercase italic tracking-widest tracking-tighter dark:text-white">Arena Kosong</h3>
                </div>
              ) : (
                <>
                  <div className="bg-primary p-7 rounded-[2.5rem] dark:text-white shadow-xl shadow-primary/30 relative overflow-hidden text-center sm:text-left">
                    <div className="relative z-10 dark:text-white">
                      <span className="text-[10px] font-black uppercase tracking-[0.3em] bg-white/20 px-3 py-1 rounded-full dark:text-white">Arena Active</span>
                      <h2 className="text-3xl font-black mt-4 mb-4 uppercase italic tracking-tighter leading-none dark:text-white">{data.event.nama}</h2>
                      <div className="flex items-center justify-center sm:justify-start gap-2 text-xs font-bold opacity-80 mb-8 italic dark:text-white"><MapPin size={16} /> {data.event.lokasi}</div>
                      <div className="flex justify-between items-end text-left dark:text-white">
                        <div className='dark:text-white'>
                          <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1 dark:text-white">Bladers Ready</p>
                          <div className="flex items-center gap-2 dark:text-white"><Users size={20} /><span className="text-2xl font-black italic dark:text-white">{data.count}</span></div>
                        </div>
                        {/* Logic Tombol Hadir / Batal */}
                        {data?.participants?.some(p => p.email === user?.email) ? (
                          <div className="flex flex-col items-end gap-2">
                            {/* Status Ready */}
                            <div className="bg-white/20 backdrop-blur-md px-6 py-3 rounded-2xl flex items-center gap-2 font-black text-xs italic uppercase text-white">
                              <CheckCircle2 size={18} /> Ready
                            </div>

                            {/* Tombol Batal Hadir */}
                            <button
                              type="button"
                              onClick={handleCancelAttend}
                              disabled={isSubmitting}
                              className="text-[10px] font-black text-white/50 uppercase italic tracking-widest hover:text-red-400 transition-colors"
                            >
                              {isSubmitting ? "..." : "Batal Hadir"}
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={handleAttend}
                            disabled={isSubmitting}
                            className="bg-white text-primary px-8 py-4 rounded-2xl font-black shadow-xl uppercase italic tracking-tighter text-sm disabled:opacity-50 active:scale-95 transition-all"
                          >
                            {isSubmitting ? <Loader2 className="animate-spin" /> : "I'm Ready!"}
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/10 rounded-full blur-3xl dark:text-white" />
                  </div>
                  <section className='dark:text-white'>
                    <div className="flex justify-between items-center mb-6 px-1 dark:text-white"><h3 className="text-xs font-black uppercase italic tracking-widest text-gray-400 dark:text-white">Bladers on Arena</h3><span className="bg-primary/10 text-primary text-[10px] font-black px-3 py-1 rounded-full dark:text-white">{data.count} Bladers</span></div>
                    <div className="grid gap-4 dark:text-white">
                      {data.participants?.map((p, i) => (
                        <motion.div key={i} initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: i * 0.05 }} className="flex items-center gap-4 bg-white dark:bg-dark-card p-4 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800 dark:text-white">
                          <img src={p.foto} referrerPolicy="no-referrer" className="w-12 h-12 rounded-2xl object-cover border-2 border-gray-50 dark:border-gray-700 shadow-sm dark:text-white" alt="" />
                          <div className="flex-1 dark:text-white">
                            <p className="font-black text-[15px] dark:text-gray-100 uppercase italic tracking-tighter leading-none mb-1 dark:text-white">{p.nama}</p>
                            <p className="text-[9px] text-primary font-black uppercase tracking-[0.2em] italic leading-tight dark:text-white">Ranked Blader</p>
                          </div>
                          <div className="w-2.5 h-2.5 bg-green-500 rounded-full shadow-[0_0_12px_rgba(34,197,94,0.8)] animate-pulse dark:text-white" />
                        </motion.div>
                      ))}
                    </div>
                  </section>
                </>
              )}
            </motion.div>
          ) : activeTab === 'standings' ? (
            <StandingsContent key="standings" />
          ) : activeTab === 'admin' ? (
            <AdminContent key="admin" />
          ) : (
            <ProfileContent key="profile" />
          )}
        </AnimatePresence>
      </main>

      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[92%] max-w-md bg-white/80 dark:bg-dark-card/80 backdrop-blur-2xl border border-white/20 dark:border-gray-800 rounded-[2.5rem] p-2 shadow-2xl flex justify-between items-center z-50 dark:text-white">
        <button type="button" onClick={() => setActiveTab('arena')} className={`flex-1 flex flex-col items-center gap-1 py-3 rounded-[2rem] transition-all ${activeTab === 'arena' ? 'bg-primary dark:text-white shadow-lg' : 'text-gray-400'}`}>
          <MapPin size={18} /><span className="text-[8px] font-black uppercase italic tracking-tighter leading-none dark:text-white">Arena</span>
        </button>
        <button type="button" onClick={() => setActiveTab('standings')} className={`flex-1 flex flex-col items-center gap-1 py-3 rounded-[2rem] transition-all ${activeTab === 'standings' ? 'bg-primary dark:text-white shadow-lg' : 'text-gray-400'}`}>
          <Trophy size={18} /><span className="text-[8px] font-black uppercase italic tracking-tighter leading-none dark:text-white">Standings</span>
        </button>
        {blader?.role === 'Admin' && (
          <button type="button" onClick={() => setActiveTab('admin')} className={`flex-1 flex flex-col items-center gap-1 py-3 rounded-[2rem] transition-all ${activeTab === 'admin' ? 'bg-red-500 dark:text-white shadow-lg shadow-red-500/30' : 'text-gray-400'}`}>
            <ShieldCheck size={18} /><span className="text-[8px] font-black uppercase italic tracking-tighter leading-none dark:text-white">Admin</span>
          </button>
        )}
        <button type="button" onClick={() => setActiveTab('profile')} className={`flex-1 flex flex-col items-center gap-1 py-3 rounded-[2rem] transition-all ${activeTab === 'profile' ? 'bg-primary dark:text-white shadow-lg' : 'text-gray-400'}`}>
          <UserCircle size={18} /><span className="text-[8px] font-black uppercase italic tracking-tighter leading-none dark:text-white">Profile</span>
        </button>
      </nav>
    </div>
  );
}