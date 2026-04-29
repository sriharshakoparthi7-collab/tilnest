import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { base44 } from "@/api/base44Client";
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, Cell } from "recharts";
import { CheckCircle2, AlertTriangle } from "lucide-react";

const QUADRANT_ACTIONS = {
  critical: { label: "Disclosure Required — Critical", color: "#dc2626", bg: "bg-red-50 border-red-200" },
  high: { label: "Disclosure Required — High", color: "#ea580c", bg: "bg-orange-50 border-orange-200" },
  medium: { label: "Monitor for Disclosure", color: "#ca8a04", bg: "bg-yellow-50 border-yellow-200" },
  low: { label: "Consider Disclosure", color: "#6b7280", bg: "bg-slate-50 border-slate-200" },
};

function getQuadrant(iro, impactThreshold, financialThreshold) {
  const imp = iro.composite_score || iro.impact_score || 0;
  const fin = iro.financial_score || 0;
  const highImp = imp >= impactThreshold;
  const highFin = fin >= financialThreshold;
  if (highImp && highFin) return "critical";
  if (highImp || highFin) return "high";
  if (imp >= 2 || fin >= 2) return "medium";
  return "low";
}

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const d = payload[0].payload;
    return (
      <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-xs max-w-48">
        <div className="font-semibold text-slate-900 mb-1">{d.topic_name}</div>
        <div className="text-slate-500">Impact: <strong>{d.x?.toFixed(2)}</strong></div>
        <div className="text-slate-500">Financial: <strong>{d.y?.toFixed(2)}</strong></div>
        <div className="text-slate-500">Level: <strong>{d.materiality_level?.replace(/_/g, " ")}</strong></div>
      </div>
    );
  }
  return null;
};

