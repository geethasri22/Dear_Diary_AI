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
  const [lastSavedText, setLastSavedText] = useState<string | null>(null);

  // Support Chat Modal States
  const [showChat, setShowChat] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<any[]>([
    {
      role: "assistant",
      content: "Hello! I'm here for you. We noticed things have been a bit heavy lately. Would you like to share what's on your mind?"
    }
  ]);

  // Guided Breathing State
  const [breathingActive, setBreathingActive] = useState(false);
  const [breathing, setBreathing] = useState<{
    phase: "Inhale" | "Hold In" | "Exhale" | "Hold Out";
    seconds: number;
  }>({ phase: "Inhale", seconds: 4 });

  // Delete Confirm Modal State
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Music Therapy States
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeTrack, setActiveTrack] = useState<string | null>(null);
  const [customTrackUrl, setCustomTrackUrl] = useState("");
  const [youtubeId, setYoutubeId] = useState<string | null>(null);
  const [frequencyActive, setFrequencyActive] = useState<number | null>(null);
  const [frequencyVolume, setFrequencyVolume] = useState(0.1);

  // Music Therapy Refs
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);

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

  // Cleanup Music Therapy Oscillator on Unmount
  useEffect(() => {
    return () => {
      if (oscillatorRef.current) {
        try {
          oscillatorRef.current.stop();
        } catch (_) {}
      }
      if (audioCtxRef.current) {
        try {
          audioCtxRef.current.close();
        } catch (_) {}
      }
    };
  }, []);

  // Guided Box Breathing Timer Effect
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

  // Load Past Diary Entries from Firestore with LocalStorage fallback
  const loadDiaryEntries = async (uid: string) => {
    try {
      const q = query(
        collection(db, "entries"),
        where("userId", "==", uid)
      );
      const snapshot = await getDocs(q);
      const entriesData: any[] = [];
      snapshot.forEach((doc) => {
        entriesData.push({ id: doc.id, ...doc.data() });
      });

      // Sort descending by createdAt
      entriesData.sort((a: any, b: any) => {
        const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0);
        const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0);
        return timeB - timeA;
      });

      setHistory(entriesData);
      updateAnalytics(entriesData);
      
      // Update local cache
      localStorage.setItem(`entries_${uid}`, JSON.stringify(entriesData));
    } catch (error) {
      console.warn("Firestore error loading entries, falling back to LocalStorage:", error);
      try {
        const cached = localStorage.getItem(`entries_${uid}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          const hydrated = parsed.map((entry: any) => {
            if (entry.createdAt) {
              const d = entry.createdAt.seconds 
                ? new Date(entry.createdAt.seconds * 1000) 
                : new Date(entry.createdAt);
              return {
                ...entry,
                createdAt: {
                  toDate: () => d,
                  seconds: Math.floor(d.getTime() / 1000)
                }
              };
            }
            return entry;
          });
          setHistory(hydrated);
          updateAnalytics(hydrated);
        } else {
          setHistory([]);
          updateAnalytics([]);
        }
      } catch (err) {
        console.error("LocalStorage load failed:", err);
        setHistory([]);
        updateAnalytics([]);
      }
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

    const hasNegativeTrend = negativeCount > positiveCount;
    const hasCrisisPattern = crisisCount >= 1;

    if (hasNegativeTrend || hasCrisisPattern) {
      setSmartAlert(true);
    } else {
      setSmartAlert(false);
    }

    // Weekly summary text
    if (entriesList.length < 1) {
      setWeeklySummary("Write a few more entries to generate weekly emotional insights.");
    } else if (negativeCount > positiveCount) {
      setWeeklySummary("This week has felt emotionally heavy. Remember to be gentle with yourself. You're building resilience 💛");
    } else if (positiveCount > negativeCount) {
      setWeeklySummary("You had a positive emotional trend this week. Keep nurturing what's working 🌟");
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
      return 0; // Streak broken
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
    const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      days.push({
        date: weekdays[d.getDay()],
        timestamp: d.getTime(),
        total: 0,
        count: 0,
        score: null
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
    setLastSavedText(null);

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

      // 3. Save to Firestore
      let entryId = "local_" + Date.now();
      const newEntryDoc = {
        userId: user.uid,
        text: entryText,
        mood: mood,
        supportReply: feedback
      };

      try {
        const docRef = await addDoc(collection(db, "entries"), {
          ...newEntryDoc,
          createdAt: serverTimestamp()
        });
        entryId = docRef.id;
      } catch (fireErr) {
        console.warn("Firestore save failed, saving locally:", fireErr);
      }

      // Sync/Add to localStorage
      const cached = localStorage.getItem(`entries_${user.uid}`);
      let localEntries: any[] = [];
      if (cached) {
        try {
          localEntries = JSON.parse(cached);
        } catch (_) {}
      }
      
      const newEntryWithMeta = {
        id: entryId,
        ...newEntryDoc,
        createdAt: {
          seconds: Math.floor(Date.now() / 1000)
        }
      };
      localEntries.unshift(newEntryWithMeta);
      localStorage.setItem(`entries_${user.uid}`, JSON.stringify(localEntries));

      setDetectedMood(mood);
      setSupportFeedback(feedback);
      setLastSavedText(entryText);
      setEntryText("");

      const randIdx = Math.floor(Math.random() * JOURNAL_REFLECTIONS.length);
      setActiveReflection(JOURNAL_REFLECTIONS[randIdx]);

      // Hydrate for local state to include the mock toDate function immediately
      const d = new Date(newEntryWithMeta.createdAt.seconds * 1000);
      const hydratedNewEntry = {
        ...newEntryWithMeta,
        createdAt: {
          toDate: () => d,
          seconds: newEntryWithMeta.createdAt.seconds
        }
      };

      // Directly update state to reflect immediately in the history stream
      const updatedHistory = [hydratedNewEntry, ...history];
      setHistory(updatedHistory);
      updateAnalytics(updatedHistory);
    } catch (err) {
      console.error("Error saving entry:", err);
    } finally {
      setLoading(false);
    }
  };

  // Delete Entry
  const handleDeleteEntry = async (id: string) => {
    try {
      await deleteDoc(doc(db, "entries", id));
    } catch (error) {
      console.warn("Error deleting entry from Firestore:", error);
    }

    if (user) {
      const cached = localStorage.getItem(`entries_${user.uid}`);
      let filtered: any[] = [];
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          filtered = parsed.filter((item: any) => item.id !== id);
          localStorage.setItem(`entries_${user.uid}`, JSON.stringify(filtered));
        } catch (_) {}
      }
      
      // Update history state directly
      const hydrated = filtered.map((entry: any) => {
        if (entry.createdAt) {
          const d = entry.createdAt.seconds 
            ? new Date(entry.createdAt.seconds * 1000) 
            : new Date(entry.createdAt);
          return {
            ...entry,
            createdAt: {
              toDate: () => d,
              seconds: Math.floor(d.getTime() / 1000)
            }
          };
        }
        return entry;
      });
      setHistory(hydrated);
      updateAnalytics(hydrated);
    }
    setDeleteConfirmId(null);
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

  // Music Therapy Handlers
  const stopAllAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    if (oscillatorRef.current) {
      try {
        oscillatorRef.current.stop();
      } catch (_) {}
      oscillatorRef.current = null;
    }
    setIsPlaying(false);
    setActiveTrack(null);
    setYoutubeId(null);
    setFrequencyActive(null);
  };

  const playCuratedTrack = (url: string, trackName: string) => {
    stopAllAudio();
    setActiveTrack(trackName);
    if (audioRef.current) {
      audioRef.current.src = url;
      audioRef.current.volume = frequencyVolume;
      audioRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch(err => {
        console.error("Calming audio playback failed:", err);
      });
    }
  };

  const toggleOscillator = (freqHz: number) => {
    if (frequencyActive === freqHz) {
      stopAllAudio();
      return;
    }

    stopAllAudio();
    setFrequencyActive(freqHz);
    setActiveTrack(`${freqHz} Hz Solfeggio`);

    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") {
        ctx.resume();
      }

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freqHz, ctx.currentTime);
      gain.gain.setValueAtTime(frequencyVolume, ctx.currentTime);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      oscillatorRef.current = osc;
      gainNodeRef.current = gain;
    } catch (err) {
      console.error("Oscillator start failed:", err);
    }
  };

  const handleLoadCustomSong = () => {
    if (!customTrackUrl.trim()) return;
    stopAllAudio();

    const ytRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = customTrackUrl.match(ytRegex);
    if (match && match[1]) {
      setYoutubeId(match[1]);
      setActiveTrack("YouTube Custom Song");
    } else {
      setActiveTrack("Custom Direct Audio Link");
      if (audioRef.current) {
        audioRef.current.src = customTrackUrl;
        audioRef.current.volume = frequencyVolume;
        audioRef.current.play().then(() => {
          setIsPlaying(true);
        }).catch(err => {
          console.error("Direct audio load failed:", err);
        });
      }
    }
  };

  const togglePlayPause = () => {
    if (frequencyActive) {
      toggleOscillator(frequencyActive);
      return;
    }
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play().then(() => {
          setIsPlaying(true);
        }).catch(err => console.error(err));
      }
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseFloat(e.target.value);
    setFrequencyVolume(vol);
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.setValueAtTime(vol, audioCtxRef.current?.currentTime || 0);
    }
    if (audioRef.current) {
      audioRef.current.volume = vol;
    }
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

  // Support Chat Message Send Handler
  const handleSendChatMessage = async () => {
    if (!chatInput.trim()) return;

    const userMsg = { role: "user", content: chatInput };
    const updatedMessages = [...chatMessages, userMsg];
    setChatMessages(updatedMessages);
    setChatInput("");
    setChatLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: updatedMessages })
      });
      const data = await res.json();
      if (data.reply) {
        setChatMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
      }
    } catch (err) {
      console.error("Chat error:", err);
    } finally {
      setChatLoading(false);
    }
  };

  // Word & Character count helpers
  const charCount = entryText.length;
  const wordCount = entryText.trim() === "" ? 0 : entryText.trim().split(/\s+/).length;

  // Crisis detection
  const hasCrisisKeywordsTyping = () => {
    const crisisKeywords = ["die", "kill myself", "suicide", "end my life", "i want to die", "i wanna die", "harm myself", "self-harm", "self harm", "cutting myself"];
    const lowerText = entryText.toLowerCase();
    return crisisKeywords.some(keyword => lowerText.includes(keyword));
  };

  const showCrisisHelpline = hasCrisisKeywordsTyping() || smartAlert || (detectedMood === "CRISIS");

  // Time based greeting
  const getGreeting = () => {
    const hr = new Date().getHours();
    if (hr < 12) return "Good morning";
    if (hr < 17) return "Good afternoon";
    if (hr < 21) return "Good evening";
    return "Good night";
  };

  // Compute Today's Mood
  const todaysMoodInfo = (() => {
    if (!history || history.length === 0) {
      return { label: "No entry today", emoji: "📝", count: 0, colorClass: "bg-slate-500/10 border-slate-500/20 text-slate-600 dark:text-slate-400" };
    }

    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const todayEnd = todayStart + 24 * 60 * 60 * 1000;

    const todayEntries = history.filter((entry) => {
      if (!entry.createdAt) return false;
      const d = typeof entry.createdAt.toDate === "function" ? entry.createdAt.toDate() : new Date(entry.createdAt);
      const t = d.getTime();
      return t >= todayStart && t < todayEnd;
    });

    if (todayEntries.length === 0) {
      return { label: "No entry today", emoji: "📝", count: 0, colorClass: "bg-slate-500/10 border-slate-500/20 text-slate-600 dark:text-slate-400" };
    }

    let totalScore = 0;
    let crisisCount = 0;
    todayEntries.forEach((entry) => {
      const mood = (entry.mood || "").toLowerCase();
      if (mood.includes("positive")) totalScore += 2;
      else if (mood.includes("neutral")) totalScore += 1;
      else if (mood.includes("negative")) totalScore += -1;
      else if (mood.includes("crisis")) {
        totalScore += -2;
        crisisCount++;
      }
    });

    const avgScore = totalScore / todayEntries.length;
    let label = "Neutral";
    let emoji = "😐";
    let colorClass = "bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400";

    if (crisisCount >= 1 || avgScore < -1.5) {
      label = "CRISIS ALERT";
      emoji = "🚨";
      colorClass = "bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400 animate-pulse";
    } else if (avgScore >= 1.5) {
      label = "Positive";
      emoji = "😊";
      colorClass = "bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-400";
    } else if (avgScore >= 0.5) {
      label = "Neutral";
      emoji = "😐";
      colorClass = "bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400";
    } else {
      label = "Negative";
      emoji = "😔";
      colorClass = "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400";
    }

    return { label, emoji, count: todayEntries.length, colorClass };
  })();

  // Filtering and Searching entries
  const filteredHistory = history.filter((item) => {
    const matchesSearch = item.text?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = selectedMoodFilter === "All" || item.mood?.toUpperCase() === selectedMoodFilter.toUpperCase();
    return matchesSearch && matchesFilter;
  });

  // Calculate mood counts for Mood Analytics widget
  const getMoodCounts = () => {
    let positive = 0;
    let neutral = 0;
    let negative = 0;

    history.forEach((e) => {
      const mood = (e.mood || "").toLowerCase();
      if (mood.includes("positive")) positive++;
      else if (mood.includes("neutral")) neutral++;
      else if (mood.includes("negative") || mood.includes("crisis")) negative++;
    });

    return { positive, neutral, negative };
  };

  const counts = getMoodCounts();
  const totalCounts = counts.positive + counts.neutral + counts.negative || 1;

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-tr from-purple-100 via-indigo-50 to-pink-100 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950 font-sans">
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 rounded-full border-4 border-purple-500/20 border-t-purple-600 animate-spin mb-4"></div>
          <p className="text-purple-600 dark:text-purple-300 font-medium">Opening dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-tr from-purple-50 via-slate-50 to-pink-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 text-slate-800 dark:text-slate-100 transition-colors duration-500 pb-12 font-sans">
      
      {/* Top Navbar */}
      <nav className="sticky top-0 z-30 w-full bg-white/60 dark:bg-slate-900/60 backdrop-blur-md border-b border-purple-100/50 dark:border-slate-800/50 px-6 py-4 shadow-sm font-sans">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">💜</span>
            <span className="font-extrabold text-xl bg-gradient-to-r from-purple-700 to-pink-600 dark:from-purple-300 dark:to-pink-400 bg-clip-text text-transparent select-none">
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
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
                </svg>
              ) : (
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

      <div className="max-w-7xl mx-auto px-6 mt-8 font-sans">
        
        {/* Smart Alert / "Want to Talk" Yellow Banner */}
        {smartAlert && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#fef9c3] dark:bg-yellow-950/20 border border-[#fef08a] dark:border-yellow-900/50 p-5 rounded-3xl mb-8 animate-fade-in font-sans">
            <div className="text-sm font-bold text-amber-800 dark:text-amber-400">
              🧡 We noticed this week has been emotionally heavy.
            </div>
            <button
              onClick={() => setShowChat(true)}
              className="px-6 py-2 bg-[#9333ea] hover:bg-[#7e22ce] text-white rounded-xl font-bold text-xs shadow-sm transition"
            >
              Want to talk?
            </button>
          </div>
        )}

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

          <div className="flex flex-wrap items-center gap-4">
            {/* Today's Mood Badge */}
            <div className={`flex items-center gap-3 border px-5 py-3 rounded-2xl shadow-sm ${todaysMoodInfo.colorClass}`}>
              <span className="text-3xl">{todaysMoodInfo.emoji}</span>
              <div>
                <div className="text-base font-black">
                  {todaysMoodInfo.label === "No entry today" ? "No Entry Today" : `${todaysMoodInfo.label}`}
                </div>
                <div className="text-[10px] uppercase tracking-wider font-extrabold opacity-80">
                  {todaysMoodInfo.count === 0 ? "Write your first entry" : `Based on ${todaysMoodInfo.count} ${todaysMoodInfo.count === 1 ? 'entry' : 'entries'}`}
                </div>
              </div>
            </div>

            {/* Streak Badge */}
            <div className="flex items-center gap-3 bg-gradient-to-r from-orange-500/10 to-amber-500/10 border border-orange-500/20 px-5 py-3 rounded-2xl animate-pulse">
              <span className="text-3xl">🔥</span>
              <div>
                <div className="text-lg font-black text-orange-600 dark:text-orange-400">{streak} Day Streak</div>
                <div className="text-[10px] uppercase tracking-wider font-extrabold text-orange-500/80">Reflecting daily</div>
              </div>
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
                    <span>Save & Analyze Entry</span>
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

                {lastSavedText && (
                  <div className="bg-slate-50/50 dark:bg-slate-950/20 border-l-4 border-slate-400 dark:border-slate-700 p-4 rounded-xl">
                    <div className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Your Saved Entry</div>
                    <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed font-medium whitespace-pre-wrap">
                      {lastSavedText}
                    </p>
                  </div>
                )}

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
                  </div>
                )}
              </div>
            )}

            {/* Healing Music Therapy Card */}
            <div className="bg-white/70 dark:bg-slate-900/70 border border-white/20 dark:border-slate-800/40 p-6 rounded-3xl shadow-xl space-y-5">
              <div className="flex items-center justify-between border-b border-purple-100 dark:border-slate-800 pb-3">
                <h2 className="font-extrabold text-purple-950 dark:text-white text-lg flex items-center gap-2">
                  <span>🎵</span> Healing Music Therapy
                </h2>
                <span className="text-xs bg-purple-500/10 text-purple-600 dark:text-purple-400 px-2.5 py-0.5 rounded-full font-bold">Ambient & Freqs</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Solfeggio Binaural Healing Frequencies */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Solfeggio Healing Frequencies</h3>
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => toggleOscillator(432)}
                      className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center justify-between ${
                        frequencyActive === 432
                          ? "bg-purple-600 text-white shadow-md shadow-purple-500/10"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                      }`}
                    >
                      <span>432 Hz - Cosmic Resonance</span>
                      {frequencyActive === 432 ? <span>⏸️ Active</span> : <span>▶️ Play</span>}
                    </button>
                    <button
                      onClick={() => toggleOscillator(528)}
                      className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center justify-between ${
                        frequencyActive === 528
                          ? "bg-purple-600 text-white shadow-md shadow-purple-500/10"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                      }`}
                    >
                      <span>528 Hz - Inner Peace / DNA Repair</span>
                      {frequencyActive === 528 ? <span>⏸️ Active</span> : <span>▶️ Play</span>}
                    </button>
                  </div>
                </div>

                {/* Ambient Nature Sounds */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Curated Ambient Nature</h3>
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => playCuratedTrack("https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3", "Ocean Waves Relaxation")}
                      className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center justify-between ${
                        activeTrack === "Ocean Waves Relaxation" && isPlaying
                          ? "bg-purple-600 text-white shadow-md shadow-purple-500/10"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                      }`}
                    >
                      <span>🌊 Ocean Waves</span>
                      {activeTrack === "Ocean Waves Relaxation" && isPlaying ? <span>⏸️ Playing</span> : <span>▶️ Play</span>}
                    </button>
                    <button
                      onClick={() => playCuratedTrack("https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3", "Calming Forest Ambient")}
                      className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center justify-between ${
                        activeTrack === "Calming Forest Ambient" && isPlaying
                          ? "bg-purple-600 text-white shadow-md shadow-purple-500/10"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                      }`}
                    >
                      <span>🎹 Calming Piano</span>
                      {activeTrack === "Calming Forest Ambient" && isPlaying ? <span>⏸️ Playing</span> : <span>▶️ Play</span>}
                    </button>
                  </div>
                </div>
              </div>

              {/* Custom Track Loader (Song of Choice) */}
              <div className="border-t border-purple-100 dark:border-slate-800 pt-4 space-y-3">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Play a Song of Your Choice</h3>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={customTrackUrl}
                    onChange={(e) => setCustomTrackUrl(e.target.value)}
                    placeholder="Paste YouTube Link or direct MP3 Audio URL..."
                    className="flex-1 px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs outline-none focus:ring-1 focus:ring-purple-500 text-slate-800 dark:text-white"
                  />
                  <button
                    onClick={handleLoadCustomSong}
                    className="px-6 py-2 bg-[#9333ea] hover:bg-[#7e22ce] text-white rounded-xl font-bold text-xs transition"
                  >
                    Load & Play
                  </button>
                </div>
              </div>

              {/* Interactive Player controls */}
              {(activeTrack || youtubeId) && (
                <div className="bg-slate-50 dark:bg-slate-950/40 p-4 rounded-2xl flex flex-col items-center gap-3 animate-fade-in">
                  <div className="text-xs font-bold text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
                    <span className="animate-bounce">🎵</span> Currently Active: <span className="text-slate-700 dark:text-slate-300">{activeTrack || "YouTube Embed"}</span>
                  </div>

                  {youtubeId ? (
                    <div className="w-full aspect-video rounded-xl overflow-hidden shadow-md">
                      <iframe
                        src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1`}
                        title="YouTube healing music"
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                        className="w-full h-full"
                      />
                    </div>
                  ) : (
                    <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div className="flex gap-2">
                        <button
                          onClick={togglePlayPause}
                          className="px-4 py-2 bg-[#9333ea] hover:bg-[#7e22ce] text-white rounded-lg text-xs font-bold"
                        >
                          {isPlaying ? "Pause" : "Play"}
                        </button>
                        <button
                          onClick={stopAllAudio}
                          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold"
                        >
                          Stop
                        </button>
                      </div>

                      {/* Volume Slider */}
                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <span className="text-[10px] font-bold text-slate-400">Vol</span>
                        <input
                          type="range"
                          min="0"
                          max="0.5"
                          step="0.01"
                          value={frequencyVolume}
                          onChange={handleVolumeChange}
                          className="w-full sm:w-28 accent-purple-600 cursor-pointer h-1 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Hidden Audio Element */}
              <audio ref={audioRef} onEnded={() => setIsPlaying(false)} className="hidden" />
            </div>

            {/* History Feed */}
            <div className="bg-white/70 dark:bg-slate-900/70 border border-white/20 dark:border-slate-800/40 p-6 rounded-3xl shadow-xl space-y-6 font-sans">
              
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
                      className="w-full pl-9 pr-4 py-2 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs outline-none focus:ring-2 focus:ring-purple-500/20 dark:focus:ring-purple-400/20 font-medium text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500"
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

                          {/* Delete Action */}
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

            {/* Weekly Mood Chart Card with Insight */}
            <div className="bg-white/70 dark:bg-slate-900/70 border border-white/20 dark:border-slate-800/40 p-6 rounded-3xl shadow-xl space-y-4">
              <h3 className="font-extrabold text-purple-950 dark:text-white text-base flex items-center gap-2 border-b border-purple-100 dark:border-slate-800 pb-2">
                <span>📊</span> Weekly Mood Trend
              </h3>

              {/* Weekly Emotional Insight Box matching Image 2 */}
              {weeklySummary && (
                <div className="bg-[#f0f7ff] dark:bg-blue-950/20 p-5 rounded-2xl border border-blue-100 dark:border-slate-800/40 text-blue-800 dark:text-blue-300 space-y-2">
                  <h3 className="text-sm font-black flex items-center gap-1">
                    <span>🧠</span> Weekly Emotional Insight
                  </h3>
                  <p className="text-xs font-bold leading-relaxed">{weeklySummary}</p>
                </div>
              )}

              {/* Recharts Curve Line Chart matching Image 2 */}
              {mounted && weeklyData.length > 0 ? (
                <div className="w-full h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={weeklyData} margin={{ top: 10, right: 10, left: -25, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:hidden" />
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" className="hidden dark:block" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fontWeight: "bold" }} stroke="#94a3b8" />
                      <YAxis domain={[-2, 2]} ticks={[-2, -1, 0, 1, 2]} tick={{ fontSize: 10, fontWeight: "bold" }} stroke="#94a3b8" />
                      <Line
                        type="monotone"
                        dataKey="score"
                        stroke="#7c3aed"
                        strokeWidth={3}
                        dot={{ r: 4, stroke: "#7c3aed", strokeWidth: 2, fill: "#fff" }}
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
            </div>

            {/* Mood Analytics Card matching Image 4 */}
            <div className="bg-white/70 dark:bg-slate-900/70 border border-white/20 dark:border-slate-800/40 p-6 rounded-3xl shadow-xl space-y-4">
              <h3 className="text-sm font-black text-[#7c3aed] dark:text-[#a78bfa] flex items-center gap-1.5 border-b border-purple-100 dark:border-slate-800 pb-2">
                <span>📊</span> Mood Analytics
              </h3>
              
              <div className="space-y-4">
                {/* Positive Row */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-bold text-slate-400">
                    <span>positive</span>
                    <span>{counts.positive}</span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2">
                    <div
                      className="bg-[#10b981] h-2 rounded-full transition-all duration-500"
                      style={{ width: `${(counts.positive / totalCounts) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Neutral Row */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-bold text-slate-400">
                    <span>neutral</span>
                    <span>{counts.neutral}</span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2">
                    <div
                      className="bg-[#6b7280] h-2 rounded-full transition-all duration-500"
                      style={{ width: `${(counts.neutral / totalCounts) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Negative Row */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-bold text-slate-400">
                    <span>negative</span>
                    <span>{counts.negative}</span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2">
                    <div
                      className="bg-[#ef4444] h-2 rounded-full transition-all duration-500"
                      style={{ width: `${(counts.negative / totalCounts) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Crisis Alert Card matching Image 5 */}
            {showCrisisHelpline && (
              <div className="bg-[#fee2e2] dark:bg-red-950/20 border-2 border-red-500 p-6 rounded-3xl shadow-xl space-y-4 animate-pulse">
                <h3 className="font-black text-red-700 dark:text-red-400 text-base flex items-center gap-2 border-b border-red-500/20 pb-2">
                  <span>⚠️</span> Crisis Detected
                </h3>
                <p className="text-xs text-red-700 dark:text-red-300 font-bold leading-relaxed">
                  You are not alone. Please reach out for support.
                </p>
                <div className="bg-white/80 dark:bg-slate-900/80 border border-red-200/50 p-4 rounded-2xl text-center space-y-1">
                  <div className="text-[10px] font-black text-red-500 uppercase tracking-widest">24/7 Helpline Support</div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white">
                    ☎️ Kiran Helpline: 1800-599-0019
                  </div>
                </div>
                
                {/* Breathing Trigger in Crisis Card */}
                <button
                  onClick={() => setBreathingActive(!breathingActive)}
                  className="w-full py-2.5 bg-[#3b82f6] hover:bg-[#2563eb] text-white rounded-lg font-bold text-xs transition"
                >
                  {breathingActive ? `Breathing (${breathing.phase} ${breathing.seconds}s) 🧘` : "Start 1-Minute Breathing 🧘"}
                </button>

                <p className="text-xs font-bold text-[#2563eb] dark:text-[#60a5fa] text-center transition duration-500">
                  {breathingActive ? (
                    <span className="animate-pulse">{breathing.phase === "Inhale" ? "Inhale deeply..." : breathing.phase === "Hold In" ? "Hold..." : "Exhale slowly..."}</span>
                  ) : (
                    "Inhale 4s -> Hold 4s -> Exhale 4s 🌿"
                  )}
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

      {/* Floating Compassionate Support Chat Modal */}
      {showChat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white dark:bg-[#222a36] w-full max-w-[400px] rounded-2xl shadow-xl flex flex-col h-[500px] border border-slate-100 dark:border-slate-800">
            
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-800/80 flex justify-between items-center bg-purple-50 dark:bg-purple-950/20 rounded-t-2xl">
              <h3 className="font-extrabold text-sm text-[#7c3aed] dark:text-[#a78bfa] flex items-center gap-1.5">
                <span>💜</span> Compassionate Support
              </h3>
              <button
                onClick={() => setShowChat(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white font-black text-sm"
              >
                ✕
              </button>
            </div>

            {/* Message Feed */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3.5 bg-slate-50/50 dark:bg-[#171d26]/20">
              {chatMessages.map((msg, index) => (
                <div
                  key={index}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-xs font-semibold leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-[#9333ea] text-white rounded-br-none'
                        : 'bg-white dark:bg-[#222a36] border border-slate-100 dark:border-slate-800/80 text-slate-800 dark:text-slate-200 rounded-bl-none shadow-sm'
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex justify-start">
                  <div className="bg-white dark:bg-[#222a36] border border-slate-100 dark:border-slate-800/80 rounded-2xl rounded-bl-none px-4 py-2.5 text-xs font-bold text-slate-400 italic">
                    typing...
                  </div>
                </div>
              )}
            </div>

            {/* Chat Input */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800/80 flex gap-2">
              <input
                type="text"
                placeholder="Type your message..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSendChatMessage();
                }}
                disabled={chatLoading}
                className="flex-1 px-4 py-2 bg-slate-50 dark:bg-[#171d26] border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-1 focus:ring-purple-500 text-xs font-semibold text-slate-800 dark:text-white"
              />
              <button
                onClick={handleSendChatMessage}
                disabled={chatLoading || !chatInput.trim()}
                className="px-4 py-2 bg-[#9333ea] hover:bg-[#7e22ce] text-white rounded-xl font-bold text-xs transition"
              >
                Send
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}