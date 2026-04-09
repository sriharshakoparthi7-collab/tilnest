import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { MapPin, Plus } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export default function LocationSelector({ value, onChange, label = "Location", required = false, showAddHint = true }) {
  const [locations, setLocations] = useState([]);

  useEffect(() => {
    base44.entities.Location.list().then(setLocations);
  }, []);

  return (
    <div>
      {label && <Label className="text-sm font-medium">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</Label>}
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="mt-1">
          <SelectValue placeholder="Select location..." />
        </SelectTrigger>
        <SelectContent>
          {locations.length === 0 && (
            <div className="px-3 py-2 text-xs text-slate-400 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" /> No locations yet — add one in Settings
            </div>
          )}
          {locations.map(l => (
            <SelectItem key={l.id} value={l.id}>
              <div className="flex items-center gap-2">
                <MapPin className="w-3 h-3 text-slate-400" />
                <span>{l.name}</span>
                {l.city && <span className="text-slate-400 text-xs">{l.city}</span>}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {showAddHint && locations.length === 0 && (
        <a href="/locations" className="text-xs text-emerald-600 hover:underline flex items-center gap-1 mt-1">
          <Plus className="w-3 h-3" /> Add your first location
        </a>
      )}
    </div>
  );
}