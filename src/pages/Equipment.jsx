import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Upload, Search, Zap, BarChart3, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import EquipmentForm from "../components/equipment/EquipmentForm";
import EquipmentTable from "../components/equipment/EquipmentTable";
import BulkUploadModal from "../components/BulkUploadModal";
import { EQUIPMENT_TYPES, POWER_SOURCES, calculateEquipmentEmissions, unitForMeasurementType } from "@/utils/equipmentHelpers";

const TEMPLATE_HEADERS = ["equipment_name","equipment_type_main","equipment_subtype","power_source","activity_type","measurement_type","quantity","start_date","end_date","reporting_period","manufacturer","model","equipment_age_years","status","notes"];
const EXAMPLE_ROWS = [
  ["Generator-001","Generator","Diesel 50kW","Diesel","Continuous (runs 24/7)","Fuel Consumption (L)","250","2024-01-01","2024-03-31","Monthly","Caterpillar","C9","5","Active","Primary backup"],
  ["Compressor-A","Compressor","10HP","Electric","Intermittent (scheduled use)","Energy Consumption (kWh)","400","2024-01-01","2024-03-31","Monthly","Atlas Copco","ZR4","8","Active","Factory floor"],
];

export default function Equipment() {
  const [equipment, setEquipment] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [showBulk, setShowBulk] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  const load = async () => {
    const [eq, locs] = await Promise.all([base44.entities.Equipment.list(), base44.entities.Location.list()]);
    setEquipment(eq);
    setLocations(locs);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id) => { await base44.entities.Equipment.delete(id); load(); };

  const handleEdit = (item) => { setEditItem(item); setShowForm(true); };

  const filtered = equipment.filter(eq =>
    (typeFilter === "All" || eq.equipment_type_main === typeFilter) &&
    (statusFilter === "All" || eq.status === statusFilter) &&
    (!search || eq.equipment_name?.toLowerCase().includes(search.toLowerCase()) ||
      eq.location_name?.toLowerCase().includes(search.toLowerCase()) ||
      eq.equipment_type_main?.toLowerCase().includes(search.toLowerCase()))
  );

  const totalEmissions = equipment.reduce((s, e) => s + (e.tco2e || 0), 0);
  const activeCount = equipment.filter(e => e.status === "Active").length;

  const handleBulkUpload = async (rows) => {
    let created = 0, skipped = 0;
    for (const row of rows) {
      if (!row.equipment_name || !row.equipment_type_main) { skipped++; continue; }
      const loc = locations.find(l => l.name === row.location_name);
      const preview = calculateEquipmentEmissions({
        measurementType: row.measurement_type,
        quantity: parseFloat(row.quantity) || 0,
        powerSource: row.power_source,
        equipmentType: row.equipment_type_main,
      });
      await base44.entities.Equipment.create({
        ...row,
        location_id: loc?.id || "",
        quantity: parseFloat(row.quantity) || 0,
        equipment_age_years: parseFloat(row.equipment_age_years) || undefined,
        unit: unitForMeasurementType(row.measurement_type),
        tco2e: preview.tco2e,
        calculation_method: preview.method,
        status: row.status || "Active",
      });
      created++;
    }
    load();
    return { created, skipped, errors: [] };
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Equipment Registry</h1>
          <p className="text-sm text-slate-500 mt-0.5">Track machinery and stationary equipment emissions</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowBulk(true)} className="gap-1.5">
            <Upload className="w-3.5 h-3.5" /> Bulk Upload
          </Button>
          <Button size="sm" onClick={() => { setEditItem(null); setShowForm(true); }} className="gap-1.5">
            <Plus className="w-4 h-4" /> Add Equipment
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total Equipment", value: equipment.length, icon: Zap, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Active Equipment", value: activeCount, icon: Activity, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Total Emissions", value: `${totalEmissions.toFixed(3)} tCO₂e`, icon: BarChart3, color: "text-amber-600", bg: "bg-amber-50" },
        ].map(s => (
          <div key={s.label} className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg ${s.bg} flex items-center justify-center flex-shrink-0`}>
              <s.icon className={`w-4 h-4 ${s.color}`} />
            </div>
            <div>
              <div className="text-xs text-slate-500">{s.label}</div>
              <div className="text-lg font-bold text-slate-900">{s.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <Input className="pl-8 h-9 w-56 text-sm" placeholder="Search equipment..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="h-9 w-44 text-sm"><SelectValue placeholder="All types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All types</SelectItem>
            {EQUIPMENT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 w-36 text-sm"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All statuses</SelectItem>
            {["Active","Inactive","Retired"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-xs text-slate-400 ml-auto">{filtered.length} record{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Table / Empty state */}
      {loading ? (
        <div className="flex items-center justify-center h-40"><div className="w-8 h-8 border-4 border-slate-200 border-t-emerald-600 rounded-full animate-spin" /></div>
      ) : filtered.length > 0 ? (
        <EquipmentTable equipment={filtered} onEdit={handleEdit} onDelete={handleDelete} />
      ) : (
        <div className="text-center py-16 bg-white border border-dashed border-slate-300 rounded-xl">
          <Zap className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="font-semibold text-slate-700 mb-1">{search || typeFilter !== "All" ? "No equipment matches your filters" : "No equipment yet"}</h3>
          <p className="text-sm text-slate-500 mb-4">Add generators, compressors, forklifts and other equipment to track emissions</p>
          <Button onClick={() => { setEditItem(null); setShowForm(true); }} className="gap-2"><Plus className="w-4 h-4" /> Add First Equipment</Button>
        </div>
      )}

      <EquipmentForm
        open={showForm}
        onClose={() => { setShowForm(false); setEditItem(null); }}
        onSaved={load}
        defaultValues={editItem || {}}
      />

      <BulkUploadModal
        open={showBulk}
        onClose={() => setShowBulk(false)}
        title="Equipment"
        templateHeaders={TEMPLATE_HEADERS}
        exampleRows={EXAMPLE_ROWS}
        onUpload={handleBulkUpload}
      />
    </div>
  );
}