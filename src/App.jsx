import { useContext, useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AuthContext } from './context/AuthContext';
import GoogleSignInButton from './components/GoogleSignInButton';
import UserAvatar from './components/UserAvatar';
import PullToRefresh from 'react-simple-pull-to-refresh';
import { AnimatePresence, motion } from 'framer-motion';
import {
  LogOut, Loader2, MapPin, Trophy, UserCircle, ShieldCheck, Swords, Minimize, BookOpen
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { getFromGas, postToGas, postToGasLongRunning, updateBio, uploadProfilePhoto, updatePoints, createTournament, startEvent, endEvent, finishTournament, updateEvent } from './utils/api';
import CancelModal from './components/CancelModal';
import CreateEventModal from './components/CreateEventModal';
import ConfirmModal from './components/ConfirmModal';
import EditEventModal from './components/EditEventModal';
import EventCard from './components/EventCard';
import BladersPage from './components/BladersPage';
import ParticipantList from './components/ParticipantList';
import StandingsContent from './components/StandingsContent';
import AdminContent from './components/AdminContent';
import ProfileContent from './components/ProfileContent';
import Rule from './components/Rule';
import ProfileModal from './components/ProfileModal';
import RefereeArena from './components/RefereeArena';
import LandingPage from './components/LandingPage';
import RankingsPage from './components/RankingsPage';
import EventsPage from './components/EventsPage';
import EventDetailPage from './components/EventDetailPage';
import RuleDetailPage from './components/RuleDetailPage';
import BladerProfilePage from './components/BladerProfilePage';

export default function App() {
  const { user, login, logout, updateUser, currentPlayer, setPlayer, refreshPlayer } = useContext(AuthContext);

  const isValidUser = Boolean(user && user.sub && user.email);
  const [pathname, setPathname] = useState(window.location.pathname);

  useEffect(() => {
    const handleRouteChange = () => setPathname(window.location.pathname);
    window.addEventListener('popstate', handleRouteChange);
    return () => window.removeEventListener('popstate', handleRouteChange);
  }, []);

  const getRouteDataPlan = (pathnameToCheck) => {
    const route = pathnameToCheck.split('?')[0];

    switch (route) {
      case '/':
        return ['currentPlayer', 'checkProfile', 'getEvent', 'getEvents', 'getLeaderboard', 'getSettings'];
      case '/ranking':
        return ['currentPlayer', 'getLeaderboard'];
      case '/events':
        return ['currentPlayer', 'getEvents'];
      case '/profile':
        return ['currentPlayer', 'checkProfile', 'getLeaderboard', 'getMyDecks', 'getBeybladeParts'];
      case '/admin':
        return ['currentPlayer', 'checkProfile', 'getEvents', 'getRules', 'getLeaderboard'];
      case '/arena':
        return ['currentPlayer', 'checkProfile', 'getEvents', 'getLeaderboard'];

      // Public pages own their data fetching. App should not treat an empty
      // initial request plan as a global failure during a hard refresh.
      case '/bladers':
      default:
        return [];
    }
  };

  useEffect(() => {
    const root = document.getElementById('root');
    if (root?.style) {
      root.style.paddingTop = 'env(safe-area-inset-top)';
      root.style.paddingBottom = 'env(safe-area-inset-bottom)';
    }
  }, []);

  const [data, setData] = useState({ event: null, participants: [], count: 0, challongeUrl: '' });
  const [events, setEvents] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [blader, setBlader] = useState(null);
  const [settings, setSettings] = useState({});
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isLoadingPublic, setIsLoadingPublic] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUpdatingPoints, setIsUpdatingPoints] = useState(false);
  const [isOnboarding, setIsOnboarding] = useState(false);
  const [initError, setInitError] = useState(null);
  const [initStatus, setInitStatus] = useState({});
  const [newNickname, setNewNickname] = useState('');
  const [activeTab, setActiveTab] = useState('arena');
  const [showEventModal, setShowEventModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmModalData, setConfirmModalData] = useState({ title: '', message: '', confirmLabel: '', isSubmitting: false, variant: 'danger', onConfirm: () => {} });
  const [showEditModal, setShowEditModal] = useState(false);
  const [isEditingEvent, setIsEditingEvent] = useState(false);
  const [editEventInitialData, setEditEventInitialData] = useState({});
  const [modalProfile, setModalProfile] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [excludedPlayerIds, setExcludedPlayerIds] = useState([]);

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
      if (res && res.status === 'timeout') {
        return { status: 'timeout', message: res.message, data: data };
      }
      if (res && res.status === 'error') {
        return { status: 'error', message: res.message, data: data };
      }
      if (res) {
        setData(res);
      }
      return { status: 'success', data: res };
    } catch (err) {
      console.error('Gagal fetch event:', err);
      return { status: 'error', error: err, data: data };
    }
  };

  const refreshEvents = async () => {
    try {
      const res = await getFromGas('getEvents');
      if (res && res.status === 'timeout') {
        return { status: 'timeout', message: res.message, data: events };
      }
      if (res && res.status === 'error') {
        return { status: 'error', message: res.message, data: events };
      }
      if (Array.isArray(res?.events)) {
        setEvents(res.events);
      } else {
        setEvents([]);
      }
      return { status: 'success', data: res };
    } catch (err) {
      console.error('Gagal fetch events:', err);
      return { status: 'error', error: err, data: events };
    }
  };

  const refreshLeaderboard = async () => {
    try {
      const res = await getFromGas('getLeaderboard', true);
      if (res && res.status === 'timeout') {
        return { status: 'timeout', message: res.message, data: leaderboard };
      }
      if (res && res.status === 'error') {
        return { status: 'error', message: res.message, data: leaderboard };
      }
      if (res && Array.isArray(res)) setLeaderboard(res);
      return { status: 'success', data: res };
    } catch (err) {
      console.error('Gagal fetch leaderboard:', err);
      return { status: 'error', error: err, data: leaderboard };
    }
  };

  const refreshRules = async () => {
    try {
      const res = await getFromGas('getRules');
      if (res && res.status === 'timeout') {
        return { status: 'timeout', message: res.message, data: rules };
      }
      if (res && res.status === 'error') {
        return { status: 'error', message: res.message, data: rules };
      }
      if (Array.isArray(res)) setRules(res);
      return { status: 'success', data: res };
    } catch (err) {
      console.error('Gagal fetch rules:', err);
      return { status: 'error', error: err, data: rules };
    }
  };

  const checkProfile = async () => {
    try {
      const googleId = user?.sub;
      const email = user?.email;
      const res = await getFromGas('getBlader', true, {
        googleId,
        email
      });

      if (res && (res.status === 'timeout' || res.status === 'error')) {
        return { status: res.status, message: res.message, data: blader };
      }

      if (res?.registered === true) {
        setBlader(res);
        setIsOnboarding(false);
        const photo = res.foto || res.photo;
        if (photo && photo !== user.picture) {
          updateUser({ ...user, picture: photo });
        }

        const minimalPlayer = {
          nickname: res.nickname || '',
          photoUrl: photo || user.picture || '',
          role: res.role || 'Blader',
          publicProfileId: res.public_profile_id || ''
        };
        setPlayer(minimalPlayer);
      } else if (res?.registered === false) {
        setIsOnboarding(true);
        setPlayer(null);
      } else if (res?.error) {
        throw new Error(res.error);
      } else {
        throw new Error('Response profile tidak valid');
      }
      return { status: 'success', data: res };
    } catch (err) {
      console.error('Gagal fetch profile:', err);
      return { status: 'error', error: err, data: blader };
    }
  };

  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  const retryRequest = async (fn, label, maxRetries = 2, baseDelay = 1000, timeoutMs = 8000) => {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await Promise.race([
          fn(),
          new Promise((_, reject) => setTimeout(() => reject(new Error(`Timeout: ${label} (> ${timeoutMs}ms)`)), timeoutMs))
        ]);
        if (attempt > 0) {
        }
        return { status: 'success', data: result };
      } catch (err) {
        const isTimeout = err?.code === 'ECONNABORTED' || err?.message?.includes('timeout');
        const isNetwork = err?.code === 'ERR_NETWORK' || err?.message?.includes('Network Error');
        const retryable = isTimeout || isNetwork;
        
        
        if (!retryable || attempt === maxRetries) {
          return { 
            status: isTimeout ? 'timeout' : 'error', 
            error: err,
            message: isTimeout ? `Request timeout untuk ${label}` : `Gagal terhubung ke server (${label})`
          };
        }
        
        await sleep(baseDelay * Math.pow(2, attempt));
      }
    }
    return { status: 'timeout', message: `Request timeout untuk ${label}` };
  };

  const initApp = async () => {
    setLoading(true);
    setIsLoadingPublic(true);
    setInitError(null);
    setInitStatus({});
    
    try {
      const routePlan = getRouteDataPlan(pathname);
      
      const fetchPromises = [];
      const fetchLabels = [];

      // CRITICAL: currentPlayer from cache - don't wait for API
      if (routePlan.includes('currentPlayer')) {
        if (currentPlayer) {
        } else {
        }
      }

      // Route-aware data fetching
      if (routePlan.includes('getEvent')) {
        fetchPromises.push(retryRequest(() => refreshEvent(), 'getEvent', 2, 1000, 8000));
        fetchLabels.push('event');
      }
      if (routePlan.includes('getEvents')) {
        fetchPromises.push(retryRequest(() => refreshEvents(), 'getEvents', 2, 1000, 8000));
        fetchLabels.push('events');
      }
      if (routePlan.includes('getLeaderboard')) {
        fetchPromises.push(retryRequest(() => refreshLeaderboard(), 'getLeaderboard', 2, 1000, 8000));
        fetchLabels.push('leaderboard');
      }
      if (routePlan.includes('getRules')) {
        fetchPromises.push(retryRequest(() => refreshRules(), 'getRules', 2, 1000, 8000));
        fetchLabels.push('rules');
      }
      if (routePlan.includes('getSettings')) {
        fetchPromises.push(retryRequest(() => getFromGas('getSettings'), 'getSettings', 2, 1000, 8000));
        fetchLabels.push('settings');
      }
      if (routePlan.includes('checkProfile')) {
        fetchPromises.push(retryRequest(() => checkProfile(), 'checkProfile', 2, 1000, 8000));
        fetchLabels.push('profile');
      }

      // Background retry for non-critical data
      const backgroundRetries = [];
      const backgroundLabels = [];
      if (routePlan.includes('getMyDecks')) {
        backgroundRetries.push(retryRequest(() => getMyDecks({ filter: 'all', googleId: user?.sub }), 'getMyDecks', 2, 1000, 8000));
        backgroundLabels.push('getMyDecks');
      }
      if (routePlan.includes('getBeybladeParts')) {
        backgroundRetries.push(retryRequest(() => getBeybladeParts(), 'getBeybladeParts', 2, 1000, 8000));
      }

      const results = await Promise.allSettled(fetchPromises);

      const statusMap = {};
      let hasAnySuccess = false;
      let allFailed = fetchPromises.length > 0;

      results.forEach((result, index) => {
        const label = fetchLabels[index];
        
        if (result.status === 'fulfilled') {
          hasAnySuccess = true;
          allFailed = false;
          statusMap[label] = { status: result.value.status, message: result.value.message };
        } else {
          statusMap[label] = { status: 'error', message: result.reason?.message || 'Unknown error' };
        }
      });

      setInitStatus(statusMap);

      if (fetchPromises.length === 0) {
        setInitError(null);
      } else if (allFailed) {
        setInitError('Gagal memuat data. Periksa koneksi internet.');
      } else {
        setInitError(null);
      }

      // Fire background retries
      if (backgroundRetries.length > 0) {
        Promise.allSettled(backgroundRetries).then(backgroundResults => {
          backgroundResults.forEach((result, index) => {
            const label = backgroundLabels[index] || 'unknown';
            if (result.status === 'fulfilled') {
              const status = result.value.status;
              if (status === 'success') {
              } else if (status === 'timeout') {
              } else {
              }
            } else {
            }
          });
        });
      }
    } catch (err) {
      console.error('Gagal inisialisasi app:', err);
      setInitError('Gagal memuat data. Periksa koneksi internet.');
    } finally {
      setLoading(false);
      setIsLoadingPublic(false);
    }
  };

  const retryInit = async () => {
    await initApp();
  };

  const retrySpecific = async (label) => {
    let result;
    switch (label) {
      case 'profile':
        result = await retryRequest(() => checkProfile(), 'checkProfile');
        if (result.status === 'success') setInitStatus(prev => ({ ...prev, profile: { status: 'success' } }));
        break;
      case 'settings':
        result = await retryRequest(() => getFromGas('getSettings'), 'getSettings');
        if (result.status === 'success') {
          setSettings(result.data || {});
          setInitStatus(prev => ({ ...prev, settings: { status: 'success' } }));
        }
        break;
      case 'event':
        result = await retryRequest(() => refreshEvent(), 'refreshEvent');
        if (result.status === 'success') setInitStatus(prev => ({ ...prev, event: { status: 'success' } }));
        break;
      case 'events':
        result = await retryRequest(() => refreshEvents(), 'refreshEvents');
        if (result.status === 'success') setInitStatus(prev => ({ ...prev, events: { status: 'success' } }));
        break;
      case 'leaderboard':
        result = await retryRequest(() => refreshLeaderboard(), 'refreshLeaderboard');
        if (result.status === 'success') setInitStatus(prev => ({ ...prev, leaderboard: { status: 'success' } }));
        break;
      case 'rules':
        result = await retryRequest(() => refreshRules(), 'refreshRules');
        if (result.status === 'success') setInitStatus(prev => ({ ...prev, rules: { status: 'success' } }));
        break;
    }
  };

  const fetchPublicData = async () => {
    setIsLoadingPublic(true);
    try {
      const routePlan = getRouteDataPlan(pathname);
      const publicPromises = [];
      
      if (routePlan.includes('getEvent')) {
        publicPromises.push(retryRequest(() => refreshEvent(), 'refreshEvent', 2, 1000, 8000));
      }
      if (routePlan.includes('getEvents')) {
        publicPromises.push(retryRequest(() => refreshEvents(), 'refreshEvents', 2, 1000, 8000));
      }
      if (routePlan.includes('getLeaderboard')) {
        publicPromises.push(retryRequest(() => refreshLeaderboard(), 'refreshLeaderboard', 2, 1000, 8000));
      }
      
      await Promise.allSettled(publicPromises);
    } catch (err) {
      console.error('Gagal fetch data publik:', err);
    } finally {
      setIsLoadingPublic(false);
    }
  };

  const handleGoogleLogin = async (userData) => {
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
  };

  useEffect(() => {
    if (user) {
      initApp();
    } else {
      setLoading(false);
      fetchPublicData();
    }
  }, [user, pathname]);

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

  const handleAttendEvent = async (eventId) => {
    if (!user?.sub || !eventId) return;
    setIsSubmitting(true);
    const payload = { eventId, googleId: user.sub, nickname: blader?.nickname || user.name, email: user.email, foto: blader?.photo || user.picture };
    const res = await postToGas('attendance', payload);
    if (res?.status === 'success') {
      toast.success('Ready to Battle!');
      await Promise.all([refreshEvent(), refreshEvents()]);
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
      await Promise.all([refreshEvent(), refreshEvents()]);
    } else {
      toast.error(res?.message || 'Gagal terhubung ke server');
    }
    setIsSubmitting(false);
  };

  const handleGenerateTournament = async (opts = {}) => {
    const { format = 'weekly', swissRounds } = opts;
    if (!data?.event?.id) return toast.error('Tidak ada event aktif!');
    setIsGenerating(true);
    try {
      const challongeFormat = format === 'final' ? 'double elimination' : 'swiss';
      const loadingToast = toast.loading('Sedang membuat tournament, menambahkan peserta, mengacak peserta, dan memulai tournament...');
      const createRes = await postToGasLongRunning('createTournament', {
        eventId: data.event.id,
        format: challongeFormat,
        swiss_rounds: format === 'weekly' ? Number(swissRounds) || 3 : undefined
      });
      toast.dismiss(loadingToast);
      if (createRes?.status === 'success') {
        toast.success(format === 'weekly' ? 'Turnamen Weekly Dimulai!' : 'Turnamen Final Dimulai!');
        refreshEvent();
        refreshEvents();
      } else if (createRes?.status === 'timeout') {
        toast.error(createRes?.message || 'Proses mungkin masih berjalan. Jangan klik Generate Bracket lagi.');
      } else {
        toast.error(createRes?.message || 'Gagal generate turnamen');
      }
    } catch {
      toast.error('Proses mungkin masih berjalan. Jangan klik Generate Bracket lagi.');
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
      toast.error('Gagal simpan bio');
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
      refreshEvent();
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
      toast.error('Gagal update pengaturan');
    }
    setIsSubmitting(false);
  };

  const handleConfirmAction = async () => {
    const { onConfirm, isSubmitting: modalSubmitting } = confirmModalData;
    if (modalSubmitting) return;
    setConfirmModalData(prev => ({ ...prev, isSubmitting: true }));
    try {
      await onConfirm();
    } finally {
      setConfirmModalData(prev => ({ ...prev, isSubmitting: false }));
      setShowConfirmModal(false);
    }
  };

  const handleEditEvent = async (formData) => {
    setIsEditingEvent(true);
    try {
      const res = await updateEvent(formData);
      if (res?.status === 'success') {
        toast.success('Event berhasil diperbarui');
        setShowEditModal(false);
        await Promise.all([refreshEvent(), refreshEvents()]);
      } else {
        toast.error(res?.message || 'Gagal mengedit event');
      }
    } catch {
      toast.error('Gagal mengedit event');
    } finally {
      setIsEditingEvent(false);
    }
  };

  const openStartConfirm = (eventId) => {
    const targetEventId = eventId || data?.event?.id;
    setConfirmModalData({
      title: 'Mulai event sekarang?',
      message: 'Event akan diubah dari UPCOMING menjadi LIVE. Pastikan peserta sudah siap.',
      confirmLabel: 'Mulai',
      isSubmitting: false,
      variant: 'success',
      onConfirm: async () => {
        if (!targetEventId) {
          toast.error('Event tidak ditemukan');
          throw new Error('Event tidak ditemukan');
        }
        const res = await startEvent(targetEventId);
        if (res?.status === 'success') {
          toast.success('Event berhasil dimulai.');
          await Promise.all([refreshEvent(), refreshEvents()]);
        } else {
          toast.error(res?.message || 'Gagal memulai event');
          throw new Error(res?.message || 'Gagal memulai event');
        }
      }
    });
    setShowConfirmModal(true);
  };

  const openEndConfirm = (eventId) => {
    const targetEventId = eventId || data?.event?.id;
    setConfirmModalData({
      title: 'Akhiri event ini?',
      message: 'Event akan diubah dari LIVE menjadi COMPLETED. Pastikan tournament sudah selesai.',
      confirmLabel: 'Akhiri',
      isSubmitting: false,
      variant: 'danger',
      onConfirm: async () => {
        if (!targetEventId) {
          toast.error('Event tidak ditemukan');
          throw new Error('Event tidak ditemukan');
        }
        const res = await endEvent(targetEventId);
        if (res?.status === 'success') {
          toast.success('Event berhasil diselesaikan.');
          await Promise.all([refreshEvent(), refreshEvents()]);
        } else {
          toast.error(res?.message || 'Gagal mengakhiri event');
          throw new Error(res?.message || 'Gagal mengakhiri event');
        }
      }
    });
    setShowConfirmModal(true);
  };

  const openStartTournamentConfirm = (eventId) => {
    const targetEventId = eventId || data?.event?.id;
    setConfirmModalData({
      title: 'Mulai tournament?',
      message: 'Tournament akan diubah dari NOT STARTED menjadi RUNNING. Check-in akan ditutup.',
      confirmLabel: 'Mulai Tournament',
      isSubmitting: false,
      variant: 'success',
      onConfirm: async () => {
        if (!targetEventId) {
          toast.error('Event tidak ditemukan');
          throw new Error('Event tidak ditemukan');
        }
        const res = await startTournamentStatus(targetEventId);
        if (res?.status === 'success') {
          toast.success('Tournament berhasil dimulai.');
          await Promise.all([refreshEvent(), refreshEvents()]);
        } else {
          const message = res?.message || res?.error || 'Gagal memulai tournament';
          toast.error(message);
          throw new Error(message);
        }
      }
    });
    setShowConfirmModal(true);
  };

  const openFinishTournamentConfirm = (eventId) => {
    const targetEventId = eventId || data?.event?.id;
    setConfirmModalData({
      title: 'Finish tournament?',
      message: 'Status tournament akan berubah menjadi FINISHED. Rekap hasil belum dilakukan.',
      confirmLabel: 'FINISH TOURNAMENT',
      isSubmitting: false,
      loadingMessage: 'Finishing tournament...',
      loadingSubMessage: 'Sedang mengubah status tournament.',
      variant: 'warning',
      onConfirm: async () => {
        if (!targetEventId) {
          toast.error('Event tidak ditemukan');
          throw new Error('Event tidak ditemukan');
        }
        const res = await postToGasLongRunning('finishTournament', { eventId: targetEventId });
        if (res?.status === 'success') {
          toast.success('TOURNAMENT FINISHED');
          await Promise.all([refreshEvent(), refreshEvents()]);
        } else if (res?.status === 'timeout') {
          toast.error(res?.message || 'Proses mungkin masih berlangsung. Jangan tekan lagi.');
          throw new Error(res?.message || 'Timeout');
        } else {
          const message = res?.message || res?.error || 'Gagal menyelesaikan tournament';
          toast.error(message);
          throw new Error(message);
        }
      }
    });
    setShowConfirmModal(true);
  };

  const openEditModal = () => {
    setEditEventInitialData({
      event_id: data?.event?.id || data?.event?.event_id,
      id: data?.event?.id || data?.event?.event_id,
      nama: data?.event?.nama || '',
      lokasi: data?.event?.lokasi || '',
      tanggal_event: data?.event?.tanggal_event || '',
      waktu_event: data?.event?.waktu_event || data?.event?.waktu || '',
      rule_id: data?.event?.rule_id || ''
    });
    setShowEditModal(true);
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

  if (initError && isValidUser && Object.keys(initStatus).length === 0) {
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

  const MainApp = () => {
    const navigate = useNavigate();
    
    const failedSections = Object.entries(initStatus)
      .filter(([_, status]) => status && status.status && status.status !== 'success')
      .map(([label, _]) => label);

    return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-bg transition-colors duration-500 pb-28 pt-[max(env(safe-area-inset-top),1.5rem)] dark:text-white overflow-y-auto">
      {failedSections.length > 0 && (
        <div className="mx-6 mt-4 mb-2 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-2xl">
          <p className="text-yellow-400 font-black text-xs uppercase tracking-widest mb-2">
            Beberapa data belum dapat diperbarui. Data terakhir tetap ditampilkan.
          </p>
          <div className="flex flex-wrap gap-2">
            {failedSections.map(section => (
              <button
                key={section}
                type="button"
                onClick={() => retrySpecific(section)}
                className="px-3 py-1.5 bg-yellow-500/20 text-yellow-300 rounded-lg font-black text-[10px] uppercase tracking-widest hover:bg-yellow-500/30 transition-colors"
              >
                Retry {section}
              </button>
            ))}
          </div>
        </div>
      )}
      <CreateEventModal
        show={showEventModal}
        onClose={() => setShowEventModal(false)}
        onSubmit={handleSubmitEvent}
        isSubmitting={isSubmitting}
        rules={rules}
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
      <ConfirmModal
        show={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={handleConfirmAction}
        title={confirmModalData.title}
        message={confirmModalData.message}
        confirmLabel={confirmModalData.confirmLabel}
        isSubmitting={confirmModalData.isSubmitting}
        variant={confirmModalData.variant}
      />
      <EditEventModal
        show={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSubmit={handleEditEvent}
        isSubmitting={isEditingEvent}
        initialData={editEventInitialData}
        rules={rules}
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
            <RefereeArena 
              key="referee" 
              masterPlayers={leaderboard}
              events={events}
              externalExcludedPlayerIds={excludedPlayerIds}
              onExcludedPlayersChange={setExcludedPlayerIds}
            />
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
                    eventStatus={data.event?.status}
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
                  user={user}
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
                  currentEvent={data?.event}
                  events={events}
                  onRefreshEvent={refreshEvent}
                  onStartEvent={openStartConfirm}
                  onEndEvent={openEndConfirm}
                  onFinishTournament={openFinishTournamentConfirm}
                  onEditEvent={openEditModal}
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
        <button type="button" onClick={() => navigate('/arena')} className="flex-1 flex flex-col items-center gap-1 py-3 rounded-[2rem] transition-all text-gray-400 hover:text-white">
          <MapPin size={18} /><span className="text-[8px] font-black uppercase italic tracking-tighter leading-none">Arena</span>
        </button>
        <button type="button" onClick={() => navigate('/')} className="flex-1 flex flex-col items-center gap-1 py-3 rounded-[2rem] transition-all text-gray-400 hover:text-white">
          <Trophy size={18} /><span className="text-[8px] font-black uppercase italic tracking-tighter leading-none">Standings</span>
        </button>
        <button type="button" onClick={() => navigate('/')} className="flex-1 flex flex-col items-center gap-1 py-3 rounded-[2rem] transition-all text-gray-400 hover:text-white">
          <BookOpen size={18} /><span className="text-[8px] font-black uppercase italic tracking-tighter leading-none">Rule</span>
        </button>
        {blader?.role === 'Admin' && (
          <>
            <button type="button" onClick={() => navigate('/admin')} className="flex-1 flex flex-col items-center gap-1 py-3 rounded-[2rem] transition-all text-gray-400 hover:text-white">
              <ShieldCheck size={18} /><span className="text-[8px] font-black uppercase italic tracking-tighter leading-none">Admin</span>
            </button>
            <button type="button" onClick={() => navigate('/arena')} className="flex-1 flex flex-col items-center gap-1 py-3 rounded-[2rem] transition-all text-gray-400 hover:text-white">
              <Swords size={18} /><span className="text-[8px] font-black uppercase italic tracking-tighter leading-none">Referee</span>
            </button>
          </>
        )}
        <button type="button" onClick={() => navigate('/profile')} className="flex-1 flex flex-col items-center gap-1 py-3 rounded-[2rem] transition-all text-gray-400 hover:text-white">
          <UserCircle size={18} /><span className="text-[8px] font-black uppercase italic tracking-tighter leading-none">Profile</span>
        </button>
      </nav>
    </div>
   );
  };

  return (
    <>
      <CreateEventModal
        show={showEventModal}
        onClose={() => setShowEventModal(false)}
        onSubmit={handleSubmitEvent}
        isSubmitting={isSubmitting}
        rules={rules}
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
      <ConfirmModal
        show={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={handleConfirmAction}
        title={confirmModalData.title}
        message={confirmModalData.message}
        confirmLabel={confirmModalData.confirmLabel}
        isSubmitting={confirmModalData.isSubmitting}
        variant={confirmModalData.variant}
      />
      <EditEventModal
        show={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSubmit={handleEditEvent}
        isSubmitting={isEditingEvent}
        initialData={editEventInitialData}
        rules={rules}
      />
      <ProfileModal player={modalProfile} loading={modalLoading} onClose={closeProfile} />
      <Toaster position="top-center" />
      <Router>
      <Routes>
        <Route
          path="/"
          element={
            isValidUser && isOnboarding ? (
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
            ) : (
              <LandingPage
                leaderboard={leaderboard}
                currentEvent={data.event}
                isLoadingPublic={isLoadingPublic}
                onGoogleLogin={handleGoogleLogin}
              />
            )
          }
        />
        <Route
          path="/ranking"
          element={
            <RankingsPage
              leaderboard={leaderboard}
              currentUser={user}
            />
          }
        />
        <Route
          path="/bladers"
          element={<BladersPage />}
        />
        <Route
          path="/bladers/:profileId"
          element={<BladerProfilePage />}
        />
        <Route
          path="/events"
          element={
            <EventsPage
              currentEvent={data.event}
              events={events}
            />
          }
        />
        <Route
          path="/events/:id"
          element={<EventDetailPage />}
        />
        <Route
          path="/rules/:id"
          element={<RuleDetailPage />}
        />
        <Route
          path="/profile"
          element={
            isValidUser ? (
              <ProfileContent
                blader={blader}
                user={user}
                settings={settings}
                leaderboard={leaderboard}
                onUpdateNickname={handleUpdateNickname}
                onUpdateBio={handleUpdateBio}
                onUploadPhoto={handleUploadPhoto}
                isSubmitting={isSubmitting}
              />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        <Route
          path="/admin"
          element={
            String(blader?.role || '').toLowerCase() === 'admin' ? (
              <AdminContent
                key="admin"
                user={user}
                onCreateEvent={() => setShowEventModal(true)}
                onGenerateTournament={handleGenerateTournament}
                onUpdatePoints={handleUpdatePoints}
                onToggleNickname={handleToggleNickname}
                nicknameAllowed={settings.allow_nickname_change === true || settings.allow_nickname_change === 'true'}
                leaderboard={leaderboard}
                rules={rules}
                onRefreshRules={refreshRules}
                isSubmitting={isSubmitting}
                isGenerating={isGenerating}
                isUpdatingPoints={isUpdatingPoints}
                eventId={data?.event?.id}
                currentEvent={data?.event}
                events={events}
                onRefreshEvent={refreshEvent}
                onStartEvent={openStartConfirm}
                onEndEvent={openEndConfirm}
                onFinishTournament={openFinishTournamentConfirm}
                onEditEvent={handleEditEvent}
              />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        <Route
          path="/arena"
          element={
            isValidUser ? (
              <RefereeArena
                key="referee"
                masterPlayers={leaderboard}
                events={events}
                externalExcludedPlayerIds={excludedPlayerIds}
                onExcludedPlayersChange={setExcludedPlayerIds}
              />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
    </>
  );
}
