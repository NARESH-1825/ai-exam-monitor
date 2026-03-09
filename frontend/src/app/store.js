// frontend/src/app/store.js
import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../features/auth/authSlice';
import examReducer from '../features/exam/examSlice';
import proctorReducer from '../features/proctor/proctorSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    exam: examReducer,
    proctor: proctorReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({ serializableCheck: false }),
});
