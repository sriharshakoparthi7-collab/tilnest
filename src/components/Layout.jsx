import { Outlet, Link, useLocation } from "react-router-dom";
import { useState } from "react";
import {
  LayoutDashboard, Building2, MapPin, Flame, Zap, Globe, BarChart3,
  Database, ChevronDown, ChevronRight, Leaf, Menu, X
} from "lucide-react";

const NAV = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/" },
  { label: "Organization", icon: Building2, path: "/organization" },
  { label: "Locations", icon: MapPin, path: "/locations" },
  {
    label: "Scope 1", icon: Flame, color: "text-emerald-400",
    children: [
      { label: "Stationary Energy", path: "/scope1/energy" },
      { label: "Vehicles", path: "/scope1/vehicles" },
      { label: "Refrigerants", path: "/scope1/refrigerants" },
    ]
  },
  {
    label: "Scope 2", icon: Zap, color: "text-amber-400",
    children: [
      { label: "Electricity", path: "/scope2/electricity" },
      { label: "Heat & Steam", path: "/scope2/heat" },
    ]
  },
  {
    label: "Scope 3", icon: Globe, color: "text-blue-400",
    children: [
      { label: "All Categories", path: "/scope3" },
    ]
  },
  { label: "Reports", icon: BarChart3, path: "/reports" },
  { label: "Data Management", icon: Database, path: "/data" },
];

export default function Layout() {
  const location = useLocation();
  const [expanded, setExpanded] = useState({ "Scope 1": true, "Scope 2": false, "Scope 3": false });
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggle = (label) => setExpanded(prev => ({ ...prev, [label]: !prev[label] }));
  const isActive = (path) => location.pathname === path;
  const isChildActive = (children) => children?.some(c => location.pathname.startsWith(c.path));

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-sidebar-border">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Leaf className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-white font-semibold text-base tracking-tight">tilnest</div>
            <div className="text-sidebar-foreground/50 text-xs">GHG Inventory</div>
          </div>
        </div>
      </div>

      {/* Reporting Year */}
      <div className="px-4 py-3 border-b border-sidebar-border">
        <div className="flex items-center justify-between bg-sidebar-accent rounded-lg px-3 py-2">
          <span className="text-sidebar-foreground/70 text-xs">Reporting Year</span>
          <span className="text-white text-xs font-semibold">2024</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 overflow-y-auto space-y-0.5">
        {NAV.map((item) => {
          const Icon = item.icon;
          if (item.children) {
            const open = expanded[item.label];
            const active = isChildActive(item.children);
            return (
              <div key={item.label}>
                <button
                  onClick={() => toggle(item.label)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all ${active ? "bg-sidebar-accent text-white" : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-white"}`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 ${item.color || "text-sidebar-foreground/70"}`} />
                    <span className="font-medium">{item.label}</span>
                  </div>
                  {open ? <ChevronDown className="w-3.5 h-3.5 opacity-60" /> : <ChevronRight className="w-3.5 h-3.5 opacity-60" />}
                </button>
                {open && (
                  <div className="ml-4 mt-0.5 space-y-0.5 border-l border-sidebar-border pl-3">
                    {item.children.map(child => (
                      <Link
                        key={child.path}
                        to={child.path}
                        onClick={() => setMobileOpen(false)}
                        className={`block px-3 py-1.5 rounded-lg text-sm transition-all ${isActive(child.path) ? "bg-primary/20 text-primary-foreground font-medium text-emerald-300" : "text-sidebar-foreground/70 hover:text-white hover:bg-sidebar-accent/50"}`}
                      >
                        {child.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          }
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all ${isActive(item.path) ? "bg-sidebar-accent text-white font-medium" : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-white"}`}
            >
              <Icon className={`w-4 h-4 ${item.color || "text-sidebar-foreground/70"}`} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-sidebar-border">
        <div className="bg-emerald-900/30 rounded-lg p-3">
          <div className="text-xs text-emerald-400 font-medium mb-1">Data completeness</div>
          <div className="w-full bg-sidebar-border rounded-full h-1.5 mb-1">
            <div className="bg-emerald-400 h-1.5 rounded-full" style={{ width: "42%" }} />
          </div>
          <div className="text-xs text-sidebar-foreground/50">42% of inventory measured</div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-60 bg-sidebar flex-shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="fixed inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-60 bg-sidebar h-full shadow-xl">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="h-14 bg-card border-b border-border flex items-center justify-between px-4 md:px-6 flex-shrink-0">
          <button className="md:hidden p-1.5 rounded-lg hover:bg-muted" onClick={() => setMobileOpen(true)}>
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3 ml-auto">
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-sm font-semibold text-emerald-700">0.00 tCO₂e</span>
            </div>
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
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