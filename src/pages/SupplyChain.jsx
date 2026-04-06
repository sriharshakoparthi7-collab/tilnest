import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Package, AlertTriangle, Search, Download, Plus, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import AddEntryDialog from "../components/AddEntryDialog";

const MONTHS = ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun"];
const COLORS = ["#0d9488", "#0ea5e9", "#f59e0b", "#8b5cf6", "#ef4444", "#10b981", "#f97316", "#06b6d4"];

const FY_TABS = ["FY2026", "FY2025", "FY2024"];
const TYPE_FILTERS = ["All types", "Energy", "Travel", "Waste", "Goods", "Other"];

export default function SupplyChain() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All types");
  const [fy, setFy] = useState("FY2024");
  const [showDialog, setShowDialog] = useState(false);

  const load = () => base44.entities.EmissionEntry.list().then(d => { setEntries(d); setLoading(false); });
  useEffect(() => { load(); }, []);

  // Aggregate by supplier
  const supplierMap = entries.reduce((acc, e) => {
    if (!e.supplier) return acc;
    if (!acc[e.supplier]) {
      acc[e.supplier] = { company: e.supplier, tco2e: 0, amount_paid: 0, category: e.category, scope: e.scope };
    }
    acc[e.supplier].tco2e += (e.tco2e || 0);
    acc[e.supplier].amount_paid += (e.amount_paid || 0);
    return acc;
  }, {});

  const suppliers = Object.values(supplierMap).sort((a, b) => b.tco2e - a.tco2e);
  const totalTCO2e = suppliers.reduce((s, v) => s + v.tco2e, 0);
  const unknownPct = suppliers.length > 0 ? ((suppliers.filter(s => !s.company).length / suppliers.length) * 100).toFixed(1) : 0;

  const filtered = suppliers.filter(s =>
    (!search || s.company.toLowerCase().includes(search.toLowerCase())) &&
    (typeFilter === "All types" || s.category?.includes(typeFilter))
  );

  // Trend chart — top 5 suppliers over months
  const top5 = suppliers.slice(0, 5);
  const trendData = MONTHS.map((m, i) => {
    const row = { month: m };
    top5.forEach(s => {
      row[s.company] = entries
        .filter(e => e.supplier === s.company && e.start_date && ((new Date(e.start_date).getMonth() + 6) % 12 === i))
        .reduce((sum, e) => sum + (e.tco2e || 0), 0).toFixed(3);
    });
    return row;
  });

  // Top emissions bar data
  const topEmissionsData = top5.map((s, i) => ({
    ...s,
    pct: totalTCO2e > 0 ? ((s.tco2e / totalTCO2e) * 100).toFixed(1) : 0,
    color: COLORS[i % COLORS.length]
  }));

  const catTypeMap = (cat) => {
    if (!cat) return "Other";
    if (cat.toLowerCase().includes("electr") || cat.toLowerCase().includes("energy") || cat.toLowerCase().includes("fuel")) return "Energy";
    if (cat.toLowerCase().includes("travel") || cat.toLowerCase().includes("flight") || cat.toLowerCase().includes("transport")) return "Travel";
    if (cat.toLowerCase().includes("waste")) return "Waste";
    if (cat.toLowerCase().includes("goods") || cat.toLowerCase().includes("purchased")) return "Goods";
    return "Other";
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-slate-200 border-t-emerald-600 rounded-full animate-spin" /></div>;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Supplier Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">Track and manage emissions across your supply chain</p>
        </div>
        <div className="flex items-center gap-2">
          {FY_TABS.map(f => (
            <button key={f} onClick={() => setFy(f)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${fy === f ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-4 py-3">
          <Package className="w-4 h-4 text-slate-600" />
          <span className="text-sm font-semibold text-slate-800">{suppliers.length} Suppliers</span>
        </div>
        {parseFloat(unknownPct) > 0 && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <span className="text-sm font-medium text-amber-700">{unknownPct}% Supplier unknown</span>
          </div>
        )}
        <div className="ml-auto">
          <Button size="sm" onClick={() => setShowDialog(true)} className="gap-1.5 text-sm">
            <Plus className="w-4 h-4" /> Add Supplier Entry
          </Button>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Emissions */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-800">Top emissions</h3>
            <div className="flex items-center gap-2">
              <select className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white text-slate-600">
                {TYPE_FILTERS.map(t => <option key={t}>{t}</option>)}
              </select>
              <button className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><Download className="w-3.5 h-3.5" /></button>
            </div>
          </div>

          {topEmissionsData.length > 0 ? (
            <div className="space-y-3">
              {/* Bar chart visual */}
              <div className="flex h-3 rounded-full overflow-hidden mb-4 gap-0.5">
                {topEmissionsData.map(s => (
                  <div key={s.company} style={{ width: `${s.pct}%`, backgroundColor: s.color }} title={`${s.company}: ${s.pct}%`} />
                ))}
              </div>
              {topEmissionsData.map((s, i) => (
                <div key={s.company} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                    <span className="text-sm text-slate-700 truncate">{s.company}</span>
                  </div>
                  <div className="flex items-center gap-4 flex-shrink-0 text-sm">
                    <span className="font-semibold text-slate-800">{s.tco2e.toFixed(2)} tCO₂e</span>
                    <span className="text-slate-400 w-10 text-right">{s.pct}%</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-36 flex items-center justify-center text-sm text-slate-400">
              Add supplier data to see top emissions
            </div>
          )}
        </div>

        {/* Emissions Trend */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-800">Emissions Trend</h3>
            <div className="flex items-center gap-2">
              <select className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white text-slate-600">
                {TYPE_FILTERS.map(t => <option key={t}>{t}</option>)}
              </select>
              <button className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><Download className="w-3.5 h-3.5" /></button>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#94a3b8" }} />
              <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 11 }} />
              {top5.map((s, i) => (
                <Line key={s.company} type="monotone" dataKey={s.company} stroke={COLORS[i % COLORS.length]} strokeWidth={1.5} dot={{ r: 2 }} />
              ))}
            </LineChart>
          </ResponsiveContainer>
          {top5.length > 0 && (
            <div className="flex flex-wrap gap-3 mt-2">
              {top5.map((s, i) => (
                <div key={s.company} className="flex items-center gap-1.5 text-xs text-slate-500">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                  {s.company}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Supplier Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <Input className="pl-8 text-sm h-9" placeholder="Search suppliers..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700">
            {TYPE_FILTERS.map(t => <option key={t}>{t}</option>)}
          </select>
          <div className="ml-auto">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <Download className="w-3 h-3" /> Export
            </Button>
          </div>
        </div>

        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              {["Company", "Emission source", "Amount paid", "Emissions", "Percentage %"].map(h => (
                <th key={h} className="text-left py-3 px-5 text-xs font-semibold text-slate-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length > 0 ? filtered.map((s, i) => (
              <tr key={s.company} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                <td className="py-3.5 px-5">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }}>
                      {s.company[0]?.toUpperCase()}
                    </div>
                    <span className="font-medium text-slate-800">{s.company}</span>
                  </div>
                </td>
                <td className="py-3.5 px-5 text-slate-600">{catTypeMap(s.category)}</td>
                <td className="py-3.5 px-5 text-slate-600">
                  {s.amount_paid > 0 ? `$${s.amount_paid.toFixed(2)}` : "$0.00"}
                </td>
                <td className="py-3.5 px-5 font-semibold text-slate-800">{s.tco2e.toFixed(2)} tCO₂e</td>
                <td className="py-3.5 px-5">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-slate-100 rounded-full h-1.5 max-w-[60px]">
                      <div className="h-1.5 rounded-full" style={{ width: `${totalTCO2e > 0 ? (s.tco2e / totalTCO2e * 100) : 0}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                    </div>
                    <span className="text-slate-600 text-xs w-10">
                      {totalTCO2e > 0 ? ((s.tco2e / totalTCO2e) * 100).toFixed(1) : 0}%
                    </span>
                  </div>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={5} className="py-12 text-center text-slate-400 text-sm">
                  {search ? "No suppliers match your search" : "No supplier data yet. Add entries with supplier names to see them here."}
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {filtered.length > 0 && (
          <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-500">{filtered.length} suppliers</span>
            <span className="text-sm font-bold text-slate-800">Total: {totalTCO2e.toFixed(2)} tCO₂e</span>
          </div>
        )}
      </div>

      <AddEntryDialog
        open={showDialog}
        onClose={() => setShowDialog(false)}
        onSaved={load}
        scope="Scope 3"
        category="Purchased Goods and Services"
        defaultValues={{}}
      />
    </div>
  );
}