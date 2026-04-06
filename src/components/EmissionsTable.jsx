import { Trash2, Edit2 } from "lucide-react";

const SCOPE_COLORS = { "Scope 1": "#10b981", "Scope 2": "#f59e0b", "Scope 3": "#3b82f6" };

export default function EmissionsTable({ entries, onDelete, onEdit, columns = [] }) {
  const defaultCols = [
    { key: "source_name", label: "Source" },
    { key: "location_name", label: "Location" },
    { key: "start_date", label: "Start Date" },
    { key: "end_date", label: "End Date" },
    { key: "supplier", label: "Supplier" },
    { key: "quantity", label: "Usage" },
    { key: "unit", label: "Unit" },
    { key: "amount_paid", label: "Amount Paid" },
    { key: "tco2e", label: "Emissions (tCO₂e)" },
    { key: "status", label: "Status" },
  ];

  const cols = columns.length > 0 ? columns : defaultCols;

  const statusColors = {
    Draft: "bg-gray-100 text-gray-600",
    "In Review": "bg-amber-50 text-amber-700",
    Approved: "bg-emerald-50 text-emerald-700"
  };

  if (entries.length === 0) return null;

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            {cols.map(c => (
              <th key={c.key} className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground whitespace-nowrap">{c.label}</th>
            ))}
            <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground">Actions</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(e => (
            <tr key={e.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
              {cols.map(c => (
                <td key={c.key} className="py-3 px-4 whitespace-nowrap">
                  {c.key === "tco2e" ? (
                    <span className="font-semibold">{(e[c.key] || 0).toFixed(3)}</span>
                  ) : c.key === "status" ? (
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[e.status] || "bg-gray-100 text-gray-600"}`}>{e.status}</span>
                  ) : c.key === "amount_paid" && e.amount_paid ? (
                    <span>{e.currency || "USD"} {e.amount_paid.toFixed(2)}</span>
                  ) : c.key === "quantity" && e.quantity ? (
                    <span>{e.quantity} {e.unit}</span>
                  ) : (
                    <span className="text-foreground">{e[c.key] ?? "—"}</span>
                  )}
                </td>
              ))}
              <td className="py-3 px-4">
                <div className="flex items-center gap-1">
                  {onEdit && <button onClick={() => onEdit(e)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>}
                  {onDelete && <button onClick={() => onDelete(e.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-500 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}