import { useEffect, useState } from 'react';
import { supabase, type Verb } from '@/lib/supabase';
import { ArrowLeft, Plus, Trash2, Loader2, BookOpen, Search } from 'lucide-react';

interface AdminProps {
  onExit: () => void;
}

export default function Admin({ onExit }: AdminProps) {
  const [verbs, setVerbs] = useState<Verb[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ slovensky: '', prvy_tvar: '', druhy_tvar: '', treti_tvar: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadVerbs();
  }, []);

  const loadVerbs = async () => {
    const { data } = await supabase.from('verbs').select('*').order('slovensky');
    setVerbs((data || []) as Verb[]);
    setLoading(false);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.slovensky.trim() || !form.prvy_tvar.trim() || !form.druhy_tvar.trim() || !form.treti_tvar.trim()) {
      setError('Vyplň všetky polia');
      return;
    }
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase.from('verbs').insert({
      slovensky: form.slovensky.trim(),
      prvy_tvar: form.prvy_tvar.trim(),
      druhy_tvar: form.druhy_tvar.trim(),
      treti_tvar: form.treti_tvar.trim(),
    });
    if (insertError) {
      setError('Nepodarilo sa pridať sloveso');
      setSaving(false);
      return;
    }
    setForm({ slovensky: '', prvy_tvar: '', druhy_tvar: '', treti_tvar: '' });
    setShowForm(false);
    setSaving(false);
    await loadVerbs();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Naozaj chceš vymazať toto sloveso? Vymažu sa aj všetky štatistiky hráčov pre toto sloveso.')) return;
    await supabase.from('verbs').delete().eq('id', id);
    await loadVerbs();
  };

  const filtered = verbs.filter(v =>
    v.slovensky.toLowerCase().includes(search.toLowerCase()) ||
    v.prvy_tvar.toLowerCase().includes(search.toLowerCase()) ||
    v.druhy_tvar.toLowerCase().includes(search.toLowerCase()) ||
    v.treti_tvar.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <header className="border-b border-slate-700/50 bg-slate-900/50 backdrop-blur-xl sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={onExit} className="text-slate-400 hover:text-white transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-white font-bold text-lg">Admin Panel</h1>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold rounded-lg transition-all"
          >
            <Plus className="w-4 h-4" /> Pridať sloveso
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Add form */}
        {showForm && (
          <form onSubmit={handleAdd} className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-6 mb-6 space-y-4">
            <h2 className="text-lg font-bold text-white">Nové sloveso</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <FormField label="Slovensky" value={form.slovensky} onChange={(v) => setForm({ ...form, slovensky: v })} placeholder="napr. byť" />
              <FormField label="1. tvar (base form)" value={form.prvy_tvar} onChange={(v) => setForm({ ...form, prvy_tvar: v })} placeholder="napr. be" />
              <FormField label="2. tvar (past simple)" value={form.druhy_tvar} onChange={(v) => setForm({ ...form, druhy_tvar: v })} placeholder="napr. was/were" />
              <FormField label="3. tvar (past participle)" value={form.treti_tvar} onChange={(v) => setForm({ ...form, treti_tvar: v })} placeholder="napr. been" />
            </div>
            {error && <p className="text-sm text-rose-400">{error}</p>}
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold rounded-lg transition-all disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Pridať
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setError(null); }}
                className="px-6 py-2.5 text-slate-400 hover:text-white bg-slate-700/50 hover:bg-slate-700 rounded-lg transition-all"
              >
                Zrušiť
              </button>
            </div>
          </form>
        )}

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Hľadať sloveso..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-transparent transition-all"
          />
        </div>

        {/* Verb list */}
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Žiadne slovesá</p>
            </div>
          ) : (
            filtered.map(verb => (
              <div
                key={verb.id}
                className="flex items-center justify-between p-4 bg-slate-800/50 backdrop-blur-xl rounded-xl border border-slate-700/50 hover:border-slate-600 transition-all"
              >
                <div>
                  <p className="text-white font-medium">{verb.slovensky}</p>
                  <p className="text-slate-400 text-sm">
                    {verb.prvy_tvar} · {verb.druhy_tvar} · {verb.treti_tvar}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(verb.id)}
                  className="p-2 text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>

        <p className="text-slate-500 text-xs text-center mt-6">
          Celkom {verbs.length} slovies
        </p>
      </div>
    </div>
  );
}

function FormField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-400 mb-1.5">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-transparent transition-all"
        autoComplete="off"
      />
    </div>
  );
}
