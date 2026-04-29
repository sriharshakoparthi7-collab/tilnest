import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { base44 } from "@/api/base44Client";
import { Plus, Trash2, Sparkles, ChevronDown, ChevronUp } from "lucide-react";

const SEGMENT_COLORS = {
  upstream: "bg-amber-100 text-amber-700 border-amber-200",
  direct_operations: "bg-blue-100 text-blue-700 border-blue-200",
  downstream: "bg-emerald-100 text-emerald-700 border-emerald-200",
};

const SEGMENT_LABELS = {
  upstream: "Upstream",
  direct_operations: "Direct Operations",
  downstream: "Downstream",
};

export default function Phase2ValueChain({ assessment, onUpdate }) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [expanded, setExpanded] = useState({});
  const [newTopic, setNewTopic] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load();
  }, [assessment.id]);

  const load = async () => {
    setLoading(true);
    const data = await base44.entities.ValueChainActivity.filter({ assessment_id: assessment.id });
    setActivities(data);
    setLoading(false);
  };

  const generateValueChain = async () => {
    setGenerating(true);
    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `You are a sustainability expert. Generate a typical value chain for the following company profile:

Company: ${assessment.company_name}
Industry: ${assessment.industry_description || assessment.industry_code}
Framework: ${assessment.assessment_framework}
Country: ${assessment.country}

Return JSON with value chain activities covering upstream, direct operations, and downstream segments, with relevant sustainability topics for each:
{
  "activities": [
    {
      "activity_name": "string",
      "segment": "upstream | direct_operations | downstream",
      "sustainability_topics": ["topic1", "topic2"],
      "esrs_references": ["ESRS.E1", "ESRS.S1"] 
    }
  ]
}

Generate 8-12 activities covering the full value chain. ESRS references only if framework is ESRS.`,
      response_json_schema: {
        type: "object",
        properties: {
          activities: {
            type: "array",
            items: {
              type: "object",
              properties: {
                activity_name: { type: "string" },
                segment: { type: "string" },
                sustainability_topics: { type: "array", items: { type: "string" } },
                esrs_references: { type: "array", items: { type: "string" } }
              }
            }
          }
        }
      }
    });

    if (res?.activities) {
      for (const act of res.activities) {
        await base44.entities.ValueChainActivity.create({
          assessment_id: assessment.id,
          activity_name: act.activity_name,
          segment: act.segment,
          sustainability_topics: act.sustainability_topics || [],
          esrs_references: act.esrs_references || [],
          is_auto_generated: true,
        });
      }
      await load();
    }
    setGenerating(false);
  };

  const addActivity = async () => {
    const act = await base44.entities.ValueChainActivity.create({
      assessment_id: assessment.id,
      activity_name: "New Activity",
      segment: "direct_operations",
      sustainability_topics: [],
      esrs_references: [],
      is_auto_generated: false,
    });
    setActivities(a => [...a, act]);
    setExpanded(e => ({ ...e, [act.id]: true }));
  };

  const updateActivity = async (id, data) => {
    await base44.entities.ValueChainActivity.update(id, data);
    setActivities(acts => acts.map(a => a.id === id ? { ...a, ...data } : a));
  };

  const deleteActivity = async (id) => {
    await base44.entities.ValueChainActivity.delete(id);
    setActivities(acts => acts.filter(a => a.id !== id));
  };

  const addTopic = async (actId) => {
    const topic = newTopic[actId];
    if (!topic?.trim()) return;
    const act = activities.find(a => a.id === actId);
    const topics = [...(act.sustainability_topics || []), topic.trim()];
    await updateActivity(actId, { sustainability_topics: topics });
    setNewTopic(t => ({ ...t, [actId]: "" }));
  };

  const removeTopic = async (actId, topicIdx) => {
    const act = activities.find(a => a.id === actId);
    const topics = (act.sustainability_topics || []).filter((_, i) => i !== topicIdx);
    await updateActivity(actId, { sustainability_topics: topics });
  };

  const handleNext = async () => {
    setSaving(true);
    const updated = await base44.entities.MaterialityAssessment.update(assessment.id, {
      current_phase: Math.max(assessment.current_phase || 1, 3),
    });
    onUpdate(updated);
    setSaving(false);
  };

  const grouped = { upstream: [], direct_operations: [], downstream: [] };
  activities.forEach(a => { if (grouped[a.segment]) grouped[a.segment].push(a); });

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Phase 2: Value Chain & Sustainability Topics</h2>
        <p className="text-sm text-slate-500 mt-1">Map your value chain activities and identify sustainability topics for each segment.</p>
      </div>

      {activities.length === 0 && !loading && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-6 text-center">
          <Sparkles className="w-10 h-10 text-indigo-400 mx-auto mb-3" />
          <h3 className="font-semibold text-indigo-900 mb-1">Auto-Generate Value Chain</h3>
          <p className="text-sm text-indigo-600 mb-4">AI will generate typical value chain activities and sustainability topics based on your industry profile.</p>
          <Button onClick={generateValueChain} disabled={generating} className="gap-2">
            <Sparkles className="w-4 h-4" />
            {generating ? "Generating..." : "Generate with AI"}
          </Button>
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-2 border-slate-300 border-t-slate-700 rounded-full animate-spin" />
        </div>
      )}

      {!loading && activities.length > 0 && (
        <div className="space-y-5">
          {Object.entries(grouped).map(([segment, acts]) => (
            <div key={segment}>
              <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border mb-3 ${SEGMENT_COLORS[segment]}`}>
                {SEGMENT_LABELS[segment]} ({acts.length})
              </div>
              <div className="space-y-2">
                {acts.map(act => (
                  <div key={act.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                    <div className="flex items-center gap-3 px-4 py-3">
                      <button onClick={() => setExpanded(e => ({ ...e, [act.id]: !e[act.id] }))} className="text-slate-400">
                        {expanded[act.id] ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                      <Input
                        className="flex-1 border-0 bg-transparent p-0 text-sm font-medium focus-visible:ring-0 h-auto"
                        value={act.activity_name}
                        onChange={e => updateActivity(act.id, { activity_name: e.target.value })}
                      />
                      <select className="text-xs border border-slate-200 rounded-md px-2 py-1 bg-white" value={act.segment} onChange={e => updateActivity(act.id, { segment: e.target.value })}>
                        <option value="upstream">Upstream</option>
                        <option value="direct_operations">Direct Ops</option>
                        <option value="downstream">Downstream</option>
                      </select>
                      {act.is_auto_generated && <span className="text-xs text-indigo-400 bg-indigo-50 px-1.5 py-0.5 rounded">AI</span>}
                      <button onClick={() => deleteActivity(act.id)} className="text-slate-300 hover:text-red-400">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    {expanded[act.id] && (
                      <div className="px-4 pb-4 space-y-3 border-t border-slate-100 pt-3">
                        <div className="text-xs font-medium text-slate-600">Sustainability Topics</div>
                        <div className="flex flex-wrap gap-2">
                          {(act.sustainability_topics || []).map((t, i) => (
                            <span key={i} className="flex items-center gap-1 bg-slate-100 text-slate-700 text-xs px-2 py-1 rounded-full">
                              {t}
                              <button onClick={() => removeTopic(act.id, i)} className="text-slate-400 hover:text-red-400">×</button>
                            </span>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <Input
                            className="h-7 text-xs"
                            placeholder="Add topic..."
                            value={newTopic[act.id] || ""}
                            onChange={e => setNewTopic(t => ({ ...t, [act.id]: e.target.value }))}
                            onKeyDown={e => e.key === "Enter" && addTopic(act.id)}
                          />
                          <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => addTopic(act.id)}>Add</Button>
                        </div>
                        {(act.esrs_references || []).length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {act.esrs_references.map((ref, i) => (
                              <span key={i} className="text-xs bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded">{ref}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={addActivity} className="gap-2">
              <Plus className="w-4 h-4" /> Add Activity
            </Button>
            {activities.length > 0 && (
              <Button variant="outline" size="sm" onClick={generateValueChain} disabled={generating} className="gap-2 text-indigo-600 border-indigo-200 hover:bg-indigo-50">
                <Sparkles className="w-4 h-4" /> {generating ? "Generating..." : "Add More with AI"}
              </Button>
            )}
          </div>
        </div>
      )}

      {activities.length > 0 && (
        <div className="flex justify-end pt-4">
          <Button onClick={handleNext} disabled={saving}>
            {saving ? "Saving..." : "Continue to Phase 3 →"}
          </Button>
        </div>
      )}
    </div>
  );
}