import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Search, ChevronRight, BarChart3, CheckCircle2, Clock, FileText } from "lucide-react";

const STATUS_COLORS = {
  draft: "bg-slate-100 text-slate-600",
  in_progress: "bg-blue-100 text-blue-700",
  ready_for_review: "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-600",
};

const APPROACH_LABELS = {
  single_impact: "Impact Only",
  single_financial: "Financial Only",
  double_materiality: "Double Materiality",
};

const FRAMEWORK_COLORS = {
  GRI: "bg-green-100 text-green-700",
  ISSB: "bg-blue-100 text-blue-700",
  ESRS: "bg-purple-100 text-purple-700",
};

export default function MaterialityAssessments() {
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [newForm, setNewForm] = useState({ name: "", company_name: "", assessment_year: new Date().getFullYear(), assessment_framework: "ESRS", materiality_approach: "double_materiality" });

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    const data = await base44.entities.MaterialityAssessment.list("-created_date");
    setAssessments(data);
    setLoading(false);
  };

  const create = async () => {
    if (!newForm.name || !newForm.company_name) return;
    const record = await base44.entities.MaterialityAssessment.create({
      ...newForm,
      status: "draft",
      current_phase: 1,
      impact_threshold: 3.0,
      financial_threshold: 3.0,
      board_approval_status: "pending",
    });
    setCreating(false);
    setNewForm({ name: "", company_name: "", assessment_year: new Date().getFullYear(), assessment_framework: "ESRS", materiality_approach: "double_materiality" });
    load();
  };

  const filtered = assessments.filter(a =>
    a.name?.toLowerCase().includes(search.toLowerCase()) ||
    a.company_name?.toLowerCase().includes(search.toLowerCase())
  );

  const phaseLabel = (phase) => {
    const labels = { 1: "Company Setup", 2: "Value Chain", 3: "Stakeholders", 4: "IRO Register", 5: "Scoring", 6: "Matrix & Sign-off" };
    return labels[phase] || `Phase ${phase}`;
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Materiality Assessments</h1>
          <p className="text-sm text-slate-500 mt-1">GRI · ISSB · ESRS — Impact, Financial & Double Materiality</p>
        </div>
        <Button onClick={() => setCreating(true)} className="gap-2">
          <Plus className="w-4 h-4" /> New Assessment
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total", value: assessments.length, icon: FileText, color: "text-slate-700" },
          { label: "In Progress", value: assessments.filter(a => a.status === "in_progress").length, icon: Clock, color: "text-blue-600" },
          { label: "Ready for Review", value: assessments.filter(a => a.status === "ready_for_review").length, icon: BarChart3, color: "text-amber-600" },
          { label: "Approved", value: assessments.filter(a => a.status === "approved").length, icon: CheckCircle2, color: "text-emerald-600" },
        ].map(s => (
          <Card key={s.label} className="border-slate-200">
            <CardContent className="p-4 flex items-center gap-3">
              <s.icon className={`w-8 h-8 ${s.color}`} />
              <div>
                <div className="text-2xl font-bold text-slate-900">{s.value}</div>
                <div className="text-xs text-slate-500">{s.label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
        <Input className="pl-9" placeholder="Search assessments..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* New Assessment Form */}
      {creating && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-blue-900">New Materiality Assessment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-700">Assessment Name *</label>
                <Input className="mt-1" placeholder="e.g. 2026 Materiality Assessment" value={newForm.name} onChange={e => setNewForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700">Company Name *</label>
                <Input className="mt-1" placeholder="e.g. AcmeCorp Industries" value={newForm.company_name} onChange={e => setNewForm(f => ({ ...f, company_name: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-700">Year</label>
                <Input type="number" className="mt-1" value={newForm.assessment_year} onChange={e => setNewForm(f => ({ ...f, assessment_year: parseInt(e.target.value) }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700">Framework</label>
                <select className="mt-1 w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={newForm.assessment_framework} onChange={e => setNewForm(f => ({ ...f, assessment_framework: e.target.value }))}>
                  <option value="ESRS">ESRS</option>
                  <option value="GRI">GRI</option>
                  <option value="ISSB">ISSB</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700">Approach</label>
                <select className="mt-1 w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={newForm.materiality_approach} onChange={e => setNewForm(f => ({ ...f, materiality_approach: e.target.value }))}>
                  <option value="double_materiality">Double Materiality</option>
                  <option value="single_impact">Impact Only</option>
                  <option value="single_financial">Financial Only</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <Button variant="ghost" onClick={() => setCreating(false)}>Cancel</Button>
              <Button onClick={create} disabled={!newForm.name || !newForm.company_name}>Create Assessment</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-slate-300 border-t-slate-700 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No assessments yet</p>
          <p className="text-sm mt-1">Click "New Assessment" to get started</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(a => (
            <Link key={a.id} to={`/materiality/${a.id}`}>
              <Card className="border-slate-200 hover:shadow-md hover:border-slate-300 transition-all cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-start gap-4 flex-1">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-slate-900">{a.name}</h3>
                          <Badge className={`text-xs ${STATUS_COLORS[a.status] || "bg-slate-100 text-slate-600"}`}>{a.status?.replace(/_/g, " ")}</Badge>
                          {a.assessment_framework && <Badge className={`text-xs ${FRAMEWORK_COLORS[a.assessment_framework] || "bg-slate-100 text-slate-600"}`}>{a.assessment_framework}</Badge>}
                        </div>
                        <div className="text-sm text-slate-500 mt-0.5">{a.company_name} · {a.assessment_year}</div>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-xs text-slate-400">{APPROACH_LABELS[a.materiality_approach] || a.materiality_approach}</span>
                          <span className="text-xs text-slate-300">·</span>
                          <span className="text-xs text-blue-600 font-medium">Phase {a.current_phase}: {phaseLabel(a.current_phase)}</span>
                        </div>
                      </div>
                      {/* Phase progress */}
                      <div className="hidden md:flex items-center gap-1">
                        {[1,2,3,4,5,6].map(p => (
                          <div key={p} className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${p < (a.current_phase || 1) ? "bg-emerald-500 text-white" : p === (a.current_phase || 1) ? "bg-blue-500 text-white" : "bg-slate-100 text-slate-400"}`}>{p}</div>
                        ))}
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-300 ml-3 flex-shrink-0" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}