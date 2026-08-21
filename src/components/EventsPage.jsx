import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { CalendarDays, MapPin, Clock8, Users, ExternalLink, Sparkles } from 'lucide-react';
import PublicNavbar from './PublicNavbar';
import { useNavigate } from 'react-router-dom';
import { getFromGas } from '../utils/api';

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

const getEventDateTime = (event) => {
  if (!event) return '';
  const date = formatTanggalIndonesia(event.tanggal_event || '');
  const time = event.waktu_event || event.waktu || '';
  if (date && time) {
    return `${date} • ${time}`;
  }
  return date || time;
};

const getEventTimestamp = (event) => {
  if (!event) return 0;

  const rawDate = String(
    event.tanggal_event ||
    event.tanggal_buat ||
    ''
  ).trim();

  const rawTime = String(
    event.waktu_event ||
    event.waktu ||
    '00:00'
  ).trim();

  if (!rawDate) return 0;

  // ISO: 2026-08-14 / 2026-08-14T00:00:00
  if (/^\d{4}-\d{2}-\d{2}/.test(rawDate)) {
    const isoDate = rawDate.includes('T')
      ? rawDate
      : `${rawDate}T${rawTime.substring(0, 5) || '00:00'}:00`;

    const timestamp = new Date(isoDate).getTime();

    if (!Number.isNaN(timestamp)) {
      return timestamp;
    }
  }

  // Format: DD/MM/YYYY atau DD-MM-YYYY
  const numericMatch = rawDate.match(
    /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/
  );

  if (numericMatch) {
    const [, day, month, year] = numericMatch;

    const timestamp = new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(rawTime.substring(0, 2)) || 0,
      Number(rawTime.substring(3, 5)) || 0
    ).getTime();

    if (!Number.isNaN(timestamp)) {
      return timestamp;
    }
  }

  // Fallback terakhir untuk format tanggal yang bisa dikenali browser.
  const fallback = new Date(`${rawDate} ${rawTime}`).getTime();

  return Number.isNaN(fallback) ? 0 : fallback;
};

