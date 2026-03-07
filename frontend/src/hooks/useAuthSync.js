// frontend/src/hooks/useAuthSync.js
// Feature 3: Listens for cross-tab auth events (login/logout)
// AND watches Firestore for session invalidation (other device logged in)
// AND handles account block events from faculty
import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { clearAuth, fetchMe } from '../features/auth/authSlice';
import { toast } from 'react-toastify';
import { useSocket } from './useSocket';

const useAuthSync = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user, isAuthenticated, token } = useSelector(state => state.auth);
  const unsubRef = useRef(null);
  const sessionRef = useRef(null);
  const socket = useSocket(token);

  // ── 1. Cross-tab via localStorage events ──────────────────────────────────
  useEffect(() => {
    const handleStorage = (e) => {
      if (e.key !== 'auth_event') return;
      try {
        const event = JSON.parse(e.newValue);
        if (!event) return;
        if (event.type === 'LOGOUT') {
          dispatch(clearAuth());
          navigate('/login', { replace: true });
        }
        if (event.type === 'LOGIN') {
          dispatch(fetchMe());
        }
      } catch {}
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [dispatch, navigate]);

  // ── 2. Socket: user:blocked — immediate account block by faculty ─────────
  useEffect(() => {
    if (!socket) return;
    socket.on('user:blocked', ({ studentId, message }) => {
      if (user?.id === studentId || user?.userId === studentId) {
        toast.error(message || 'Your account has been blocked by faculty.', {
          toastId: 'user-blocked',
          autoClose: false,
        });
        dispatch(clearAuth());
        localStorage.removeItem('token');
        localStorage.removeItem('authUser');
        navigate('/login', { replace: true });
      }
    });
    return () => socket.off('user:blocked');
  }, [socket, user?.id, dispatch, navigate]);

  // ── 3. Firestore real-time session watcher ─────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      unsubRef.current?.();
      unsubRef.current = null;
      sessionRef.current = null;
      return;
    }

    const storedToken = localStorage.getItem('token');
    if (!storedToken) return;
    try {
      const payload = JSON.parse(atob(storedToken.split('.')[1]));
      sessionRef.current = payload.sessionId;
    } catch { return; }

    const userRef = doc(db, 'users', user.id);
    unsubRef.current = onSnapshot(userRef, (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();

      // Account blocked by faculty
      if (data.isBlocked) {
        dispatch(clearAuth());
        localStorage.removeItem('token');
        localStorage.removeItem('authUser');
        toast.error('Your account has been blocked. Please contact faculty.', {
          toastId: 'account-blocked',
          autoClose: false,
        });
        navigate('/login', { replace: true });
        return;
      }

      if (data.activeSessionId === null) {
        dispatch(clearAuth());
        localStorage.removeItem('token');
        localStorage.removeItem('authUser');
        toast.info('You have been logged out.', { toastId: 'session-out' });
        navigate('/login', { replace: true });
        return;
      }

      if (sessionRef.current && data.activeSessionId !== sessionRef.current) {
        dispatch(clearAuth());
        localStorage.removeItem('token');
        localStorage.removeItem('authUser');
        toast.warning('You were logged in from another device. This session has ended.', {
          toastId: 'session-kicked',
          autoClose: 6000,
        });
        navigate('/login', { replace: true });
      }
    }, (err) => {
      console.warn('Firestore session watch error (non-critical):', err.code);
    });

    return () => {
      unsubRef.current?.();
      unsubRef.current = null;
    };
  }, [isAuthenticated, user?.id, dispatch, navigate]);
};

export default useAuthSync;
