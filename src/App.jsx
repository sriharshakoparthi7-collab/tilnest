import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Organization from './pages/Organization';
import Locations from './pages/Locations';
import Scope1Energy from './pages/Scope1Energy';
import Scope1Vehicles from './pages/Scope1Vehicles';
import Scope1Refrigerants from './pages/Scope1Refrigerants';
import Scope2Electricity from './pages/Scope2Electricity';
import Scope2Heat from './pages/Scope2Heat';
import Scope3Categories from './pages/Scope3Categories';
import Reports from './pages/Reports';
import DataManagement from './pages/DataManagement';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/organization" element={<Organization />} />
        <Route path="/locations" element={<Locations />} />
        <Route path="/scope1/energy" element={<Scope1Energy />} />
        <Route path="/scope1/vehicles" element={<Scope1Vehicles />} />
        <Route path="/scope1/refrigerants" element={<Scope1Refrigerants />} />
        <Route path="/scope2/electricity" element={<Scope2Electricity />} />
        <Route path="/scope2/heat" element={<Scope2Heat />} />
        <Route path="/scope3" element={<Scope3Categories />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/data" element={<DataManagement />} />
        <Route path="*" element={<PageNotFound />} />
      </Route>
    </Routes>
  );
  };


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App