const StatusTab = ({ label, active, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${active
      ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30'
      : 'bg-gray-900/80 text-gray-400 border border-white/10 hover:text-white hover:border-white/20'
      }`}
  >
    {label}
  </button>
);

export default function EventsPage({ currentEvent = null, events = [] }) {
  const [activeTab, setActiveTab] = useState('LIVE');
  const [fetchedEvents, setFetchedEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const hasEvent = Boolean(currentEvent && currentEvent.nama);

  useEffect(() => {
    const fetchEvents = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await getFromGas('getEvents');
        if (Array.isArray(res?.events)) {
          setFetchedEvents(res.events);
        } else {
          setFetchedEvents([]);
        }
      } catch (err) {
        console.error('Gagal fetch events:', err);
        setError('Gagal memuat riwayat event.');
        setFetchedEvents([]);
      } finally {
        setLoading(false);
      }
    };
    if (!events || events.length === 0) {
      fetchEvents();
    }
  }, [events]);

  const eventList = Array.isArray(events) && events.length > 0 ? events : fetchedEvents;

  const currentEventId = useMemo(() => currentEvent?.event_id || currentEvent?.id || '', [currentEvent]);

  const normalizedEvents = useMemo(() => {
    return eventList.map(e => ({
      ...e,
      status: String(e.status || '').toLowerCase().trim()
    }));
  }, [eventList]);

  const filteredEvents = useMemo(() => {
    const excludeId = currentEventId;
    let list = normalizedEvents.filter(e => {
      const eventId = e.event_id || e.id || '';
      return eventId && eventId !== excludeId;
    });

    if (activeTab === 'UPCOMING') {
      list = list.filter(e => e.status === 'upcoming');
      list.sort((a, b) => {
        const dateA = a.tanggal_event || a.tanggal_buat || '';
        const dateB = b.tanggal_event || b.tanggal_buat || '';

        if (dateA && dateB) return dateB.localeCompare(dateA);
        if (dateA) return -1;
        if (dateB) return 1;

        return (b.event_id || '').localeCompare(a.event_id || '');
      });
    } else if (activeTab === 'LIVE') {
      list = list.filter(e => e.status === 'aktif');
      list.sort((a, b) => {
        const dateA = a.tanggal_event || a.tanggal_buat || '';
        const dateB = b.tanggal_event || b.tanggal_buat || '';
        if (dateA && dateB) return dateB.localeCompare(dateA);
        if (dateA) return -1;
        if (dateB) return 1;
        return (b.event_id || '').localeCompare(a.event_id || '');
      });
    } else if (activeTab === 'COMPLETED') {
      list = list.filter(e => e.status === 'selesai');

      list.sort((a, b) => {
        const timeA = getEventTimestamp(a);
        const timeB = getEventTimestamp(b);

        // Terbaru → terlama
        if (timeA !== timeB) {
          return timeB - timeA;
        }

        // Kalau tanggal sama, gunakan event_id sebagai tie breaker
        return String(b.event_id || b.id || '').localeCompare(
          String(a.event_id || a.id || '')
        );
      });
    }

    return list;
  }, [normalizedEvents, activeTab, currentEventId]);

  const getStatusLabel = (status) => {
    const s = String(status || '').toLowerCase();
    if (s === 'aktif') return 'LIVE';
    if (s === 'selesai') return 'COMPLETED';
    if (s === 'upcoming') return 'UPCOMING';
    return s.toUpperCase();
  };

  const getStatusColor = (status) => {
    const s = String(status || '').toLowerCase();
    if (s === 'aktif') return 'bg-green-500/20 text-green-400 border-green-500/30';
    if (s === 'selesai') return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    if (s === 'upcoming') return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  };

  const getSectionTitle = () => {
    if (activeTab === 'UPCOMING') return 'UPCOMING EVENTS';
    if (activeTab === 'LIVE') return 'LIVE EVENTS';
    if (activeTab === 'COMPLETED') return 'EVENT HISTORY';
    return '';
  };

  const getSectionSubtitle = () => {
    if (activeTab === 'UPCOMING') return 'Event Mendatang';
    if (activeTab === 'LIVE') return 'Turnamen Sedang Berlangsung';
    if (activeTab === 'COMPLETED') return 'Turnamen Sebelumnya';
    return '';
  };

  const getEmptyMessage = () => {
    if (activeTab === 'UPCOMING') return 'No upcoming events.';
    if (activeTab === 'LIVE') return 'No live events.';
    if (activeTab === 'COMPLETED') return 'No completed events.';
    return '';
  };

  const showEmptyState = filteredEvents.length === 0 && !(hasEvent && activeTab === 'LIVE');

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <PublicNavbar />
      <div className="max-w-5xl mx-auto px-6 pt-20 pb-12">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative mb-8 overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-blue-600/20 via-gray-900 to-cyan-400/10 px-6 py-9 text-center shadow-2xl shadow-black/20"
        >
          <div className="absolute -top-16 -left-16 h-44 w-44 rounded-full bg-blue-500/20 blur-3xl" />
          <div className="absolute -bottom-20 -right-10 h-48 w-48 rounded-full bg-cyan-400/15 blur-3xl" />
          <div className="relative">
            <div className="mx-auto mb-3 flex w-fit items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-[9px] font-black uppercase tracking-[0.2em] text-cyan-200">
              <Sparkles size={12} /> Battle Calendar
            </div>
            <h1 className="text-3xl md:text-5xl font-black italic uppercase tracking-tighter mb-2">
              <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-500 bg-clip-text text-transparent">
                EVENTS
              </span>
            </h1>
            <p className="text-xs font-black text-gray-500 uppercase tracking-[0.2em]">
              Lalapan Beyblade Tournament
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-left">
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-2.5">
                <CalendarDays size={18} className="text-cyan-300" />
                <div>
                  <p className="text-[8px] font-black uppercase tracking-widest text-gray-500">Total Event</p>
                  <p className="mt-0.5 text-lg font-black italic text-white">{normalizedEvents.length + (hasEvent ? 1 : 0)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-green-400/20 bg-green-500/10 px-4 py-2.5">
                <span className="h-2.5 w-2.5 rounded-full bg-green-400 shadow-[0_0_12px_rgba(74,222,128,0.8)]" />
                <div>
                  <p className="text-[8px] font-black uppercase tracking-widest text-green-200/60">Sedang berjalan</p>
                  <p className="mt-0.5 text-lg font-black italic text-white">{hasEvent ? '1 Event' : 'Tidak ada'}</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Status Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-10"
        >
          <div className="flex items-center justify-center gap-2">
            <StatusTab
              label="UPCOMING"
              active={activeTab === 'UPCOMING'}
              onClick={() => setActiveTab('UPCOMING')}
            />
            <StatusTab
              label="LIVE"
              active={activeTab === 'LIVE'}
              onClick={() => setActiveTab('LIVE')}
            />
            <StatusTab
              label="COMPLETED"
              active={activeTab === 'COMPLETED'}
              onClick={() => setActiveTab('COMPLETED')}
            />
          </div>
        </motion.div>

        {/* Featured / Active Event */}
        {hasEvent && activeTab === 'LIVE' && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-16"
          >
            <div className="bg-gray-900/80 backdrop-blur-sm rounded-[2.5rem] border border-white/5 overflow-hidden">
              <div className="p-6 md:p-8">
                {/* Event Header */}
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
                  <div>
                    <span className="inline-block px-3 py-1 rounded-full bg-blue-500/20 text-blue-400 text-[9px] font-black uppercase tracking-widest mb-3">
                      Featured Event
                    </span>
                    <h2 className="text-2xl md:text-3xl font-black italic uppercase tracking-tight leading-tight">
                      {currentEvent.nama}
                    </h2>
                  </div>
                  {currentEvent.count !== undefined && (
                    <div className="flex items-center gap-2 text-gray-400">
                      <Users size={18} />
                      <span className="text-sm font-black">{currentEvent.count} Bladers</span>
                    </div>
                  )}
                </div>

                {/* Event Details */}
                <div className="space-y-3 mb-8">
                  {currentEvent.lokasi && (
                    <div className="flex items-center gap-3 text-sm font-bold text-gray-300">
                      <div className="w-8 h-8 rounded-lg bg-gray-800/80 flex items-center justify-center flex-shrink-0">
                        <MapPin size={16} className="text-gray-400" />
                      </div>
                      <span>{currentEvent.lokasi}</span>
                    </div>
                  )}
                  {currentEvent && (
                    <div className="flex items-center gap-3 text-sm font-bold text-gray-300">
                      <div className="w-8 h-8 rounded-lg bg-gray-800/80 flex items-center justify-center flex-shrink-0">
                        <Clock8 size={16} className="text-gray-400" />
                      </div>
                      <span>{getEventDateTime(currentEvent)}</span>
                    </div>
                  )}
                </div>

                {/* CTA */}
                {currentEvent.id && (
                  <motion.button
                    type="button"
                    onClick={() => navigate(`/events/${currentEvent.id}`)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-500 px-8 py-4 rounded-2xl font-black uppercase italic text-sm shadow-2xl shadow-blue-600/40 hover:shadow-blue-500/60 transition-all"
                  >
                    <ExternalLink size={18} />
                    View Event
                  </motion.button>
                )}
              </div>

              {/* Decorative background */}
              <div className="absolute -right-10 -top-10 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
            </div>
          </motion.div>
        )}

        {/* Empty state for LIVE tab when no current event */}
        {!hasEvent && activeTab === 'LIVE' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-20"
          >
            <CalendarIcon className="text-gray-700 mx-auto mb-4" size={48} />
            <p className="text-sm font-black text-gray-600 uppercase tracking-widest">
              No live events.
            </p>
          </motion.div>
        )}

        {/* Event Lists */}
        {(activeTab === 'UPCOMING' || activeTab === 'LIVE' || activeTab === 'COMPLETED') && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center">
                <CalendarIcon className="text-orange-400" size={20} />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase italic tracking-tight">
                  {getSectionTitle()}
                </h3>
                <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">
                  {getSectionSubtitle()}
                </p>
              </div>
            </div>

            {loading ? (
              <div className="bg-gray-900/80 backdrop-blur-sm rounded-[2.5rem] border border-white/5 p-6 md:p-8">
                <div className="text-center py-12">
                  <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Memuat event...</p>
                </div>
              </div>
            ) : error ? (
              <div className="bg-gray-900/80 backdrop-blur-sm rounded-[2.5rem] border border-white/5 p-6 md:p-8">
                <div className="text-center py-12">
                  <p className="text-sm font-black text-red-400 uppercase tracking-widest mb-4">{error}</p>
                  <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="px-6 py-3 bg-primary text-white rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 transition-all"
                  >
                    Coba Lagi
                  </button>
                </div>
              </div>
            ) : showEmptyState ? (
              <div className="bg-gray-900/80 backdrop-blur-sm rounded-[2.5rem] border border-white/5 p-6 md:p-8">
                <div className="text-center py-12">
                  <CalendarIcon className="text-gray-700 mx-auto mb-4" size={36} />
                  <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest">
                    {getEmptyMessage()}
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredEvents.map((event, index) => (
                  <motion.div
                    key={event.event_id || event.id || index}
                    custom={index}
                    variants={fadeUp}
                    initial="hidden"
                    animate="visible"
                    className="bg-gray-900/80 backdrop-blur-sm rounded-[2.5rem] border border-white/5 p-5 md:p-6 flex flex-col justify-between hover:border-white/10 transition-all cursor-pointer"
                    onClick={() => navigate(`/events/${event.event_id || event.id}`)}
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        <span className={`inline-block px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${getStatusColor(event.status)}`}>
                          {getStatusLabel(event.status)}
                        </span>
                        {String(event.status || '').toLowerCase() === 'aktif' && (
                          <span className={`inline-block px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${event.tournament_status === 'not_started' ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' :
                            event.tournament_status === 'running' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
                              event.tournament_status === 'finished' ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' :
                                'bg-gray-500/20 text-gray-400 border-gray-500/30'
                            }`}>
                            {event.tournament_status === 'not_started' ? 'CHECK-IN OPEN' :
                              event.tournament_status === 'running' ? 'TOURNAMENT RUNNING' :
                                event.tournament_status === 'finished' ? 'TOURNAMENT FINISHED' :
                                  String(event.tournament_status || '').toUpperCase()}
                          </span>
                        )}
                      </div>
                      <h4 className="text-base md:text-lg font-black italic uppercase tracking-tight leading-tight mb-3">
                        {event.nama}
                      </h4>
                      <div className="space-y-2">
                        {getEventDateTime(event) && (
                          <div className="flex items-center gap-2 text-[11px] font-bold text-gray-400">
                            <Clock8 size={14} className="text-gray-500" />
                            <span>{getEventDateTime(event)}</span>
                          </div>
                        )}
                        {event.lokasi && (
                          <div className="flex items-center gap-2 text-[11px] font-bold text-gray-400">
                            <MapPin size={14} className="text-gray-500" />
                            <span>{event.lokasi}</span>
                          </div>
                        )}
                        {String(event.status || '').toLowerCase() === 'aktif' && (
                          <div className="flex items-center gap-2 text-[11px] font-bold text-green-400">
                            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                            <span>LIVE NOW · {event.count ?? 0} Bladers</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="mt-4">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/events/${event.event_id || event.id}`);
                        }}
                        className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-500 px-6 py-3 rounded-2xl font-black uppercase italic text-sm shadow-lg shadow-blue-600/30 hover:shadow-blue-500/50 transition-all active:scale-95"
                      >
                        <ExternalLink size={14} />
                        View Event
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </div>
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
