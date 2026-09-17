import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase, type Player, type Verb, type PlayerVerb, type QuestionType, type PracticeMode, type InputMode } from '@/lib/supabase';
import {
  ArrowLeft, Check, X, Mic, MicOff, Volume2, Loader2, Trophy, Flame, Brain
} from 'lucide-react';

interface PracticeProps {
  player: Player;
  mode: PracticeMode;
  inputMode: InputMode;
  selectedVerbIds?: string[];
  onExit: () => void;
}

interface Question {
  verb: Verb;
  type: QuestionType;
}

interface AnswerResult {
  correct: boolean;
  userAnswers: string[];
  correctAnswers: string[];
  type: QuestionType;
}

const FORM_LABELS: Record<string, string> = {
  form1: 'Základný tvar',
  form2: 'Minulý čas',
  form3: 'Príčastie',
};

const TYPE_LABELS: Record<string, string> = {
  slovak: 'Napíš anglické sloveso',
  form1: 'Napíš 1. tvar',
  form2: 'Napíš 2. tvar',
  form3: 'Napíš 3. tvar',
};

const QUESTION_TYPES: QuestionType[] = ['slovak', 'form1', 'form2', 'form3'];

export default function Practice({ player, mode, inputMode, selectedVerbIds, onExit }: PracticeProps) {
  const [verbs, setVerbs] = useState<Verb[]>([]);
  const [playerVerbs, setPlayerVerbs] = useState<Map<string, PlayerVerb>>(new Map());
  const [queue, setQueue] = useState<Question[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<string[]>(['', '', '']);
  const [activeField, setActiveField] = useState(0);
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [score, setScore] = useState({ correct: 0, wrong: 0 });
  const [streak, setStreak] = useState(0);
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [audioError, setAudioError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const fieldRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    const [{ data: verbData }, { data: pvData }] = await Promise.all([
      supabase.from('verbs').select('*').order('slovensky'),
      supabase.from('player_verbs').select('*').eq('player_id', player.id),
    ]);
    const vList = (verbData || []) as Verb[];
    const pvMap = new Map<string, PlayerVerb>();
    (pvData || []).forEach(p => pvMap.set(p.verb_id, p as PlayerVerb));

    let pool = vList;
    if (mode === 'category' && selectedVerbIds) {
      pool = vList.filter(v => selectedVerbIds.includes(v.id));
    } else if (mode === 'errors') {
      const errorVerbs = vList.filter(v => {
        const pv = pvMap.get(v.id);
        if (!pv) return false;
        return pv.zle > 0;
      });
      pool = errorVerbs.length > 0 ? errorVerbs : vList;
    }

    if (pool.length === 0) {
      setLoading(false);
      return;
    }

    const q = buildQueue(pool, pvMap, mode);
    setVerbs(pool);
    setPlayerVerbs(pvMap);
    setQueue(q);
    setLoading(false);
  };

  const buildQueue = (pool: Verb[], pvMap: Map<string, PlayerVerb>, m: PracticeMode): Question[] => {
    const weighted: { verb: Verb; weight: number }[] = pool.map(v => {
      const pv = pvMap.get(v.id);
      let weight = 1;
      if (pv) {
        if (pv.zle > pv.spravne) weight += 3;
        if (pv.zle > 0) weight += 2;
        if (pv.streak === 0) weight += 1;
        if (pv.posledna_chyba) weight += 1;
      } else {
        weight += 2;
      }
      return { verb: v, weight };
    });

    const totalWeight = weighted.reduce((s, w) => s + w.weight, 0);
    const questions: Question[] = [];
    const targetCount = Math.max(pool.length * 3, 15);

    if (m === 'mix') {
      for (let i = 0; i < targetCount; i++) {
        const verb = weightedPick(weighted, totalWeight);
        const type = QUESTION_TYPES[Math.floor(Math.random() * QUESTION_TYPES.length)];
        questions.push({ verb, type });
      }
    } else {
      const types = QUESTION_TYPES;
      for (let i = 0; i < targetCount; i++) {
        const verb = weightedPick(weighted, totalWeight);
        const type = types[i % types.length];
        questions.push({ verb, type });
      }
    }

    for (let i = questions.length - 1; i > 0; i--) {
      if (questions[i].verb.id === questions[i - 1].verb.id) {
        const j = Math.floor(Math.random() * (i - 1));
        [questions[i], questions[j]] = [questions[j], questions[i]];
      }
    }
    return questions;
  };

  const weightedPick = (items: { verb: Verb; weight: number }[], total: number): Verb => {
    let r = Math.random() * total;
    for (const item of items) {
      r -= item.weight;
      if (r <= 0) return item.verb;
    }
    return items[0].verb;
  };

  const current = queue[currentIdx];

  const getCorrectAnswers = (verb: Verb, type: QuestionType): string[] => {
    if (type === 'slovak') return [verb.prvy_tvar, verb.druhy_tvar, verb.treti_tvar];
    return [verb.prvy_tvar, verb.druhy_tvar, verb.treti_tvar];
  };

  const getPromptFields = (type: QuestionType): { label: string; placeholder: string }[] => {
    if (type === 'slovak') {
      return [
        { label: '1. tvar', placeholder: 'base form' },
        { label: '2. tvar', placeholder: 'past simple' },
        { label: '3. tvar', placeholder: 'past participle' },
      ];
    }
    return [
      { label: FORM_LABELS[type], placeholder: 'napíš odpoveď' },
    ];
  };

  const getExpectedFields = (type: QuestionType): number => {
    return type === 'slovak' ? 3 : 1;
  };

  const normalize = (s: string): string => s.trim().toLowerCase().replace(/\s+/g, ' ');

  const checkAnswer = useCallback((): AnswerResult => {
    if (!current) { return { correct: false, userAnswers: [], correctAnswers: [], type: 'slovak' }; }
    const { verb, type } = current;
    const correctArr = [verb.prvy_tvar, verb.druhy_tvar, verb.treti_tvar];
    const fieldCount = getExpectedFields(type);

    let userArr: string[];
    let expectedArr: string[];

    if (type === 'slovak') {
      userArr = answers.slice(0, 3);
      expectedArr = correctArr;
    } else {
      const idx = parseInt(type.replace('form', '')) - 1;
      userArr = [answers[0]];
      expectedArr = [correctArr[idx]];
    }

    const allCorrect = userArr.every((a, i) => {
      const norm = normalize(a);
      const exp = normalize(expectedArr[i]);
      if (type !== 'slovak' && i === 0) {
        return norm === exp || norm === exp.split('/')[0].trim() || norm === exp.split('/')[1]?.trim();
      }
      return norm === exp;
    });

    return { correct: allCorrect, userAnswers: userArr, correctAnswers: expectedArr, type };
  }, [current, answers]);

  const handleSubmit = async () => {
    if (!current) return;
    const res = checkAnswer();
    setResult(res);

    if (res.correct) {
      setScore(s => ({ ...s, correct: s.correct + 1 }));
      setStreak(s => s + 1);
    } else {
      setScore(s => ({ ...s, wrong: s.wrong + 1 }));
      setStreak(0);
    }

    await saveResult(current.verb, res);
  };

  const saveResult = async (verb: Verb, res: AnswerResult) => {
    const { data: existing } = await supabase
      .from('player_verbs')
      .select('*')
      .eq('player_id', player.id)
      .eq('verb_id', verb.id)
      .maybeSingle();

    let pvId: string;
    if (existing) {
      const pv = existing as PlayerVerb;
      const updates = {
        spravne: pv.spravne + (res.correct ? 1 : 0),
        zle: pv.zle + (res.correct ? 0 : 1),
        streak: res.correct ? pv.streak + 1 : 0,
        level: res.correct ? Math.min(5, Math.floor((pv.streak + 1) / 3) + 1) : 1,
        posledna_chyba: res.correct ? pv.posledna_chyba : new Date().toISOString(),
      };
      await supabase.from('player_verbs').update(updates).eq('id', pv.id);
      pvId = pv.id;
    } else {
      const { data: created } = await supabase.from('player_verbs').insert({
        player_id: player.id,
        verb_id: verb.id,
        spravne: res.correct ? 1 : 0,
        zle: res.correct ? 0 : 1,
        streak: res.correct ? 1 : 0,
        level: res.correct ? 1 : 1,
        posledna_chyba: res.correct ? null : new Date().toISOString(),
      }).select('*').single();
      pvId = created?.id || '';
    }

    if (!res.correct && pvId) {
      await supabase.from('verb_errors').insert({
        player_verb_id: pvId,
        cas: new Date().toISOString(),
        odpovede: res.userAnswers,
        spravne: res.correctAnswers,
        typ: res.type,
      });
    }
  };

  const handleNext = () => {
    setResult(null);
    setAnswers(['', '', '']);
    setActiveField(0);
    setTranscript('');
    setAudioError(null);
    if (currentIdx + 1 < queue.length) {
      setCurrentIdx(currentIdx + 1);
    } else {
      const pool = verbs;
      const q = buildQueue(pool, playerVerbs, mode);
      setQueue(q);
      setCurrentIdx(0);
    }
    setTimeout(() => fieldRefs.current[0]?.focus(), 100);
  };

  // Audio recording
  const startRecording = () => {
    setAudioError(null);
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setAudioError('Tvoj prehliadač nepodporuje rozpoznávanie reči. Použi Chrome.');
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    recognition.onresult = (event: any) => {
      const text = event.results[0][0].transcript;
      setTranscript(text);
      if (current?.type === 'slovak') {
        const words = text.trim().split(/\s+/);
        const newAnswers = [...answers];
        for (let i = 0; i < Math.min(3, words.length); i++) {
          newAnswers[i] = words[i] || '';
        }
        setAnswers(newAnswers);
      } else {
        setAnswers([text, '', '']);
      }
      setRecording(false);
    };

    recognition.onerror = (event: any) => {
      setAudioError('Nepodarilo sa zachytiť reč. Skús znova.');
      setRecording(false);
    };

    recognition.onend = () => setRecording(false);
    recognitionRef.current = recognition;
    recognition.start();
    setRecording(true);
  };

  const stopRecording = () => {
    recognitionRef.current?.stop();
    setRecording(false);
  };

  const speakWord = (text: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      window.speechSynthesis.speak(utterance);
    }
  };

  // Auto-focus first field on new question
  useEffect(() => {
    if (!loading && !result && current) {
      setTimeout(() => fieldRefs.current[0]?.focus(), 100);
    }
  }, [currentIdx, loading]);

  // Keyboard submit on Enter
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !result) {
        e.preventDefault();
        handleSubmit();
      } else if (e.key === 'Enter' && result) {
        e.preventDefault();
        handleNext();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [answers, result, currentIdx]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-sky-500 animate-spin" />
      </div>
    );
  }

  if (queue.length === 0) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-400 mb-4">Žiadne slovesá na precvičenie.</p>
          <button onClick={onExit} className="px-6 py-2 bg-sky-500 text-white rounded-xl font-medium">Späť</button>
        </div>
      </div>
    );
  }

  const fields = getPromptFields(current.type);
  const fieldCount = getExpectedFields(current.type);
  const progress = ((currentIdx) / queue.length) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="border-b border-slate-700/50 bg-slate-900/50 backdrop-blur-xl sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <button onClick={onExit} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" /> Späť
          </button>
          <div className="flex items-center gap-4 text-sm">
            <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
              <Check className="w-4 h-4" /> {score.correct}
            </span>
            <span className="flex items-center gap-1.5 text-rose-400 font-medium">
              <X className="w-4 h-4" /> {score.wrong}
            </span>
            <span className="flex items-center gap-1.5 text-orange-400 font-medium">
              <Flame className="w-4 h-4" /> {streak}
            </span>
          </div>
        </div>
        <div className="h-1 bg-slate-800">
          <div className="h-full bg-gradient-to-r from-sky-500 to-blue-600 transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Question card */}
        <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-8 shadow-2xl">
          {/* Prompt */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 text-sky-400 text-xs font-medium mb-3">
              <Brain className="w-3.5 h-3.5" />
              {current.type === 'slovak' ? 'Preklad zo slovenčiny' : FORM_LABELS[current.type]}
            </div>
            <h2 className="text-4xl font-bold text-white mb-2">
              {current.type === 'slovak' ? current.verb.slovensky : current.verb.slovensky}
            </h2>
            {current.type !== 'slovak' && (
              <p className="text-slate-400 text-sm">
                Ktorý tvar slovesa "{current.verb.slovensky}"?
              </p>
            )}
            {current.type === 'slovak' && (
              <p className="text-slate-400 text-sm">{TYPE_LABELS[current.type]}</p>
            )}
          </div>

          {/* Answer fields */}
          {!result ? (
            <div className="space-y-3">
              {fields.slice(0, fieldCount).map((field, i) => (
                <div key={i}>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">{field.label}</label>
                  <div className="flex gap-2">
                    <input
                      ref={(el) => { fieldRefs.current[i] = el; }}
                      type="text"
                      value={answers[i] || ''}
                      onChange={(e) => {
                        const next = [...answers];
                        next[i] = e.target.value;
                        setAnswers(next);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { e.preventDefault(); handleSubmit(); }
                      }}
                      placeholder={field.placeholder}
                      className="flex-1 px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all text-lg"
                      autoComplete="off"
                      autoCapitalize="off"
                      spellCheck={false}
                    />
                    <button
                      onClick={() => speakWord(answers[i] || '')}
                      className="px-3 bg-slate-700/50 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl transition-all"
                      title="Vysloviť"
                    >
                      <Volume2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}

              {/* Audio input */}
              {inputMode === 'audio' && (
                <div className="pt-2">
                  {recording ? (
                    <button
                      onClick={stopRecording}
                      className="w-full flex items-center justify-center gap-2 py-3 bg-rose-500/20 border border-rose-500/40 text-rose-400 font-medium rounded-xl animate-pulse"
                    >
                      <MicOff className="w-5 h-5" /> Nahrávam... Klikni pre zastavenie
                    </button>
                  ) : (
                    <button
                      onClick={startRecording}
                      className="w-full flex items-center justify-center gap-2 py-3 bg-sky-500/10 border border-sky-500/30 text-sky-400 hover:bg-sky-500/20 font-medium rounded-xl transition-all"
                    >
                      <Mic className="w-5 h-5" /> Povedz do mikrofónu
                    </button>
                  )}
                  {transcript && (
                    <p className="text-center text-slate-400 text-sm mt-2">Počuté: "{transcript}"</p>
                  )}
                  {audioError && (
                    <p className="text-center text-rose-400 text-sm mt-2">{audioError}</p>
                  )}
                </div>
              )}

              <button
                onClick={handleSubmit}
                className="w-full py-3 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-blue-500/30"
              >
                Skontrolovať
              </button>
            </div>
          ) : (
            <ResultView result={result} verb={current.verb} onNext={handleNext} />
          )}
        </div>

        {/* Hint */}
        {!result && inputMode === 'text' && (
          <p className="text-center text-slate-500 text-xs mt-4">
            Stlač Enter pre kontrolu
          </p>
        )}
      </div>
    </div>
  );
}

function ResultView({ result, verb, onNext }: { result: AnswerResult; verb: Verb; onNext: () => void }) {
  const fieldLabels = ['1. tvar', '2. tvar', '3. tvar'];

  return (
    <div className="space-y-4">
      <div className={`text-center py-4 rounded-xl ${result.correct ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-rose-500/10 border border-rose-500/30'}`}>
        {result.correct ? (
          <>
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-500/20 mb-2">
              <Check className="w-6 h-6 text-emerald-400" strokeWidth={3} />
            </div>
            <p className="text-emerald-400 font-bold text-lg">Správne!</p>
          </>
        ) : (
          <>
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-rose-500/20 mb-2">
              <X className="w-6 h-6 text-rose-400" strokeWidth={3} />
            </div>
            <p className="text-rose-400 font-bold text-lg">Nesprávne</p>
          </>
        )}
      </div>

      {!result.correct && (
        <div className="space-y-2">
          {result.userAnswers.map((ans, i) => {
            const isRight = ans.trim().toLowerCase() === result.correctAnswers[i]?.toLowerCase();
            return (
              <div key={i} className="flex items-center gap-3 p-3 bg-slate-900/50 rounded-xl">
                <span className="text-xs text-slate-500 w-16">{fieldLabels[i] || 'Odpoveď'}</span>
                <span className={`flex-1 ${isRight ? 'text-emerald-400' : 'text-rose-400 line-through'}`}>
                  {ans || '—'}
                </span>
                {!isRight && (
                  <span className="text-emerald-400 font-medium">
                    {result.correctAnswers[i]}
                  </span>
                )}
                {isRight && <Check className="w-4 h-4 text-emerald-400" />}
              </div>
            );
          })}
        </div>
      )}

      {result.correct && (
        <div className="flex items-center justify-center gap-2 p-3 bg-slate-900/50 rounded-xl">
          <Trophy className="w-5 h-5 text-amber-400" />
          <span className="text-slate-300 text-sm">
            {verb.prvy_tvar} · {verb.druhy_tvar} · {verb.treti_tvar}
          </span>
        </div>
      )}

      <button
        onClick={onNext}
        className="w-full py-3 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-blue-500/30"
      >
        Ďalšie sloveso
      </button>
    </div>
  );
}
