import { Outlet, Link, useLocation } from "react-router-dom";
import { useState } from "react";
import {
  LayoutDashboard, Globe, Zap, Car, ShoppingBag, Trash2, Users, Wind, Droplets,
  MoreHorizontal, Leaf, BarChart3, Link2, Target, BookOpen, ChevronDown,
  ChevronRight, Building2, Menu, Package, Calculator
} from "lucide-react";

const ENV_ITEMS = [
  { label: "Energy", path: "/environment/energy", icon: Zap },
  { label: "Travel", path: "/environment/travel", icon: Car },
  { label: "Goods & Services", path: "/environment/goods", icon: ShoppingBag },
  { label: "Waste & Reuse", path: "/environment/waste", icon: Trash2 },
  { label: "Employees", path: "/environment/employees", icon: Users },
  { label: "Refrigerants", path: "/environment/refrigerants", icon: Wind },
  { label: "Water", path: "/environment/water", icon: Droplets },
  { label: "Other", path: "/environment/other", icon: MoreHorizontal },
];

const NAV_ITEMS = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/", type: "link" },
  {
    label: "Environment", icon: Globe, type: "group", children: ENV_ITEMS,
    matchPaths: ["/environment"]
  },
  { label: "Offsets", icon: Leaf, path: "/offsets", type: "link" },
  { label: "Marketplace", icon: Link2, path: "/marketplace", type: "link" },
  { label: "Targets", icon: Target, path: "/targets", type: "link" },
  { label: "Reports", icon: BarChart3, path: "/reports", type: "link" },
  { label: "Supply chain", icon: Package, path: "/supply-chain", type: "link" },
  { label: "GHG Calculator", icon: Calculator, path: "/calculator", type: "link" },
  { label: "Learn", icon: BookOpen, path: "/learn", type: "link" },
];

export default function Layout() {
  const location = useLocation();
  const [envOpen, setEnvOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (path) => location.pathname === path;
  const isEnvActive = () => location.pathname.startsWith("/environment");

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-white border-r border-slate-200">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-600 flex items-center justify-center">
            <Leaf className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-slate-800 text-base tracking-tight">tilnest</span>
        </div>
      </div>

      {/* Org switcher */}
      <div className="px-3 py-3 border-b border-slate-100">
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer">
          <div className="w-7 h-7 rounded-full bg-teal-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            TC
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-slate-800 truncate">My Company</div>
            <div className="text-xs text-slate-500">All locations</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 overflow-y-auto space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;

          if (item.type === "group") {
            const envActive = isEnvActive();
            return (
              <div key={item.label}>
                <button
                  onClick={() => setEnvOpen(o => !o)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all ${envActive ? "text-slate-900 bg-slate-100 font-medium" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span className="flex-1 text-left">{item.label}</span>
                  {envOpen ? <ChevronDown className="w-3.5 h-3.5 opacity-50" /> : <ChevronRight className="w-3.5 h-3.5 opacity-50" />}
                </button>
                {envOpen && (
                  <div className="ml-3 mt-0.5 pl-3 border-l border-slate-200 space-y-0.5">
                    {ENV_ITEMS.map(child => {
                      const CIcon = child.icon;
                      const active = isActive(child.path);
                      return (
                        <Link
                          key={child.path}
                          to={child.path}
                          onClick={() => setMobileOpen(false)}
                          className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm transition-all ${active ? "text-emerald-700 bg-emerald-50 font-medium border-l-2 border-emerald-500 -ml-px pl-[11px]" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"}`}
                        >
                          <CIcon className="w-3.5 h-3.5 flex-shrink-0" />
                          <span>{child.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          const active = isActive(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all ${active ? "text-slate-900 bg-slate-100 font-medium" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom settings */}
      <div className="border-t border-slate-100 px-2 py-3 space-y-0.5">
        <Link to="/organization" className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-all">
          <Building2 className="w-4 h-4" />
          <span>Company settings</span>
        </Link>
        <Link to="/data" className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-all">
          <LayoutDashboard className="w-4 h-4" />
          <span>Data</span>
        </Link>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-56 flex-shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="fixed inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-56 h-full shadow-xl">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-12 bg-white border-b border-slate-200 flex items-center justify-between px-5 flex-shrink-0">
          <button className="md:hidden p-1.5 rounded-lg hover:bg-slate-100" onClick={() => setMobileOpen(true)}>
            <Menu className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-3 ml-auto">
            <div className="text-sm text-slate-500 hidden sm:block">FY2024</div>
            <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="text-xs font-semibold text-emerald-700">0.00 tCO₂e</span>
            </div>
            <div className="w-7 h-7 rounded-full bg-teal-600 flex items-center justify-center">
              <span className="text-white text-xs font-bold">T</span>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}