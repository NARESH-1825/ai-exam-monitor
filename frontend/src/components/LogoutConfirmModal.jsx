// frontend/src/components/LogoutConfirmModal.jsx
import React, { useEffect } from 'react';

/**
 * A beautiful, animated confirmation modal for logging out.
 * 
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether the modal is visible
 * @param {Function} props.onClose - Triggered when user cancels
 * @param {Function} props.onConfirm - Triggered when user confirms logout
 */
const LogoutConfirmModal = ({ isOpen, onClose, onConfirm }) => {
  // Prevent background scrolling when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4">
      {/* Backdrop overlay */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-md transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Modal card */}
      <div 
        className="relative bg-[#0f172a]/95 border border-slate-800 text-white rounded-2xl p-6 w-full max-w-sm shadow-2xl scale-in"
        style={{
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px rgba(59, 130, 246, 0.05)'
        }}
      >
        {/* Decorative top gradient accent */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-red-500 via-rose-600 to-amber-500 rounded-t-2xl" />

        {/* Circular Logout Icon Header */}
        <div className="flex justify-center mb-5 mt-2">
          <div className="w-14 h-14 rounded-full bg-red-950/50 border border-red-800/40 flex items-center justify-center text-2xl shadow-inner animate-pulse">
            🚪
          </div>
        </div>

        {/* Text Content */}
        <div className="text-center mb-6">
          <h3 className="text-lg font-bold text-slate-100 tracking-tight">Confirm Logout</h3>
          <p className="text-slate-400 text-xs mt-2 leading-relaxed px-2">
            Are you sure you want to sign out of the AI Exam Monitor platform? This will end your active session.
          </p>
        </div>

        {/* Buttons Row */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 bg-slate-800/80 hover:bg-slate-700/90 text-slate-300 font-semibold rounded-xl text-xs tracking-wide transition-all border border-slate-700/30 hover:border-slate-600/50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 py-2.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold rounded-xl text-xs tracking-wide transition-all shadow-lg shadow-red-950/40 hover:shadow-red-900/50"
          >
            Yes, Sign Out
          </button>
        </div>
      </div>
    </div>
  );
};

export default LogoutConfirmModal;
