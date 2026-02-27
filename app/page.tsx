'use client'

import { useState, useEffect } from "react";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  addDoc,
  collection,
  serverTimestamp,
  query,
  where,
  orderBy,
  getDocs
} from "firebase/firestore";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "firebase/auth";
import { updateProfile } from "firebase/auth";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

const firebaseConfig = {
  apiKey: "AIzaSyC-DeN0kPonjC3LSwMPAvgy-KzaH3AN-qQ",
  authDomain: "deardiaryapp-3c86c.firebaseapp.com",
  projectId: "deardiaryapp-3c86c",
  storageBucket: "deardiaryapp-3c86c.firebasestorage.app",
  messagingSenderId: "138714408969",
  appId: "1:138714408969:web:f4a220f880978389dcb0d8"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export default function Home() {

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [user, setUser] = useState<any>(null);
  const [entry, setEntry] = useState("");
  const [mood, setMood] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [streak, setStreak] = useState(0);
  const [dark, setDark] = useState(false);
  const [analytics, setAnalytics] = useState({
    positive: 0,
    neutral: 0,
    negative: 0,
  });
  const [weeklyData, setWeeklyData] = useState<any[]>([]);
  const [therapyMode, setTherapyMode] = useState(false);
const [supportReply, setSupportReply] = useState("");
const [breathing, setBreathing] = useState(false); 
const [weeklySummary, setWeeklySummary] = useState("");
const [smartAlert, setSmartAlert] = useState(false);



// Auth listener
// Optional: force logout
useEffect(() => {
  auth.signOut();
}, []);

// Auth listener
useEffect(() => {
  const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
    setUser(currentUser);
    if (currentUser) loadHistory();
  });

  return () => unsubscribe();
}, []);
useEffect(() => {
  if (!history.length) return;

  const { positive, negative } = analytics;

  const crisisCount = history.filter(
    (entry) => entry.mood === "CRISIS"
  ).length;

  // Condition 1: More negative than positive
  const negativeTrend = negative > positive;

  // Condition 2: 2+ crisis entries
  const crisisPattern = crisisCount >= 2;

  // Condition 3: Streak broken after 5+
  const streakBreak = streak === 0 && history.length >= 5;

  if (negativeTrend || crisisPattern || streakBreak) {
    setSmartAlert(true);
  } else {
    setSmartAlert(false);
  }

}, [history, analytics, streak]);
{streak > 0 && (
  <div className="text-center mt-3">
    <p className="text-orange-500 font-bold text-lg">
      🔥 {streak} Day Streak!
    </p>
  </div>
)}
<div className={dark ? "bg-gray-900 text-white" : "bg-purple-100"}></div>
  const encouragement: Record<string, string> = {
    LABEL_0: "I'm really sorry you're feeling this way. You are not alone 💛",
    LABEL_1: "It's okay to feel neutral. Take a deep breath 🌿",
    LABEL_2: "That's wonderful to hear! Keep shining ✨",
  };
  

  // 🔥 STREAK CALCULATOR
  const calculateStreak = (entries: any[]) => {
    if (!entries.length) return 0;

    const dates = entries
      .map((entry) => entry.createdAt?.toDate())
      .filter(Boolean)
      .map((d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()));

    const uniqueDates = [...new Set(dates.map(d => d.getTime()))]
      .map(t => new Date(t))
      .sort((a, b) => b.getTime() - a.getTime());

    let count = 0;
    const today = new Date();
    today.setHours(0,0,0,0);

    for (let i = 0; i < uniqueDates.length; i++) {
      const expected = new Date(today);
      expected.setDate(today.getDate() - i);

      if (uniqueDates[i].getTime() === expected.getTime()) count++;
      else break;
    }

    return count;
  };
  const generateWeeklySummary = (entries: any[]) => {
  if (entries.length < 5) {
    setWeeklySummary("");
    return;
  }

  const { positive, neutral, negative } = calculateAnalytics(entries);

  let summary = "";

  if (negative > positive) {
    summary =
      "This week felt emotionally heavy. But recognizing your feelings shows strength. You're building resilience 💛";
  } 
  else if (positive > negative) {
    summary =
      "You had a positive emotional trend this week. Keep nurturing what’s working 🌟";
  } 
  else {
    summary =
      "Your week was emotionally balanced. Take time to reflect and recharge 🌿";
  }

  setWeeklySummary(summary);
};

  // 📊 ANALYTICS
  const calculateAnalytics = (entries: any[]) => {
    let positive = 0;
    let neutral = 0;
    let negative = 0;

    entries.forEach(entry => {
      const mood = entry.mood?.toLowerCase() || "";
      if (mood.includes("positive")) positive++;
      else if (mood.includes("neutral")) neutral++;
      else if (mood.includes("negative")) negative++;
    });

    return { positive, neutral, negative };
  };

  // 📈 WEEKLY TREND (AVERAGE BASED)
  const getWeeklyTrend = (entries: any[]) => {
    const days: any[] = [];

    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0,0,0,0);

      days.push({
        date: date.toLocaleDateString("en-IN", { weekday: "short" }),
        total: 0,
        count: 0,
        score: 0,
      });
    }

    entries.forEach(entry => {
      if (!entry.createdAt) return;

      const entryDate = entry.createdAt.toDate();
      entryDate.setHours(0,0,0,0);

      days.forEach((day, index) => {
        const compareDate = new Date();
        compareDate.setDate(compareDate.getDate() - (6 - index));
        compareDate.setHours(0,0,0,0);

        if (entryDate.getTime() === compareDate.getTime()) {
          const mood = entry.mood?.toLowerCase() || "";

          let moodScore = 0;
          if (mood.includes("positive")) moodScore = 2;
          else if (mood.includes("neutral")) moodScore = 1;
          else if (mood.includes("negative")) moodScore = -1;

          day.total += moodScore;
          day.count += 1;
        }
      });
    });

    days.forEach(day => {
      day.score = day.count ? day.total / day.count : 0;
    });

    return days;
  };

  // 🔥 LOAD HISTORY
  const loadHistory = async () => {
  if (!user) return;

  const q = query(
    collection(db, "entries"),
    where("userId", "==", user.uid),
    orderBy("createdAt", "desc")
  );

  const snapshot = await getDocs(q);
  const entriesData: any[] = [];

  snapshot.forEach(doc => {
    entriesData.push({ id: doc.id, ...doc.data() });
  });

  setHistory(entriesData);
  setStreak(calculateStreak(entriesData));
  setAnalytics(calculateAnalytics(entriesData));
  setWeeklyData(getWeeklyTrend(entriesData)); // 🔥 ADD THIS
  generateWeeklySummary(entriesData);
};

  const handleSignup = async () => {
    const res = await createUserWithEmailAndPassword(auth, email, password);
    setUser(res.user);
  };

  const handleLogin = async () => {
    const res = await signInWithEmailAndPassword(auth, email, password);
    setUser(res.user);
  };

  const handleLogout = async () => {
    await signOut(auth);
    setUser(null);
  };
