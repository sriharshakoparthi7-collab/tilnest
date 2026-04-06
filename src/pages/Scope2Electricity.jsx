import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Upload, Zap, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import EmissionsTable from "../components/EmissionsTable";
import AddEntryDialog from "../components/AddEntryDialog";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid, Legend } from "recharts";

const ENERGY_TYPES = [
  { label: "Electricity", key: "Electricity" },
  { label: "Stationary Fuel", key: "Stationary Fuel" },
];

export default function Scope2Electricity() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editEntry, setEditEntry] = useState(null);
  const [search, setSearch] = useState("");
  const [energyFilter, setEnergyFilter] = useState("Electricity");

  const load = () => base44.entities.EmissionEntry.filter({ scope: "Scope 2" }).then(d => { setEntries(d); setLoading(false); });
  useEffect(() => { load(); }, []);

  const handleDelete = async (id) => { await base44.entities.EmissionEntry.delete(id); load(); };

  const totalTCO2e = entries.reduce((s, e) => s + (e.tco2e || 0), 0);
  const totalKWh = entries.reduce((s, e) => s + (e.quantity || 0), 0);
  const avgGreenPower = entries.length > 0 ? (entries.reduce((s, e) => s + (e.green_power_pct || 0), 0) / entries.length).toFixed(1) : 0;

  const filtered = entries.filter(e => {
    const matchSearch = !search || (e.source_name || "").toLowerCase().includes(search.toLowerCase()) || (e.location_name || "").toLowerCase().includes(search.toLowerCase());
    return matchSearch;
  });

  const pieData = [
    { name: "Renewable", value: parseFloat(avgGreenPower), color: "#10b981" },
    { name: "Grid electricity", value: 100 - parseFloat(avgGreenPower), color: "#94a3b8" },
  ].filter(d => d.value > 0);

  const cols = [
    { key: "location_name", label: "Location" },
    { key: "source_name", label: "Meter" },
    { key: "start_date", label: "Start Date" },
    { key: "end_date", label: "End Date" },
    { key: "supplier", label: "Supplier" },
    { key: "quantity", label: "Usage (kWh)" },
    { key: "green_power_pct", label: "GreenPower %" },
    { key: "amount_paid", label: "Amount Paid" },
    { key: "tco2e", label: "Emissions (tCO₂e)" },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Zap className="w-4 h-4 text-amber-500" />
            <span>Scope 2</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Energy</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Indirect emissions from purchased electricity, heat and steam</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2 text-sm"><Upload className="w-4 h-4" /> Import</Button>
          <Button className="gap-2" onClick={() => { setEditEntry(null); setShowDialog(true); }}>
            <Plus className="w-4 h-4" /> Add Energy
          </Button>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-semibold text-foreground text-sm">Energy Sources</h3>
              <p className="text-xs text-muted-foreground">FY2024</p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <ResponsiveContainer width={120} height={120}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={35} outerRadius={55} dataKey="value" paddingAngle={3}>
                  {pieData.map(d => <Cell key={d.name} fill={d.color} />)}
                </Pie>
                <Tooltip formatter={v => `${v.toFixed(1)}%`} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2">
              <div className="text-2xl font-bold text-foreground">{avgGreenPower}%</div>
              <div className="text-xs text-muted-foreground">RENEWABLE</div>
              {pieData.map(d => (
                <div key={d.name} className="flex items-center gap-1.5 text-xs">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                  <span className="text-muted-foreground">{d.value.toFixed(1)}% {d.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold text-foreground text-sm mb-3">Key Metrics</h3>
          <div className="space-y-4">
            {[
              { label: "Total Emissions", value: `${totalTCO2e.toFixed(3)} tCO₂e` },
              { label: "Total Consumption", value: `${totalKWh.toFixed(0)} kWh` },
              { label: "Avg Green Power", value: `${avgGreenPower}%` },
              { label: "Locations tracked", value: new Set(entries.map(e => e.location_name)).size },
            ].map(m => (
              <div key={m.label} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                <span className="text-sm text-muted-foreground">{m.label}</span>
                <span className="text-sm font-semibold">{m.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Filter and Table */}
      <div>
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <div className="flex bg-muted rounded-lg p-1">
            {ENERGY_TYPES.map(t => (
              <button key={t.key} onClick={() => setEnergyFilter(t.key)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${energyFilter === t.key ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}>
                {t.label}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input className="pl-9 w-56 text-sm" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <span className="text-sm text-muted-foreground ml-auto">{filtered.length} records</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-32"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>
        ) : filtered.length > 0 ? (
          <EmissionsTable entries={filtered} columns={cols} onDelete={handleDelete} onEdit={(e) => { setEditEntry(e); setShowDialog(true); }} />
        ) : (
          <div className="text-center py-14 bg-card border border-dashed border-border rounded-xl">
            <Zap className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
            <h3 className="font-medium text-foreground mb-1">No energy data yet</h3>
            <p className="text-sm text-muted-foreground mb-4">Add your electricity, natural gas and other purchased energy records</p>
            <Button onClick={() => setShowDialog(true)} variant="outline" className="gap-2"><Plus className="w-4 h-4" /> Add Energy Entry</Button>
          </div>
        )}
      </div>

      <AddEntryDialog
        open={showDialog}
        onClose={() => { setShowDialog(false); setEditEntry(null); }}
        onSaved={load}
        scope="Scope 2"
        category="Purchased Electricity"
        defaultValues={editEntry || {}}
      />
    </div>
  );
}