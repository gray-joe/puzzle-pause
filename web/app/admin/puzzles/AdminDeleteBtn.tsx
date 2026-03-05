"use client";

import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

export default function AdminDeleteBtn({ puzzleId }: { puzzleId: number }) {
  const router = useRouter();

  async function handleDelete() {
    if (!confirm("Delete this puzzle?")) return;
    try {
      await api.admin.deletePuzzle(puzzleId);
      router.refresh();
    } catch (err: any) {
      alert(err.message ?? "Failed to delete");
    }
  }

  return (
    <button
      onClick={handleDelete}
      style={{ background: "transparent", border: "none", color: "var(--error)", cursor: "pointer", fontFamily: "inherit", fontSize: "inherit", padding: 0 }}
    >
      delete
    </button>
  );
}
