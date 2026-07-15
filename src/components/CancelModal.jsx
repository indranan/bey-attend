import { motion, AnimatePresence } from 'framer-motion';
import { TriangleAlert } from 'lucide-react';

const CancelModal = ({ show, onClose, onConfirm, isSubmitting }) => (
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
            <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-500/20 flex items-center justify-center">
              <TriangleAlert size={34} className="text-red-500" />
            </div>
          </div>

          <h2 className="text-xl font-black text-center text-gray-900 dark:text-white">Cancel Attendance?</h2>
          <p className="text-sm text-center text-gray-500 dark:text-gray-400 mt-3">
            Are you sure you want to cancel your attendance for this event?
          </p>

          <div className="flex gap-3 mt-8">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-2xl bg-gray-100 dark:bg-gray-800 font-bold text-gray-700 dark:text-white hover:bg-gray-200 transition"
            >
              Keep
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isSubmitting}
              className="flex-1 py-3 rounded-2xl bg-red-500 text-white font-bold hover:bg-red-600 transition disabled:opacity-50"
            >
              {isSubmitting ? '...' : 'Cancel'}
            </button>
          </div>
        </motion.div>
      </div>
    )}
  </AnimatePresence>
);

export default CancelModal;
