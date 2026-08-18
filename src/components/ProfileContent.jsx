import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Edit3, Loader2, Quote } from 'lucide-react';
import PhotoUploader from './PhotoUploader';
import UserAvatar from './UserAvatar';
import PublicNavbar from './PublicNavbar';
import MyDecks from './MyDecks';

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.4, ease: 'easeOut' }
  })
};

const ProfileContent = ({ blader, user, settings = {}, leaderboard = [], onUpdateNickname, onUpdateBio, onUploadPhoto, isSubmitting }) => {
  console.log('[PROFILE ROUTE COMPONENT]', 'ProfileContent');
  console.log('[PROFILE NAVBAR]', { rendered: true });
  const [isEditingNick, setIsEditingNick] = useState(false);
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [editNick, setEditNick] = useState(blader?.nickname || '');
  const [slogan, setSlogan] = useState(blader?.slogan || '');
  const [catatan, setCatatan] = useState(blader?.catatan || '');

  useEffect(() => {
    setEditNick(blader?.nickname || '');
    setSlogan(blader?.slogan || '');
    setCatatan(blader?.catatan || '');
  }, [blader?.nickname, blader?.slogan, blader?.catatan]);

  const safeLeaderboard = Array.isArray(leaderboard) ? leaderboard : [];
  const myRankIndex = safeLeaderboard.findIndex((item) => String(item.googleId || '') === String(user?.sub || ''));
  const myRank = myRankIndex !== -1 ? myRankIndex + 1 : '--';
  const myStats = myRankIndex !== -1 ? safeLeaderboard[myRankIndex] : null;

  const photo = blader?.foto || blader?.photo || user?.picture || '';
  const nicknameAllowed = settings.allow_nickname_change === true || settings.allow_nickname_change === 'true';

  if (!blader) {
    return (
      <div className="min-h-screen bg-gray-950 text-white overflow-x-hidden">
        <PublicNavbar />
        <div className="max-w-6xl mx-auto px-6 pt-24 pb-16">
          <div className="bg-gray-900/80 backdrop-blur-sm rounded-[2rem] border border-white/5 p-10 text-center shadow-2xl">
            <Loader2 className="animate-spin text-blue-400 mx-auto mb-4" size={32} />
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Memuat profil...</p>
          </div>
        </div>
      </div>
    );
  }

  const handleSave = async () => {
    if (editNick.length < 3) return;
    await onUpdateNickname(editNick);
    setIsEditingNick(false);
  };

  const handleSaveBio = async () => {
    const res = await onUpdateBio({ slogan: slogan.slice(0, 50), catatan: catatan.slice(0, 150) });
    if (res?.status === 'success') setIsEditingBio(false);
  };

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
        {/* Profile Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gray-900/80 backdrop-blur-sm rounded-[2rem] border border-white/5 p-6 md:p-8 shadow-2xl mb-6"
        >
          <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              <div className="absolute -inset-1 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-full blur opacity-60" />
              <div className="relative">
                <UserAvatar src={photo} name={user?.name} className="w-24 h-24 md:w-28 md:h-28 rounded-full border-2 border-white/10" />
                <div className="absolute -bottom-1 -right-1 bg-primary p-2 rounded-xl">
                  <Trophy size={16} />
                </div>
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 text-center md:text-left">
              {isEditingNick ? (
                <div className="space-y-3">
                  <input
                    value={editNick}
                    onChange={(e) => setEditNick(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                    className="w-full p-3 bg-gray-800 border-2 border-primary rounded-xl text-center font-bold outline-none dark:text-white"
                  />
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setIsEditingNick(false)} className="flex-1 py-2 bg-gray-700 rounded-xl font-bold dark:text-white">Batal</button>
                    <button type="button" onClick={handleSave} className="flex-1 py-2 bg-primary rounded-xl font-bold dark:text-white">
                      {isSubmitting ? <Loader2 className="animate-spin mx-auto" size={18} /> : 'Simpan'}
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex flex-col md:flex-row items-center gap-3 mb-2">
                    <h2 className="text-2xl md:text-3xl font-black italic tracking-tighter">{blader?.nickname}</h2>
                    <span className="inline-block px-3 py-1 rounded-full bg-blue-500/20 text-blue-400 text-[9px] font-black uppercase tracking-widest border border-blue-500/30">
                      {blader?.role || 'Blader'}
                    </span>
                  </div>
                  {blader?.slogan && (
                    <p className="text-sm text-gray-400 italic">
                      &ldquo;{blader.slogan}&rdquo;
                    </p>
                  )}
                  {nicknameAllowed && (
                    <button type="button" onClick={() => setIsEditingNick(true)} className="mt-3 text-[10px] font-black text-primary border-2 border-primary/20 px-4 py-1.5 rounded-full flex items-center gap-2 hover:bg-primary/5 transition-all mx-auto md:mx-0">
                      <Edit3 size={12} /> GANTI NICKNAME
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gray-900/80 backdrop-blur-sm rounded-[2rem] border border-white/5 p-6 md:p-8 shadow-2xl mb-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center">
              <Trophy className="text-yellow-400" size={20} />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase italic tracking-tight">My Stats</h3>
              <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Leaderboard Performance</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 bg-gray-800/40 rounded-2xl border border-white/5">
              <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">Rank</p>
              <p className="text-2xl font-black text-white">#{myRank}</p>
            </div>
            <div className="text-center p-4 bg-gray-800/40 rounded-2xl border border-white/5">
              <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">Points</p>
              <p className="text-2xl font-black text-white">{myStats?.point || 0}</p>
            </div>
            <div className="text-center p-4 bg-gray-800/40 rounded-2xl border border-white/5">
              <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">Finish</p>
              <p className="text-2xl font-black text-white">{myStats?.pointFinish || 0}</p>
            </div>
          </div>
        </motion.div>

        {/* Battle Bio */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-gray-900/80 backdrop-blur-sm rounded-[2rem] border border-white/5 p-6 md:p-8 shadow-2xl mb-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center">
              <Quote className="text-purple-400" size={20} />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase italic tracking-tight">Battle Bio</h3>
              <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Slogan & Gaya Main</p>
            </div>
            <button
              type="button"
              onClick={() => { setSlogan(blader?.slogan || ''); setCatatan(blader?.catatan || ''); setIsEditingBio(true); }}
              className="ml-auto text-[10px] font-black text-primary border-2 border-primary/20 px-4 py-1.5 rounded-full flex items-center gap-1 hover:bg-primary/5 transition-all"
            >
              <Edit3 size={10} /> EDIT
            </button>
          </div>

          {isEditingBio ? (
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1">
                  <span>Slogan (Battle Cry)</span><span>{slogan.length}/50</span>
                </div>
                <input
                  value={slogan}
                  maxLength={50}
                  onChange={(e) => setSlogan(e.target.value)}
                  placeholder="Ex: Aku akan menghancurkanmu!"
                  className="w-full p-3 bg-gray-800 border-2 border-primary rounded-xl font-bold outline-none dark:text-white"
                />
              </div>
              <div>
                <div className="flex justify-between text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1">
                  <span>Catatan / Gaya Main</span><span>{catatan.length}/150</span>
                </div>
                <textarea
                  value={catatan}
                  maxLength={150}
                  rows={3}
                  onChange={(e) => setCatatan(e.target.value)}
                  placeholder="Ex: Agresif, suka serangan pertama..."
                  className="w-full p-3 bg-gray-800 border-2 border-primary rounded-xl font-bold outline-none dark:text-white resize-none"
                />
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setIsEditingBio(false)} className="flex-1 py-2 bg-gray-700 rounded-xl font-bold dark:text-white">Batal</button>
                <button type="button" onClick={handleSaveBio} className="flex-1 py-2 bg-primary rounded-xl font-bold dark:text-white">
                  {isSubmitting ? <Loader2 className="animate-spin mx-auto" size={18} /> : 'Simpan'}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="flex items-start gap-2 text-primary font-black italic text-sm">
                <Quote size={14} className="mt-0.5 shrink-0" />
                {blader?.slogan || 'Belum ada slogan.'}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                {blader?.catatan || 'Belum ada catatan gaya main.'}
              </p>
            </div>
          )}
        </motion.div>

        {/* Photo Upload */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gray-900/80 backdrop-blur-sm rounded-[2rem] border border-white/5 p-6 md:p-8 shadow-2xl mb-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-green-500/10 border border-green-500/30 flex items-center justify-center">
              <Trophy className="text-green-400" size={20} />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase italic tracking-tight">Profile Photo</h3>
              <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Upload Foto Profil</p>
            </div>
          </div>
          <PhotoUploader onCropped={onUploadPhoto} isSubmitting={isSubmitting} />
        </motion.div>

        {/* My Decks */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-gray-900/80 backdrop-blur-sm rounded-[2rem] border border-white/5 p-6 md:p-8 shadow-2xl"
        >
          <MyDecks user={user} />
        </motion.div>
      </div>
    </div>
  );
};

export default ProfileContent;
