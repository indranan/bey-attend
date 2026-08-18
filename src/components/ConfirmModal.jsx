import { motion, AnimatePresence } from 'framer-motion';
import { TriangleAlert, Loader2 } from 'lucide-react';

const ConfirmModal = ({ show, onClose, onConfirm, title, message, confirmLabel, isSubmitting, loadingMessage, loadingSubMessage, variant = 'danger' }) => {
  const isDanger = variant === 'danger';
  return (
    <AnimatePresence>
      {show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="w-full max-w-sm rounded-3xl bg-white dark:bg-gray-900 p-7 shadow-2xl"
          >
            <div className="flex justify-center mb-5">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center ${isDanger ? 'bg-red-100 dark:bg-red-500/20' : 'bg-blue-100 dark:bg-blue-500/20'}`}>
                {isSubmitting ? (
                  <Loader2 size={34} className="text-blue-500 animate-spin" />
                ) : (
                  <TriangleAlert size={34} className={isDanger ? 'text-red-500' : 'text-blue-500'} />
                )}
              </div>
            </div>

            <h2 className="text-xl font-black text-center text-gray-900 dark:text-white">{title}</h2>
            <p className="text-sm text-center text-gray-500 dark:text-gray-400 mt-3">
              {isSubmitting ? (loadingMessage || 'Processing...') : message}
            </p>
            {isSubmitting && loadingSubMessage && (
              <p className="text-xs text-center text-gray-400 dark:text-gray-500 mt-2">{loadingSubMessage}</p>
            )}

            <div className="flex gap-3 mt-8">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="flex-1 py-3 rounded-2xl bg-gray-100 dark:bg-gray-800 font-bold text-gray-700 dark:text-white hover:bg-gray-200 transition disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={isSubmitting}
                className={`flex-1 py-3 rounded-2xl font-bold transition disabled:opacity-50 ${isDanger ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-blue-500 text-white hover:bg-blue-600'}`}
              >
                {isSubmitting ? (loadingMessage || '...') : confirmLabel}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default ConfirmModal;
