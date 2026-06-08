import { useState } from 'react';
import { Users, Plus, Copy, Trash2, Pencil } from 'lucide-react';
import { useHouseholds } from '../hooks/useHouseholds';
import { useTranslation } from '../i18n';

export default function HouseholdsPage() {
  const { t } = useTranslation();
  const {
    household,
    participants,
    loading,
    createHousehold,
    joinHousehold,
    updateHousehold,
    addParticipant,
    updateParticipant,
    removeParticipant,
    recalculateIncomeRatios,
  } = useHouseholds();

  const [mode, setMode] = useState<'create' | 'join' | null>(null);
  const [householdName, setHouseholdName] = useState('');
  const [participantName, setParticipantName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [editingParticipant, setEditingParticipant] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editRatio, setEditRatio] = useState('');
  const [showAddParticipant, setShowAddParticipant] = useState(false);
  const [newParticipantName, setNewParticipantName] = useState('');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    try {
      await createHousehold(householdName, participantName);
      setMode(null);
      setHouseholdName('');
      setParticipantName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create household');
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    try {
      await joinHousehold(inviteCode, participantName);
      setMode(null);
      setInviteCode('');
      setParticipantName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join household');
    }
  };

  const handleAddParticipant = async () => {
    if (!newParticipantName.trim()) return;
    try {
      await addParticipant(newParticipantName.trim());
      setNewParticipantName('');
      setShowAddParticipant(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add participant');
    }
  };

  const handleEditParticipant = (id: string) => {
    const participant = participants.find(p => p.id === id);
    if (participant) {
      setEditingParticipant(id);
      setEditName(participant.name);
      setEditRatio((participant.incomeRatio * 100).toFixed(1));
    }
  };

  const handleSaveParticipant = async () => {
    if (editingParticipant) {
      try {
        await updateParticipant(editingParticipant, {
          name: editName,
          incomeRatio: parseFloat(editRatio) / 100,
        });
        setEditingParticipant(null);
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Failed to update participant');
      }
    }
  };

  const handleRemoveParticipant = async (id: string) => {
    if (confirm(t('households.removeConfirm'))) {
      try {
        await removeParticipant(id);
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Failed to remove participant');
      }
    }
  };

  const handleRecalculate = async () => {
    try {
      await recalculateIncomeRatios();
      alert(t('households.recalculateSuccess'));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to recalculate ratios');
    }
  };

  const copyInviteCode = async () => {
    if (!household?.inviteCode) return;
    let copied = false;
    try {
      await navigator.clipboard.writeText(household.inviteCode);
      copied = true;
    } catch {
      try {
        const ta = document.createElement('textarea');
        ta.value = household.inviteCode;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        copied = document.execCommand('copy');
        document.body.removeChild(ta);
      } catch { /* last resort: user can manually copy */ }
    }
    if (copied) alert(t('households.copiedToClipboard'));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-slate-400">{t('households.loading')}</div>
      </div>
    );
  }

  if (!household) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-bold text-slate-100">{t('households.title')}</h1>

        <div className="rounded-xl bg-slate-800 p-6 text-center">
          <Users size={48} className="mx-auto mb-4 text-slate-400" />
          <p className="text-slate-300 mb-6">{t('households.noHousehold')}</p>

          {!mode ? (
            <div className="flex flex-col gap-3 max-w-sm mx-auto">
              <button
                onClick={() => setMode('create')}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 transition-colors"
              >
                {t('households.create')}
              </button>
              <button
                onClick={() => setMode('join')}
                className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-600 transition-colors"
              >
                {t('households.join')}
              </button>
            </div>
          ) : mode === 'create' ? (
            <form onSubmit={handleCreate} className="flex flex-col gap-4 max-w-sm mx-auto text-left">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  {t('households.householdName')}
                </label>
                <input
                  type="text"
                  value={householdName}
                  onChange={(e) => setHouseholdName(e.target.value)}
                  placeholder={t('households.householdNamePlaceholder')}
                  className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm text-slate-100 border border-slate-700 focus:border-emerald-500 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  {t('households.yourName')}
                </label>
                <input
                  type="text"
                  value={participantName}
                  onChange={(e) => setParticipantName(e.target.value)}
                  placeholder={t('households.yourNamePlaceholder')}
                  className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm text-slate-100 border border-slate-700 focus:border-emerald-500 focus:outline-none"
                  required
                />
              </div>
              {error && (
                <div className="rounded-lg bg-rose-900/30 border border-rose-800 p-3 text-sm text-rose-300">
                  {error}
                </div>
              )}
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 transition-colors"
                >
                  {t('households.createButton')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode(null);
                    setError(null);
                  }}
                  className="flex-1 rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-600 transition-colors"
                >
                  {t('households.cancel')}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleJoin} className="flex flex-col gap-4 max-w-sm mx-auto text-left">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  {t('households.inviteCode')}
                </label>
                <input
                  type="text"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  placeholder={t('households.inviteCodePlaceholder')}
                  className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm text-slate-100 border border-slate-700 focus:border-emerald-500 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  {t('households.yourName')}
                </label>
                <input
                  type="text"
                  value={participantName}
                  onChange={(e) => setParticipantName(e.target.value)}
                  placeholder={t('households.yourNamePlaceholder')}
                  className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm text-slate-100 border border-slate-700 focus:border-emerald-500 focus:outline-none"
                  required
                />
              </div>
              {error && (
                <div className="rounded-lg bg-rose-900/30 border border-rose-800 p-3 text-sm text-rose-300">
                  {error}
                </div>
              )}
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 transition-colors"
                >
                  {t('households.joinButton')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode(null);
                    setError(null);
                  }}
                  className="flex-1 rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-600 transition-colors"
                >
                  {t('households.cancel')}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-100">{household.name}</h1>
      </div>

      {/* Invite Code */}
      <div className="rounded-xl bg-slate-800 p-4">
        <h2 className="text-sm font-medium text-slate-200 mb-3">{t('households.inviteCode')}</h2>
        <div className="flex items-center gap-2">
          <code className="flex-1 rounded-lg bg-slate-900 px-3 py-2 text-sm text-slate-100 font-mono">
            {household.inviteCode}
          </code>
          <button
            onClick={copyInviteCode}
            className="rounded-lg bg-slate-700 p-2 text-slate-300 hover:bg-slate-600 transition-colors"
            aria-label={t('households.copyInviteCode')}
          >
            <Copy size={16} />
          </button>
        </div>
        <p className="text-xs text-slate-500 mt-2">{t('households.inviteCodeHelp')}</p>
      </div>

      {/* Split Method */}
      <div className="rounded-xl bg-slate-800 p-4">
        <h2 className="text-sm font-medium text-slate-200 mb-3">{t('households.splitMethod')}</h2>
        <div className="flex gap-2 mb-3">
          <button
            onClick={() => updateHousehold({ splitMethod: 'proportional' })}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              household.splitMethod === 'proportional'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-700 text-slate-200 hover:bg-slate-600'
            }`}
          >
            {t('households.proportional')}
          </button>
          <button
            onClick={() => updateHousehold({ splitMethod: 'fixed' })}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              household.splitMethod === 'fixed'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-700 text-slate-200 hover:bg-slate-600'
            }`}
          >
            {t('households.fixed')}
          </button>
        </div>
        <p className="text-xs text-slate-500">
          {household.splitMethod === 'proportional'
            ? t('households.proportionalHelp')
            : t('households.fixedHelp')}
        </p>
        {household.splitMethod === 'proportional' && (
          <button
            onClick={handleRecalculate}
            className="mt-3 w-full rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-600 transition-colors"
          >
            {t('households.recalculateRatios')}
          </button>
        )}
      </div>

      {/* Participants */}
      <div className="rounded-xl bg-slate-800 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-slate-200">{t('households.participants')}</h2>
          <button
            onClick={() => setShowAddParticipant((v) => !v)}
            className="inline-flex items-center gap-1 rounded-lg bg-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-600 transition-colors"
          >
            <Plus size={14} />
            {t('households.addParticipant')}
          </button>
        </div>
        {showAddParticipant && (
          <div className="flex items-center gap-2 mb-3">
            <input
              type="text"
              value={newParticipantName}
              onChange={(e) => setNewParticipantName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddParticipant()}
              placeholder={t('households.addParticipantPrompt')}
              autoFocus
              className="flex-1 rounded-lg bg-slate-700 px-3 py-2 text-sm text-slate-100 border border-slate-600 focus:border-emerald-500 focus:outline-none"
            />
            <button
              onClick={handleAddParticipant}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 transition-colors"
            >
              {t('households.save')}
            </button>
            <button
              onClick={() => { setShowAddParticipant(false); setNewParticipantName(''); }}
              className="rounded-lg bg-slate-600 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-500 transition-colors"
            >
              {t('households.cancel')}
            </button>
          </div>
        )}
        <div className="flex flex-col gap-2">
          {participants.map(participant => (
            <div key={participant.id} className="rounded-lg bg-slate-900 p-3">
              {editingParticipant === participant.id ? (
                <div className="flex flex-col gap-2">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-100 border border-slate-700 focus:border-emerald-500 focus:outline-none"
                  />
                  <input
                    type="number"
                    step="0.1"
                    value={editRatio}
                    onChange={(e) => setEditRatio(e.target.value)}
                    placeholder={t('households.incomeRatio')}
                    className="rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-100 border border-slate-700 focus:border-emerald-500 focus:outline-none"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveParticipant}
                      className="flex-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 transition-colors"
                    >
                      {t('households.save')}
                    </button>
                    <button
                      onClick={() => setEditingParticipant(null)}
                      className="flex-1 rounded-lg bg-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-600 transition-colors"
                    >
                      {t('households.cancel')}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-slate-100">{participant.name}</p>
                    <p className="text-xs text-slate-400">
                      {t('households.incomeRatio')}: {(participant.incomeRatio * 100).toFixed(1)}%
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEditParticipant(participant.id)}
                      className="text-slate-400 hover:text-slate-200 transition-colors"
                      aria-label={t('households.editParticipant')}
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => handleRemoveParticipant(participant.id)}
                      className="text-slate-400 hover:text-rose-400 transition-colors"
                      aria-label={t('households.removeParticipant')}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
