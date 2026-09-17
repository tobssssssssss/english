import { useEffect, useState } from 'react';
import { supabase, type Player, type Verb, type PlayerVerb } from '@/lib/supabase';
import {
  Shuffle, AlertCircle, ListChecks, Mic, Keyboard, LogOut,
  Settings, BarChart3, Trophy, Flame, Target, BookOpen
} from 'lucide-react';

interface HomeProps {
  player: Player;
  onStartPractice: (mode: 'mix' | 'errors' | 'category', inputMode: 'text' | 'audio', selectedVerbs?: string[]) => void;
  onOpenAdmin: () => void;
}

interface Stats {
  totalVerbs: number;
  learned: number;
  totalCorrect: number;
  totalWrong: number;
  bestStreak: number;
}

export default function Home({ player, onStartPractice, onOpenAdmin }: HomeProps) {
  const [verbs, setVerbs] = useState<Verb[]>([]);
  const [playerVerbs, setPlayerVerbs] = useState<PlayerVerb[]>([]);
  const [stats, setStats] = useState<Stats>({ totalVerbs: 0, learned: 0, totalCorrect: 0, totalWrong: 0, bestStreak: 0 });
  const [inputMode, setInputMode] = useState<'text' | 'audio'>('text');
  const [showCategory, setShowCategory] = useState(false);
  const [selectedVerbs, setSelectedVerbs] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [{ data: verbData }, { data: pvData }] = await Promise.all([
      supabase.from('verbs').select('*').order('slovensky'),
      supabase.from('player_verbs').select('*').eq('player_id', player.id),
    ]);
    const vList = verbData || [];
    const pvList = (pvData || []) as PlayerVerb[];
    setVerbs(vList as Verb[]);
    setPlayerVerbs(pvList);

    const totalCorrect = pvList.reduce((s, p) => s + p.spravne, 0);
    const totalWrong = pvList.reduce((s, p) => s + p.zle, 0);
    const bestStreak = pvList.reduce((s, p) => Math.max(s, p.streak), 0);
    const learned = pvList.filter(p => p.spravne >= 5 && p.streak >= 3).length;
    setStats({ totalVerbs: vList.length, learned, totalCorrect, totalWrong, bestStreak });
  };

  const handleLogout = () => {
    localStorage.removeItem('verb_player');
    window.location.reload();
  };

  const toggleVerb = (id: string) => {
    const next = new Set(selectedVerbs);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedVerbs(next);
  };

  const selectAll = () => {
    if (selectedVerbs.size === verbs.length) setSelectedVerbs(new Set());
    else setSelectedVerbs(new Set(verbs.map(v => v.id)));
  };

  const startCategory = () => {
    if (selectedVerbs.size === 0) return;
    onStartPractice('category', inputMode, Array.from(selectedVerbs));
    setShowCategory(false);
    setSelectedVerbs(new Set());
  };

  const verbStats = (verbId: string) => playerVerbs.find(p => p.verb_id === verbId);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="border-b border-slate-700/50 bg-slate-900/50 backdrop-blur-xl sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <BookOpen className="w-5 h-5 text-white" strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-white font-bold text-lg leading-tight">English Verbs</h1>
              <p className="text-slate-400 text-xs">Vitaj, {player.nick}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {player.is_admin && (
              <button
                onClick={onOpenAdmin}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-lg transition-all"
              >
                <Settings className="w-4 h-4" /> Admin
              </button>
            )}
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-all"
            >
              <LogOut className="w-4 h-4" /> Odhlásiť
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <StatCard icon={<BookOpen className="w-5 h-5" />} label="Slovesá" value={stats.totalVerbs} color="sky" />
          <StatCard icon={<Trophy className="w-5 h-5" />} label="Naučené" value={stats.learned} color="emerald" />
          <StatCard icon={<Target className="w-5 h-5" />} label="Správne" value={stats.totalCorrect} color="blue" />
          <StatCard icon={<Flame className="w-5 h-5" />} label="Najlepší streak" value={stats.bestStreak} color="orange" />
        </div>

        {/* Input mode toggle */}
        <div className="flex items-center gap-2 p-1 bg-slate-800/50 rounded-xl mb-6 max-w-xs">
          <button
            onClick={() => setInputMode('text')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium text-sm transition-all ${
              inputMode === 'text' ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/30' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Keyboard className="w-4 h-4" /> Písať
          </button>
          <button
            onClick={() => setInputMode('audio')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium text-sm transition-all ${
              inputMode === 'audio' ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/30' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Mic className="w-4 h-4" /> Hovoriť
          </button>
        </div>

        {/* Practice modes */}
        {!showCategory ? (
          <div className="grid md:grid-cols-3 gap-4">
            <ModeCard
              icon={<Shuffle className="w-8 h-8" />}
              title="Mix"
              description="Striedajú sa všetky typy otázok náhodne"
              color="from-sky-500 to-blue-600"
              onClick={() => onStartPractice('mix', inputMode)}
            />
            <ModeCard
              icon={<AlertCircle className="w-8 h-8" />}
              title="Chyby"
              description="Precvičuj slovesá, ktoré ti najviac idú zle"
              color="from-rose-500 to-red-600"
              onClick={() => onStartPractice('errors', inputMode)}
            />
            <ModeCard
              icon={<ListChecks className="w-8 h-8" />}
              title="Výber"
              description="Vyber si konkrétne slovesá na precvičenie"
              color="from-emerald-500 to-teal-600"
              onClick={() => setShowCategory(true)}
            />
          </div>
        ) : (
          <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white">Vyber slovesá</h2>
              <div className="flex gap-2">
                <button
                  onClick={selectAll}
                  className="px-3 py-1.5 text-sm font-medium text-sky-400 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 rounded-lg transition-all"
                >
                  {selectedVerbs.size === verbs.length ? 'Odznačiť všetko' : 'Označiť všetko'}
                </button>
                <button
                  onClick={() => { setShowCategory(false); setSelectedVerbs(new Set()); }}
                  className="px-3 py-1.5 text-sm font-medium text-slate-400 hover:text-white bg-slate-700/50 hover:bg-slate-700 rounded-lg transition-all"
                >
                  Späť
                </button>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2 mb-4 max-h-96 overflow-y-auto">
              {verbs.map(verb => {
                const pv = verbStats(verb.id);
                const isSelected = selectedVerbs.has(verb.id);
                return (
                  <button
                    key={verb.id}
                    onClick={() => toggleVerb(verb.id)}
                    className={`text-left p-3 rounded-xl border transition-all ${
                      isSelected
                        ? 'bg-emerald-500/15 border-emerald-500/50 ring-1 ring-emerald-500/30'
                        : 'bg-slate-900/50 border-slate-700/50 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white font-medium text-sm">{verb.slovensky}</p>
                        <p className="text-slate-400 text-xs">{verb.prvy_tvar} · {verb.druhy_tvar} · {verb.treti_tvar}</p>
                      </div>
                      {pv && (
                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                          pv.zle > pv.spravne ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'
                        }`}>
                          {pv.spravne}/{pv.zle}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
            <button
              onClick={startCategory}
              disabled={selectedVerbs.size === 0}
              className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-emerald-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Začať precvičovať ({selectedVerbs.size} sloves{selectedVerbs.size === 1 ? '' : selectedVerbs.size < 5 ? 'á' : 'ies'})
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  const colors: Record<string, string> = {
    sky: 'text-sky-400 bg-sky-500/10',
    emerald: 'text-emerald-400 bg-emerald-500/10',
    blue: 'text-blue-400 bg-blue-500/10',
    orange: 'text-orange-400 bg-orange-500/10',
  };
  return (
    <div className="bg-slate-800/50 backdrop-blur-xl rounded-xl border border-slate-700/50 p-4">
      <div className={`inline-flex p-2 rounded-lg mb-2 ${colors[color]}`}>{icon}</div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-slate-400 text-xs">{label}</p>
    </div>
  );
}

function ModeCard({ icon, title, description, color, onClick }: { icon: React.ReactNode; title: string; description: string; color: string; onClick: () => void; }) {
  return (
    <button
      onClick={onClick}
      className="group relative overflow-hidden bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-6 text-left transition-all hover:border-slate-600 hover:scale-[1.02] hover:shadow-2xl"
    >
      <div className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${color} text-white mb-4 shadow-lg`}>
        {icon}
      </div>
      <h3 className="text-xl font-bold text-white mb-1">{title}</h3>
      <p className="text-slate-400 text-sm">{description}</p>
    </button>
  );
}
