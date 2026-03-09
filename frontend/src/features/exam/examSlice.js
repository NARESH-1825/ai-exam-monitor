// frontend/src/features/exam/examSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';

export const fetchAvailableExams = createAsyncThunk('exam/fetchAvailable', async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.get('/exam');
    return data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message);
  }
});

export const fetchFacultyExams = createAsyncThunk('exam/fetchFaculty', async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.get('/exam/faculty');
    return data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message);
  }
});

const examSlice = createSlice({
  name: 'exam',
  initialState: {
    availableExams: [],
    facultyExams: [],
    currentExam: null,
    loading: false,
    error: null,
  },
  reducers: {
    setCurrentExam: (state, action) => { state.currentExam = action.payload; },
    clearCurrentExam: (state) => { state.currentExam = null; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAvailableExams.fulfilled, (s, { payload }) => { s.availableExams = payload.exams || []; })
      .addCase(fetchFacultyExams.fulfilled, (s, { payload }) => { s.facultyExams = payload.exams || []; });
  }
});

export const { setCurrentExam, clearCurrentExam } = examSlice.actions;
export default examSlice.reducer;
