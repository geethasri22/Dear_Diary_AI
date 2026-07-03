'use client';

import { useState, useEffect, useRef } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { useRouter } from "next/navigation";
import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  getDocs,
  deleteDoc,
  doc,
  serverTimestamp
} from "firebase/firestore";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid
} from "recharts";

// Calming Mental Wellness Quotes
const WELLNESS_QUOTES = [
  { text: "You don't have to control your thoughts. You just have to stop letting them control you.", author: "Dan Millman" },
  { text: "Quiet the mind and the soul will speak.", author: "Ma Jaya Sati Bhagavati" },
  { text: "Deep breathing is our nervous system's love language.", author: "Lauren Fogel Mersy" },
  { text: "It is during our darkest moments that we must focus to see the light.", author: "Aristotle Onassis" },
  { text: "Self-care is how you take your power back.", author: "Lalah Delia" },
  { text: "Feelings are just visitors, let them come and go.", author: "Mooji" },
  { text: "One day at a time. One breath at a time.", author: "Calm Minds" },
  { text: "Your mental health is a priority. Your happiness is an essential. Your self-care is a necessity.", author: "Unknown" },
  { text: "You are stronger than your storm.", author: "Unknown" }
];

// Calming journaling reflections/quotes to keep user interacting after save
const JOURNAL_REFLECTIONS = [
  "What is one positive thing, no matter how small, that you can take away from today?",
  "Remember: feelings are like clouds—they float by and change shape. You are the sky.",
  "How can you treat yourself with a bit more kindness and grace today?",
  "What did today teach you about your own strength?",
  "Take a deep breath. You are exactly where you need to be in this moment.",
  "Is there a worry from today that you can write down and choose to release?",
  "What was the most peaceful moment of your day today?",
  "What is a small win from today that you are proud of?",
  "Name one person, place, or thing that brought you comfort today."
];

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [mounted, setMounted] = useState(false);

  // Form & Entry State
  const [entryText, setEntryText] = useState("");
  const [loading, setLoading] = useState(false);
  const [detectedMood, setDetectedMood] = useState<string | null>(null);
  const [supportFeedback, setSupportFeedback] = useState<string | null>(null);

  // History & Filters
  const [history, setHistory] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMoodFilter, setSelectedMoodFilter] = useState("All");

  // Widgets & Custom States
  const [streak, setStreak] = useState(0);
  const [weeklyData, setWeeklyData] = useState<any[]>([]);
  const [weeklySummary, setWeeklySummary] = useState("");
  const [smartAlert, setSmartAlert] = useState(false);
  const [theme, setTheme] = useState("light");
  const [quote, setQuote] = useState({ text: "", author: "" });
  const [activeReflection, setActiveReflection] = useState<string | null>(null);

  // Guided Breathing State
  const [breathingActive, setBreathingActive] = useState(false);
  const [breathing, setBreathing] = useState<{
    phase: "Inhale" | "Hold In" | "Exhale" | "Hold Out";
    seconds: number;
  }>({ phase: "Inhale", seconds: 4 });

  // Delete Confirm Modal State
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Initial Authentication & Theme Mount
  useEffect(() => {
    setMounted(true);
    getRandomQuote();

    const savedTheme = localStorage.getItem("theme") || "light";
    setTheme(savedTheme);
    if (savedTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.replace("/login");
      } else {
        setUser(currentUser);
        setChecking(false);
        await loadDiaryEntries(currentUser.uid);
      }
    });

    return () => unsubscribe();
  }, [router]);

  // Guided Breathing Timer Effect
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (breathingActive) {
      interval = setInterval(() => {
        setBreathing((prev) => {
          if (prev.seconds <= 1) {
            let nextPhase: "Inhale" | "Hold In" | "Exhale" | "Hold Out";
            if (prev.phase === "Inhale") nextPhase = "Hold In";
            else if (prev.phase === "Hold In") nextPhase = "Exhale";
            else if (prev.phase === "Exhale") nextPhase = "Hold Out";
            else nextPhase = "Inhale";
            return { phase: nextPhase, seconds: 4 };
          }
          return { ...prev, seconds: prev.seconds - 1 };
        });
      }, 1000);
    } else {
      setBreathing({ phase: "Inhale", seconds: 4 });
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [breathingActive]);

  // Load Past Diary Entries from Firestore
  const loadDiaryEntries = async (uid: string) => {
    try {
      const q = query(
        collection(db, "entries"),
        where("userId", "==", uid),
        orderBy("createdAt", "desc")
      );
      const snapshot = await getDocs(q);
      const entriesData: any[] = [];
      snapshot.forEach((doc) => {
        entriesData.push({ id: doc.id, ...doc.data() });
      });

      setHistory(entriesData);
      updateAnalytics(entriesData);
    } catch (error) {
      console.error("Error loading diary entries:", error);
    }
  };

  // Run Calculations on Entry Changes (Streak, Weekly Trend, Insights)
  const updateAnalytics = (entriesList: any[]) => {
    const computedStreak = calculateStreak(entriesList);
    setStreak(computedStreak);

    const trend = getWeeklyTrend(entriesList);
    setWeeklyData(trend);

    // Calculate Summary and Smart Alerts
    let positiveCount = 0;
    let negativeCount = 0;
    let crisisCount = 0;

    entriesList.forEach((e) => {
      const mood = (e.mood || "").toLowerCase();
      if (mood.includes("positive")) positiveCount++;
      else if (mood.includes("negative")) negativeCount++;
      else if (mood.includes("crisis")) {
        negativeCount++;
        crisisCount++;
      }
    });

    // Smart Alert logic: more negative than positive, 2+ crisis entries, or broken habit streak
    const hasNegativeTrend = negativeCount > positiveCount;
    const hasCrisisPattern = crisisCount >= 2;
    const hasStreakBreak = computedStreak === 0 && entriesList.length >= 5;

    if (hasNegativeTrend || hasCrisisPattern || hasStreakBreak) {
      setSmartAlert(true);
    } else {
      setSmartAlert(false);
    }

    // Weekly summary text
    if (entriesList.length < 3) {
      setWeeklySummary("Write a few more entries to generate weekly emotional insights.");
    } else if (negativeCount > positiveCount) {
      setWeeklySummary("This week has felt emotionally heavy. Remember to be gentle with yourself. You're building resilience 💛");
    } else if (positiveCount > negativeCount) {
      setWeeklySummary("You had a positive emotional trend this week. Keep nurturing the moments that bring you joy! 🌟");
    } else {
      setWeeklySummary("Your week was emotionally balanced. Take time to reflect, rest, and keep checking in with yourself. 🌿");
    }
  };

  // Streak Calculation
  const calculateStreak = (entries: any[]) => {
    if (!entries.length) return 0;

    const dates = entries
      .map((entry) => {
        if (!entry.createdAt) return null;
        const d = typeof entry.createdAt.toDate === "function" ? entry.createdAt.toDate() : new Date(entry.createdAt);
        return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      })
      .filter((t): t is number => t !== null);

    if (!dates.length) return 0;

    const uniqueDates = Array.from(new Set(dates)).sort((a, b) => b - a);

    const today = new Date();
    const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const oneDayMs = 24 * 60 * 60 * 1000;

    const mostRecent = uniqueDates[0];
    if (todayMidnight - mostRecent > oneDayMs) {
      return 0; // Streak broken (last entry was before yesterday)
    }

    let count = 1;
    for (let i = 1; i < uniqueDates.length; i++) {
      if (uniqueDates[i - 1] - uniqueDates[i] === oneDayMs) {
        count++;
      } else {
        break;
      }
    }

    return count;
  };

  // Recharts Trend Data Mapping
  const getWeeklyTrend = (entries: any[]) => {
    const days: any[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      days.push({
        date: d.toLocaleDateString("en-IN", { weekday: "short" }),
        timestamp: d.getTime(),
        total: 0,
        count: 0,
        score: 0
      });
    }

    entries.forEach((entry) => {
      if (!entry.createdAt) return;
      const date = typeof entry.createdAt.toDate === "function" ? entry.createdAt.toDate() : new Date(entry.createdAt);
      const midnight = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

      const dayObj = days.find((day) => day.timestamp === midnight);
      if (dayObj) {
        const mood = (entry.mood || "").toLowerCase();
        let moodScore = 0;
        if (mood.includes("positive")) moodScore = 2;
        else if (mood.includes("neutral")) moodScore = 1;
        else if (mood.includes("negative")) moodScore = -1;
        else if (mood.includes("crisis")) moodScore = -2;

        dayObj.total += moodScore;
        dayObj.count += 1;
      }
    });

    days.forEach((day) => {
      day.score = day.count ? Number((day.total / day.count).toFixed(1)) : 0;
    });

    return days;
  };

  // Handle Save Entry and Mood Analysis
  const handleSaveEntry = async () => {
    if (!entryText.trim() || !user) return;
    setLoading(true);
    setDetectedMood(null);
    setSupportFeedback(null);

    try {
      // 1. Fetch Mood Analysis
      const analyzeRes = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: entryText })
      });
      const analyzeData = await analyzeRes.json();
      const mood = analyzeData.mood || "Neutral";

      // 2. Fetch Support/Feedback
      const supportRes = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: entryText, mood })
      });
      const supportData = await supportRes.json();
      const feedback = supportData.reply || "";

      // 3. Save to Firestore "entries" collection
      await addDoc(collection(db, "entries"), {
        userId: user.uid,
        text: entryText,
        mood: mood,
        supportReply: feedback,
        createdAt: serverTimestamp()
      });

      // 4. Update UI Statuses
      setDetectedMood(mood);
      setSupportFeedback(feedback);
      setEntryText("");

      // Pick a random reflection quote to display at the bottom of the result panel
      const randIdx = Math.floor(Math.random() * JOURNAL_REFLECTIONS.length);
      setActiveReflection(JOURNAL_REFLECTIONS[randIdx]);

      // 5. Reload diary listings
      await loadDiaryEntries(user.uid);
    } catch (err) {
      console.error("Error analyzing or saving entry:", err);
    } finally {
      setLoading(false);
    }
  };

  // Delete Entry
  const handleDeleteEntry = async (id: string) => {
    try {
      await deleteDoc(doc(db, "entries", id));
      setDeleteConfirmId(null);
      if (user) await loadDiaryEntries(user.uid);
    } catch (error) {
      console.error("Error deleting entry:", error);
    }
  };

  // Theme Toggle
  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    localStorage.setItem("theme", nextTheme);
    if (nextTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  // Get Random wellness quote
  const getRandomQuote = () => {
    const index = Math.floor(Math.random() * WELLNESS_QUOTES.length);
    setQuote(WELLNESS_QUOTES[index]);
  };

  // Logout Action
  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push("/login");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  // Word & Character count helpers
  const charCount = entryText.length;
  const wordCount = entryText.trim() === "" ? 0 : entryText.trim().split(/\s+/).length;

  // Crisis detection from typing state
  const hasCrisisKeywordsTyping = () => {
    const crisisKeywords = ["die", "kill myself", "suicide", "end my life", "i want to die", "harm myself", "self-harm", "self harm", "cutting myself"];
    const lowerText = entryText.toLowerCase();
    return crisisKeywords.some(keyword => lowerText.includes(keyword));
  };

  const showCrisisHelpline = hasCrisisKeywordsTyping() || smartAlert;

  // Time based greeting
  const getGreeting = () => {
    const hr = new Date().getHours();
    if (hr < 12) return "Good morning";
    if (hr < 17) return "Good afternoon";
    if (hr < 21) return "Good evening";
    return "Good night";
  };

  // Filtering and Searching entries
  const filteredHistory = history.filter((item) => {
    const matchesSearch = item.text?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = selectedMoodFilter === "All" || item.mood?.toUpperCase() === selectedMoodFilter.toUpperCase();
    return matchesSearch && matchesFilter;
  });

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-tr from-purple-100 via-indigo-50 to-pink-100 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950">
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 rounded-full border-4 border-purple-500/20 border-t-purple-600 animate-spin mb-4"></div>
          <p className="text-purple-600 dark:text-purple-300 font-medium">Opening dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-tr from-purple-50 via-slate-50 to-pink-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 text-slate-800 dark:text-slate-100 transition-colors duration-500 pb-12">
      
      {/* Top Navbar */}
      <nav className="sticky top-0 z-30 w-full bg-white/60 dark:bg-slate-900/60 backdrop-blur-md border-b border-purple-100/50 dark:border-slate-800/50 px-6 py-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">💜</span>
            <span className="font-extrabold text-xl bg-gradient-to-r from-purple-700 to-pink-600 dark:from-purple-300 dark:to-pink-400 bg-clip-text text-transparent">
              Dear Diary AI
            </span>
          </div>

          <div className="flex items-center gap-4">
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2.5 rounded-xl bg-white/80 dark:bg-slate-800/80 border border-purple-100/50 dark:border-slate-700/50 hover:bg-purple-100/50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition duration-300"
              title="Toggle Theme"
            >
              {theme === "light" ? (
                // Moon Icon
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
                </svg>
              ) : (
                // Sun Icon
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
                </svg>
              )}
            </button>

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-200/50 hover:bg-red-500/10 text-red-600 dark:text-red-400 font-bold transition duration-300 text-sm"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
              </svg>
              <span>Logout</span>
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 mt-8">
        {/* Welcome Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border border-white/20 dark:border-slate-800/40 p-6 rounded-3xl mb-8 animate-fade-in">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-purple-950 dark:text-white">
              {getGreeting()}, {user?.displayName || "Friend"} 🌿
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mt-1">
              {new Date().toLocaleDateString("en-IN", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>

          {/* Dynamic Streak Badge */}
          <div className="flex items-center gap-3 bg-gradient-to-r from-orange-500/10 to-amber-500/10 border border-orange-500/20 px-5 py-3 rounded-2xl animate-pulse">
            <span className="text-3xl">🔥</span>
            <div>
              <div className="text-lg font-black text-orange-600 dark:text-orange-400">{streak} Day Streak</div>
              <div className="text-[10px] uppercase tracking-wider font-extrabold text-orange-500/80">Reflecting daily</div>
            </div>
          </div>
        </div>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Workspace (Left Column) */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Writing Block */}
            <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-white/35 dark:border-slate-800/60 p-6 rounded-3xl shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-purple-100 dark:border-slate-800 pb-3">
                <h2 className="font-extrabold text-purple-950 dark:text-white text-lg flex items-center gap-2">
                  <span>✍️</span> Write Diary Entry
                </h2>
                <div className="text-xs font-semibold text-slate-400">
                  {wordCount} words • {charCount} chars
                </div>
              </div>

              <textarea
                value={entryText}
                onChange={(e) => setEntryText(e.target.value)}
                placeholder="How are you feeling today? Share your thoughts, feelings, or small victories..."
                className="w-full h-48 p-4 bg-white/50 dark:bg-slate-950/50 border border-purple-100 dark:border-slate-800 rounded-2xl outline-none focus:ring-2 focus:ring-purple-500/40 dark:focus:ring-purple-400/40 focus:border-purple-500 dark:focus:border-purple-400 text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 transition-all font-medium text-sm resize-none leading-relaxed"
                disabled={loading}
              />

              <div className="flex items-center gap-3">
                <button
                  onClick={handleSaveEntry}
                  disabled={loading || !entryText.trim()}
                  className="flex-grow md:flex-grow-0 md:px-8 py-3.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-2xl font-bold shadow-lg shadow-purple-500/10 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50 disabled:scale-100 disabled:pointer-events-none flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <div className="w-5 h-5 rounded-full border-2 border-white/20 border-t-white animate-spin"></div>
                      <span>Analyzing Mood & Saving...</span>
                    </>
                  ) : (
                    <>
                      <span>Save & Analyze Entry</span>
                    </>
                  )}
                </button>

                {entryText.trim() && (
                  <button
                    onClick={() => setEntryText("")}
                    className="px-5 py-3.5 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl text-slate-500 dark:text-slate-400 font-semibold transition"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Analysis Result Banner */}
            {(detectedMood || supportFeedback) && (
              <div className="bg-white/70 dark:bg-slate-900/70 border border-purple-200/50 dark:border-slate-800/50 p-6 rounded-3xl shadow-lg space-y-4 animate-fade-in">
                <h3 className="font-extrabold text-purple-950 dark:text-white text-lg">
                  ✨ Latest Analysis Results
                </h3>

                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-sm font-semibold text-slate-500">Detected Mood:</span>
                  <span className={`px-4 py-1.5 rounded-full text-sm font-black shadow-sm ${
                    detectedMood === "Positive" ? "bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-400" :
                    detectedMood === "Negative" ? "bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400" :
                    detectedMood === "CRISIS" ? "bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 animate-pulse" :
                    "bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400"
                  }`}>
                    {detectedMood === "Positive" ? "😊 Positive" :
                     detectedMood === "Negative" ? "😔 Negative" :
                     detectedMood === "CRISIS" ? "🚨 CRISIS ALERT" :
                     "😐 Neutral"}
                  </span>
                </div>

                {supportFeedback && (
                  <div className="bg-purple-50/50 dark:bg-purple-950/20 border-l-4 border-purple-500 p-4 rounded-xl">
                    <div className="text-xs font-extrabold text-purple-600 dark:text-purple-400 uppercase tracking-widest mb-1">Empathetic Response</div>
                    <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed italic font-medium">
                      "{supportFeedback}"
                    </p>
                  </div>
                )}

                {activeReflection && (
                  <div className="mt-4 pt-4 border-t border-purple-100/50 dark:border-slate-800/50 text-center space-y-2 animate-fade-in">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-pink-500/10 text-pink-600 dark:text-pink-400 text-[10px] font-black uppercase tracking-wider">
                      🌱 Daily Mindfulness Reflection
                    </div>
                    <p className="text-xs md:text-sm text-slate-600 dark:text-slate-300 font-semibold italic px-2">
                      "{activeReflection}"
                    </p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                      Take a moment to ponder this. You can reflect further or carry this with you today.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* History Feed */}
            <div className="bg-white/70 dark:bg-slate-900/70 border border-white/20 dark:border-slate-800/40 p-6 rounded-3xl shadow-xl space-y-6">
              
              {/* Header with Search and Filter */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-purple-100 dark:border-slate-800 pb-4">
                <h2 className="font-extrabold text-purple-950 dark:text-white text-lg flex items-center gap-2">
                  <span>📅</span> Journal History
                </h2>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  {/* Search Bar */}
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m21-21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                      </svg>
                    </span>
                    <input
                      type="text"
                      placeholder="Search entries..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs outline-none focus:ring-2 focus:ring-purple-500/20 dark:focus:ring-purple-400/20 font-medium"
                    />
                  </div>

                  {/* Filter Badges */}
                  <div className="flex items-center gap-1.5 overflow-x-auto py-1">
                    {["All", "Positive", "Neutral", "Negative", "Crisis"].map((moodOption) => (
                      <button
                        key={moodOption}
                        onClick={() => setSelectedMoodFilter(moodOption)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                          selectedMoodFilter === moodOption
                            ? "bg-purple-600 text-white shadow-sm"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                        }`}
                      >
                        {moodOption}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Entries Stream */}
              <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
                {filteredHistory.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 dark:text-slate-500 font-medium">
                    {searchQuery || selectedMoodFilter !== "All"
                      ? "No entries match your search filters."
                      : "Your diary is empty. Write your first entry above!"}
                  </div>
                ) : (
                  filteredHistory.map((item) => {
                    // Date string
                    const d = item.createdAt?.toDate ? item.createdAt.toDate() : new Date(item.createdAt);
                    const formattedDate = d.toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit"
                    });

                    return (
                      <div
                        key={item.id}
                        className="p-5 bg-white/60 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-900 rounded-2xl hover:border-purple-200/50 dark:hover:border-slate-800 hover:shadow-md transition-all duration-300 space-y-3 relative group"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-2">
                            {/* Mood Tag */}
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase ${
                              item.mood === "Positive" ? "bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-400" :
                              item.mood === "Negative" ? "bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400" :
                              item.mood === "CRISIS" ? "bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400" :
                              "bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400"
                            }`}>
                              {item.mood === "Positive" ? "😊 Positive" :
                               item.mood === "Negative" ? "😔 Negative" :
                               item.mood === "CRISIS" ? "🚨 CRISIS" :
                               "😐 Neutral"}
                            </span>
                            <span className="text-[10px] text-slate-400 font-bold">{formattedDate}</span>
                          </div>

                          {/* Delete Action triggers Inline Modal or direct Delete */}
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                            {deleteConfirmId === item.id ? (
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleDeleteEntry(item.id)}
                                  className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-[10px] font-bold"
                                >
                                  Yes, Delete
                                </button>
                                <button
                                  onClick={() => setDeleteConfirmId(null)}
                                  className="px-2 py-1 bg-slate-200 dark:bg-slate-800 text-slate-500 rounded text-[10px] font-bold"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setDeleteConfirmId(item.id)}
                                className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition"
                                title="Delete Entry"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4.5 h-4.5">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                                </svg>
                              </button>
                            )}
                          </div>
                        </div>

                        <p className="text-sm text-slate-700 dark:text-slate-300 font-medium whitespace-pre-wrap leading-relaxed">
                          {item.text}
                        </p>

                        {item.supportReply && (
                          <div className="bg-purple-50/50 dark:bg-purple-950/10 border-l-2 border-purple-400 p-3 rounded-lg text-xs leading-relaxed text-slate-600 dark:text-slate-400 italic">
                            "{item.supportReply}"
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

          </div>

          {/* Sidebar Modules (Right Column) */}
          <div className="space-y-8">

            {/* Guided Box Breathing */}
            <div className="bg-white/70 dark:bg-slate-900/70 border border-white/20 dark:border-slate-800/40 p-6 rounded-3xl shadow-xl flex flex-col items-center text-center space-y-4">
              <div className="w-full flex items-center justify-between border-b border-purple-100 dark:border-slate-800 pb-2">
                <h3 className="font-extrabold text-purple-950 dark:text-white text-base flex items-center gap-2">
                  <span>🧘</span> Guided Box Breathing
                </h3>
                <span className="text-xs bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2.5 py-0.5 rounded-full font-bold">Guided</span>
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Regulate stress and calm your nerves with guided counts.
              </p>

              {/* Breathing Circle Ring */}
              <div className="relative w-36 h-36 flex items-center justify-center my-2">
                <div className="absolute inset-0 rounded-full border border-purple-500/10 dark:border-purple-400/10 animate-ping duration-[3000ms]"></div>
                
                {/* Expanding circle depending on breathing phase */}
                <div
                  className={`rounded-full flex flex-col items-center justify-center shadow-lg text-white font-black transition-all duration-1000 ease-in-out ${
                    !breathingActive
                      ? "w-24 h-24 bg-gradient-to-tr from-purple-500 to-indigo-500 shadow-purple-500/20"
                      : breathing.phase === "Inhale"
                      ? "bg-gradient-to-tr from-pink-500 to-purple-500 shadow-pink-500/20 animate-pulse"
                      : breathing.phase === "Hold In"
                      ? "bg-gradient-to-tr from-purple-600 to-indigo-600 shadow-purple-600/20"
                      : breathing.phase === "Exhale"
                      ? "bg-gradient-to-tr from-indigo-500 to-blue-500 shadow-indigo-500/20"
                      : "bg-gradient-to-tr from-slate-500 to-slate-600 shadow-slate-500/20"
                  }`}
                  style={{
                    transform: breathingActive && (breathing.phase === "Inhale" || breathing.phase === "Hold In") ? "scale(1.25)" : "scale(1.0)"
                  }}
                >
                  {breathingActive ? (
                    <>
                      <div className="text-[10px] tracking-wide uppercase font-black">
                        {breathing.phase === "Hold In" || breathing.phase === "Hold Out" ? "Hold" : breathing.phase}
                      </div>
                      <div className="text-lg font-black mt-0.5">{breathing.seconds}s</div>
                    </>
                  ) : (
                    <span className="text-xs uppercase tracking-wider font-extrabold">Idle</span>
                  )}
                </div>
              </div>

              {/* Controls */}
              <button
                onClick={() => setBreathingActive(!breathingActive)}
                className={`w-full py-2.5 rounded-xl font-bold transition flex items-center justify-center gap-2 ${
                  breathingActive
                    ? "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700"
                    : "bg-purple-600 hover:bg-purple-700 text-white shadow-md shadow-purple-500/10"
                }`}
              >
                {breathingActive ? (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5" />
                    </svg>
                    <span>Pause Exercise</span>
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347c-.75.412-1.667-.13-1.667-.986V5.653Z" />
                    </svg>
                    <span>Start Breathing (4-4-4-4)</span>
                  </>
                )}
              </button>
            </div>

            {/* Weekly Mood Chart */}
            <div className="bg-white/70 dark:bg-slate-900/70 border border-white/20 dark:border-slate-800/40 p-6 rounded-3xl shadow-xl space-y-4">
              <h3 className="font-extrabold text-purple-950 dark:text-white text-base flex items-center gap-2 border-b border-purple-100 dark:border-slate-800 pb-2">
                <span>📈</span> Weekly Mood Trend
              </h3>

              {mounted && weeklyData.length > 0 ? (
                <div className="w-full h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={weeklyData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" className="dark:hidden" />
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" className="hidden dark:block" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                      <YAxis domain={[-2, 2]} ticks={[-2, -1, 0, 1, 2]} tickFormatter={(val) => {
                        if (val === 2) return "😊";
                        if (val === 1) return "😐";
                        if (val === -1) return "😔";
                        if (val === -2) return "🚨";
                        return "";
                      }} tick={{ fontSize: 12 }} stroke="#94a3b8" />
                      <Tooltip formatter={(value) => {
                        const num = Number(value);
                        if (num >= 1.5) return ["Positive 😊", "Mood Score"];
                        if (num >= 0.5) return ["Neutral 😐", "Mood Score"];
                        if (num >= -1.5) return ["Negative 😔", "Mood Score"];
                        return ["Crisis 🚨", "Mood Score"];
                      }} />
                      <Line
                        type="monotone"
                        dataKey="score"
                        stroke="#8b5cf6"
                        strokeWidth={3}
                        dot={{ r: 4, strokeWidth: 2, fill: "#fff" }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-44 flex items-center justify-center text-slate-400 text-xs font-semibold">
                  Loading charts...
                </div>
              )}

              {/* Dynamic summary text box */}
              {weeklySummary && (
                <div className="bg-purple-50/50 dark:bg-purple-950/10 p-3.5 border border-purple-100/50 dark:border-slate-800/60 rounded-2xl text-xs leading-relaxed font-semibold text-slate-600 dark:text-purple-300">
                  <div className="font-extrabold text-[10px] uppercase tracking-wider text-purple-600 dark:text-purple-400 mb-1 flex items-center gap-1">
                    <span>🧠</span> Emotional Summary
                  </div>
                  <p>{weeklySummary}</p>
                </div>
              )}
            </div>

            {/* Crisis Alerts Override Card */}
            {showCrisisHelpline && (
              <div className="bg-red-500/10 dark:bg-red-500/20 border-2 border-red-500 p-6 rounded-3xl shadow-xl space-y-4 animate-pulse">
                <h3 className="font-black text-red-600 dark:text-red-400 text-base flex items-center gap-2 border-b border-red-500/20 pb-2">
                  <span>⚠️</span> Support & Helpline Alert
                </h3>
                <p className="text-xs text-red-600/90 dark:text-red-300 font-bold leading-relaxed">
                  We noticed statements indicating that you are feeling extremely heavy or in crisis. Please remember that you are not alone.
                </p>
                <div className="bg-white/80 dark:bg-slate-900/80 border border-red-200/50 p-4 rounded-2xl">
                  <div className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-1">24/7 Helpline Support</div>
                  <div className="text-base font-black text-slate-900 dark:text-white flex items-center justify-between">
                    <span>☎️ Kiran Helpline:</span>
                  </div>
                  <a
                    href="tel:1800-599-0019"
                    className="mt-1 block text-center py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black transition-all"
                  >
                    Call 1800-599-0019
                  </a>
                </div>
                <p className="text-[10px] text-red-600/70 dark:text-red-400/70 font-semibold text-center italic">
                  It's okay to ask for help. Please connect with your loved ones or call the number above.
                </p>
              </div>
            )}

            {/* Peace Quotations */}
            <div className="bg-white/70 dark:bg-slate-900/70 border border-white/20 dark:border-slate-800/40 p-6 rounded-3xl shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-purple-100 dark:border-slate-800 pb-2">
                <h3 className="font-extrabold text-purple-950 dark:text-white text-base flex items-center gap-2">
                  <span>✨</span> Peace Quotation
                </h3>
                <button
                  onClick={getRandomQuote}
                  className="p-1.5 hover:bg-purple-100/50 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-purple-600 transition"
                  title="New Quote"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                  </svg>
                </button>
              </div>

              {quote.text ? (
                <div className="space-y-2">
                  <p className="text-xs md:text-sm text-slate-600 dark:text-slate-300 italic leading-relaxed font-semibold">
                    "{quote.text}"
                  </p>
                  <p className="text-[10px] text-right font-black text-purple-600 dark:text-purple-400">
                    — {quote.author}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-slate-400 font-semibold italic">Loading wellness quotes...</p>
              )}
            </div>

          </div>

        </div>
      </div>
    </div>
  );
}