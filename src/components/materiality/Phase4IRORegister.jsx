import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { base44 } from "@/api/base44Client";
import { Plus, Trash2, Sparkles, ChevronDown, ChevronUp } from "lucide-react";

const IRO_TYPE_CONFIG = {
  impact_positive: { label: "Positive Impact", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  impact_negative: { label: "Negative Impact", color: "bg-red-100 text-red-600 border-red-200" },
  risk: { label: "Risk", color: "bg-orange-100 text-orange-700 border-orange-200" },
  opportunity: { label: "Opportunity", color: "bg-blue-100 text-blue-700 border-blue-200" },
};

const TIME_HORIZON_LABELS = {
  short_term: "Short-term (<1yr)",
  medium_term: "Medium-term (1-5yr)",
  long_term: "Long-term (>5yr)",
};

export default function Phase4IRORegister({ assessment, onUpdate }) {
  const [iros, setIros] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      base44.entities.IRORegister.filter({ assessment_id: assessment.id }),
      base44.entities.ValueChainActivity.filter({ assessment_id: assessment.id }),
    ]).then(([iroData, actData]) => {
      setIros(iroData);
      setActivities(actData);
      setLoading(false);
    });
  }, [assessment.id]);

  const generateIROs = async () => {
    setGenerating(true);
    const topics = activities.flatMap(a => (a.sustainability_topics || [])).filter((t, i, arr) => arr.indexOf(t) === i);
    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `You are a sustainability expert specializing in ${assessment.assessment_framework} materiality assessments.

Generate an IRO (Impacts, Risks, Opportunities) register for:
Company: ${assessment.company_name}
Industry: ${assessment.industry_description || assessment.industry_code}
Framework: ${assessment.assessment_framework}
Approach: ${assessment.materiality_approach}
Key Sustainability Topics identified: ${topics.slice(0, 15).join(", ")}

Return JSON:
{
  "iros": [
    {
      "topic_name": "string",
      "iro_type": "impact_positive | impact_negative | risk | opportunity",
      "status": "actual | potential",
      "time_horizon": "short_term | medium_term | long_term",
      "esrs_reference": "string (if ESRS framework)",
      "notes": "brief description"
    }
  ]
}

Generate 10-15 IROs covering diverse topics. For ESRS, include proper references (e.g. ESRS E1, ESRS S1).`,
      response_json_schema: {
        type: "object",
        properties: {
          iros: { type: "array", items: { type: "object", properties: { topic_name: { type: "string" }, iro_type: { type: "string" }, status: { type: "string" }, time_horizon: { type: "string" }, esrs_reference: { type: "string" }, notes: { type: "string" } } } }
        }
      }
    });

    if (res?.iros) {
      for (const iro of res.iros) {
        await base44.entities.IRORegister.create({
          assessment_id: assessment.id,
          topic_name: iro.topic_name,
          iro_type: iro.iro_type || "risk",
          status: iro.status || "potential",
          time_horizon: iro.time_horizon || "medium_term",
          esrs_reference: iro.esrs_reference || "",
          notes: iro.notes || "",
          value_chain_activities: [],
        });
      }
      const updated = await base44.entities.IRORegister.filter({ assessment_id: assessment.id });
      setIros(updated);
    }
    setGenerating(false);
  };

  const addIRO = async () => {
    const iro = await base44.entities.IRORegister.create({
      assessment_id: assessment.id,
      topic_name: "New Topic",
      iro_type: "risk",
      status: "potential",
      time_horizon: "medium_term",
      value_chain_activities: [],
    });
    setIros(is => [...is, iro]);
    setExpanded(e => ({ ...e, [iro.id]: true }));
  };

  const updateIRO = async (id, data) => {
    await base44.entities.IRORegister.update(id, data);
    setIros(is => is.map(i => i.id === id ? { ...i, ...data } : i));
  };

  const deleteIRO = async (id) => {
    await base44.entities.IRORegister.delete(id);
    setIros(is => is.filter(i => i.id !== id));
  };

  const toggleActivity = async (iroId, actName) => {
    const iro = iros.find(i => i.id === iroId);
    const current = iro.value_chain_activities || [];
    const updated = current.includes(actName) ? current.filter(a => a !== actName) : [...current, actName];
    await updateIRO(iroId, { value_chain_activities: updated });
  };

  const handleNext = async () => {
    setSaving(true);
    const upd = await base44.entities.MaterialityAssessment.update(assessment.id, {
      current_phase: Math.max(assessment.current_phase || 1, 5),
    });
    onUpdate(upd);
    setSaving(false);
  };

  if (loading) return <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-slate-300 border-t-slate-700 rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Phase 4: IRO Register</h2>
          <p className="text-sm text-slate-500 mt-1">Log all Impacts, Risks, and Opportunities identified for this assessment.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={generateIROs} disabled={generating} className="gap-1.5 text-indigo-600 border-indigo-200 hover:bg-indigo-50">
            <Sparkles className="w-4 h-4" /> {generating ? "Generating..." : "Generate with AI"}
          </Button>
          <Button size="sm" onClick={addIRO} className="gap-1.5">
            <Plus className="w-4 h-4" /> Add IRO
          </Button>
        </div>
      </div>

      {iros.length === 0 && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center">
          <p className="text-slate-400 mb-3">No IROs yet. Generate with AI or add manually.</p>
          <Button onClick={generateIROs} disabled={generating} className="gap-2">
            <Sparkles className="w-4 h-4" /> {generating ? "Generating..." : "Generate with AI"}
          </Button>
        </div>
      )}

      <div className="space-y-2">
        {iros.map(iro => {
          const typeConfig = IRO_TYPE_CONFIG[iro.iro_type] || IRO_TYPE_CONFIG.risk;
          return (
            <div key={iro.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3">
                <button onClick={() => setExpanded(e => ({ ...e, [iro.id]: !e[iro.id] }))} className="text-slate-400 flex-shrink-0">
                  {expanded[iro.id] ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                <Input
                  className="flex-1 border-0 bg-transparent p-0 text-sm font-medium focus-visible:ring-0 h-auto"
                  value={iro.topic_name}
                  onChange={e => updateIRO(iro.id, { topic_name: e.target.value })}
                />
                <span className={`text-xs px-2 py-0.5 rounded-full border font-medium flex-shrink-0 ${typeConfig.color}`}>{typeConfig.label}</span>
                {iro.esrs_reference && (
                  <span className="text-xs bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded flex-shrink-0">{iro.esrs_reference}</span>
                )}
                <span className="text-xs text-slate-400 flex-shrink-0">{iro.status === "actual" ? "Actual" : "Potential"}</span>
                <button onClick={() => deleteIRO(iro.id)} className="text-slate-200 hover:text-red-400 flex-shrink-0">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              {expanded[iro.id] && (
                <div className="px-4 pb-4 border-t border-slate-100 pt-4 grid grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-medium text-slate-600">IRO Type</label>
                      <select className="mt-1 w-full h-8 rounded-md border border-input bg-transparent px-2 text-xs" value={iro.iro_type} onChange={e => updateIRO(iro.id, { iro_type: e.target.value })}>
                        {Object.entries(IRO_TYPE_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-600">Status</label>
                      <select className="mt-1 w-full h-8 rounded-md border border-input bg-transparent px-2 text-xs" value={iro.status} onChange={e => updateIRO(iro.id, { status: e.target.value })}>
                        <option value="actual">Actual</option>
                        <option value="potential">Potential</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-600">Time Horizon</label>
                      <select className="mt-1 w-full h-8 rounded-md border border-input bg-transparent px-2 text-xs" value={iro.time_horizon} onChange={e => updateIRO(iro.id, { time_horizon: e.target.value })}>
                        {Object.entries(TIME_HORIZON_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-600">ESRS Reference</label>
                      <Input className="mt-1 h-8 text-xs" placeholder="e.g. ESRS E1, ESRS S1" value={iro.esrs_reference || ""} onChange={e => updateIRO(iro.id, { esrs_reference: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-600">Notes</label>
                      <textarea className="mt-1 w-full rounded-md border border-input bg-transparent px-2 py-1 text-xs min-h-[60px] resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" value={iro.notes || ""} onChange={e => updateIRO(iro.id, { notes: e.target.value })} placeholder="Brief description..." />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600">Value Chain Activities</label>
                    <div className="mt-2 space-y-1.5 max-h-48 overflow-y-auto">
                      {activities.map(act => (
                        <label key={act.id} className="flex items-center gap-2 cursor-pointer group">
                          <input type="checkbox" checked={(iro.value_chain_activities || []).includes(act.activity_name)} onChange={() => toggleActivity(iro.id, act.activity_name)} className="accent-blue-600" />
                          <span className="text-xs text-slate-700 group-hover:text-slate-900">{act.activity_name}</span>
                          <span className={`text-xs ml-auto px-1.5 py-0.5 rounded border ${act.segment === "upstream" ? "bg-amber-50 text-amber-600 border-amber-200" : act.segment === "direct_operations" ? "bg-blue-50 text-blue-600 border-blue-200" : "bg-emerald-50 text-emerald-600 border-emerald-200"}`}>
                            {act.segment === "direct_operations" ? "Ops" : act.segment}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {iros.length > 0 && (
        <div className="flex justify-between items-center pt-4">
          <span className="text-sm text-slate-500">{iros.length} IRO{iros.length !== 1 ? "s" : ""} registered</span>
          <Button onClick={handleNext} disabled={saving}>
            {saving ? "Saving..." : "Continue to Phase 5: Scoring →"}
          </Button>
        </div>
      )}
    </div>
  );
}