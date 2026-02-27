"use client";

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

  // Wait until Firebase finishes checking login state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-purple-100">
        <p className="text-purple-600 font-semibold">Loading...</p>
      </div>
    );
  }

  // If not logged in, redirect to login page
  if (!user) {
    router.replace("/login");
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-purple-100">
      <div className="bg-white p-8 rounded-2xl shadow-xl text-center space-y-4">
        <h1 className="text-3xl font-bold text-purple-700">
          Welcome {user.displayName || user.email?.split("@")[0]} 💜
        </h1>

        <p className="text-gray-600">
          Your safe space is ready ✨
        </p>

        <button
          onClick={() => router.push("/")}
          className="bg-purple-600 text-white px-6 py-2 rounded-lg"
        >
          Go to Diary
        </button>
      </div>
    </div>
  );
}