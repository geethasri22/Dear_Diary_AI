"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";

export default function Welcome() {
  const [user, setUser] = useState<any>(null);
  const [checking, setChecking] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setChecking(false);
    });

    return () => unsubscribe();
  }, []);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Loading...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Not logged in
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-purple-100">
      <div className="bg-white p-8 rounded-2xl shadow-xl text-center space-y-4">
        <h1 className="text-3xl font-bold text-purple-700">
          Welcome {user.displayName || user.email.split("@")[0]} 💜
        </h1>

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