export default function Phase6Matrix({ assessment, onUpdate }) {
  const [iros, setIros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [impactThreshold, setImpactThreshold] = useState(assessment.impact_threshold || 3.0);
  const [financialThreshold, setFinancialThreshold] = useState(assessment.financial_threshold || 3.0);
  const [justification, setJustification] = useState(assessment.threshold_justification || "");
  const [boardStatus, setBoardStatus] = useState(assessment.board_approval_status || "pending");
  const [boardNotes, setBoardNotes] = useState(assessment.board_approval_notes || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    base44.entities.IRORegister.filter({ assessment_id: assessment.id }).then(data => {
      setIros(data);
      setLoading(false);
    });
  }, [assessment.id]);

  const scatterData = iros.map(iro => ({
    x: parseFloat((iro.composite_score || iro.impact_score || 0).toFixed(3)),
    y: parseFloat((iro.financial_score || 0).toFixed(3)),
    topic_name: iro.topic_name,
    materiality_level: iro.materiality_level,
    quadrant: getQuadrant(iro, impactThreshold, financialThreshold),
  }));

  const DOT_COLORS = {
    critical: "#dc2626",
    high: "#ea580c",
    medium: "#ca8a04",
    low: "#9ca3af",
  };

  const saveThresholds = async () => {
    setSaving(true);
    const upd = await base44.entities.MaterialityAssessment.update(assessment.id, {
      impact_threshold: impactThreshold,
      financial_threshold: financialThreshold,
      threshold_justification: justification,
      board_approval_status: boardStatus,
      board_approval_notes: boardNotes,
      status: boardStatus === "approved" ? "approved" : boardStatus === "rejected" ? "rejected" : "ready_for_review",
      current_phase: Math.max(assessment.current_phase || 1, 6),
    });
    onUpdate(upd);
    setSaving(false);
  };

  const groupedByQuadrant = { critical: [], high: [], medium: [], low: [] };
  iros.forEach(iro => {
    const q = getQuadrant(iro, impactThreshold, financialThreshold);
    groupedByQuadrant[q].push(iro);
  });

  if (loading) return <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-slate-300 border-t-slate-700 rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Phase 6: Materiality Matrix & Sign-Off</h2>
        <p className="text-sm text-slate-500 mt-1">Visualize your materiality results and set disclosure thresholds.</p>
      </div>

      {/* Scatter Plot */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="text-sm font-semibold text-slate-700 mb-4">Materiality Matrix</div>
        {scatterData.some(d => d.x > 0 || d.y > 0) ? (
          <ResponsiveContainer width="100%" height={380}>
            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis type="number" dataKey="x" name="Impact Score" domain={[0, 5]} label={{ value: "Impact Score →", position: "insideBottom", offset: -10, fontSize: 12, fill: "#64748b" }} tick={{ fontSize: 11 }} />
              <YAxis type="number" dataKey="y" name="Financial Score" domain={[0, 5]} label={{ value: "Financial Score →", angle: -90, position: "insideLeft", offset: 10, fontSize: 12, fill: "#64748b" }} tick={{ fontSize: 11 }} />
              <ReferenceLine x={impactThreshold} stroke="#ef4444" strokeDasharray="4 4" strokeWidth={1.5} label={{ value: `Impact: ${impactThreshold}`, position: "top", fontSize: 10, fill: "#ef4444" }} />
              <ReferenceLine y={financialThreshold} stroke="#ef4444" strokeDasharray="4 4" strokeWidth={1.5} label={{ value: `Financial: ${financialThreshold}`, position: "right", fontSize: 10, fill: "#ef4444" }} />
              <Tooltip content={<CustomTooltip />} />
              <Scatter data={scatterData}>
                {scatterData.map((entry, i) => (
                  <Cell key={i} fill={DOT_COLORS[entry.quadrant] || "#9ca3af"} opacity={0.8} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-center py-16 text-slate-400">
            <p className="text-sm">No scored IROs to display. Complete Phase 5 scoring first.</p>
          </div>
        )}
      </div>

      {/* Threshold Controls */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="text-sm font-semibold text-slate-700">Threshold Settings</div>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="text-xs font-medium text-slate-600">Impact Threshold (default 3.0)</label>
            <div className="flex items-center gap-3 mt-2">
              <input type="range" min="1" max="5" step="0.5" value={impactThreshold} onChange={e => setImpactThreshold(parseFloat(e.target.value))} className="flex-1 accent-red-500" />
              <span className="font-bold text-red-600 w-8">{impactThreshold}</span>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Financial Threshold (default 3.0)</label>
            <div className="flex items-center gap-3 mt-2">
              <input type="range" min="1" max="5" step="0.5" value={financialThreshold} onChange={e => setFinancialThreshold(parseFloat(e.target.value))} className="flex-1 accent-red-500" />
              <span className="font-bold text-red-600 w-8">{financialThreshold}</span>
            </div>
          </div>
        </div>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <label className="text-xs font-medium text-slate-600">Threshold Justification *</label>
            <span className="text-xs text-red-500">(Mandatory for audit trail)</span>
          </div>
          <textarea
            className="w-full min-h-[80px] rounded-md border border-input bg-transparent px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            placeholder="Explain why these thresholds were selected (e.g., aligned with GRI standards, board risk appetite, industry benchmarks)..."
            value={justification}
            onChange={e => setJustification(e.target.value)}
          />
        </div>
      </div>

      {/* IRO Summary by Quadrant */}
      <div className="grid grid-cols-2 gap-4">
        {Object.entries(groupedByQuadrant).map(([q, items]) => {
          const cfg = QUADRANT_ACTIONS[q];
          return (
            <div key={q} className={`border rounded-xl p-4 ${cfg.bg}`}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cfg.color }} />
                <span className="text-xs font-semibold" style={{ color: cfg.color }}>{cfg.label}</span>
                <span className="ml-auto text-xs font-bold" style={{ color: cfg.color }}>{items.length}</span>
              </div>
              <div className="space-y-1">
                {items.map(iro => (
                  <div key={iro.id} className="text-xs text-slate-700 bg-white/60 rounded px-2 py-1">{iro.topic_name}</div>
                ))}
                {items.length === 0 && <div className="text-xs text-slate-400 italic">None</div>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Board Approval */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="text-sm font-semibold text-slate-700">Board Approval & Sign-Off</div>
        <div className="flex gap-3">
          {[
            { value: "pending", label: "Pending Review", color: "border-slate-300 text-slate-600" },
            { value: "approved", label: "Approved ✓", color: "border-emerald-300 text-emerald-700 bg-emerald-50" },
            { value: "rejected", label: "Changes Required", color: "border-amber-300 text-amber-700 bg-amber-50" },
          ].map(opt => (
            <label key={opt.value} className={`flex items-center gap-2 px-3 py-2 border rounded-lg cursor-pointer text-xs font-medium transition-all ${boardStatus === opt.value ? opt.color + " border-2" : "border-slate-200 hover:bg-slate-50"}`}>
              <input type="radio" name="board" value={opt.value} checked={boardStatus === opt.value} onChange={() => setBoardStatus(opt.value)} className="accent-blue-600" />
              {opt.label}
            </label>
          ))}
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600">Approval Notes</label>
          <textarea
            className="mt-1 w-full min-h-[60px] rounded-md border border-input bg-transparent px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            placeholder="Notes from board review..."
            value={boardNotes}
            onChange={e => setBoardNotes(e.target.value)}
          />
        </div>
        {boardStatus === "approved" && (
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-xs text-emerald-700">
            <CheckCircle2 className="w-4 h-4" />
            Assessment will be marked as Approved and locked for further changes.
          </div>
        )}
        {boardStatus === "rejected" && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700">
            <AlertTriangle className="w-4 h-4" />
            Assessment will be returned for revision.
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <Button onClick={saveThresholds} disabled={saving || !justification.trim()}>
          {saving ? "Saving..." : "Save & Finalise Assessment"}
        </Button>
      </div>
    </div>
  );
}