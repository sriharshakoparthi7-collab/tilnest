import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Download, BarChart3, TrendingUp, FileText, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend } from "recharts";

const MONTHS = ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun"];
const SCOPE_COLORS = { "Scope 1": "#10b981", "Scope 2": "#f59e0b", "Scope 3": "#3b82f6" };

const TABS = ["Emission summary", "Trends", "Inventory report", "Scope 3"];

export default function Reports() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("Emission summary");

  useEffect(() => {
    base44.entities.EmissionEntry.list().then(d => { setEntries(d); setLoading(false); });
  }, []);

  const totalByScope = entries.reduce((acc, e) => {
    acc[e.scope] = (acc[e.scope] || 0) + (e.tco2e || 0);
    return acc;
  }, {});
  const total = Object.values(totalByScope).reduce((a, b) => a + b, 0);

  const monthlyData = MONTHS.map(month => {
    const row = { month };
    ["Scope 1", "Scope 2", "Scope 3"].forEach(scope => {
      row[scope] = entries.filter(e => e.scope === scope && e.start_date).reduce((s, e) => s + (e.tco2e || 0), 0).toFixed(3);
    });
    return row;
  });

  const topEmissions = [...entries].sort((a, b) => (b.tco2e || 0) - (a.tco2e || 0)).slice(0, 8);

  const s3Categories = entries.filter(e => e.scope === "Scope 3").reduce((acc, e) => {
    const k = e.category;
    if (!acc[k]) acc[k] = { category: k, tco2e: 0, s3_category_number: e.s3_category_number };
    acc[k].tco2e += (e.tco2e || 0);
    return acc;
  }, {});

  const categoryBreakdown = [
    { scope: "Scope 1", tco2e: totalByScope["Scope 1"] || 0, pct: total > 0 ? (((totalByScope["Scope 1"] || 0) / total) * 100).toFixed(2) : 0 },
    { scope: "Scope 2", tco2e: totalByScope["Scope 2"] || 0, pct: total > 0 ? (((totalByScope["Scope 2"] || 0) / total) * 100).toFixed(2) : 0 },
    { scope: "Scope 3", tco2e: totalByScope["Scope 3"] || 0, pct: total > 0 ? (((totalByScope["Scope 3"] || 0) / total) * 100).toFixed(2) : 0 },
  ];

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Emissions Reports</h1>
        <Button className="gap-2"><Download className="w-4 h-4" /> Download Report</Button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        {TABS.map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-all -mb-px ${activeTab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {t}
          </button>
        ))}
      </div>

      {activeTab === "Emission summary" && (
        <div className="space-y-5">
          {/* Scope KPI Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="text-xs text-muted-foreground mb-1">Total Emissions</div>
              <div className="text-2xl font-bold">{total.toFixed(2)}</div>
              <div className="text-xs text-muted-foreground">tCO₂e</div>
            </div>
            {["Scope 1", "Scope 2", "Scope 3"].map(scope => (
              <div key={scope} className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-center gap-1.5 mb-1">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: SCOPE_COLORS[scope] }} />
                  <div className="text-xs text-muted-foreground">{scope}</div>
                </div>
                <div className="text-2xl font-bold">{(totalByScope[scope] || 0).toFixed(2)}</div>
                <div className="text-xs text-muted-foreground">{total > 0 ? (((totalByScope[scope] || 0) / total) * 100).toFixed(1) : 0}% of total</div>
              </div>
            ))}
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-foreground">Emission by Month</h3>
                <div className="flex gap-1">
                  {["Monthly", "Yearly"].map(v => <button key={v} className={`px-2.5 py-1 text-xs rounded-lg ${v === "Monthly" ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted"}`}>{v}</button>)}
                </div>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={monthlyData} barSize={10}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="Scope 1" stackId="a" fill="#10b981" />
                  <Bar dataKey="Scope 2" stackId="a" fill="#f59e0b" />
                  <Bar dataKey="Scope 3" stackId="a" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="font-semibold text-foreground mb-3">Top Emissions</h3>
              {topEmissions.length > 0 ? (
                <div className="space-y-2">
                  {topEmissions.map((e, i) => (
                    <div key={e.id} className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: SCOPE_COLORS[e.scope] }} />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs truncate">{e.category}</div>
                        <div className="h-1.5 bg-muted rounded-full mt-0.5">
                          <div className="h-1.5 rounded-full" style={{ width: `${total > 0 ? ((e.tco2e || 0) / total * 100) : 0}%`, backgroundColor: SCOPE_COLORS[e.scope] }} />
                        </div>
                      </div>
                      <div className="text-xs font-medium whitespace-nowrap">{(e.tco2e || 0).toFixed(2)}t</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-sm text-muted-foreground">No data yet</div>
              )}
            </div>
          </div>

          {/* Category Table */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/30">
                <tr>
                  {["Category", "Emissions", "Percentage"].map(h => (
                    <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {categoryBreakdown.map(row => (
                  <tr key={row.scope} className="border-b border-border/50 hover:bg-muted/20">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: SCOPE_COLORS[row.scope] }} />
                        <span className="font-medium">{row.scope}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-semibold">{row.tco2e.toFixed(2)} tCO₂e</td>
                    <td className="py-3 px-4 text-muted-foreground">{row.pct}%</td>
                  </tr>
                ))}
                <tr className="bg-muted/20">
                  <td className="py-3 px-4 font-bold">Total</td>
                  <td className="py-3 px-4 font-bold">{total.toFixed(2)} tCO₂e</td>
                  <td className="py-3 px-4 font-bold">100%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "Scope 3" && (
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h3 className="font-semibold">Scope 3 Category Breakdown</h3>
            </div>
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/30">
                <tr>
                  {["Category", "Emissions", "Percentage"].map(h => (
                    <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.values(s3Categories).sort((a, b) => b.tco2e - a.tco2e).map(row => (
                  <tr key={row.category} className="border-b border-border/50 hover:bg-muted/20">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded bg-blue-50 text-blue-700 flex items-center justify-center text-xs font-bold">{row.s3_category_number}</div>
                        <span>{row.category}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-semibold">{row.tco2e.toFixed(3)} tCO₂e</td>
                    <td className="py-3 px-4 text-muted-foreground">
                      {(totalByScope["Scope 3"] || 0) > 0 ? ((row.tco2e / (totalByScope["Scope 3"] || 1)) * 100).toFixed(2) + "%" : "—"}
                    </td>
                  </tr>
                ))}
                {Object.keys(s3Categories).length === 0 && (
                  <tr><td colSpan={3} className="py-10 text-center text-muted-foreground text-sm">No Scope 3 data yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {(activeTab === "Trends" || activeTab === "Inventory report") && (
        <div className="text-center py-20 bg-card border border-dashed border-border rounded-xl">
          <BarChart3 className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
          <h3 className="font-medium text-foreground mb-1">{activeTab}</h3>
          <p className="text-sm text-muted-foreground">Add more emission data to see detailed trends and inventory analysis</p>
        </div>
      )}
    </div>
  );
}