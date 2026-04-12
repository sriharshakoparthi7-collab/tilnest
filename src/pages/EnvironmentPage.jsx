import { useState, useEffect } from "react";
import { useParams, useLocation } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Plus, Upload, Download, Search, Import } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import GHGEntryDialog from "../components/GHGEntryDialog";
import ProductClassificationGateway from "../components/ProductClassificationGateway";
import SoldProductsDialog from "../components/SoldProductsDialog";
import InvestmentsGateway from "../components/InvestmentsGateway";
import InvestmentsPCAFDialog from "../components/InvestmentsPCAFDialog";
import BusinessTravelDialog from "../components/BusinessTravelDialog";
import RefrigerantsTieredDialog from "../components/RefrigerantsTieredDialog";
import TransportationTieredDialog from "../components/TransportationTieredDialog";
import LeasedAssetsTieredDialog from "../components/LeasedAssetsTieredDialog";
import WasteReuseTieredDialog from "../components/WasteReuseTieredDialog";
import EmployeeCommutingDialog from "../components/EmployeeCommutingDialog";
import FranchisesDialog from "../components/FranchisesDialog";
import BulkUploadModal from "../components/BulkUploadModal";
import EmissionsTable from "../components/EmissionsTable";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid, Legend } from "recharts";

const CATEGORY_CONFIG = {
  energy: {
    title: "Energy",
    scope: "Scope 2",
    category: "Purchased Electricity",
    description: "Purchased electricity, heat, steam and cooling",
    cols: [
      { key: "location_name", label: "Location" },
      { key: "source_name", label: "Meter" },
      { key: "start_date", label: "Start date" },
      { key: "end_date", label: "End date" },
      { key: "supplier", label: "Supplier" },
      { key: "quantity", label: "Usage" },
      { key: "green_power_pct", label: "GreenPower" },
      { key: "amount_paid", label: "Amount paid" },
      { key: "tco2e", label: "Emissions" },
    ],
    energyTypes: ["Electricity", "Gas", "Stationary Fuel"],
    defaultUnit: "kWh",
    pieLabel: "Energy Sources",
  },
  travel: {
    title: "Business Travel",
    scope: "Scope 3",
    category: "Business Travel",
    description: "Business flights, accommodation, rideshare, trains and buses",
    cols: [
      { key: "location_name", label: "Location" },
      { key: "source_name", label: "Description" },
      { key: "start_date", label: "Start date" },
      { key: "end_date", label: "End date" },
      { key: "supplier", label: "Supplier" },
      { key: "quantity", label: "Distance / Spend" },
      { key: "unit", label: "Unit" },
      { key: "amount_paid", label: "Amount paid" },
      { key: "tco2e", label: "Emissions" },
    ],
    defaultUnit: "km",
    pieLabel: "Travel Sources",
  },
  goods: {
    title: "Goods & Services",
    scope: "Scope 3",
    category: "Purchased Goods and Services",
    description: "Purchased goods, capital goods and freight",
    cols: [
      { key: "source_name", label: "Item / Category" },
      { key: "location_name", label: "Location" },
      { key: "start_date", label: "Start date" },
      { key: "supplier", label: "Supplier" },
      { key: "quantity", label: "Spend / Quantity" },
      { key: "unit", label: "Unit" },
      { key: "amount_paid", label: "Amount paid" },
      { key: "tco2e", label: "Emissions" },
    ],
    defaultUnit: "USD",
    pieLabel: "Spend Sources",
  },
  waste: {
    title: "Waste & Reuse",
    scope: "Scope 3",
    category: "Waste Generated in Operations",
    description: "Waste disposal, recycling and water treatment",
    cols: [
      { key: "source_name", label: "Waste Type" },
      { key: "location_name", label: "Location" },
      { key: "start_date", label: "Start date" },
      { key: "supplier", label: "Disposal Method" },
      { key: "quantity", label: "Weight (kg)" },
      { key: "amount_paid", label: "Amount paid" },
      { key: "tco2e", label: "Emissions" },
    ],
    defaultUnit: "kg",
    pieLabel: "Waste Types",
  },
  employees: {
    title: "Employee Commuting",
    scope: "Scope 3",
    category: "Employee Commuting",
    description: "Employee commuting, work from home and remote working",
    cols: [
      { key: "source_name", label: "Transport Mode" },
      { key: "location_name", label: "Location" },
      { key: "start_date", label: "Start date" },
      { key: "quantity", label: "Distance / Count" },
      { key: "unit", label: "Unit" },
      { key: "amount_paid", label: "Amount paid" },
      { key: "tco2e", label: "Emissions" },
    ],
    defaultUnit: "km",
    pieLabel: "Commute Modes",
  },
  refrigerants: {
    title: "Refrigerants",
    scope: "Scope 1",
    category: "Refrigerants",
    description: "Fugitive emissions from refrigerant gases in owned equipment",
    cols: [
      { key: "source_name", label: "Equipment" },
      { key: "location_name", label: "Location" },
      { key: "start_date", label: "Start date" },
      { key: "end_date", label: "End date" },
      { key: "supplier", label: "Gas Type" },
      { key: "quantity", label: "Amount (kg)" },
      { key: "tco2e", label: "Emissions" },
    ],
    defaultUnit: "kg",
    pieLabel: "Gas Types",
  },
  water: {
    title: "Water",
    scope: "Scope 3",
    category: "Water Consumption",
    description: "Water consumption and water treatment",
    cols: [
      { key: "source_name", label: "Source" },
      { key: "location_name", label: "Location" },
      { key: "start_date", label: "Start date" },
      { key: "end_date", label: "End date" },
      { key: "supplier", label: "Supplier" },
      { key: "quantity", label: "Volume (m³)" },
      { key: "amount_paid", label: "Amount paid" },
      { key: "tco2e", label: "Emissions" },
    ],
    defaultUnit: "m³",
    pieLabel: "Water Sources",
  },
  transportation: {
    title: "Transportation & Distribution",
    scope: "Scope 3",
    category: "Upstream Transportation & Distribution",
    description: "Upstream (Cat 4) and downstream (Cat 9) transportation and distribution of goods",
    cols: [
      { key: "source_name", label: "Route / Description" },
      { key: "location_name", label: "Location" },
      { key: "start_date", label: "Start date" },
      { key: "supplier", label: "Carrier" },
      { key: "quantity", label: "Weight (kg)" },
      { key: "unit", label: "Unit" },
      { key: "amount_paid", label: "Amount paid" },
      { key: "tco2e", label: "Emissions" },
    ],
    defaultUnit: "kg",
    pieLabel: "Transport Modes",
    splitLabel: ["Upstream (Cat 4)", "Downstream (Cat 9)"],
  },
  "leased-assets": {
    title: "Leased Assets",
    scope: "Scope 3",
    category: "Upstream Leased Assets",
    description: "Upstream leased assets (Cat 8) and downstream leased assets (Cat 13)",
    cols: [
      { key: "source_name", label: "Asset" },
      { key: "location_name", label: "Location" },
      { key: "start_date", label: "Start date" },
      { key: "end_date", label: "End date" },
      { key: "supplier", label: "Lessor / Lessee" },
      { key: "quantity", label: "Usage" },
      { key: "unit", label: "Unit" },
      { key: "tco2e", label: "Emissions" },
    ],
    defaultUnit: "kWh",
    pieLabel: "Asset Types",
    splitLabel: ["Upstream (Cat 8)", "Downstream (Cat 13)"],
  },
  "sold-products": {
    title: "Sold Products",
    scope: "Scope 3",
    category: "Processing of Sold Products",
    description: "Processing (Cat 10), use (Cat 11) and end-of-life treatment (Cat 12) of sold products",
    cols: [
      { key: "source_name", label: "Product" },
      { key: "location_name", label: "Location" },
      { key: "start_date", label: "Start date" },
      { key: "supplier", label: "Customer / Region" },
      { key: "quantity", label: "Units Sold" },
      { key: "unit", label: "Unit" },
      { key: "amount_paid", label: "Revenue" },
      { key: "tco2e", label: "Emissions" },
    ],
    defaultUnit: "units",
    pieLabel: "Product Lines",
    splitLabel: ["Processing (Cat 10)", "Use (Cat 11)", "End-of-Life (Cat 12)"],
  },
  franchises: {
    title: "Franchises",
    scope: "Scope 3",
    category: "Franchises",
    description: "Scope 1 & 2 emissions from franchisee operations (Cat 14)",
    cols: [
      { key: "source_name", label: "Franchise Location" },
      { key: "location_name", label: "Region" },
      { key: "start_date", label: "Start date" },
      { key: "end_date", label: "End date" },
      { key: "supplier", label: "Franchisee" },
      { key: "quantity", label: "Reported tCO₂e (S1+S2)" },
      { key: "amount_paid", label: "Revenue" },
      { key: "tco2e", label: "Emissions" },
    ],
    defaultUnit: "tCO2e",
    pieLabel: "Franchise Locations",
  },
  investments: {
    title: "Investments",
    scope: "Scope 3",
    category: "Investments",
    description: "Financed emissions from equity, debt and project finance (Cat 15)",
    cols: [
      { key: "source_name", label: "Investment / Fund" },
      { key: "location_name", label: "Region" },
      { key: "start_date", label: "Start date" },
      { key: "supplier", label: "Investee" },
      { key: "quantity", label: "Investment ($)" },
      { key: "unit", label: "Unit" },
      { key: "amount_paid", label: "Total Portfolio ($)" },
      { key: "tco2e", label: "Emissions" },
    ],
    defaultUnit: "USD",
    pieLabel: "Asset Classes",
  },
  other: {
    title: "Other",
    scope: "Scope 1",
    category: "Other Emissions",
    description: "Miscellaneous emissions not covered elsewhere",
    cols: [
      { key: "source_name", label: "Description" },
      { key: "location_name", label: "Location" },
      { key: "start_date", label: "Date" },
      { key: "supplier", label: "Supplier" },
      { key: "quantity", label: "Quantity" },
      { key: "unit", label: "Unit" },
      { key: "tco2e", label: "Emissions" },
    ],
    defaultUnit: "t",
    pieLabel: "Sources",
  },
  "process-emissions": {
    title: "Process Emissions",
    scope: "Scope 1",
    category: "Process Emissions",
    description: "Industrial process emissions from chemical reactions, not fuel combustion (e.g., cement clinker, limestone calcination)",
    cols: [
      { key: "source_name", label: "Process / Material" },
      { key: "location_name", label: "Location" },
      { key: "start_date", label: "Date" },
      { key: "quantity", label: "Mass (Tonnes)" },
      { key: "unit", label: "Unit" },
      { key: "tco2e", label: "Emissions" },
    ],
    defaultUnit: "t",
    pieLabel: "Process Types",
  },
};

