# TopBrains-Style UI Redesign

Transform the AI Exam Monitor into a premium, dashboard-focused UI inspired by TopBrains.com — with a persistent sidebar, compact panels, slide-in drawers, and minimal scrolling. The dark `bg-gray-900` background is preserved throughout.

## Proposed Changes

### Shared Layout & Components

#### [MODIFY] [index.css](file:///c:/Users/TAMIZH/Downloads/Compressed/2/output/frontend/src/index.css)
- Add Google Font (Inter) import
- Custom scrollbar styles (thin, dark)
- Sidebar transition CSS variables
- Global body font override

#### [NEW] [DashboardLayout.jsx](file:///c:/Users/TAMIZH/Downloads/Compressed/2/output/frontend/src/components/DashboardLayout.jsx)
Shared layout shell used by all authenticated pages:
- **Collapsible sidebar** (icons only collapsed, full label expanded)
- **Top bar** with breadcrumb, user avatar, logout
- **Main content area** with `overflow-y-auto` scroll contained within viewport (no full-page scroll)
- Responsive: sidebar collapses to bottom nav on mobile

#### [MODIFY] [Navbar.jsx](file:///c:/Users/TAMIZH/Downloads/Compressed/2/output/frontend/src/components/Navbar.jsx)
- Converted into a thin **top header bar** used inside `DashboardLayout` (breadcrumb + user pill + logout)
- No longer a standalone nav — sidebar handles navigation

---

### Public Pages

#### [MODIFY] [Landing.jsx](file:///c:/Users/TAMIZH/Downloads/Compressed/2/output/frontend/src/pages/Landing.jsx)
- Hero section with animated gradient badge, large headline, dual CTAs
- Feature cards in responsive 3-column grid
- Stats bar (e.g., "5000+ exams conducted")
- Sticky glass-effect navbar with Login button
- **No background change** (stays `from-gray-900 via-blue-950 to-gray-900`)

#### [MODIFY] [Login.jsx](file:///c:/Users/TAMIZH/Downloads/Compressed/2/output/frontend/src/pages/Login.jsx)
- Split-panel layout (left: branding/feature bullets, right: form card)
- Glassmorphism card with tab switcher (Login / Register)
- Animated focus rings, password strength bar
- Responsive: stacks vertically on mobile

---

### Student Pages

#### [MODIFY] [student/Dashboard.jsx](file:///c:/Users/TAMIZH/Downloads/Compressed/2/output/frontend/src/pages/student/Dashboard.jsx)
- Uses `DashboardLayout` (sidebar with: Dashboard, Assessments, Profile)
- Stat cards row (Exams, Avg Score, Passed, Failed)
- Charts section in a **2-column grid** with fixed height (no overflow)
- Results as a **slide-in right drawer** (click "View Results" → drawer slides in)
- "Browse Exams" CTA button prominent in sidebar nav and dashboard

#### [MODIFY] [student/Assessments.jsx](file:///c:/Users/TAMIZH/Downloads/Compressed/2/output/frontend/src/pages/student/Assessments.jsx)
- Uses `DashboardLayout`
- Cards in a **responsive grid** (1→2→3 col)
- Live exam cards highlighted with pulse badge
- Permission modal stays the same (already good)
- Auto-refresh progress bar at top of content area

---

### Faculty Pages

#### [MODIFY] [faculty/Dashboard.jsx](file:///c:/Users/TAMIZH/Downloads/Compressed/2/output/frontend/src/pages/faculty/Dashboard.jsx)
- Uses `DashboardLayout` (sidebar: Dashboard, Question Bank, Create Exam, Students, Monitor)
- Stat cards row
- Exam list as compact table with status badges, action buttons
- Quick action tiles below stat cards

#### [MODIFY] [faculty/QuestionBank.jsx](file:///c:/Users/TAMIZH/Downloads/Compressed/2/output/frontend/src/pages/faculty/QuestionBank.jsx)
- Uses `DashboardLayout`
- Paper list in left panel, detail/form in **right slide-in drawer**
- Search bar in header
- No full-page navigation changes (list/detail/form logic kept, but rendered in-place)

#### [MODIFY] [faculty/ExamConfig.jsx](file:///c:/Users/TAMIZH/Downloads/Compressed/2/output/frontend/src/pages/faculty/ExamConfig.jsx)
- Uses `DashboardLayout`
- Step-by-step wizard tabs (Basic Info → Questions → Proctoring → Review)
- Clean form sections with dividers

#### [MODIFY] [faculty/Students.jsx](file:///c:/Users/TAMIZH/Downloads/Compressed/2/output/frontend/src/pages/faculty/Students.jsx)
- Uses `DashboardLayout`
- Searchable data table
- Student detail in slide-in drawer

#### [MODIFY] [faculty/LiveMonitor.jsx](file:///c:/Users/TAMIZH/Downloads/Compressed/2/output/frontend/src/pages/faculty/LiveMonitor.jsx)
- Uses `DashboardLayout`
- Student grid cards (compact, 4-col on desktop)
- Leaderboard in a tabbed view (Live / Results)
- End exam button prominent in top bar

---

## Verification Plan

### Manual Browser Testing
1. Run `npm run dev` in `frontend/` directory
2. Navigate to `http://localhost:5173`
3. Verify **Landing page**: hero loads, features grid shows, navbar sticky
4. Navigate to `/login` — verify split-panel, tab switch works
5. Login as student → verify sidebar visible, stat cards show, charts render
6. Go to Assessments → verify card grid, live badge pulse
7. Login as faculty → verify sidebar, quick actions, exam table
8. Go to Question Bank → verify search, drawer slides in
9. Resize browser to mobile → verify bottom nav appears, sidebar collapses
10. Check at 768px, 1024px, 1440px breakpoints
