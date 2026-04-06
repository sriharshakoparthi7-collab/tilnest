import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Upload, Flame, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import EmissionsTable from "../components/EmissionsTable";
import AddEntryDialog from "../components/AddEntryDialog";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

const FUEL_TYPES = [
  { label: "Natural Gas", color: "#10b981" },
  { label: "Diesel", color: "#f59e0b" },
  { label: "LPG", color: "#3b82f6" },
  { label: "Coal", color: "#6b7280" },
  { label: "Biomass", color: "#84cc16" },
];

export default function Scope1Energy() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editEntry, setEditEntry] = useState(null);
  const [search, setSearch] = useState("");

  const load = () => base44.entities.EmissionEntry.filter({ scope: "Scope 1", category: "Stationary Combustion" }).then(d => { setEntries(d); setLoading(false); });
  useEffect(() => { load(); }, []);

  const handleDelete = async (id) => { await base44.entities.EmissionEntry.delete(id); load(); };

  const totalTCO2e = entries.reduce((s, e) => s + (e.tco2e || 0), 0);
  const filtered = entries.filter(e => !search || (e.source_name || "").toLowerCase().includes(search.toLowerCase()) || (e.location_name || "").toLowerCase().includes(search.toLowerCase()));

  const byFuel = FUEL_TYPES.map(f => ({
    name: f.label,
    value: entries.filter(e => e.fuel_type === f.label).reduce((s, e) => s + (e.tco2e || 0), 0),
    color: f.color
  })).filter(f => f.value > 0);

  const cols = [
    { key: "source_name", label: "Source" },
    { key: "location_name", label: "Location" },
    { key: "start_date", label: "Start Date" },
    { key: "end_date", label: "End Date" },
    { key: "supplier", label: "Supplier" },
    { key: "quantity", label: "Usage" },
    { key: "amount_paid", label: "Amount Paid" },
    { key: "tco2e", label: "Emissions (tCO₂e)" },
    { key: "status", label: "Status" },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Flame className="w-4 h-4 text-emerald-600" />
            <span>Scope 1</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Stationary Energy</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Direct emissions from burning fuels in owned or controlled stationary sources</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2 text-sm"><Upload className="w-4 h-4" /> Import</Button>
          <Button className="gap-2" onClick={() => { setEditEntry(null); setShowDialog(true); }}>
            <Plus className="w-4 h-4" /> Add Energy
          </Button>
        </div>
      </div>

      {/* Summary Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-xs text-muted-foreground mb-1 font-medium">Total Emissions</div>
          <div className="text-3xl font-bold text-foreground">{totalTCO2e.toFixed(3)}</div>
          <div className="text-sm text-muted-foreground">tCO₂e</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-xs text-muted-foreground mb-1 font-medium">Entries</div>
          <div className="text-3xl font-bold text-foreground">{entries.length}</div>
          <div className="text-sm text-muted-foreground">data records</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          {byFuel.length > 0 ? (
            <>
              <div className="text-xs text-muted-foreground mb-2 font-medium">By Fuel Type</div>
              <div className="flex items-center gap-3">
                <ResponsiveContainer width={60} height={60}>
                  <PieChart>
                    <Pie data={byFuel} cx="50%" cy="50%" outerRadius={28} dataKey="value">
                      {byFuel.map(f => <Cell key={f.name} fill={f.color} />)}
                    </Pie>
                    <Tooltip formatter={v => `${v.toFixed(3)} t`} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1">
                  {byFuel.slice(0, 3).map(f => (
                    <div key={f.name} className="flex items-center gap-1.5 text-xs">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: f.color }} />
                      <span className="text-muted-foreground truncate">{f.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="text-xs text-muted-foreground font-medium">Fuel Sources<br /><span className="text-foreground font-normal mt-1 block">No data yet</span></div>
          )}
        </div>
      </div>

      {/* Table */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input className="pl-9 w-60 text-sm" placeholder="Search entries..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <span className="text-sm text-muted-foreground">{filtered.length} records</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-32"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>
        ) : filtered.length > 0 ? (
          <EmissionsTable entries={filtered} columns={cols} onDelete={handleDelete} onEdit={(e) => { setEditEntry(e); setShowDialog(true); }} />
        ) : (
          <div className="text-center py-14 bg-card border border-dashed border-border rounded-xl">
            <Flame className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
            <h3 className="font-medium text-foreground mb-1">No stationary energy data</h3>
            <p className="text-sm text-muted-foreground mb-4">Add data for natural gas, diesel, LPG and other fuels burned at your facilities</p>
            <Button onClick={() => setShowDialog(true)} variant="outline" className="gap-2"><Plus className="w-4 h-4" /> Add First Entry</Button>
          </div>
        )}
      </div>

      <AddEntryDialog
        open={showDialog}
        onClose={() => { setShowDialog(false); setEditEntry(null); }}
        onSaved={load}
        scope="Scope 1"
        category="Stationary Combustion"
        defaultValues={editEntry || {}}
      />
    </div>
  );
}