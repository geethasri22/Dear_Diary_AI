"use client";

import { useState } from "react";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase"; // ✅ use auth directly

export default function Signup() {
  const router = useRouter();

  const [name, setName] = useState("");       // 🔹 Added name state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSignup = async () => {
    const res = await createUserWithEmailAndPassword(auth, email, password);

    // 🔹 Save name to Firebase Auth displayName
    await updateProfile(res.user, {
      displayName: name,
    });

    router.push("/welcome");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-purple-100">
      <div className="bg-white p-6 rounded-xl shadow-lg w-80 space-y-4">
        <h1 className="text-xl font-bold text-center text-purple-700">
          Sign Up
        </h1>

        {/* 🔹 Name input field */}
        <input
          className="w-full border p-2 rounded text-black"
          placeholder="Your Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <input
          className="w-full border p-2 rounded"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          type="password"
          className="w-full border p-2 rounded"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button
          className="w-full bg-purple-600 text-white p-2 rounded"
          onClick={handleSignup}
        >
          Create Account
        </button>
      </div>
    </div>
  );
}