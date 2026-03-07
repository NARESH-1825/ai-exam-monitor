// frontend/src/features/auth/authSlice.js
// Features:
// 1. Single-session enforcement (new login kicks old session)
// 2. Auto-login on new tab if token still valid
// 3. Cross-tab logout via Firestore real-time listener
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';

// ── Thunks ──────────────────────────────────────────────────────────────────

export const loginUser = createAsyncThunk('auth/login', async (credentials, { rejectWithValue }) => {
  try {
    const deviceInfo = {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
    const { data } = await api.post('/auth/login', { ...credentials, deviceInfo });
    // Store token + metadata in localStorage so other tabs can read it
    localStorage.setItem('token', data.token);
    localStorage.setItem('authUser', JSON.stringify(data.user));
    // Broadcast to other tabs that login happened
    localStorage.setItem('auth_event', JSON.stringify({ type: 'LOGIN', ts: Date.now() }));
    return data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Login failed');
  }
});

export const logoutUser = createAsyncThunk('auth/logout', async (_, { rejectWithValue }) => {
  try {
    await api.post('/auth/logout');
  } catch {
    // Even if server fails, clear locally
  }
  localStorage.removeItem('token');
  localStorage.removeItem('authUser');
  // Broadcast logout to all other tabs
  localStorage.setItem('auth_event', JSON.stringify({ type: 'LOGOUT', ts: Date.now() }));
  // Small delay then remove the event key
  setTimeout(() => localStorage.removeItem('auth_event'), 500);
});

export const fetchMe = createAsyncThunk('auth/me', async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.get('/auth/me');
    // Refresh stored user
    localStorage.setItem('authUser', JSON.stringify(data.user));
    return data;
  } catch (err) {
    localStorage.removeItem('token');
    localStorage.removeItem('authUser');
    return rejectWithValue(err.response?.data?.message || 'Session invalid');
  }
});

// ── Helper: read token/user from storage ────────────────────────────────────
const getStoredToken = () => localStorage.getItem('token');
const getStoredUser = () => {
  try { return JSON.parse(localStorage.getItem('authUser')); } catch { return null; }
};

// ── Slice ────────────────────────────────────────────────────────────────────
const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: getStoredUser(),          // Feature 2: pre-populate from storage
    token: getStoredToken(),        // Feature 2: auto-login on new tab
    loading: false,
    error: null,
    isAuthenticated: !!getStoredToken() && !!getStoredUser(),
  },
  reducers: {
    setUser: (state, action) => {
      state.user = action.payload;
      state.isAuthenticated = true;
    },
    // Feature 3: called when cross-tab logout is detected
    clearAuth: (state) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Login
      .addCase(loginUser.pending, (s) => { s.loading = true; s.error = null; })
      .addCase(loginUser.fulfilled, (s, { payload }) => {
        s.loading = false;
        s.user = payload.user;
        s.token = payload.token;
        s.isAuthenticated = true;
        s.error = null;
      })
      .addCase(loginUser.rejected, (s, { payload }) => {
        s.loading = false;
        s.error = payload;
      })
      // Logout
      .addCase(logoutUser.fulfilled, (s) => {
        s.user = null; s.token = null; s.isAuthenticated = false;
      })
      // fetchMe (verify token on app load / new tab)
      .addCase(fetchMe.fulfilled, (s, { payload }) => {
        s.user = payload.user;
        s.isAuthenticated = true;
        s.loading = false;
      })
      .addCase(fetchMe.rejected, (s) => {
        s.user = null; s.token = null; s.isAuthenticated = false;
        s.loading = false;
      });
  }
});

export const { setUser, clearAuth } = authSlice.actions;
export default authSlice.reducer;
