import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { ToastProvider } from "./context/ToastContext";
import { ConfirmProvider } from "./context/ConfirmContext";
import MainLayout from "./layouts/MainLayout";
import AdminLayout from "./layouts/AdminLayout";
import ProtectedRoute from "./components/ProtectedRoute";

import Home from "./pages/Home";
import Reels from "./pages/Reels";
import ReelDetail from "./pages/ReelDetail";
import Categories from "./pages/Categories";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";
import PublicProfile from "./pages/PublicProfile";
import Leaderboard from "./pages/Leaderboard";
import Watch from "./pages/Watch";
import ErrorBoundary from "./components/ErrorBoundary";
import { useLocation } from "react-router-dom";
import Studio from "./pages/Studio";
import Library from "./pages/Library";
import NotFound from "./pages/NotFound";

import AdminAnalytics from "./pages/admin/AdminAnalytics";
import AdminReels from "./pages/admin/AdminReels";
import AdminCategories from "./pages/admin/AdminCategories";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminComments from "./pages/admin/AdminComments";
import AdminReelDetail from "./pages/admin/AdminReelDetail";

// resets the boundary whenever the user navigates to another page
const Guarded = ({ children }) => <ErrorBoundary resetKey={useLocation().pathname}>{children}</ErrorBoundary>;

function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <ConfirmProvider>
          <AuthProvider>
            <BrowserRouter>
              <Guarded>
              <Routes>
                <Route path="/watch" element={<Watch />} />
                <Route path="/watch/:id" element={<Watch />} />

                <Route element={<MainLayout />}>
                  <Route path="/" element={<Home />} />
                  <Route path="/reels" element={<Reels />} />
                  <Route path="/reels/:id" element={<ReelDetail />} />
                  <Route path="/categories" element={<Categories />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/signup" element={<Signup />} />
                  <Route path="/leaderboard" element={<Leaderboard />} />
                  <Route path="/u/:id" element={<PublicProfile />} />
                  <Route
                    path="/dashboard"
                    element={
                      <ProtectedRoute>
                        <Dashboard />
                      </ProtectedRoute>
                    }
                  />
                  <Route path="/library" element={<ProtectedRoute><Library /></ProtectedRoute>} />
                  <Route path="/studio" element={<ProtectedRoute roles={["creator", "admin"]}><Studio /></ProtectedRoute>} />
                  <Route
                    path="/profile"
                    element={
                      <ProtectedRoute>
                        <Profile />
                      </ProtectedRoute>
                    }
                  />
                  <Route path="*" element={<NotFound />} />
                </Route>

                <Route
                  path="/admin"
                  element={
                    <ProtectedRoute adminOnly>
                      <AdminLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<AdminAnalytics />} />
                  <Route path="reels" element={<AdminReels />} />
                  <Route path="reels/:id" element={<AdminReelDetail />} />
                  <Route path="categories" element={<AdminCategories />} />
                  <Route path="users" element={<AdminUsers />} />
                  <Route path="comments" element={<AdminComments />} />
                </Route>
              </Routes>
              </Guarded>
            </BrowserRouter>
          </AuthProvider>
        </ConfirmProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;
