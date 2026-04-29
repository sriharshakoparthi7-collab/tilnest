import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { base44 } from "@/api/base44Client";
import { Plus, Trash2, Users } from "lucide-react";

const ENGAGEMENT_METHODS = ["Survey", "Interview", "Workshop", "Focus Group", "Other"];
const ENGAGEMENT_FREQUENCIES = ["Weekly", "Monthly", "Quarterly", "Annual", "Ad-hoc"];

function ScoreSlider({ label, value, onChange }) {
  return (
    <div>
      <div className="flex justify-between text-xs text-slate-600 mb-1">
        <span>{label}</span>
        <span className="font-bold text-slate-900">{value}/5</span>
      </div>
      <input type="range" min="1" max="5" step="1" value={value} onChange={e => onChange(parseInt(e.target.value))}
        className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-blue-600" />
      <div className="flex justify-between text-xs text-slate-400 mt-0.5">
        <span>Low</span><span>High</span>
      </div>
    </div>
  );
}

export default function Phase3Stakeholders({ assessment, onUpdate }) {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newGroup, setNewGroup] = useState({ name: "", engagement_method: "Survey", engagement_frequency: "Annual", influence_score: 3, interest_score: 3, survey_respondent_count: 0 });

  useEffect(() => { load(); }, [assessment.id]);

  const load = async () => {
    setLoading(true);
    const data = await base44.entities.StakeholderGroup.filter({ assessment_id: assessment.id });
    setGroups(data);
    setLoading(false);
  };

  const saveGroup = async () => {
    if (!newGroup.name) return;
    const prioritization_score = newGroup.influence_score * newGroup.interest_score;
    const g = await base44.entities.StakeholderGroup.create({
      ...newGroup,
      assessment_id: assessment.id,
      prioritization_score,
    });
    setGroups(gs => [...gs, g]);
    setNewGroup({ name: "", engagement_method: "Survey", engagement_frequency: "Annual", influence_score: 3, interest_score: 3, survey_respondent_count: 0 });
    setAdding(false);
  };

  const deleteGroup = async (id) => {
    await base44.entities.StakeholderGroup.delete(id);
    setGroups(gs => gs.filter(g => g.id !== id));
  };

  const handleNext = async () => {
    setSaving(true);
    const updated = await base44.entities.MaterialityAssessment.update(assessment.id, {
      current_phase: Math.max(assessment.current_phase || 1, 4),
    });
    onUpdate(updated);
    setSaving(false);
  };

  // Skip if financial only
  if (assessment.materiality_approach === "single_financial") {
    return (
      <div className="max-w-2xl">
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center">
          <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="font-semibold text-slate-700">Stakeholder Engagement — Not Required</h3>
          <p className="text-sm text-slate-500 mt-1">Financial-only materiality approach does not require stakeholder engagement.</p>
          <Button className="mt-4" onClick={handleNext}>Continue to Phase 4 →</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Phase 3: Stakeholder Group Register</h2>
        <p className="text-sm text-slate-500 mt-1">Identify and score your key stakeholder groups. Prioritization Score = Influence × Interest.</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-slate-300 border-t-slate-700 rounded-full animate-spin" /></div>
      ) : (
        <>
          {/* Groups Table */}
          {groups.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-600">Group</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-600">Method</th>
                    <th className="text-center px-3 py-2.5 text-xs font-semibold text-slate-600">Influence</th>
                    <th className="text-center px-3 py-2.5 text-xs font-semibold text-slate-600">Interest</th>
                    <th className="text-center px-3 py-2.5 text-xs font-semibold text-slate-600">Priority Score</th>
                    <th className="text-center px-3 py-2.5 text-xs font-semibold text-slate-600">Respondents</th>
                    <th className="px-3 py-2.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map(g => (
                    <tr key={g.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">{g.name}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{g.engagement_method} · {g.engagement_frequency}</td>
                      <td className="px-3 py-3 text-center">
                        <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded">{g.influence_score}</span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded">{g.interest_score}</span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${g.prioritization_score >= 16 ? "bg-emerald-100 text-emerald-700" : g.prioritization_score >= 9 ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"}`}>
                          {g.prioritization_score}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center text-slate-500 text-xs">{g.survey_respondent_count || 0}</td>
                      <td className="px-3 py-3">
                        <button onClick={() => deleteGroup(g.id)} className="text-slate-300 hover:text-red-400">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Add Group Form */}
          {adding ? (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 space-y-4">
              <div className="text-sm font-semibold text-blue-900">Add Stakeholder Group</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Group Name *</Label>
                  <Input className="mt-1" placeholder="e.g. Investors, Employees" value={newGroup.name} onChange={e => setNewGroup(g => ({ ...g, name: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs">Respondents</Label>
                  <Input type="number" className="mt-1" value={newGroup.survey_respondent_count} onChange={e => setNewGroup(g => ({ ...g, survey_respondent_count: parseInt(e.target.value) || 0 }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Engagement Method</Label>
                  <select className="mt-1 w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={newGroup.engagement_method} onChange={e => setNewGroup(g => ({ ...g, engagement_method: e.target.value }))}>
                    {ENGAGEMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <Label className="text-xs">Frequency</Label>
                  <select className="mt-1 w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={newGroup.engagement_frequency} onChange={e => setNewGroup(g => ({ ...g, engagement_frequency: e.target.value }))}>
                    {ENGAGEMENT_FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <ScoreSlider label="Influence Score" value={newGroup.influence_score} onChange={v => setNewGroup(g => ({ ...g, influence_score: v }))} />
                <ScoreSlider label="Interest Score" value={newGroup.interest_score} onChange={v => setNewGroup(g => ({ ...g, interest_score: v }))} />
              </div>
              <div className="bg-white border border-blue-200 rounded-lg px-3 py-2 text-sm text-blue-800">
                Prioritization Score: <strong>{newGroup.influence_score * newGroup.interest_score}</strong> (Influence {newGroup.influence_score} × Interest {newGroup.interest_score})
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" size="sm" onClick={() => setAdding(false)}>Cancel</Button>
                <Button size="sm" onClick={saveGroup} disabled={!newGroup.name}>Add Group</Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" onClick={() => setAdding(true)} className="gap-2">
              <Plus className="w-4 h-4" /> Add Stakeholder Group
            </Button>
          )}
        </>
      )}

      <div className="flex justify-end pt-4">
        <Button onClick={handleNext} disabled={saving}>
          {saving ? "Saving..." : "Continue to Phase 4 →"}
        </Button>
      </div>
    </div>
  );
}