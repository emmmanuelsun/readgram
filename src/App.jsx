import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Bookmark, Sparkles, Brain, Flame, Wand2, Loader2, X, ArrowRight, ArrowLeft, Volume2, VolumeX, Download, Eye, EyeOff, RefreshCw } from 'lucide-react';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);
const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY;

const CURATED_FALLBACKS = [
  {
    id: 'f1',
    title: 'The 1% Rule of Aggregation',
    content: 'If you get 1% better each day for one year, you’ll end up thirty-seven times better by the time you’re done. Small habits compound like interest.',
    author: 'James Clear',
    book: 'Atomic Habits',
    category: 'Productivity'
  },
  {
    id: 'f2',
    title: 'Radical Acceptance',
    content: 'Pain is inevitable; suffering is optional. When you stop fighting reality, you free up energy to transform your reaction to it.',
    author: 'Tara Brach',
    book: 'Radical Acceptance',
    category: 'Psychology'
  },
  {
    id: 'f3',
    title: 'The Enchiridion Dichotomy of Control',
    content: 'Some things are within our control and others not. Things in our control are opinion, pursuit, desire, aversion—whatever are our own actions.',
    author: 'Epictetus',
    book: 'Enchiridion',
    category: 'Philosophy'
  }
];

export default function App() {
  const [insights, setInsights] = useState(CURATED_FALLBACKS);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [savedIds, setSavedIds] = useState([]);
  const [activeTab, setActiveTab] = useState('daily');
  
  // DYNAMIC STREAK ENGINE
  const [streak, setStreak] = useState(1);

  // AUDIO STATE
  const [isSpeaking, setIsSpeaking] = useState(false);

  // ACTIVE RECALL STATE
  const [revealedRecallIds, setRevealedRecallIds] = useState([]);

  // PWA PROMPT
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  // AI MODAL & RATE LIMIT STATES
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [promptInput, setPromptInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiError, setAiError] = useState('');
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    initStreakSystem();
    fetchInsightsAndRotate();

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    });

    return () => {
      window.speechSynthesis?.cancel();
    };
  }, []);

  // COOLDOWN TIMER FOR API RATE LIMITS
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((prev) => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // 1. DYNAMIC STREAK SYSTEM (LOCALSTORAGE)
  const initStreakSystem = () => {
    const today = new Date().toISOString().split('T')[0];
    const lastVisit = localStorage.getItem('readgram_last_visit');
    const savedStreak = parseInt(localStorage.getItem('readgram_streak') || '1', 10);

    if (!lastVisit) {
      localStorage.setItem('readgram_last_visit', today);
      localStorage.setItem('readgram_streak', '1');
      setStreak(1);
      return;
    }

    const lastDate = new Date(lastVisit);
    const currentDate = new Date(today);
    const diffTime = Math.abs(currentDate - lastDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      // Consecutive day visit
      const newStreak = savedStreak + 1;
      localStorage.setItem('readgram_streak', String(newStreak));
      localStorage.setItem('readgram_last_visit', today);
      setStreak(newStreak);
    } else if (diffDays > 1) {
      // Streak broken
      localStorage.setItem('readgram_streak', '1');
      localStorage.setItem('readgram_last_visit', today);
      setStreak(1);
    } else {
      // Same day visit
      setStreak(savedStreak);
    }
  };

  // 2. AUTOMATED DAILY WISDOM ROTATION
  async function fetchInsightsAndRotate() {
    const { data } = await supabase.from('ideas').select('*').order('created_at', { ascending: false });
    
    let pool = CURATED_FALLBACKS;
    if (data && data.length > 0) {
      pool = data;
    }
    
    setInsights(pool);

    // Calculate a deterministic index based on the day of the year
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const diff = now - start;
    const oneDay = 1000 * 60 * 60 * 24;
    const dayOfYear = Math.floor(diff / oneDay);
    
    const dailyIndex = dayOfYear % pool.length;
    setCurrentIndex(dailyIndex);
  }

  const toggleSave = (id) => {
    if (savedIds.includes(id)) {
      setSavedIds(savedIds.filter((item) => item !== id));
    } else {
      setSavedIds([...savedIds, id]);
    }
  };

  const handleNext = () => {
    stopAudio();
    setCurrentIndex((prev) => (prev < insights.length - 1 ? prev + 1 : 0));
  };

  const handlePrev = () => {
    stopAudio();
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : insights.length - 1));
  };

  const toggleAudio = (textToRead) => {
    if (!('speechSynthesis' in window)) return;

    if (isSpeaking) {
      stopAudio();
    } else {
      const utterance = new SpeechSynthesisUtterance(textToRead);
      utterance.rate = 0.9;
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
      setIsSpeaking(true);
    }
  };

  const stopAudio = () => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };

  const handleInstallPWA = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setDeferredPrompt(null);
  };

  const toggleRecallReveal = (id) => {
    if (revealedRecallIds.includes(id)) {
      setRevealedRecallIds(revealedRecallIds.filter((i) => i !== id));
    } else {
      setRevealedRecallIds([...revealedRecallIds, id]);
    }
  };

  // 3. AI GENERATOR WITH QUOTA/COOLDOWN PROTECTION
  const generateSacredInsight = async () => {
    if (!promptInput.trim() || cooldown > 0) return;
    if (!geminiApiKey) {
      setAiError('VITE_GEMINI_API_KEY is missing in your .env');
      return;
    }

    setIsGenerating(true);
    setAiError('');

    try {
      const promptText = `Act as a world-class philosopher and master editor. Extract 1 profound core insight from "${promptInput}". 
      Respond strictly with a JSON object containing keys: "title", "content", "author", "book", "category". 
      Category must be one of: "Productivity", "Psychology", "Philosophy".
      No markdown backticks, valid JSON only.`;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${geminiApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: promptText }] }] })
        }
      );

      const resData = await response.json();

      if (!response.ok) {
        if (response.status === 429 || resData?.error?.message?.includes('quota')) {
          setCooldown(40);
          throw new Error('API Rate limit reached. Free tier allows 5 requests/min. Please wait for the timer.');
        }
        throw new Error(resData?.error?.message || 'AI Distillation failed.');
      }

      const rawText = resData.candidates[0].content.parts[0].text;
      const cleanJson = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
      const newCard = JSON.parse(cleanJson);

      const { data } = await supabase.from('ideas').insert([newCard]).select();
      
      const cardToInsert = data ? data[0] : { ...newCard, id: String(Date.now()) };
      setInsights((prev) => [cardToInsert, ...prev]);
      setCurrentIndex(0);
      setPromptInput('');
      setIsModalOpen(false);
    } catch (err) {
      setAiError(err.message || 'Failed to distill insight.');
    } finally {
      setIsGenerating(false);
    }
  };

  const currentInsight = insights[currentIndex] || insights[0];
  const isSaved = savedIds.includes(currentInsight.id);
  const stashList = insights.filter((item) => savedIds.includes(item.id));

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-slate-100 flex flex-col justify-between font-sans selection:bg-indigo-500/30">
      
      {/* Header */}
      <header className="w-full max-w-xl mx-auto px-6 py-8 flex items-center justify-between">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab('daily')}>
          <div className="w-8 h-8 rounded-full bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 font-bold text-sm">
            R
          </div>
          <span className="text-sm font-medium tracking-widest uppercase text-slate-400">Readgram</span>
        </div>

        <div className="flex items-center gap-3">
          {deferredPrompt && (
            <button
              onClick={handleInstallPWA}
              className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-3 py-1.5 rounded-full hover:bg-emerald-900/60 transition"
            >
              <Download className="w-3.5 h-3.5" /> Install
            </button>
          )}

          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 text-xs font-medium text-indigo-300 bg-indigo-950/60 border border-indigo-800/60 px-3 py-1.5 rounded-full hover:bg-indigo-900/60 transition"
          >
            <Wand2 className="w-3.5 h-3.5" /> Distill
          </button>
          
          <div className="flex items-center gap-1.5 text-xs text-amber-400 font-medium bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-full">
            <Flame className="w-3.5 h-3.5 fill-amber-400" /> {streak}d streak
          </div>
        </div>
      </header>

      {/* Main Sanctuary Area */}
      <main className="w-full max-w-xl mx-auto px-6 flex-1 flex flex-col justify-center pb-12">
        
        {/* Navigation Tabs */}
        <div className="flex justify-center gap-8 mb-10 text-xs font-semibold tracking-wider uppercase">
          <button
            onClick={() => setActiveTab('daily')}
            className={`pb-1 transition border-b-2 ${activeTab === 'daily' ? 'border-indigo-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
          >
            Daily Wisdom
          </button>
          <button
            onClick={() => setActiveTab('stash')}
            className={`pb-1 transition border-b-2 ${activeTab === 'stash' ? 'border-indigo-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
          >
            Active Recall ({savedIds.length})
          </button>
        </div>

        {activeTab === 'daily' ? (
          <div className="relative group">
            {/* Main Card */}
            <div className="bg-gradient-to-b from-slate-900/80 to-slate-950 border border-slate-800/80 rounded-3xl p-8 md:p-10 shadow-2xl backdrop-blur-xl relative overflow-hidden transition-all duration-500">
              
              <div className="absolute -top-24 -right-24 w-48 h-48 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none"></div>

              {/* Card Meta */}
              <div className="flex items-center justify-between mb-8">
                <span className="text-[11px] uppercase tracking-widest text-indigo-400 font-semibold bg-indigo-950/80 border border-indigo-800/40 px-3 py-1 rounded-full">
                  {currentInsight.category}
                </span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleAudio(`${currentInsight.title}. ${currentInsight.content}`)}
                    className={`p-2 rounded-full border transition ${
                      isSpeaking 
                        ? 'bg-indigo-600 text-white border-indigo-500 animate-pulse' 
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-indigo-400'
                    }`}
                  >
                    {isSpeaking ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  </button>

                  <button
                    onClick={() => toggleSave(currentInsight.id)}
                    className="p-2 rounded-full bg-slate-900 border border-slate-800 text-slate-400 hover:text-indigo-400 transition"
                  >
                    <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-indigo-500 text-indigo-500' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Core Idea */}
              <h2 className="text-2xl md:text-3xl font-serif text-slate-100 mb-6 leading-snug">
                {currentInsight.title}
              </h2>
              
              <p className="text-slate-300 text-base md:text-lg leading-relaxed font-light mb-8">
                "{currentInsight.content}"
              </p>

              {/* Attribution */}
              <div className="pt-6 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-500">
                <span className="font-medium text-slate-400">— {currentInsight.author}</span>
                <span className="italic">{currentInsight.book || currentInsight.category}</span>
              </div>

              <div className="absolute bottom-2 left-0 right-0 text-center text-[10px] text-slate-700 tracking-widest font-mono pointer-events-none opacity-40">
                READGRAM.CO
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between mt-6 px-2">
              <button
                onClick={handlePrev}
                className="flex items-center gap-1 text-xs text-slate-500 hover:text-white transition"
              >
                <ArrowLeft className="w-4 h-4" /> Previous
              </button>
              <span className="text-xs text-slate-600">
                {currentIndex + 1} of {insights.length}
              </span>
              <button
                onClick={handleNext}
                className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 font-medium transition"
              >
                Next Thought <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          /* Sanctuary Mode */
          <div className="space-y-4">
            {stashList.length === 0 ? (
              <div className="text-center py-20 text-slate-600 text-sm">
                Your Sanctuary is empty. Bookmark cards to enable Active Recall quizzes.
              </div>
            ) : (
              stashList.map((item) => {
                const isRevealed = revealedRecallIds.includes(item.id);
                return (
                  <div key={item.id} className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 transition">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] text-indigo-400 uppercase tracking-widest">{item.category}</span>
                      <button
                        onClick={() => toggleRecallReveal(item.id)}
                        className="flex items-center gap-1 text-xs text-indigo-400 hover:underline"
                      >
                        {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        {isRevealed ? 'Hide Memory' : 'Test Recall'}
                      </button>
                    </div>

                    <h4 className="text-lg font-serif text-white mb-3">{item.title}</h4>

                    {isRevealed ? (
                      <p className="text-slate-300 text-sm leading-relaxed border-t border-slate-800/60 pt-3">
                        "{item.content}"
                        <span className="block mt-2 text-xs text-slate-500 italic">— {item.author}</span>
                      </p>
                    ) : (
                      <div 
                        onClick={() => toggleRecallReveal(item.id)}
                        className="bg-slate-950/80 border border-dashed border-slate-800 rounded-xl p-4 text-center cursor-pointer hover:border-indigo-500/50 transition"
                      >
                        <p className="text-xs text-slate-500">
                          🧠 <span className="text-slate-400 font-medium">Active Recall Challenge:</span> Can you recite the core lesson? <span className="text-indigo-400 underline ml-1">Tap to reveal</span>
                        </p>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="w-full text-center py-6 text-xs text-slate-600 tracking-wider">
        Designed for clarity. Read daily.
      </footer>

      {/* AI Distiller Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-md w-full shadow-2xl relative">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute right-6 top-6 text-slate-500 hover:text-slate-300"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-xl font-serif text-white mb-2">Distill Wisdom</h3>
            <p className="text-xs text-slate-400 mb-6">
              Enter any book, thinker, or mental model to extract a singular, high-impact insight.
            </p>

            <input
              type="text"
              placeholder="e.g. Meditations by Marcus Aurelius"
              value={promptInput}
              onChange={(e) => setPromptInput(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 mb-4 transition"
            />

            {aiError && <p className="text-xs text-rose-400 mb-4 bg-rose-950/40 p-3 rounded-xl border border-rose-900/50">{aiError}</p>}

            <button
              onClick={generateSacredInsight}
              disabled={isGenerating || !promptInput.trim() || cooldown > 0}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white font-medium py-3 rounded-2xl text-xs uppercase tracking-widest transition flex items-center justify-center gap-2"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Distilling Essence...
                </>
              ) : cooldown > 0 ? (
                `Cooldown (${cooldown}s)`
              ) : (
                'Extract Insight'
              )}
            </button>
          </div>
        </div>
      )}

    </div>
  );
}