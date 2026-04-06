import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Wind } from "lucide-react";
import { Button } from "@/components/ui/button";
import AddEntryDialog from "../components/AddEntryDialog";
import EmissionsTable from "../components/EmissionsTable";

export default function Scope1Refrigerants() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);

  const load = () => base44.entities.EmissionEntry.filter({ scope: "Scope 1", category: "Refrigerants" }).then(d => { setEntries(d); setLoading(false); });
  useEffect(() => { load(); }, []);

  const handleDelete = async (id) => { await base44.entities.EmissionEntry.delete(id); load(); };
  const totalTCO2e = entries.reduce((s, e) => s + (e.tco2e || 0), 0);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Wind className="w-4 h-4 text-emerald-600" /><span>Scope 1</span>
          </div>
          <h1 className="text-2xl font-bold">Refrigerants</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Fugitive emissions from refrigerant gases used in equipment</p>
        </div>
        <Button className="gap-2" onClick={() => setShowDialog(true)}><Plus className="w-4 h-4" /> Add Refrigerant Data</Button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-xs text-muted-foreground mb-1 font-medium">Total Emissions</div>
          <div className="text-3xl font-bold">{totalTCO2e.toFixed(3)} <span className="text-sm font-normal text-muted-foreground">tCO₂e</span></div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-xs text-muted-foreground mb-1 font-medium">Equipment Tracked</div>
          <div className="text-3xl font-bold">{entries.length}</div>
        </div>
      </div>

      {loading ? <div className="flex items-center justify-center h-32"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>
        : entries.length > 0 ? <EmissionsTable entries={entries} onDelete={handleDelete} />
        : (
          <div className="text-center py-14 bg-card border border-dashed border-border rounded-xl">
            <Wind className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
            <h3 className="font-medium mb-1">No refrigerant data</h3>
            <p className="text-sm text-muted-foreground mb-4">Track HFCs, PFCs and other refrigerant gases from your equipment</p>
            <Button onClick={() => setShowDialog(true)} variant="outline" className="gap-2"><Plus className="w-4 h-4" /> Add Entry</Button>
          </div>
        )}

      <AddEntryDialog open={showDialog} onClose={() => setShowDialog(false)} onSaved={load} scope="Scope 1" category="Refrigerants" defaultValues={{}} />
    </div>
  );
}