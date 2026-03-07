// frontend/src/features/proctor/proctorSlice.js
// REDESIGN: violationCount (simple integer 0→3) replaces cheatScore
import { createSlice } from '@reduxjs/toolkit';

const proctorSlice = createSlice({
  name: 'proctor',
  initialState: {
    events: [],
    violationCount: 0,   // 0–3; hits 3 → auto-submit with 0 marks
    isActive: false,
  },
  reducers: {
    addEvent: (state, action) => {
      state.events.push(action.payload);
      if (state.events.length > 50) state.events.shift();
    },
    setViolationCount: (state, action) => {
      state.violationCount = action.payload;
    },
    setActive: (state, action) => {
      state.isActive = action.payload;
    },
    resetProctor: (state) => {
      state.events = [];
      state.violationCount = 0;
      state.isActive = false;
    },
  },
});

export const { addEvent, setViolationCount, setActive, resetProctor } = proctorSlice.actions;
export default proctorSlice.reducer;
