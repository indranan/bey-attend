import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getRule, getRuleById } from '../utils/api';
import { BookOpen, AlertTriangle, RefreshCw, X, ChevronLeft, ChevronRight } from 'lucide-react';

const RuleSkeleton = () => (
  <div className="animate-pulse space-y-4">
    <div className="h-8 bg-gray-200 dark:bg-gray-800 rounded-xl w-3/4 mx-auto" />
    <div className="h-64 bg-gray-200 dark:bg-gray-800 rounded-[2rem] w-full" />
    <div className="h-16 bg-yellow-100 dark:bg-yellow-900/20 rounded-2xl w-full border-2 border-yellow-200 dark:border-yellow-800" />
    <div className="space-y-2">
      <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-full" />
      <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-5/6" />
      <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-4/6" />
    </div>
  </div>
);

const formatDriveImageUrl = (url) => {
  if (!url) return '';
  
  if (url.includes('drive.google.com')) {
    const match = url.match(/(?:file\/d\/|v\/|e\/|u\/\d+\/|v=|\/d\/|id=)([a-zA-Z0-9_-]{25,33})/);
    
    if (match && match[1]) {
      const fileId = match[1];
      return `https://lh3.googleusercontent.com/d/${fileId}`;
    }
  }
  
  return url;
};