// 🚨 CRISIS DETECTION
const detectCrisis = (text: string) => {
  const crisisKeywords = [
    "die",
    "kill myself",
    "suicide",
    "end my life",
    "i want to die",
    "i wanna die",
    "i don't want to live",
    "no reason to live"
  ];

  const lowerText = text.toLowerCase();
  return crisisKeywords.some(keyword =>
    lowerText.includes(keyword)
  );
};
  const analyzeMood = async () => {
  if (!entry.trim()) return;
  setLoading(true);
  try {

    // 🚨 Crisis Override FIRST
    if (detectCrisis(entry)) {
      setMood("CRISIS");

      await addDoc(collection(db, "entries"), {
        userId: user?.uid,
        text: entry,
        mood: "CRISIS",
        createdAt: serverTimestamp(),
      });

      await loadHistory();
      setEntry("");
      setLoading(false);
      return;
    }

    // 🧠 Normal AI Mood Detection
    const res = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: entry }),
    });

    const data = await res.json();

    if (Array.isArray(data) && data[0]) {
      let detectedMood = data[0][0].label;

if (detectedMood === "LABEL_0") detectedMood = "Negative";
if (detectedMood === "LABEL_1") detectedMood = "Neutral";
if (detectedMood === "LABEL_2") detectedMood = "Positive";
<p className="text-center text-blue-500">
  Debug Mood: {detectedMood}
</p>

setMood(detectedMood);
      setMood(detectedMood);

      await addDoc(collection(db, "entries"), {
        userId: user?.uid,
        text: entry,
        mood: detectedMood,
        createdAt: serverTimestamp(),
      });

      await loadHistory();
      setEntry("");
    }

  } catch (error) {
    console.error(error);
    setMood("ERROR");
  }

  setLoading(false);
};

  return (
    <div
  className={`min-h-screen flex items-center justify-center p-4 transition-all duration-300 ${
    dark ? "bg-gray-900 text-white" : "bg-purple-100 text-black"
  }`}
>
      <div
  className={`shadow-xl rounded-2xl p-6 w-full max-w-md space-y-4 transition-all duration-300 ${
    dark ? "bg-gray-800 text-white" : "bg-white text-black"
  }`}
>

        <h1 className="text-2xl font-bold text-center text-purple-700">
          Dear Diary 💜
        </h1>
         <button
          onClick={() => setDark(!dark)}
          className="w-full bg-gray-500 text-white p-2 rounded mt-3"
        >
          Toggle {dark ? "Light" : "Dark"} Mode
        </button>


        {!user ? (
          <>
            <input className="w-full border p-2 rounded"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)} />

            <input type="password"
              className="w-full border p-2 rounded"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)} />

            <div className="flex gap-2">
              <button className="w-full bg-purple-500 text-white p-2 rounded" onClick={handleLogin}>
                Login
              </button>
              <button className="w-full bg-pink-500 text-white p-2 rounded" onClick={handleSignup}>
                Sign Up
                
              </button>
            </div>
          </>
        ) : (
          <>
            <textarea
              className="w-full border p-2 rounded min-h-[120px] text-black"
              placeholder="Write your feelings here..."
              value={entry}
              onChange={(e) => setEntry(e.target.value)}
            />

            <button
              className="w-full bg-purple-600 text-white p-2 rounded"
              onClick={analyzeMood}
              disabled={loading}
            >
              {loading ? "Analyzing..." : "Analyze Mood"}
            </button>

            {mood && (
              <p className="text-center font-semibold text-purple-700">
                Detected Mood: {mood}
              </p>
            )}
{/* Encouragement Message */}
{mood && mood !== "CRISIS" && (
  <div className="text-center mt-3">

    {(mood === "LABEL_2" || mood.toLowerCase().includes("positive")) && (
      <p className="text-green-600 font-medium">
        Keep shining! You're doing amazing 🌟
      </p>
    )}

    {(mood === "LABEL_0" || mood.toLowerCase().includes("negative")) && (
      <p className="text-red-500 font-medium">
        I'm here for you. Things will get better 💛
      </p>
    )}

    {(mood === "LABEL_1" || mood.toLowerCase().includes("neutral")) && (
      <p className="text-gray-500 font-medium">
        Every day is a new opportunity 🌿
      </p>
    )}

  </div>
)}
{mood === "CRISIS" && (
  <div className="mt-4 p-4 bg-red-100 border border-red-400 rounded-xl shadow-sm text-center animate-fade-in">
    <h2 className="text-red-700 font-bold text-lg">
      ⚠️ Crisis Detected
    </h2>

    <p className="mt-2 text-red-600">
      You are not alone. Please reach out for support.
    </p>

    <p className="mt-2 font-semibold text-red-700">
      ☎ Kiran Helpline: 1800-599-0019 (24/7)
    </p>

    <button
      onClick={() => setBreathing(true)}
      className="mt-3 bg-blue-500 text-white px-4 py-2 rounded-lg"
    >
      Start 1-Minute Breathing 🧘
    </button>
  </div>
)}
      {breathing && (
  <div className="mt-3 text-center">
    <p className="text-blue-600 font-semibold">
      Inhale 4s → Hold 4s → Exhale 4s 🌿
    </p>
  </div>
)}      
{smartAlert && (
  <div className="mt-4 p-3 bg-yellow-100 border border-yellow-400 rounded-lg text-center animate-fade-in">
    <p className="text-yellow-700 font-semibold">
      💛 We noticed this week has been emotionally heavy.
    </p>
    <button
      onClick={() => setTherapyMode(true)}
     className="w-full bg-purple-600 text-white p-2 rounded-lg hover:bg-purple-700 transition"
    >
      Want to talk?
    </button>
  </div>
)}
            {streak > 0 && (
              <p className="text-center text-orange-500 font-bold text-lg">
                🔥 {streak} Day Streak!
              </p>
            )}

            {/* 📊 Analytics */}
            {history.length > 0 && (
              <div className="p-4 bg-purple-50 rounded-lg">
                <h2 className="text-center font-semibold text-purple-700 mb-3">
                  📊 Mood Analytics
                </h2>

                {["positive","neutral","negative"].map(type => {
                  const value = analytics[type as keyof typeof analytics];
                  
                  return (
                    <div key={type} className="mb-2">
                      <div className="flex justify-between text-sm">
                        <span>{type}</span>
                        <span>{value}</span>
                      </div>
                      <div className="bg-gray-200 h-3 rounded-full">
                        <div
                          className={`h-3 rounded-full ${
                            type === "positive"
                              ? "bg-green-500"
                              : type === "neutral"
                              ? "bg-gray-500"
                              : "bg-red-500"
                          }`}
                          style={{
                            width: `${history.length ? (value/history.length)*100 : 0}%`
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 📈 Weekly Graph */}
            {weeklyData.length > 0 && (
              <div className="mt-4 p-4 bg-purple-50 rounded-lg">
                <h2 className="text-center font-semibold text-purple-700 mb-3">
                  📈 Weekly Mood Trend
                </h2>
                 <ResponsiveContainer width="100%" height={200}>
      <LineChart data={weeklyData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" />
        <YAxis domain={[-2, 2]} />
        <Tooltip />
        <Line
          type="monotone"
          dataKey="score"
          stroke="#7c3aed"
          strokeWidth={3}
        />
      </LineChart>
    </ResponsiveContainer>
  </div>
)}
                {weeklySummary && (
  <div className="mt-4 p-4 bg-blue-50 rounded-lg shadow-sm text-center">
    <h3 className="font-semibold text-blue-700">
      🧠 Weekly Emotional Insight
    </h3>
    <p className="mt-2 text-blue-600">
      {weeklySummary}
    </p>
  </div>
)}
<div>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={weeklyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis domain={[-2, 2]} />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="score"
                      stroke="#7c3aed"
                      strokeWidth={3}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            

            <button
              className="w-full bg-purple-600 text-white p-2 rounded-lg hover:bg-purple-700 transition"
              onClick={handleLogout}
            >
              Logout
            </button>
          </>
        )}
      </div>
    </div>
  );
}