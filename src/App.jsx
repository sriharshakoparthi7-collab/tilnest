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
import EnvironmentPage from './pages/EnvironmentPage';
import Scope3Categories from './pages/Scope3Categories';
import Reports from './pages/Reports';
import DataManagement from './pages/DataManagement';
import SupplyChain from './pages/SupplyChain';
import VehicleRegistry from './pages/VehicleRegistry';
import Equipment from './pages/Equipment';

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
        <Route path="/environment/energy" element={<EnvironmentPage />} />
        <Route path="/environment/travel" element={<EnvironmentPage />} />
        <Route path="/environment/goods" element={<EnvironmentPage />} />
        <Route path="/environment/waste" element={<EnvironmentPage />} />
        <Route path="/environment/employees" element={<EnvironmentPage />} />
        <Route path="/environment/refrigerants" element={<EnvironmentPage />} />
        <Route path="/environment/water" element={<EnvironmentPage />} />
        <Route path="/environment/transportation" element={<EnvironmentPage />} />
        <Route path="/environment/leased-assets" element={<EnvironmentPage />} />
        <Route path="/environment/sold-products" element={<EnvironmentPage />} />
        <Route path="/environment/franchises" element={<EnvironmentPage />} />
        <Route path="/environment/investments" element={<EnvironmentPage />} />
        <Route path="/environment/other" element={<EnvironmentPage />} />
        <Route path="/scope3" element={<Scope3Categories />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/data" element={<DataManagement />} />
        <Route path="/supply-chain" element={<SupplyChain />} />
        <Route path="/vehicles" element={<VehicleRegistry />} />
        <Route path="/equipment" element={<Equipment />} />
        <Route path="*" element={<Dashboard />} />
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