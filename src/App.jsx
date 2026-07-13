import { useContext, useEffect, useState } from 'react';
import { AuthContext } from './context/AuthContext';
import { GoogleLogin } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';
import axios from 'axios';
import toast, { Toaster } from 'react-hot-toast';
import { LogOut, MapPin, Users, CheckCircle2, Loader2, Trophy, UserCircle, Edit3 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const GAS_URL = "https://script.google.com/macros/s/AKfycbynKfNDSCwidAoF6ZdIvQbN0BSqiozGgvdwRUO-lyhkM6IIIKhKp0kEEd8oc_QdcHT9yw/exec";

export default function App() {
  const { user, login, logout } = useContext(AuthContext);

  // -- STATES --
  const [data, setData] = useState({ event: null, participants: [], count: 0 });
  const [blader, setBlader] = useState(null);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOnboarding, setIsOnboarding] = useState(false);
  const [newNickname, setNewNickname] = useState("");
  const [activeTab, setActiveTab] = useState('arena'); // 'arena' atau 'profile'
  

  // -- INITIAL LOAD --
  useEffect(() => {
    if (user) {
      const initApp = async () => {
        setLoading(true);
        // Menjalankan semua fetch secara paralel agar lebih cepat
        await Promise.all([checkProfile(), fetchSettings(), fetchEventData()]);
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
    } catch (err) { toast.error("Gagal update data event"); }
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
        return toast.error("Nickname sudah digunakan Blader lain!");
      }
      const payload = {
        googleId: user.sub,
        email: user.email,
        googleName: user.name,
        nickname: newNickname,
        photoUrl: user.picture
      };
      await axios.post(`${GAS_URL}?path=createProfile`, JSON.stringify(payload), {
        headers: {
          'Content-Type': 'text/plain',
        },
      });
      toast.success(`Selamat datang, Blader ${newNickname}!`);
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
        headers: {
          'Content-Type': 'text/plain',
        },
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

  // -- SUB-COMPONENT: PROFILE PAGE --
  const ProfileContent = () => {
    const [isEditing, setIsEditing] = useState(false);
    const [editNick, setEditNick] = useState(blader?.nickname || "");

    const handleUpdateNick = async () => {
      if (editNick.length < 3) return toast.error("Terlalu pendek!");
      setIsSubmitting(true);
      try {
        // 1. Stringify data kamu
        const payload = JSON.stringify({
          googleId: user.sub,
          newNickname: editNick
        });

        // 2. Tambahkan header 'Content-Type': 'text/plain'
        const res = await axios.post(`${GAS_URL}?path=updateNickname`, payload, {
          headers: {
            'Content-Type': 'text/plain',
          },
        });

        if (res.data.status === "success") {
          toast.success("Nickname diupdate!");
          await checkProfile();
          setIsEditing(false);
        } else {
          toast.error(res.data.message || "Gagal update");
        }
      } catch (err) {
        console.error("Error detail:", err);
        toast.error("Terjadi kesalahan koneksi");
      } finally {
        setIsSubmitting(false);
      }
    };

    return (
      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
        <div className="bg-white dark:bg-dark-card rounded-[2.5rem] p-8 text-center shadow-sm border border-gray-100 dark:border-gray-800">
          <div className="relative w-24 h-24 mx-auto mb-4">
            <img
              src={user.picture}
              referrerPolicy="no-referrer"
              className="w-full h-full rounded-3xl border-4 border-primary shadow-lg object-cover"
              alt="profile"
            />
            <div className="absolute -bottom-2 -right-2 bg-primary text-white p-2 rounded-xl">
              <Trophy size={16} />
            </div>
          </div>

          {isEditing ? (
            <div className="space-y-3">
              <input
                value={editNick}
                onChange={(e) => setEditNick(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
                className="w-full p-3 bg-gray-100 dark:bg-gray-800 rounded-xl text-center font-bold outline-none border-2 border-primary dark:text-white"
              />
              <div className="flex gap-2 text-sm">
                <button onClick={() => setIsEditing(false)} className="flex-1 py-2 bg-gray-200 dark:bg-gray-700 rounded-xl font-bold dark:text-white">Batal</button>
                <button onClick={handleUpdateNick} className="flex-1 py-2 bg-primary text-white rounded-xl font-bold">
                  {isSubmitting ? <Loader2 className="animate-spin mx-auto" size={18} /> : "Simpan"}
                </button>
              </div>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-black italic uppercase tracking-tighter dark:text-white">{blader?.nickname}</h2>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em] mb-4">{blader?.role || 'Blader'}</p>

              {settings.allow_nickname_change === "true" && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="text-[10px] font-black text-primary border-2 border-primary/20 px-6 py-2 rounded-full flex items-center gap-2 mx-auto hover:bg-primary/5 transition-all"
                >
                  <Edit3 size={12} /> GANTI NICKNAME
                </button>
              )}
            </>
          )}
        </div>

        {/* Stats Section */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white dark:bg-dark-card p-6 rounded-[2rem] text-center border border-gray-100 dark:border-gray-800 shadow-sm">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Rank</p>
            <p className="text-2xl font-black text-primary italic font-outline-2 uppercase">#--</p>
          </div>
          <div className="bg-white dark:bg-dark-card p-6 rounded-[2rem] text-center border border-gray-100 dark:border-gray-800 shadow-sm">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Points</p>
            <p className="text-2xl font-black text-primary italic font-outline-2 uppercase">0</p>
          </div>
        </div>
      </motion.div>
    );
  };

  // -- RENDER CONDITIONALS --

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-dark-bg">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="animate-spin text-primary" size={40} />
          <p className="text-xs font-black text-gray-400 animate-pulse uppercase tracking-[0.3em] italic">Arena Readying...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-dark-bg p-6">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-sm bg-white dark:bg-dark-card p-10 rounded-[2.5rem] shadow-xl text-center border border-gray-100 dark:border-gray-800">
          <Trophy className="text-primary mx-auto mb-4" size={48} />
          <h1 className="text-3xl font-black text-primary mb-2 italic uppercase">BEY-ATTEND</h1>
          <p className="text-gray-400 text-[10px] mb-8 font-black uppercase tracking-[0.3em] italic">Blader Identity Presence</p>
          <div className="flex justify-center">
            <GoogleLogin
              onSuccess={res => login(jwtDecode(res.credential))}
              onError={() => toast.error("Login Gagal")}
              theme="filled_blue"
              shape="pill"
            />
          </div>
        </motion.div>
      </div>
    );
  }

  if (isOnboarding) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-dark-bg p-6">
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="max-w-sm w-full bg-white dark:bg-dark-card p-8 rounded-[2.5rem] shadow-2xl border border-gray-100 dark:border-gray-800 text-center">
          <UserCircle size={48} className="mx-auto text-primary mb-2" />
          <h2 className="text-2xl font-black text-gray-800 dark:text-white uppercase italic tracking-tighter">New Blader</h2>
          <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-8">Pilih nickname Battle-mu!</p>

          <div className="space-y-6">
            <input
              type="text"
              value={newNickname}
              onChange={(e) => setNewNickname(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
              placeholder="Contoh: Dragoon_Storm"
              className="w-full p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl font-black text-center text-gray-800 dark:text-white border-2 border-transparent focus:border-primary outline-none transition-all"
            />
            <button
              onClick={handleCreateProfile}
              disabled={isSubmitting || newNickname.length < 3}
              className="w-full bg-primary text-white py-4 rounded-2xl font-black shadow-lg shadow-primary/30 uppercase italic tracking-widest disabled:opacity-50"
            >
              {isSubmitting ? "Registering..." : "Start Journey"}
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  const isPresent = data?.participants?.some(p => p.email === user?.email) || false;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-bg transition-colors duration-500">
      <Toaster position="top-center" />

      {/* Navbar */}
      <nav className="max-w-md mx-auto p-4 flex justify-between items-center sticky top-0 bg-gray-50/80 dark:bg-dark-bg/80 backdrop-blur-lg z-50">
        <div className="flex items-center gap-3">
          <img
            src={user.picture}
            referrerPolicy="no-referrer"
            className="w-11 h-11 rounded-2xl border-2 border-primary object-cover"
            alt="avatar"
          />
          <div>
            <p className="text-[10px] font-black text-primary leading-none uppercase tracking-widest italic mb-0.5 tracking-tighter">Blader Profile</p>
            <p className="font-black text-sm text-gray-800 dark:text-white uppercase italic tracking-tighter">{blader?.nickname}</p>
          </div>
        </div>
        <button onClick={logout} className="p-3 bg-red-100 text-red-600 rounded-2xl dark:bg-red-900/20 active:scale-90 transition-all">
          <LogOut size={20} />
        </button>
      </nav>

      {/* Main Content Area */}
      <main className="max-w-md mx-auto p-4 pb-32">
        <AnimatePresence mode="wait">
          {activeTab === 'arena' ? (
            /* TAB: ARENA */
            <motion.div
              key="arena"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-8"
            >
              {!data?.event ? (
                <div className="text-center p-12 bg-white dark:bg-dark-card rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-gray-800">
                  <Users className="text-gray-300 mx-auto mb-4" size={48} />
                  <h3 className="font-black text-gray-400 uppercase italic tracking-widest">Arena Kosong</h3>
                </div>
              ) : (
                <>
                  {/* Event Card */}
                  <div className="bg-primary p-7 rounded-[2.5rem] text-white shadow-xl shadow-primary/30 relative overflow-hidden">
                    <div className="relative z-10">
                      <span className="text-[10px] font-black uppercase tracking-[0.3em] bg-white/20 px-3 py-1 rounded-full">Arena Active</span>
                      <h2 className="text-3xl font-black mt-4 mb-4 uppercase italic tracking-tighter leading-none">{data.event.nama}</h2>
                      <div className="flex items-center gap-2 text-xs font-bold opacity-80 mb-8 italic">
                        <MapPin size={16} /> {data.event.lokasi}
                      </div>

                      <div className="flex justify-between items-end">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">Bladers Ready</p>
                          <div className="flex items-center gap-2">
                            <Users size={20} />
                            <span className="text-2xl font-black italic">{data.count}</span>
                          </div>
                        </div>

                        {isPresent ? (
                          <div className="bg-white/20 backdrop-blur-md px-6 py-3 rounded-2xl flex items-center gap-2 font-black text-xs italic uppercase">
                            <CheckCircle2 size={18} /> Ready
                          </div>
                        ) : (
                          <button
                            onClick={handleAttend}
                            disabled={isSubmitting}
                            className="bg-white text-primary px-8 py-4 rounded-2xl font-black shadow-xl uppercase italic tracking-tighter text-sm disabled:opacity-50"
                          >
                            {isSubmitting ? <Loader2 className="animate-spin mx-auto" /> : "I'm Ready!"}
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
                  </div>

                  {/* List Bladers */}
                  <section>
                    <div className="flex justify-between items-center mb-6 px-1">
                      <h3 className="text-xs font-black uppercase italic tracking-widest text-gray-400">Bladers on Arena</h3>
                      <span className="bg-primary/10 text-primary text-[10px] font-black px-3 py-1 rounded-full">{data.count} Bladers</span>
                    </div>

                    <div className="grid gap-4">
                      {data.participants?.map((p, i) => (
                        <motion.div
                          key={p.email}
                          initial={{ x: -20, opacity: 0 }}
                          animate={{ x: 0, opacity: 1 }}
                          transition={{ delay: i * 0.05 }}
                          className="flex items-center gap-4 bg-white dark:bg-dark-card p-4 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800"
                        >
                          <img
                            src={p.foto}
                            referrerPolicy="no-referrer"
                            className="w-12 h-12 rounded-2xl object-cover border-2 border-gray-50 dark:border-gray-700 shadow-sm"
                            alt=""
                          />
                          <div className="flex-1">
                            <p className="font-black text-[15px] dark:text-gray-100 uppercase italic tracking-tighter leading-none mb-1">{p.nama}</p>
                            <p className="text-[9px] text-primary font-black uppercase tracking-[0.2em] italic">Blader Rank #1</p>
                          </div>
                          <div className="w-2.5 h-2.5 bg-green-500 rounded-full shadow-[0_0_12px_rgba(34,197,94,0.8)] animate-pulse" />
                        </motion.div>
                      ))}
                    </div>
                  </section>
                </>
              )}
            </motion.div>
          ) : (
            /* TAB: PROFILE */
            <ProfileContent />
          )}
        </AnimatePresence>
      </main>

      {/* Floating Bottom Navigation */}
      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-md bg-white/80 dark:bg-dark-card/80 backdrop-blur-2xl border border-white/20 dark:border-gray-800 rounded-[2.5rem] p-2 shadow-2xl flex justify-between items-center z-50">
        <button
          onClick={() => setActiveTab('arena')}
          className={`flex-1 flex flex-col items-center gap-1 py-3 rounded-[2rem] transition-all ${activeTab === 'arena' ? 'bg-primary text-white shadow-lg shadow-primary/30' : 'text-gray-400'}`}
        >
          <MapPin size={20} />
          <span className="text-[10px] font-black uppercase tracking-tighter italic">Arena</span>
        </button>

        <button
          onClick={() => setActiveTab('profile')}
          className={`flex-1 flex flex-col items-center gap-1 py-3 rounded-[2rem] transition-all ${activeTab === 'profile' ? 'bg-primary text-white shadow-lg shadow-primary/30' : 'text-gray-400'}`}
        >
          <UserCircle size={20} />
          <span className="text-[10px] font-black uppercase tracking-tighter italic">Profile</span>
        </button>
      </nav>
    </div>
  );
}