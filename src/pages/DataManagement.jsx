import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Database, CheckCircle2, AlertTriangle, Circle } from "lucide-react";

const SOURCES = ["Electricity", "Gas", "Stationary Fuel", "Company Vehicles", "Flights", "Goods & Services", "Capital Goods", "Employee Commute", "Waste", "Refrigerants"];
const MONTHS = ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun"];

export default function DataManagement() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [locations, setLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState("All locations");

  useEffect(() => {
    Promise.all([
      base44.entities.EmissionEntry.list(),
      base44.entities.Location.list()
    ]).then(([e, l]) => {
      setEntries(e);
      setLocations(l);
      setLoading(false);
    });
  }, []);

  const hasData = (source, monthIdx) => {
    const catMap = {
      Electricity: "Purchased Electricity",
      Gas: "Stationary Combustion",
      "Stationary Fuel": "Stationary Combustion",
      "Company Vehicles": "Mobile Combustion",
      Flights: "Business Travel",
      "Goods & Services": "Purchased Goods and Services",
      "Capital Goods": "Capital Goods",
      "Employee Commute": "Employee Commuting",
      Waste: "Waste Generated in Operations",
      Refrigerants: "Refrigerants",
    };
    return entries.some(e => {
      const cat = catMap[source] || source;
      return e.category === cat && e.start_date && new Date(e.start_date).getMonth() === ((monthIdx + 6) % 12);
    });
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Data Management Reports</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Track data completeness across emission sources and time periods</p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-foreground">Data Summary</h3>
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /><span className="text-muted-foreground">Data present</span></div>
            <div className="flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5 text-amber-500" /><span className="text-muted-foreground">Incomplete</span></div>
            <div className="flex items-center gap-1.5"><Circle className="w-3.5 h-3.5 text-muted-foreground/30" /><span className="text-muted-foreground">No data</span></div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2.5 px-3 text-xs font-semibold text-muted-foreground min-w-[140px]">Source</th>
                {MONTHS.map(m => (
                  <th key={m} className="text-center py-2.5 px-2 text-xs font-semibold text-muted-foreground w-12">{m}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SOURCES.map(source => (
                <tr key={source} className="border-b border-border/50 hover:bg-muted/20">
                  <td className="py-2.5 px-3 font-medium text-sm">{source}</td>
                  {MONTHS.map((m, i) => {
                    const has = hasData(source, i);
                    return (
                      <td key={m} className="py-2.5 px-2 text-center">
                        {has ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" />
                        ) : (
                          <Circle className="w-4 h-4 text-muted-foreground/25 mx-auto" />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Entries", value: entries.length, color: "text-foreground" },
          { label: "Approved", value: entries.filter(e => e.status === "Approved").length, color: "text-emerald-600" },
          { label: "Pending Review", value: entries.filter(e => e.status === "Draft").length, color: "text-amber-600" },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4 text-center">
            <div className={`text-3xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-sm text-muted-foreground mt-1">{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}