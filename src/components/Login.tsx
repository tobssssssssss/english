import { useState } from 'react';
import { supabase, type Player, ADMIN_NICK } from '@/lib/supabase';
import { BookOpen, LogIn, UserPlus, Loader2 } from 'lucide-react';

interface LoginProps {
  onLogin: (player: Player) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [nick, setNick] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'login' | 'register'>('login');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = nick.trim();
    if (!trimmed) {
      setError('Zadaj nick');
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const { data: existing } = await supabase
        .from('players')
        .select('*')
        .eq('nick', trimmed)
        .maybeSingle();

      if (mode === 'login') {
        if (!existing) {
          setError('Tento nick neexistuje. Zaregistruj sa.');
          setLoading(false);
          return;
        }
        onLogin(existing as Player);
      } else {
        if (existing) {
          setError('Tento nick už existuje. Prihlás sa.');
          setLoading(false);
          return;
        }
        const isAdmin = trimmed.toLowerCase() === ADMIN_NICK.toLowerCase();
        const { data: created, error: insertError } = await supabase
          .from('players')
          .insert({ nick: trimmed, is_admin: isAdmin })
          .select('*')
          .single();
        if (insertError) throw insertError;
        onLogin(created as Player);
      }
    } catch {
      setError('Niečo sa pokazilo. Skús znova.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-sky-400 to-blue-600 mb-4 shadow-lg shadow-blue-500/30">
            <BookOpen className="w-10 h-10 text-white" strokeWidth={2.5} />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">English Verbs</h1>
          <p className="text-slate-400 mt-2">Precvičuj anglické slovesá formou hry</p>
        </div>

        <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-8 shadow-2xl">
          <div className="flex gap-2 mb-6 p-1 bg-slate-900/50 rounded-xl">
            <button
              onClick={() => { setMode('login'); setError(null); }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium text-sm transition-all ${
                mode === 'login'
                  ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <LogIn className="w-4 h-4" /> Prihlásiť sa
            </button>
            <button
              onClick={() => { setMode('register'); setError(null); }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium text-sm transition-all ${
                mode === 'register'
                  ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <UserPlus className="w-4 h-4" /> Registrovať sa
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Nick</label>
              <input
                type="text"
                value={nick}
                onChange={(e) => setNick(e.target.value)}
                placeholder="Tvoj nick..."
                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all"
                autoFocus
              />
            </div>

            {error && (
              <div className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-4 py-2.5">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : mode === 'login' ? (
                <>
                  <LogIn className="w-5 h-5" /> Prihlásiť sa
                </>
              ) : (
                <>
                  <UserPlus className="w-5 h-5" /> Registrovať sa
                </>
              )}
            </button>
          </form>

          <p className="text-xs text-slate-500 text-center mt-6">
            Prihlás sa svojím nickom alebo si vytvor nový účet.
          </p>
        </div>
      </div>
    </div>
  );
}