const SCOPE_COLORS = { "Scope 1": "#10b981", "Scope 2": "#f59e0b", "Scope 3": "#3b82f6" };
const PIE_COLORS = ["#0d9488", "#0ea5e9", "#f59e0b", "#8b5cf6", "#ef4444", "#10b981"];

const FY_OPTIONS = ["FY2026", "FY2025", "FY2024", "FY2023", "FY2022"];

export default function EnvironmentPage() {
  const location = useLocation();
  const categoryKey = location.pathname.split("/environment/")[1] || "energy";
  const config = CATEGORY_CONFIG[categoryKey] || CATEGORY_CONFIG.energy;

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editEntry, setEditEntry] = useState(null);
  const [search, setSearch] = useState("");
  const [energyTypeFilter, setEnergyTypeFilter] = useState(config.energyTypes?.[0] || "");
  const [locationFilter, setLocationFilter] = useState("All locations");
  const [locations, setLocations] = useState([]);
  const [fy, setFy] = useState("FY2024");
  const [showBulk, setShowBulk] = useState(false);
  const [dialogProps, setDialogProps] = useState({});
  const [showSoldProducts, setShowSoldProducts] = useState(false);
  const [soldProductsCategories, setSoldProductsCategories] = useState([]);
  const [showInvestments, setShowInvestments] = useState(false);
  const [editInvestment, setEditInvestment] = useState(null);
  const [showGateway, setShowGateway] = useState(false);
  const [showInvGateway, setShowInvGateway] = useState(false);
  const [showTravelDialog, setShowTravelDialog] = useState(false);
  const [travelSubCategory, setTravelSubCategory] = useState("Air Travel");
  const [showRefrigDialog, setShowRefrigDialog] = useState(false);
  const [showTransportDialog, setShowTransportDialog] = useState(false);
  const [transportDirection, setTransportDirection] = useState("Upstream");
  const [showLeasedDialog, setShowLeasedDialog] = useState(false);
  const [leasedType, setLeasedType] = useState("Upstream");
  const [showWasteDialog, setShowWasteDialog] = useState(false);
  const [showCommuteDialog, setShowCommuteDialog] = useState(false);
  const [showFranchiseDialog, setShowFranchiseDialog] = useState(false);

  const openAdd = (overrides = {}) => {
    setEditEntry(null);
    setDialogProps(overrides);
    setShowDialog(true);
  };

  const load = () => {
    base44.entities.EmissionEntry.filter({ scope: config.scope, category: config.category })
      .then(d => { setEntries(d); setLoading(false); });
  };

  useEffect(() => {
    setLoading(true);
    load();
    base44.entities.Location.list().then(setLocations);
  }, [categoryKey]);

  const handleDelete = async (id) => { await base44.entities.EmissionEntry.delete(id); load(); };

  const filtered = entries.filter(e =>
    (!search || (e.source_name || "").toLowerCase().includes(search.toLowerCase()) || (e.location_name || "").toLowerCase().includes(search.toLowerCase())) &&
    (locationFilter === "All locations" || e.location_name === locationFilter)
  );

  const totalTCO2e = entries.reduce((s, e) => s + (e.tco2e || 0), 0);

  // Pie data: group by location or sub_category
  const pieGroups = entries.reduce((acc, e) => {
    const key = e.location_name || e.sub_category || "Other";
    acc[key] = (acc[key] || 0) + (e.tco2e || 0);
    return acc;
  }, {});
  const pieData = Object.entries(pieGroups).map(([name, value]) => ({ name, value: parseFloat(value.toFixed(3)) })).filter(d => d.value > 0);

  // Trend data by month
  const monthLabels = ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun"];
  const trendData = monthLabels.map((m, i) => ({
    month: m,
    tCO2e: entries.filter(e => e.start_date && ((new Date(e.start_date).getMonth() + 6) % 12 === i))
      .reduce((s, e) => s + (e.tco2e || 0), 0).toFixed(3)
  }));

  const scopeColor = SCOPE_COLORS[config.scope] || "#10b981";

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{config.title}</h1>
          <p className="text-sm text-slate-500 mt-0.5">{config.description}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 text-sm" onClick={() => setShowBulk(true)}>
            <Upload className="w-3.5 h-3.5" /> Import
          </Button>
          {categoryKey === "goods" ? (
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => openAdd({ defaultValues: { sub_category: "Capital Goods" } })}>
                <Plus className="w-4 h-4" /> Add Capital Goods
              </Button>
              <Button size="sm" className="gap-1.5" onClick={() => openAdd({ defaultValues: { sub_category: "Purchased Goods & Services" } })}>
                <Plus className="w-4 h-4" /> Add Purchased Goods &amp; Services
              </Button>
            </div>
          ) : categoryKey === "energy" ? (
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => openAdd({ scope: "Scope 2", category: "Purchased Electricity" })}>
                <Plus className="w-3.5 h-3.5" /> Electricity
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => openAdd({ scope: "Scope 1", category: "Stationary Combustion" })}>
                <Plus className="w-3.5 h-3.5" /> Stationary Fuel
              </Button>
              <Button size="sm" className="gap-1.5 text-xs" onClick={() => openAdd({ scope: "Scope 2", category: "Purchased Heat & Steam" })}>
                <Plus className="w-3.5 h-3.5" /> Heat / Steam
              </Button>
            </div>
          ) : categoryKey === "travel" ? (
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => { setTravelSubCategory("Air Travel"); setShowTravelDialog(true); }}>
                <Plus className="w-3.5 h-3.5" /> ✈ Air Travel
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => { setTravelSubCategory("Road & Rail"); setShowTravelDialog(true); }}>
                <Plus className="w-3.5 h-3.5" /> 🚗 Road & Rail
              </Button>
              <Button size="sm" className="gap-1.5 text-xs" onClick={() => { setTravelSubCategory("Accommodation"); setShowTravelDialog(true); }}>
                <Plus className="w-3.5 h-3.5" /> 🏨 Accommodation
              </Button>
            </div>
          ) : categoryKey === "transportation" ? (
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => { setTransportDirection("Upstream"); setShowTransportDialog(true); }}>
                <Plus className="w-3.5 h-3.5" /> Upstream (Cat 4)
              </Button>
              <Button size="sm" className="gap-1.5 text-xs" onClick={() => { setTransportDirection("Downstream"); setShowTransportDialog(true); }}>
                <Plus className="w-3.5 h-3.5" /> Downstream (Cat 9)
              </Button>
            </div>
          ) : categoryKey === "leased-assets" ? (
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => { setLeasedType("Upstream"); setShowLeasedDialog(true); }}>
                <Plus className="w-3.5 h-3.5" /> Upstream (Cat 8)
              </Button>
              <Button size="sm" className="gap-1.5 text-xs" onClick={() => { setLeasedType("Downstream"); setShowLeasedDialog(true); }}>
                <Plus className="w-3.5 h-3.5" /> Downstream (Cat 13)
              </Button>
            </div>
          ) : categoryKey === "sold-products" ? (
            <Button size="sm" className="gap-1.5" onClick={() => setShowGateway(true)}>
              <Plus className="w-4 h-4" /> Add Product
            </Button>
          ) : categoryKey === "refrigerants" ? (
            <Button size="sm" className="gap-1.5" onClick={() => setShowRefrigDialog(true)}>
              <Plus className="w-4 h-4" /> Add Refrigerant Entry
            </Button>
          ) : categoryKey === "waste" ? (
            <Button size="sm" className="gap-1.5" onClick={() => setShowWasteDialog(true)}>
              <Plus className="w-4 h-4" /> Add Waste Entry
            </Button>
          ) : categoryKey === "employees" ? (
            <Button size="sm" className="gap-1.5" onClick={() => setShowCommuteDialog(true)}>
              <Plus className="w-4 h-4" /> Add Commuting Entry
            </Button>
          ) : categoryKey === "franchises" ? (
            <Button size="sm" className="gap-1.5" onClick={() => setShowFranchiseDialog(true)}>
              <Plus className="w-4 h-4" /> Add Franchise Entry
            </Button>
          ) : categoryKey === "investments" ? (
            <Button size="sm" className="gap-1.5" onClick={() => setShowInvGateway(true)}>
              <Plus className="w-4 h-4" /> Add Investment
            </Button>
          ) : (
            <Button size="sm" className="gap-1.5" onClick={() => openAdd()}>
              <Plus className="w-4 h-4" /> Add {config.title}
            </Button>
          )}
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Energy Sources / Breakdown pie */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">{config.pieLabel}</h3>
            </div>
            <div className="flex items-center gap-2">
              <select value={fy} onChange={e => setFy(e.target.value)} className="text-xs border border-slate-200 rounded-lg px-2 py-1 text-slate-600 bg-white">
                {FY_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
          </div>
          {pieData.length > 0 ? (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width={130} height={130}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={60} dataKey="value" paddingAngle={3}>
                    {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={v => `${v} tCO₂e`} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 flex-1">
                {pieData.slice(0, 5).map((d, i) => (
                  <div key={d.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="text-slate-600 truncate max-w-[100px]">{d.name}</span>
                    </div>
                    <span className="font-medium text-slate-800">{d.value}t</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-32 flex items-center justify-center text-sm text-slate-400">No data yet — add entries below</div>
          )}
        </div>

        {/* Emissions Trend */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-800">Emissions Trend</h3>
            <span className="text-xs text-slate-400">Last 12 months</span>
          </div>
          <ResponsiveContainer width="100%" height={130}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#94a3b8" }} />
              <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 11 }} />
              <Line type="monotone" dataKey="tCO2e" stroke={scopeColor} strokeWidth={2} dot={{ r: 3, fill: scopeColor }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        {config.energyTypes && (
          <div className="flex bg-slate-100 rounded-lg p-0.5">
            {config.energyTypes.map(t => (
              <button key={t} onClick={() => setEnergyTypeFilter(t)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${energyTypeFilter === t ? "bg-white shadow-sm text-slate-800" : "text-slate-500"}`}>
                {t}
              </button>
            ))}
          </div>
        )}
        {config.travelTypes && (
          <div className="flex gap-1 overflow-x-auto">
            {config.travelTypes.map(t => (
              <button key={t} onClick={() => setEnergyTypeFilter(t === energyTypeFilter ? "" : t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all border ${energyTypeFilter === t ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"}`}>
                {t}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 ml-0 flex-wrap">
          <select value={locationFilter} onChange={e => setLocationFilter(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700 min-w-[130px]">
            <option>All locations</option>
            {locations.map(l => <option key={l.id}>{l.name}</option>)}
          </select>

          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <Input className="pl-8 text-sm w-48 h-9" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <span className="text-sm text-slate-500">{filtered.length} records · <span className="font-semibold text-slate-800">{totalTCO2e.toFixed(3)} tCO₂e</span></span>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs"><Download className="w-3 h-3" /> Export</Button>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center h-32"><div className="w-8 h-8 border-4 border-slate-200 border-t-emerald-600 rounded-full animate-spin" /></div>
      ) : filtered.length > 0 ? (
        <EmissionsTable entries={filtered} columns={config.cols} onDelete={handleDelete} onEdit={(e) => { setEditEntry(e); setShowDialog(true); }} />
      ) : (
        <div className="text-center py-16 bg-white border border-dashed border-slate-300 rounded-xl">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
            <Plus className="w-5 h-5 text-slate-400" />
          </div>
          <h3 className="font-semibold text-slate-800 mb-1">No {config.title.toLowerCase()} data yet</h3>
          <p className="text-sm text-slate-500 mb-4">{config.description}</p>
          <Button onClick={() => setShowDialog(true)} className="gap-2"><Plus className="w-4 h-4" /> Add {config.title}</Button>
        </div>
      )}

      <BulkUploadModal
        open={showBulk}
        onClose={() => setShowBulk(false)}
        title={config.title}
        templateHeaders={["source_name", "location_name", "supplier", "start_date", "end_date", "quantity", "unit", "amount_paid", "notes"]}
        exampleRows={[["Main Meter", "Sydney HQ", "AGL", "2024-01-01", "2024-01-31", "5000", "kWh", "450", ""]]}
        onUpload={async (rows) => {
          let created = 0, skipped = 0;
          for (const row of rows) {
            if (!row.source_name && !row.quantity) { skipped++; continue; }
            await base44.entities.EmissionEntry.create({ ...row, scope: config.scope, category: config.category, reporting_year: 2024, quantity: parseFloat(row.quantity) || undefined, amount_paid: parseFloat(row.amount_paid) || undefined });
            created++;
          }
          load();
          return { created, skipped, errors: [] };
        }}
      />

      <ProductClassificationGateway
        open={showGateway}
        onClose={() => setShowGateway(false)}
        onAddEntry={(scope, category) => {
          setShowGateway(false);
          openAdd({ scope, category });
        }}
        onProceedWithCategories={(cats) => {
          setShowGateway(false);
          setSoldProductsCategories(cats);
          setShowSoldProducts(true);
        }}
      />

      <SoldProductsDialog
        open={showSoldProducts}
        onClose={() => { setShowSoldProducts(false); setSoldProductsCategories([]); }}
        onSaved={load}
        triggeredCategories={soldProductsCategories}
      />

      <InvestmentsGateway
        open={showInvGateway}
        onClose={() => setShowInvGateway(false)}
        onProceedPCAF={() => { setShowInvGateway(false); setShowInvestments(true); }}
        onControlledAsset={load}
      />

      <InvestmentsPCAFDialog
        open={showInvestments}
        onClose={() => { setShowInvestments(false); setEditInvestment(null); }}
        onSaved={load}
      />

      <TransportationTieredDialog
        open={showTransportDialog}
        onClose={() => setShowTransportDialog(false)}
        onSaved={load}
        direction={transportDirection}
      />

      <LeasedAssetsTieredDialog
        open={showLeasedDialog}
        onClose={() => setShowLeasedDialog(false)}
        onSaved={load}
        leaseType={leasedType}
      />

      <WasteReuseTieredDialog
        open={showWasteDialog}
        onClose={() => setShowWasteDialog(false)}
        onSaved={load}
      />

      <EmployeeCommutingDialog
        open={showCommuteDialog}
        onClose={() => setShowCommuteDialog(false)}
        onSaved={load}
      />

      <FranchisesDialog
        open={showFranchiseDialog}
        onClose={() => setShowFranchiseDialog(false)}
        onSaved={load}
      />

      <BusinessTravelDialog
        open={showTravelDialog}
        onClose={() => setShowTravelDialog(false)}
        onSaved={load}
        subCategory={travelSubCategory}
      />

      <RefrigerantsTieredDialog
        open={showRefrigDialog}
        onClose={() => setShowRefrigDialog(false)}
        onSaved={load}
      />

      <GHGEntryDialog
        open={showDialog}
        onClose={() => { setShowDialog(false); setEditEntry(null); setDialogProps({}); }}
        onSaved={load}
        scope={dialogProps.scope || config.scope}
        category={dialogProps.category || config.category}
        defaultValues={editEntry || dialogProps.defaultValues || {}}
      />
    </div>
  );
}