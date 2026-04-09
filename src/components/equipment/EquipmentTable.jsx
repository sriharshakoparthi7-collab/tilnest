import { Edit2, Trash2 } from "lucide-react";

const STATUS_COLORS = {
  Active: "bg-emerald-50 text-emerald-700",
  Inactive: "bg-slate-100 text-slate-500",
  Retired: "bg-red-50 text-red-600",
};

export default function EquipmentTable({ equipment, onEdit, onDelete }) {
  if (!equipment.length) return null;

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wide">
              <th className="text-left px-4 py-3">Name</th>
              <th className="text-left px-4 py-3">Type</th>
              <th className="text-left px-4 py-3">Location</th>
              <th className="text-left px-4 py-3">Power</th>
              <th className="text-left px-4 py-3">Quantity</th>
              <th className="text-left px-4 py-3">Emissions</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {equipment.map(eq => (
              <tr key={eq.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 font-medium text-slate-800">
                  {eq.equipment_name}
                  {eq.equipment_subtype && <div className="text-xs text-slate-400">{eq.equipment_subtype}</div>}
                </td>
                <td className="px-4 py-3 text-slate-600">{eq.equipment_type_main}</td>
                <td className="px-4 py-3 text-slate-600">{eq.location_name || "—"}</td>
                <td className="px-4 py-3 text-slate-600">{eq.power_source}</td>
                <td className="px-4 py-3 text-slate-600">{eq.quantity} {eq.unit}</td>
                <td className="px-4 py-3 font-semibold text-emerald-700">{(eq.tco2e || 0).toFixed(4)} tCO₂e</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[eq.status] || STATUS_COLORS.Active}`}>{eq.status}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 justify-end">
                    <button onClick={() => onEdit(eq)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700"><Edit2 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => onDelete(eq.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}