import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Building2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const INDUSTRIES = ["Agriculture", "Construction", "Education", "Energy", "Finance", "Food & Beverage", "Healthcare", "Manufacturing", "Professional Services", "Real Estate", "Retail", "Technology", "Transportation", "Utilities", "Other"];

export default function Organization() {
  const [org, setOrg] = useState(null);
  const [form, setForm] = useState({ company_name: "", industry: "", country: "", reporting_year: 2024, employee_count: "", revenue: "" });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    base44.entities.Organization.list().then(list => {
      if (list.length > 0) { setOrg(list[0]); setForm({ ...list[0] }); }
    });
  }, []);

  const save = async () => {
    setSaving(true);
    const data = { ...form, employee_count: parseInt(form.employee_count) || undefined, revenue: parseFloat(form.revenue) || undefined };
    if (org) await base44.entities.Organization.update(org.id, data);
    else await base44.entities.Organization.create(data);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
          <Building2 className="w-5 h-5 text-emerald-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Organization</h1>
          <p className="text-muted-foreground text-sm">Company profile and reporting settings</p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
        <div>
          <h2 className="text-base font-semibold text-foreground mb-4">Company Information</h2>
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium">Company Name *</Label>
              <Input className="mt-1" placeholder="Your company name" value={form.company_name} onChange={e => set("company_name", e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium">Industry</Label>
                <Select value={form.industry} onValueChange={v => set("industry", v)}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select industry..." /></SelectTrigger>
                  <SelectContent>{INDUSTRIES.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-medium">Country</Label>
                <Input className="mt-1" placeholder="e.g. United States" value={form.country} onChange={e => set("country", e.target.value)} />
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-border pt-5">
          <h2 className="text-base font-semibold text-foreground mb-4">Reporting Settings</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label className="text-sm font-medium">Reporting Year</Label>
              <Select value={String(form.reporting_year)} onValueChange={v => set("reporting_year", parseInt(v))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[2024, 2023, 2022, 2021].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm font-medium">Number of Employees</Label>
              <Input type="number" className="mt-1" placeholder="0" value={form.employee_count} onChange={e => set("employee_count", e.target.value)} />
            </div>
            <div>
              <Label className="text-sm font-medium">Annual Revenue (USD)</Label>
              <Input type="number" className="mt-1" placeholder="0" value={form.revenue} onChange={e => set("revenue", e.target.value)} />
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button onClick={save} disabled={saving || !form.company_name} className="gap-2 min-w-[120px]">
            <Save className="w-4 h-4" />
            {saved ? "Saved!" : saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}