import React, { useEffect, useState } from 'react';
import { RubricWeight, SystemSettings } from '../types';

interface SystemSettingsViewProps {
  settings: SystemSettings;
  onSaveSettings: (newSettings: SystemSettings, smtpPassword: string) => Promise<void>;
  onTestEmail: (settings: SystemSettings, smtpPassword: string, recipient: string) => Promise<void>;
}

export const SystemSettingsView: React.FC<SystemSettingsViewProps> = ({
  settings,
  onSaveSettings,
  onTestEmail,
}) => {
  const [formData, setFormData] = useState<SystemSettings>(settings);
  const [smtpPassword, setSmtpPassword] = useState('');
  const [testRecipient, setTestRecipient] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isTestingEmail, setIsTestingEmail] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const evenlyWeightedRubric = (rubricWeights: RubricWeight[]): RubricWeight[] => {
    const baseWeight = Math.floor(100 / rubricWeights.length);
    const remainder = 100 - baseWeight * rubricWeights.length;
    return rubricWeights.map((item, index) => ({
      ...item,
      weight: baseWeight + (index < remainder ? 1 : 0),
    }));
  };

  useEffect(() => {
    setFormData(settings);
  }, [settings]);

  const updateRubric = (index: number, updates: Partial<RubricWeight>) => {
    setFormData((current) => ({
      ...current,
      rubricWeights: current.rubricWeights.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...updates } : item
      ),
    }));
  };

  const addRubricCriterion = () => {
    if (formData.rubricWeights.length >= 12) return;
    const id = `criterion-${Date.now()}`;
    setFormData((current) => ({
      ...current,
      rubricWeights: [...current.rubricWeights, { id, name: '', weight: 0 }],
    }));
  };

  const removeRubricCriterion = (id: string) => {
    if (formData.rubricWeights.length <= 1) return;
    setFormData((current) => ({
      ...current,
      rubricWeights: current.rubricWeights.filter((item) => item.id !== id),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSaving(true);
    try {
      await onSaveSettings({ ...formData, rubricWeights: evenlyWeightedRubric(formData.rubricWeights) }, smtpPassword);
      setSmtpPassword('');
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not save settings.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestEmail = async () => {
    setFormError(null);
    setIsTestingEmail(true);
    try {
      await onTestEmail(formData, smtpPassword, testRecipient);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not send the test email.');
    } finally {
      setIsTestingEmail(false);
    }
  };

  return (
    <div id="system-settings-container" className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-[#E8E5E1] shadow-xs">
        <h2 className="text-2xl font-bold text-[#101010]">System & Evaluation Parameters</h2>
        <p className="text-xs text-red-900/60 mt-1">
          Configure evaluation rubrics, AI scoring assistance, and email delivery settings.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Dynamic Rubric */}
        <div className="bg-white p-6 rounded-2xl border border-[#E8E5E1] shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-[#101010] flex items-center gap-2">
            <span className="material-symbols-outlined text-red-600">balance</span>
            Evaluation Rubric
          </h3>
          <p className="text-[11px] text-red-900/60">Edit the criteria used in Manager / Employer scorecards.</p>
          <div className="space-y-3">
            {formData.rubricWeights.map((item, index) => (
              <div key={item.id} className="grid grid-cols-[1fr_auto] gap-3 items-center">
                <input
                  aria-label={`Rubric criterion ${index + 1} name`}
                  value={item.name}
                  onChange={(e) => updateRubric(index, { name: e.target.value })}
                  placeholder="Criterion name"
                  maxLength={100}
                  className="w-full rounded-xl border border-[#E8E5E1] px-3 py-2 text-xs focus:ring-1 focus:ring-red-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => removeRubricCriterion(item.id)}
                  disabled={formData.rubricWeights.length <= 1}
                  aria-label={`Remove ${item.name || `criterion ${index + 1}`}`}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-40"
                >
                  <span className="material-symbols-outlined text-lg">delete</span>
                </button>
              </div>
            ))}
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={addRubricCriterion}
              disabled={formData.rubricWeights.length >= 12}
              className="text-xs font-bold text-red-700 hover:text-red-800 disabled:opacity-40"
            >
              + Add criterion
            </button>
          </div>
        </div>

        {/* SMTP Configuration */}
        <div className="bg-white p-6 rounded-2xl border border-[#E8E5E1] shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-[#101010] flex items-center gap-2">
            <span className="material-symbols-outlined text-red-600">mail</span>
            SMTP Email Settings
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="text-xs font-semibold">SMTP Host
              <input value={formData.smtpHost} onChange={(e) => setFormData({ ...formData, smtpHost: e.target.value })} placeholder="smtp.example.com" className="mt-1 w-full rounded-xl border border-[#E8E5E1] px-3 py-2 font-normal" />
            </label>
            <label className="text-xs font-semibold">Port
              <input type="number" min={1} max={65535} value={formData.smtpPort} onChange={(e) => setFormData({ ...formData, smtpPort: Number(e.target.value) })} className="mt-1 w-full rounded-xl border border-[#E8E5E1] px-3 py-2 font-normal" />
            </label>
            <label className="text-xs font-semibold">SMTP Username
              <input autoComplete="username" value={formData.smtpUsername} onChange={(e) => setFormData({ ...formData, smtpUsername: e.target.value })} className="mt-1 w-full rounded-xl border border-[#E8E5E1] px-3 py-2 font-normal" />
            </label>
            <label className="text-xs font-semibold">SMTP Password
              <input type="password" autoComplete="new-password" value={smtpPassword} onChange={(e) => setSmtpPassword(e.target.value)} placeholder={settings.smtpPasswordConfigured ? 'Saved password (leave blank to keep)' : 'Enter SMTP password'} className="mt-1 w-full rounded-xl border border-[#E8E5E1] px-3 py-2 font-normal" />
            </label>
            <label className="text-xs font-semibold">From Address
              <input type="email" value={formData.smtpFromAddress} onChange={(e) => setFormData({ ...formData, smtpFromAddress: e.target.value })} placeholder="recruitment@example.com" className="mt-1 w-full rounded-xl border border-[#E8E5E1] px-3 py-2 font-normal" />
            </label>
            <label className="text-xs font-semibold">From Name
              <input value={formData.smtpFromName} onChange={(e) => setFormData({ ...formData, smtpFromName: e.target.value })} className="mt-1 w-full rounded-xl border border-[#E8E5E1] px-3 py-2 font-normal" />
            </label>
            <label className="text-xs font-semibold flex items-center gap-2 sm:col-span-2">
              <input type="checkbox" checked={formData.smtpSecure} onChange={(e) => setFormData({ ...formData, smtpSecure: e.target.checked })} className="accent-red-600" />
              Use secure TLS (typically port 465)
            </label>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
            <label className="text-xs font-semibold flex-1">Test recipient
              <input type="email" value={testRecipient} onChange={(e) => setTestRecipient(e.target.value)} placeholder="you@example.com" className="mt-1 w-full rounded-xl border border-[#E8E5E1] px-3 py-2 font-normal" />
            </label>
            <button type="button" onClick={handleTestEmail} disabled={isTestingEmail} className="px-4 py-2.5 rounded-xl text-xs font-bold border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50">
              {isTestingEmail ? 'Sending...' : 'Send Test Email'}
            </button>
          </div>
          <p className="text-[11px] text-red-900/60">
            {settings.smtpPasswordConfigured
              ? 'SMTP settings and the encrypted password are saved. Leave the password field empty to keep the saved password; enter a new one only to change it.'
              : 'Save your SMTP settings and password to store them encrypted in the database.'}
          </p>
        </div>

        {/* Save button */}
        <div className="flex items-center justify-between">
          {formError && <span role="alert" className="text-xs font-semibold text-red-700">{formError}</span>}
          {savedSuccess && (
            <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
              <span className="material-symbols-outlined text-base">check_circle</span>
              Settings updated successfully!
            </span>
          )}
          <div className="ml-auto">
            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2.5 bg-red-600 hover:bg-red-700 active:scale-95 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-red-500/20 flex items-center gap-2 cursor-pointer"
            >
              <span className="material-symbols-outlined text-base">save</span>
              {isSaving ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