export default function Rule({ ruleId }) {
  const [rule, setRule] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [zoomed, setZoomed] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const carouselRef = useRef(null);

  const imageUrls = (rule?.rule_image_url || '')
    .split('\n')
    .map((u) => u.trim())
    .filter((u) => u !== '');

  const scrollPrev = () => {
    if (carouselRef.current) {
      carouselRef.current.scrollBy({ left: -carouselRef.current.clientWidth, behavior: 'smooth' });
    }
  };

  const scrollNext = () => {
    if (carouselRef.current) {
      carouselRef.current.scrollBy({ left: carouselRef.current.clientWidth, behavior: 'smooth' });
    }
  };

  const fetchRule = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = ruleId ? await getRuleById(ruleId) : await getRule();
      setRule(res || {});
    } catch (err) {
      setError('Gagal memuat rule. Periksa koneksi internet.');
      console.error('Gagal fetch rule:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRule();
  }, [ruleId]);

  useEffect(() => {
    const container = carouselRef.current;
    if (!container || imageUrls.length <= 1) return;

    const handleScroll = () => {
      const slideWidth = container.clientWidth;
      if (slideWidth === 0) return;
      const newSlide = Math.round(container.scrollLeft / slideWidth);
      if (newSlide !== currentSlide && newSlide < imageUrls.length) {
        setCurrentSlide(newSlide);
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [imageUrls.length, currentSlide]);

  if (loading) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-20">
        <div className="px-2">
          <h2 className="text-xl font-black italic uppercase tracking-tighter dark:text-white">Rule of the Month</h2>
          <p className="text-[10px] text-primary font-black uppercase tracking-widest mt-1 italic tracking-tighter dark:text-white">Tournament Codex</p>
        </div>
        <div className="bg-white dark:bg-dark-card rounded-[2.5rem] border border-gray-100 dark:border-gray-800 shadow-xl">
          <div className="p-4">
            <RuleSkeleton />
          </div>
        </div>
      </motion.div>
    );
  }

  if (error) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-20">
        <div className="px-2">
          <h2 className="text-xl font-black italic uppercase tracking-tighter dark:text-white">Rule of the Month</h2>
        </div>
        <div className="bg-white dark:bg-dark-card rounded-[2.5rem] p-8 border border-gray-100 dark:border-gray-800 shadow-xl text-center">
          <AlertTriangle className="mx-auto text-red-500 mb-3" size={32} />
          <p className="text-red-500 font-bold text-sm mb-4">{error}</p>
          <button
            type="button"
            onClick={fetchRule}
            className="px-6 py-3 bg-primary text-white rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 transition-all flex items-center gap-2 mx-auto"
          >
            <RefreshCw size={14} /> Coba Lagi
          </button>
        </div>
      </motion.div>
    );
  }

  if (!rule || (!rule.rule_title && !rule.rule_details)) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-20">
        <div className="px-2">
          <h2 className="text-xl font-black italic uppercase tracking-tighter dark:text-white">Rule of the Month</h2>
          <p className="text-[10px] text-primary font-black uppercase tracking-widest mt-1 italic tracking-tighter dark:text-white">Tournament Codex</p>
        </div>
        <div className="bg-white dark:bg-dark-card rounded-[2.5rem] p-8 border border-gray-100 dark:border-gray-800 shadow-xl text-center">
          <BookOpen className="mx-auto text-gray-300 dark:text-gray-600 mb-3" size={32} />
          <p className="text-gray-400 font-bold text-xs">Belum ada rule untuk bulan ini.</p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 pb-20">
      <div className="px-2">
        <h2 className="text-xl font-black italic uppercase tracking-tighter dark:text-white">Rule of the Month</h2>
        <p className="text-[10px] text-primary font-black uppercase tracking-widest mt-1 italic tracking-tighter dark:text-white">Tournament Codex</p>
      </div>

      <div className="bg-white dark:bg-dark-card rounded-[2.5rem] border border-gray-100 dark:border-gray-800 shadow-xl space-y-5">
        <div className="text-center pt-5 px-5">
          <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase italic tracking-tighter leading-tight">
            {rule.rule_title}
          </h3>
        </div>

        {imageUrls.length > 0 && (
          <div className="px-4 pb-2 relative">
            <div
              ref={carouselRef}
              id="rule-carousel"
              className="flex overflow-x-auto snap-x snap-mandatory gap-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
            >
              {imageUrls.map((url, idx) => (
                <div
                  key={idx}
                  className="min-w-full flex-shrink-0 snap-center rounded-[2rem] overflow-hidden shadow-lg border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 cursor-zoom-in"
                  onClick={() => {
                    setCurrentSlide(idx);
                    setZoomed(true);
                  }}
                >
                  <img
                    src={formatDriveImageUrl(url)}
                    alt={`${rule.rule_title} - ${idx + 1}`}
                    className="w-full h-auto min-h-[200px] max-h-[500px] object-contain"
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                </div>
              ))}
            </div>

            {imageUrls.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={scrollPrev}
                  className="hidden md:flex absolute left-6 top-1/2 -translate-y-1/2 w-10 h-10 items-center justify-center rounded-full bg-black/50 hover:bg-black/70 text-white backdrop-blur-sm transition-all active:scale-90 shadow-lg z-10"
                  aria-label="Sebelumnya"
                >
                  <ChevronLeft size={22} />
                </button>
                <button
                  type="button"
                  onClick={scrollNext}
                  className="hidden md:flex absolute right-6 top-1/2 -translate-y-1/2 w-10 h-10 items-center justify-center rounded-full bg-black/50 hover:bg-black/70 text-white backdrop-blur-sm transition-all active:scale-90 shadow-lg z-10"
                  aria-label="Selanjutnya"
                >
                  <ChevronRight size={22} />
                </button>
              </>
            )}

            {imageUrls.length > 1 && (
              <div className="mt-3 flex items-center justify-center gap-2">
                {imageUrls.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      const container = carouselRef.current;
                      if (container) {
                        container.scrollTo({ left: container.clientWidth * idx, behavior: 'smooth' });
                      }
                    }}
                    className={`h-2 rounded-full transition-all ${idx === currentSlide ? 'w-6 bg-primary' : 'w-2 bg-gray-300 dark:bg-gray-600'}`}
                    aria-label={`Slide ${idx + 1}`}
                  />
                ))}
              </div>
            )}
            {imageUrls.length > 1 && (
              <p className="text-center text-[10px] text-gray-400 font-black uppercase tracking-widest mt-2 md:hidden">
                Geser untuk melihat slide selanjutnya ➔
              </p>
            )}
          </div>
        )}

        <div className="px-5 pb-5 space-y-4">
          {rule.rule_warning && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-400 dark:border-yellow-600 rounded-2xl p-4 flex gap-3 items-start">
              <AlertTriangle className="text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" size={20} />
              <p className="text-yellow-800 dark:text-yellow-200 font-bold text-xs leading-relaxed">
                {rule.rule_warning}
              </p>
            </div>
          )}

          {rule.rule_details && (
            <div>
              <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed whitespace-pre-line font-medium">
                {rule.rule_details}
              </p>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {zoomed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setZoomed(false)}
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.85, opacity: 0 }}
              transition={{ type: 'spring', damping: 24, stiffness: 200 }}
              className="relative w-full max-w-4xl max-h-[90vh] flex items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={formatDriveImageUrl(imageUrls[currentSlide] || '')}
                alt={rule.rule_title}
                className="w-full h-auto max-h-[90vh] object-contain rounded-2xl shadow-2xl"
              />
              <button
                type="button"
                onClick={() => setZoomed(false)}
                className="absolute -top-3 -right-3 w-10 h-10 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-full shadow-xl flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                aria-label="Tutup"
              >
                <X size={20} />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
