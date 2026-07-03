'use client';

import { useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        router.replace("/dashboard");
      } else {
        router.replace("/login");
      }
    });

    return () => unsubscribe();
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-tr from-purple-100 via-indigo-50 to-pink-100 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950 transition-colors duration-500">
      <div className="relative flex flex-col items-center p-8 rounded-2xl bg-white/30 dark:bg-slate-900/30 backdrop-blur-xl border border-white/20 dark:border-slate-800/40 shadow-2xl animate-fade-in">
        <div className="relative w-16 h-16 mb-4">
          <div className="absolute inset-0 rounded-full border-4 border-purple-500/20 animate-pulse"></div>
          <div className="absolute inset-0 rounded-full border-4 border-t-purple-600 border-r-pink-500 animate-spin"></div>
        </div>
        <h2 className="text-xl font-semibold bg-gradient-to-r from-purple-600 to-pink-600 dark:from-purple-400 dark:to-pink-400 bg-clip-text text-transparent animate-pulse">
          Opening Dear Diary...
        </h2>
        <p className="text-xs text-purple-600/70 dark:text-purple-300/60 mt-1 font-medium">
          Creating your safe space
        </p>
      </div>
    </div>
  );
}