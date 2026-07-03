'use client';

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { useRouter } from "next/navigation";

export default function Welcome() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-tr from-purple-100 via-indigo-50 to-pink-100 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950">
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 rounded-full border-4 border-purple-500/20 border-t-purple-600 animate-spin mb-4"></div>
          <p className="text-purple-600 dark:text-purple-300 font-medium">Preparing onboarding...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    router.replace("/login");
    return null;
  }

  const displayName = user.displayName || user.email?.split("@")[0] || "Friend";

  const features = [
    {
      emoji: "✍️",
      title: "Private Journaling",
      desc: "Express your raw thoughts, feelings, and life events in a completely secure space."
    },
    {
      emoji: "🧠",
      title: "AI Mood Analytics",
      desc: "Instantly analyze your entry's mood and view weekly trends with responsive charts."
    },
    {
      emoji: "🧘",
      title: "Box Breathing Widget",
      desc: "Calm your mind and release stress using our interactive guided breathing tool."
    },
    {
      emoji: "🔥",
      title: "Streak Habit Tracker",
      desc: "Stay consistent and build a positive daily reflection routine with streak achievements."
    }
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-tr from-purple-100 via-indigo-50 to-pink-100 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950 p-4 transition-colors duration-500">
      <div className="w-full max-w-2xl bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border border-white/20 dark:border-slate-800/40 p-8 md:p-10 rounded-3xl shadow-2xl space-y-8 animate-fade-in">
        
        {/* Header Section */}
        <div className="text-center space-y-2">
          <span className="inline-block text-4xl animate-bounce">✨</span>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-purple-700 via-violet-600 to-pink-600 dark:from-purple-300 dark:via-violet-400 dark:to-pink-400 bg-clip-text text-transparent">
            Welcome, {displayName}!
          </h1>
          <p className="text-purple-950/70 dark:text-purple-200/70 font-semibold text-lg">
            Your safe space is ready 💜
          </p>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {features.map((feat, idx) => (
            <div 
              key={idx} 
              className="bg-white/60 dark:bg-slate-900/60 border border-purple-100/50 dark:border-slate-800/50 p-5 rounded-2xl shadow-sm hover:shadow-md hover:scale-[1.02] transition-all duration-300 flex items-start gap-4"
            >
              <div className="text-3xl p-2 rounded-xl bg-purple-100/50 dark:bg-purple-950/50 flex items-center justify-center shadow-inner">
                {feat.emoji}
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-purple-950 dark:text-white text-base">
                  {feat.title}
                </h3>
                <p className="text-xs text-purple-950/60 dark:text-purple-300/60 leading-relaxed font-medium">
                  {feat.desc}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Start Button */}
        <div className="text-center pt-2">
          <button
            onClick={() => router.push("/dashboard")}
            className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-2xl font-bold shadow-lg shadow-purple-500/20 hover:shadow-purple-600/30 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 mx-auto"
          >
            <span>Let's Get Started</span>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
            </svg>
          </button>
          <p className="text-xs text-purple-900/40 dark:text-purple-300/40 mt-3 font-medium">
            Your diary data is privately protected.
          </p>
        </div>

      </div>
    </div>
  );
}