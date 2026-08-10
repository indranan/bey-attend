import { useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Edit3, Loader2, Quote } from 'lucide-react';
import PhotoUploader from './PhotoUploader';
import UserAvatar from './UserAvatar';

const ProfileContent = ({ blader, user, settings, leaderboard, onUpdateNickname, onUpdateBio, onUploadPhoto, isSubmitting }) => {
  const [isEditingNick, setIsEditingNick] = useState(false);
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [editNick, setEditNick] = useState(blader?.nickname || '');
  const [slogan, setSlogan] = useState(blader?.slogan || '');
  const [catatan, setCatatan] = useState(blader?.catatan || '');

  const myRankIndex = leaderboard.findIndex((item) => item.googleId === user?.sub);
  const myRank = myRankIndex !== -1 ? myRankIndex + 1 : '--';
  const myStats = myRankIndex !== -1 ? leaderboard[myRankIndex] : null;

  const photo = blader?.photo || user.picture;
  //const nicknameAllowed = settings.allow_nickname_change === 'true';

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
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
      <div className="bg-white dark:bg-dark-card rounded-[2.5rem] p-8 text-center shadow-sm border border-gray-100 dark:border-gray-800 dark:text-white">
        <div className="relative w-24 h-24 mx-auto mb-4">
          <UserAvatar src={photo} name={user?.name} className="w-full h-full rounded-3xl border-4 border-primary shadow-lg" />
          <div className="absolute -bottom-2 -right-2 bg-primary dark:text-white p-2 rounded-xl"><Trophy size={16} /></div>
        </div>

        {isEditingNick ? (
          <div className="space-y-3 dark:text-white">
            <input
              value={editNick}
              onChange={(e) => setEditNick(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
              className="w-full p-3 bg-gray-100 dark:bg-gray-800 rounded-xl text-center font-bold outline-none border-2 border-primary dark:text-white"
            />
            <div className="flex gap-2 text-sm">
              <button type="button" onClick={() => setIsEditingNick(false)} className="flex-1 py-2 bg-gray-200 dark:bg-gray-700 rounded-xl font-bold dark:text-white">Batal</button>
              <button type="button" onClick={handleSave} className="flex-1 py-2 bg-primary dark:text-white rounded-xl font-bold">
                {isSubmitting ? <Loader2 className="animate-spin mx-auto" size={18} /> : 'Simpan'}
              </button>
            </div>
          </div>
        ) : (
          <div>
            <h2 className="text-2xl font-black italic tracking-tighter dark:text-white">{blader?.nickname}</h2>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em] mb-4">{blader?.role || 'Blader'}</p>
             
            <button type="button" onClick={() => setIsEditingNick(true)} className="text-[10px] font-black text-primary border-2 border-primary/20 px-6 py-2 rounded-full flex items-center gap-2 mx-auto hover:bg-primary/5 transition-all">
                <Edit3 size={12} /> GANTI NICKNAME
              </button>
              
          </div>
        )}
      </div>

      {/* Upload Foto Profil */}
      <div className="bg-white dark:bg-dark-card rounded-[2.5rem] p-6 shadow-sm border border-gray-100 dark:border-gray-800">
        <PhotoUploader onCropped={onUploadPhoto} isSubmitting={isSubmitting} />
      </div>

      {/* Bio: Slogan & Catatan */}
      <div className="bg-white dark:bg-dark-card rounded-[2.5rem] p-6 shadow-sm border border-gray-100 dark:border-gray-800 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-black uppercase italic dark:text-gray-400">Battle Bio</h3>
          <button
            type="button"
            onClick={() => { setSlogan(blader?.slogan || ''); setCatatan(blader?.catatan || ''); setIsEditingBio(true); }}
            className="text-[10px] font-black text-primary border-2 border-primary/20 px-4 py-1.5 rounded-full flex items-center gap-1 hover:bg-primary/5 transition-all"
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
                className="w-full p-3 bg-gray-100 dark:bg-gray-800 rounded-xl font-bold outline-none border-2 border-primary dark:text-white"
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
                className="w-full p-3 bg-gray-100 dark:bg-gray-800 rounded-xl font-bold outline-none border-2 border-primary dark:text-white resize-none"
              />
            </div>
            <div className="flex gap-2 text-sm">
              <button type="button" onClick={() => setIsEditingBio(false)} className="flex-1 py-2 bg-gray-200 dark:bg-gray-700 rounded-xl font-bold dark:text-white">Batal</button>
              <button type="button" onClick={handleSaveBio} className="flex-1 py-2 bg-primary dark:text-white rounded-xl font-bold">
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
      </div>

      <div className="grid grid-cols-3 gap-3 text-center dark:text-white">
        <div className="bg-white dark:bg-dark-card p-4 rounded-[1.5rem] border border-gray-100 dark:border-gray-800 shadow-sm">
          <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Rank</p>
          <p className="text-lg font-black text-primary italic uppercase italic">#{myRank}</p>
        </div>
        <div className="bg-white dark:bg-dark-card p-4 rounded-[1.5rem] border border-gray-100 dark:border-gray-800 shadow-sm">
          <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Points</p>
          <p className="text-lg font-black text-primary italic uppercase italic">{myStats?.point || 0}</p>
        </div>
        <div className="bg-white dark:bg-dark-card p-4 rounded-[1.5rem] border border-gray-100 dark:border-gray-800 shadow-sm">
          <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Points Finish</p>
          <p className="text-lg font-black text-primary italic uppercase italic">{myStats?.pointFinish || 0}</p>
        </div>
      </div>
    </motion.div>
  );
};

export default ProfileContent;
