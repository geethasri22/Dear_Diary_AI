"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { db } from "@/lib/firebase";
import {
  addDoc,
  collection,
  getDocs,
  query,
  where,
  deleteDoc,
  doc
} from "firebase/firestore";
import { signOut, onAuthStateChanged, User } from "firebase/auth";
import { useRouter } from "next/navigation";

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [entry, setEntry] = useState("");
  const [entries, setEntries] = useState<any[]>([]);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.push("/login");
      } else {
        setUser(currentUser);
        fetchEntries(currentUser.uid);
      }
    });

    return () => unsubscribe();
  }, []);

  const fetchEntries = async (uid: string) => {
    const q = query(collection(db, "diary"), where("uid", "==", uid));
    const snapshot = await getDocs(q);
    const data = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    setEntries(data);
  };

  const handleSave = async () => {
    if (!entry.trim() || !user) return;

    await addDoc(collection(db, "diary"), {
      text: entry,
      uid: user.uid,
      createdAt: new Date()
    });

    setEntry("");
    fetchEntries(user.uid);
  };

  const handleDelete = async (id: string) => {
    await deleteDoc(doc(db, "diary", id));
    if (user) fetchEntries(user.uid);
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  return (
    <div className="min-h-screen p-6 bg-purple-100">
      <div className="max-w-xl mx-auto bg-white p-6 rounded-xl shadow-md space-y-4">
        <h1 className="text-xl font-bold text-center">
          Welcome {user?.email}
        </h1>

        <textarea
          value={entry}
          onChange={(e) => setEntry(e.target.value)}
          placeholder="Write your thoughts..."
          className="w-full border p-2 rounded"
        />

        <button
          onClick={handleSave}
          className="w-full bg-purple-600 text-white p-2 rounded"
        >
          Save Entry
        </button>

        <div className="space-y-3">
          {entries.map((item) => (
            <div key={item.id} className="p-3 border rounded bg-gray-50">
              <p>{item.text}</p>
              <button
                onClick={() => handleDelete(item.id)}
                className="text-red-500 text-sm mt-2"
              >
                Delete
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={handleLogout}
          className="w-full bg-gray-500 text-white p-2 rounded mt-4"
        >
          Logout
        </button>
      </div>
    </div>
  );
}