import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Flame, Zap, Globe, ChevronDown, ChevronUp, Plus } from "lucide-react";

const SCOPE_COLORS = { "Scope 1": "#10b981", "Scope 2": "#f59e0b", "Scope 3": "#3b82f6" };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const SCOPE_CATEGORY_PATHS = {
  "Purchased Electricity": "/environment/energy",
  "Business Travel": "/environment/travel",
  "Purchased Goods and Services": "/environment/goods",
  "Waste Generated in Operations": "/environment/waste",
  "Employee Commuting": "/environment/employees",
  "Refrigerants": "/environment/refrigerants",
  "Water Consumption": "/environment/water",
  "Upstream Transportation & Distribution": "/environment/transportation",
  "Upstream Leased Assets": "/environment/leased-assets",
  "Processing of Sold Products": "/environment/sold-products",
  "Franchises": "/environment/franchises",
  "Investments": "/environment/investments",
  "Other Emissions": "/environment/other",
};

export default function Dashboard() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedScope, setExpandedScope] = useState(null);

  useEffect(() => {
    base44.entities.EmissionEntry.filter({ reporting_year: 2024 }).then(data => {
      setEntries(data);
      setLoading(false);
    });
  }, []);

  const totalByScope = entries.reduce((acc, e) => {
    acc[e.scope] = (acc[e.scope] || 0) + (e.tco2e || 0);
    return acc;
  }, {});

  const total = Object.values(totalByScope).reduce((a, b) => a + b, 0);

  const pieData = Object.entries(totalByScope).map(([scope, val]) => ({
    name: scope, value: parseFloat(val.toFixed(2))
  }));

  const monthlyData = MONTHS.map((month, idx) => {
    const row = { month };
    ["Scope 1", "Scope 2", "Scope 3"].forEach(scope => {
      row[scope] = entries
        .filter(e => e.scope === scope && e.start_date && new Date(e.start_date).getMonth() === idx)
        .reduce((s, e) => s + (e.tco2e || 0), 0)
        .toFixed(2);
    });
    return row;
  });

  const topEmissions = [...entries]
    .sort((a, b) => (b.tco2e || 0) - (a.tco2e || 0))
    .slice(0, 6);

  const categoryBreakdown = (scope) => {
    const cats = {};
    entries.filter(e => e.scope === scope).forEach(e => {
      const key = e.category || "Other";
      cats[key] = (cats[key] || 0) + (e.tco2e || 0);
    });
    return Object.entries(cats).sort((a, b) => b[1] - a[1]);
  };

  const ScopeCard = ({ scope, icon: Icon, color, bgColor, borderColor }) => {
    const isExpanded = expandedScope === scope;
    const breakdown = categoryBreakdown(scope);
    return (
      <div className={`rounded-xl border bg-card transition-all ${isExpanded ? borderColor + " shadow-md" : "border-border"}`}>
        <button className="w-full text-left p-5" onClick={() => setExpandedScope(isExpanded ? null : scope)}>
          <div className="flex items-center justify-between mb-3">
            <div className={`w-9 h-9 rounded-lg ${bgColor} flex items-center justify-center`}>
              <Icon className={`w-5 h-5 ${color}`} />
            </div>
            {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </div>
          <div className="text-xs text-muted-foreground font-medium mb-1">{scope}</div>
          <div className="text-2xl font-bold text-foreground">
            {(totalByScope[scope] || 0).toFixed(2)}
            <span className="text-sm font-normal text-muted-foreground ml-1">tCO₂e</span>
          </div>
          {total > 0 && (
            <div className="text-xs text-muted-foreground mt-1">
              {(((totalByScope[scope] || 0) / total) * 100).toFixed(1)}% of total
            </div>
          )}
        </button>
        {isExpanded && (
          <div className="border-t border-border px-5 pb-4 pt-3 space-y-2">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Breakdown by Category</div>
            {breakdown.length === 0 ? (
              <p className="text-xs text-muted-foreground">No data yet for this scope.</p>
            ) : breakdown.map(([cat, val]) => (
              <Link key={cat} to={SCOPE_CATEGORY_PATHS[cat] || "/environment/other"} className="flex items-center justify-between group hover:bg-muted/40 rounded-lg px-2 py-1.5 transition-colors">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: SCOPE_COLORS[scope] }} />
                  <span className="text-xs text-slate-700 group-hover:text-slate-900">{cat}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-20 bg-slate-100 rounded-full h-1.5">
                    <div className="h-1.5 rounded-full" style={{ backgroundColor: SCOPE_COLORS[scope], width: `${totalByScope[scope] > 0 ? (val / totalByScope[scope]) * 100 : 0}%` }} />
                  </div>
                  <span className="text-xs font-semibold text-slate-700 w-16 text-right">{val.toFixed(3)} t</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-0.5">GHG Emissions Inventory · FY 2024</p>
        </div>
        <div className="flex items-center gap-2">
          {["FY26", "FY25", "FY24", "FY23"].map(y => (
            <button key={y} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${y === "FY24" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>
              {y}
            </button>
          ))}
        </div>
      </div>

      {/* Total Emissions Banner */}
      <div className="rounded-2xl bg-gradient-to-br from-emerald-900 to-emerald-700 p-6 text-white">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="text-emerald-200 text-sm font-medium mb-1">Total Emissions · FY2024</div>
            <div className="text-5xl font-bold">
              {loading ? "—" : total.toFixed(2)}
              <span className="text-xl font-normal text-emerald-200 ml-2">tCO₂e</span>
            </div>
            <div className="text-emerald-300 text-sm mt-2">Data last updated: {new Date().toLocaleDateString()}</div>
          </div>
          <div className="flex gap-4">
            {[
              { label: "Emission Intensity", value: "—", sub: "tCO₂e / employee" },
              { label: "Data Coverage", value: "42%", sub: "of inventory" }
            ].map(kpi => (
              <div key={kpi.label} className="bg-white/10 rounded-xl px-4 py-3 text-center min-w-[110px]">
                <div className="text-xl font-bold">{kpi.value}</div>
                <div className="text-xs text-emerald-200 mt-0.5">{kpi.sub}</div>
                <div className="text-xs text-emerald-300 mt-0.5">{kpi.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Scope Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ScopeCard scope="Scope 1" icon={Flame} color="text-emerald-600" bgColor="bg-emerald-50" borderColor="border-emerald-300" />
        <ScopeCard scope="Scope 2" icon={Zap} color="text-amber-600" bgColor="bg-amber-50" borderColor="border-amber-300" />
        <ScopeCard scope="Scope 3" icon={Globe} color="text-blue-600" bgColor="bg-blue-50" borderColor="border-blue-300" />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Emissions by Month */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-foreground">Emissions by Month</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Monthly tCO₂e breakdown</p>
            </div>
            <div className="flex gap-1">
              {["Monthly", "Yearly"].map(v => (
                <button key={v} className={`px-2.5 py-1 text-xs rounded-lg ${v === "Monthly" ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted"}`}>{v}</button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlyData} barSize={8}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", fontSize: 12 }} />
              <Bar dataKey="Scope 1" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
              <Bar dataKey="Scope 2" stackId="a" fill="#f59e0b" />
              <Bar dataKey="Scope 3" stackId="a" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Scope Breakdown Pie */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold text-foreground mb-1">Scope Breakdown</h3>
          <p className="text-xs text-muted-foreground mb-4">By GHG protocol scope</p>
          {total > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={70} dataKey="value" paddingAngle={3}>
                    {pieData.map((entry) => (
                      <Cell key={entry.name} fill={SCOPE_COLORS[entry.name]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => [`${v} tCO₂e`]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-2">
                {pieData.map(item => (
                  <div key={item.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: SCOPE_COLORS[item.name] }} />
                      <span className="text-muted-foreground">{item.name}</span>
                    </div>
                    <span className="font-medium">{item.value} t</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-40 text-center">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                <Plus className="w-5 h-5 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">No emissions data yet</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Add entries across scopes</p>
            </div>
          )}
        </div>
      </div>

      {/* Top Emissions Table */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-foreground">Top Emissions Sources</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Ranked by tCO₂e</p>
          </div>
          <Link to="/reports" className="text-xs text-primary hover:underline font-medium">View all reports →</Link>
        </div>
        {topEmissions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {["Source", "Scope", "Category", "Location", "Emissions (tCO₂e)", "% of Total"].map(h => (
                    <th key={h} className="text-left py-2.5 px-3 text-xs font-semibold text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {topEmissions.map((e, i) => (
                  <tr key={e.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="py-2.5 px-3 font-medium">{e.source_name || "—"}</td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: SCOPE_COLORS[e.scope] + "20", color: SCOPE_COLORS[e.scope] }}>
                        {e.scope}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-muted-foreground">{e.category}</td>
                    <td className="py-2.5 px-3 text-muted-foreground">{e.location_name || "—"}</td>
                    <td className="py-2.5 px-3 font-semibold">{(e.tco2e || 0).toFixed(3)}</td>
                    <td className="py-2.5 px-3 text-muted-foreground">
                      {total > 0 ? (((e.tco2e || 0) / total) * 100).toFixed(1) + "%" : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-10 text-muted-foreground">
            <p className="text-sm">No emission entries yet. Start by adding data in Scope 1, 2 or 3.</p>
          </div>
        )}
      </div>
    </div>
  );
}