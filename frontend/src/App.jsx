// frontend/src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { useEffect, useState } from "react";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import { fetchMe } from "./features/auth/authSlice";
import useAuthSync from "./hooks/useAuthSync";
import { ThemeProvider } from "./context/ThemeContext";

import Landing from "./pages/Landing";
import Login from "./pages/Login";
import StudentDashboard from "./pages/student/Dashboard";
import Assessments from "./pages/student/Assessments";
import ExamRoom from "./pages/student/ExamRoom";
import FacultyDashboard from "./pages/faculty/Dashboard";
import QuestionBank from "./pages/faculty/QuestionBank";
import ExamConfig from "./pages/faculty/ExamConfig";
import LiveMonitor from "./pages/faculty/LiveMonitor";
import Students from "./pages/faculty/Students";
import AllExams from "./pages/faculty/AllExams";
import ImportPage from "./pages/faculty/ImportQuestionPaper/ImportPage";
import ProtectedRoute from "./components/ProtectedRoute";

function AppRoutes() {
  const dispatch = useDispatch();
  const { isAuthenticated, user, token } = useSelector((state) => state.auth);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    const init = async () => {
      const storedToken = localStorage.getItem("token");
      if (storedToken) await dispatch(fetchMe());
      setInitializing(false);
    };
    init();
  }, []);

  useAuthSync();

  if (initializing) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="text-4xl mb-3 animate-spin">⚙️</div>
          <p className="text-gray-400">Initializing...</p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route
        path="/login"
        element={
          isAuthenticated ? (
            <Navigate to={user?.role === "student" ? "/student" : "/faculty"} replace />
          ) : (
            <Login />
          )
        }
      />

      {/* Student Routes */}
      <Route path="/student" element={<ProtectedRoute role="student"><StudentDashboard /></ProtectedRoute>} />
      <Route path="/student/assessments" element={<ProtectedRoute role="student"><Assessments /></ProtectedRoute>} />
      <Route path="/student/exam/:examId" element={<ProtectedRoute role="student"><ExamRoom /></ProtectedRoute>} />

      {/* Faculty Routes */}
      <Route path="/faculty" element={<ProtectedRoute role="faculty"><FacultyDashboard /></ProtectedRoute>} />
      <Route path="/faculty/questions" element={<ProtectedRoute role="faculty"><QuestionBank /></ProtectedRoute>} />
      <Route path="/faculty/exam-config" element={<ProtectedRoute role="faculty"><ExamConfig /></ProtectedRoute>} />
      <Route path="/faculty/students" element={<ProtectedRoute role="faculty"><Students /></ProtectedRoute>} />
      <Route path="/faculty/monitor/:examId" element={<ProtectedRoute role="faculty"><LiveMonitor /></ProtectedRoute>} />
      <Route path="/faculty/all-exams" element={<ProtectedRoute role="faculty"><AllExams /></ProtectedRoute>} />
      <Route path="/faculty/import-questions" element={<ProtectedRoute role="faculty"><ImportPage /></ProtectedRoute>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AppRoutes />
        <ToastContainer
          position="top-right"
          theme="dark"
          autoClose={1000}
          hideProgressBar={false}
          newestOnTop
          closeOnClick
          pauseOnHover
        />
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
