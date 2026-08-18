import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, BookOpen, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
import PublicNavbar from './PublicNavbar';
import { getFromGas } from '../utils/api';

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.4, ease: 'easeOut' }
  })
};

const getDriveDirectUrl = (url) => {
  if (!url) return null;
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  return match ? `https://lh3.googleusercontent.com/d/${match[1]}` : url;
};

const formatPeriode = (value) => {
  if (!value) return '';
  const str = String(value).trim();

  if (/^\d{4}-\d{2}$/.test(str)) {
    const [year, month] = str.split('-');
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const monthIndex = parseInt(month, 10) - 1;
    if (monthIndex >= 0 && monthIndex < 12) {
      return `${months[monthIndex]} ${year}`;
    }
  }

  try {
    const d = new Date(str);
    if (!Number.isNaN(d.getTime())) {
      const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
      return `${months[d.getMonth()]} ${d.getFullYear()}`;
    }
  } catch {
    // ignore
  }

  return str;
};

export default function RuleDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [rule, setRule] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);

  useEffect(() => {
    const fetchRule = async () => {
      if (!id) {
        setError('Rule ID tidak ditemukan');
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const res = await getFromGas('getRuleById', true, { ruleId: id });
        if (res?.status === 'error' || !res?.rule_id) {
          setError(res?.message || 'Rule tidak ditemukan');
          setRule(null);
        } else {
          setRule(res);
        }
      } catch {
        setError('Gagal memuat rule.');
        setRule(null);
      } finally {
        setLoading(false);
      }
    };
    fetchRule();
  }, [id]);

  const scrollRef = useRef(null);
  const scroll = (direction) => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: direction === 'left' ? -350 : 350, behavior: 'smooth' });
    }
  };

  const imageUrls = String(rule?.image_url || '')
    .split(/\r?\n/)
    .map((u) => u.trim())
    .filter((u) => u !== '');

  const ruleImages = imageUrls
    .map(getDriveDirectUrl)
    .filter(Boolean);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white">
        <PublicNavbar />
        <div className="max-w-5xl mx-auto px-6 pt-20 pb-12">
          <div className="text-center py-20">
            <div className="inline-block w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Memuat rule...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !rule) {
    return (
      <div className="min-h-screen bg-gray-950 text-white">
        <PublicNavbar />
        <div className="max-w-5xl mx-auto px-6 pt-20 pb-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-20"
          >
            <BookOpen className="text-gray-700 mx-auto mb-4" size={48} />
            <h2 className="text-2xl font-black text-gray-400 uppercase italic tracking-tighter mb-2">
              Rule Tidak Ditemukan
            </h2>
            <p className="text-sm text-gray-600 font-bold mb-8">
              {error || 'Rule yang kamu cari tidak tersedia.'}
            </p>
            <motion.button
              type="button"
              onClick={() => navigate(-1)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-500 px-8 py-4 rounded-2xl font-black uppercase italic text-sm shadow-2xl shadow-blue-600/40 hover:shadow-blue-500/60 transition-all"
            >
              <ArrowLeft size={18} />
              Back
            </motion.button>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <PublicNavbar />
      <div className="max-w-5xl mx-auto px-6 pt-20 pb-12">
        <motion.button
          type="button"
          onClick={() => navigate(-1)}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="inline-flex items-center gap-2 text-gray-500 hover:text-white transition-colors text-[10px] font-black uppercase tracking-widest mb-8"
        >
          <ArrowLeft size={16} />
          Back
        </motion.button>

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
                  <span className="inline-block px-3 py-1 rounded-full bg-purple-500/20 text-purple-400 text-[9px] font-black uppercase tracking-widest mb-3">
                    {rule.status || 'RULE'}
                  </span>
                  <h1 className="text-2xl md:text-4xl font-black italic uppercase tracking-tight leading-tight">
                    {rule.title || rule.nama}
                  </h1>
                </div>
                <div className="flex items-center gap-2 text-gray-400">
                  <BookOpen size={18} />
                  <span className="text-sm font-black">{rule.nama}</span>
                </div>
              </div>

            </div>

            <div className="absolute -right-10 -top-10 w-40 h-40 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
          </div>
        </motion.div>

        {ruleImages.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="mb-10"
          >
            <div className="bg-gray-900/80 backdrop-blur-sm rounded-[2.5rem] border border-white/5 p-6 md:p-8">
              <h2 className="text-lg font-black uppercase italic tracking-tight mb-4">REGULATION POSTER</h2>
              <div className="relative group">
                <button
                  type="button"
                  onClick={() => scroll('left')}
                  className="absolute left-2 top-1/2 -translate-y-1/2 z-10 hidden md:group-hover:flex items-center justify-center w-10 h-10 rounded-full bg-gray-900/80 text-white border border-white/20 hover:bg-gray-800 transition-all backdrop-blur-md shadow-xl"
                >
                  <ChevronLeft size={20} />
                </button>

                <div
                  ref={scrollRef}
                  className="flex gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
                >
                  {ruleImages.map((url, index) => (
                    <div key={index} className="min-w-[85vw] sm:min-w-[350px] md:min-w-[400px] snap-center shrink-0 flex justify-center">
                      <img
                        src={url}
                        alt={`${rule.title || rule.nama} - ${index + 1}`}
                        className="w-full max-h-[400px] object-contain rounded-2xl border border-white/10 shadow-lg bg-gray-900/50 cursor-zoom-in hover:scale-[1.02] transition-transform duration-300"
                        loading="lazy"
                        onClick={() => setPreviewImage(url)}
                        onError={(e) => {
                          e.target.style.display = 'none';
                          const placeholder = document.createElement('div');
                          placeholder.className = 'flex items-center justify-center h-[200px] text-gray-500 text-xs font-black uppercase tracking-widest';
                          placeholder.textContent = 'Image unavailable';
                          e.target.parentNode.appendChild(placeholder);
                        }}
                      />
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => scroll('right')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 z-10 hidden md:group-hover:flex items-center justify-center w-10 h-10 rounded-full bg-gray-900/80 text-white border border-white/20 hover:bg-gray-800 transition-all backdrop-blur-md shadow-xl"
                >
                  <ChevronRight size={20} />
                </button>
              </div>

              {previewImage && (
                <div
                  className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 backdrop-blur-md cursor-zoom-out"
                  onClick={() => setPreviewImage(null)}
                >
                  <img
                    src={previewImage}
                    alt="Preview Zoom"
                    className="max-w-full max-h-[95vh] object-contain rounded-xl shadow-2xl"
                  />
                  <div className="absolute top-4 right-4 text-white/50 text-sm font-bold tracking-widest bg-black/50 px-4 py-2 rounded-full pointer-events-none">
                    KLIK DI MANA SAJA UNTUK MENUTUP
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {rule.warning && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18 }}
            className="mb-10"
          >
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-[2.5rem] p-6 md:p-8 flex gap-4 items-start">
              <AlertTriangle className="text-yellow-400 flex-shrink-0 mt-1" size={24} />
              <div>
                <h3 className="text-sm font-black uppercase italic tracking-tight text-yellow-400 mb-2">Warning</h3>
                <p className="text-yellow-200 font-bold text-sm leading-relaxed whitespace-pre-line">{rule.warning}</p>
              </div>
            </div>
          </motion.div>
        )}

        {rule.details && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-10"
          >
            <div className="bg-gray-900/80 backdrop-blur-sm rounded-[2.5rem] border border-white/5 p-6 md:p-8">
              <h2 className="text-lg font-black uppercase italic tracking-tight mb-4">Details</h2>
              <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-line font-medium">{rule.details}</p>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
