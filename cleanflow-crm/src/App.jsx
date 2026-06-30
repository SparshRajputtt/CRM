import { Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout";
import { ProtectedRoute } from "./components/layout/ProtectedRoute";

import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import Dashboard from "./pages/Dashboard";
import Leads from "./pages/Leads";
import Customers from "./pages/Customers";
import Services from "./pages/Services";
import Calendar from "./pages/Calendar";
import Jobs from "./pages/Jobs";
import Quotes from "./pages/Quotes";
import Invoices from "./pages/Invoices";
import Analytics from "./pages/Analytics";
import Notes from "./pages/Notes";
import Tasks from "./pages/Tasks";
import Settings from "./pages/Settings";

/* Central route table. Auth routes are public; everything else is wrapped in
   the authenticated AppLayout behind <ProtectedRoute>. */
export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Private */}
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/leads" element={<Leads />} />
        <Route path="/customers" element={<Customers />} />
        <Route path="/jobs" element={<Jobs />} />
        <Route path="/notes" element={<Notes />} />
        <Route path="/tasks" element={<Tasks />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/services" element={<Services />} />
        <Route path="/quotes" element={<Quotes />} />
        <Route path="/invoices" element={<Invoices />} />
        <Route path="/analytics" element={<Analytics />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
