"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, AdminPuzzle } from "@/lib/api";

const PUZZLE_TYPES = ["word", "math", "ladder", "choice", "wordsearch", "order", "match", "connections", "image-tap", "image-order", "image-word", "numgrid", "scrabble", "word-wheel"];

const QUESTION_HINTS: Record<string, string> = {
  word: "Plain text or HTML. e.g. What word means...?",
  math: "Plain text or HTML. e.g. If 2+2=5, what is 3+3?",
  ladder: "word1, ____, word3, ____, word5",
  choice: "prompt|option1|option2|option3|option4",
  order: '{"prompt":"Put these in order:","items":["Item A","Item B","Item C"]}',
  match: '{"prompt":"Match these:","left":["A","B"],"right":["1","2"]}',
  connections: '{"prompt":"Find the groups:","items":["a","b","c","d"],"groups":[...]}',
  "image-tap": '{"prompt":"Tap the target","image_url":"https://...","target":{"x":0.5,"y":0.5,"radius":0.1}}',
  "image-order": '{"prompt":"Order these images:","images":["url1","url2"]}',
  "image-word": '{"prompt":"What is shown in this image?","image_url":"https://..."}',
  numgrid: '{"prompt":"What number is missing?","grid":[1,2,null,4,5,6,7,8,9,10,11,12,13,14,15,16]}',
  scrabble: '{"prompt":"What is the highest score possible? e.g. mask 10","board":[null,null,null,"M",null,null,null,null],"modifiers":[null,null,null,"dw",null,null,null,null],"rack":["C","O","R","H","A","S","K"]}',
  "word-wheel": '{"prompt":"Find the 8-letter word in each wheel","wheels":[{"letters":["S","T",null,"R","L","I",null,"G"]},{"letters":[null,"L","I","M",null,"I","N","G"]}]}',
};

interface Props { puzzle?: AdminPuzzle }

export default function PuzzleForm({ puzzle }: Props) {
  const router = useRouter();
  const isNew = !puzzle;

  const [form, setForm] = useState({
    puzzle_date: puzzle?.puzzle_date ?? "",
    puzzle_type: puzzle?.puzzle_type ?? "word",
    puzzle_name: puzzle?.puzzle_name ?? "",
    question: puzzle?.question ?? "",
    answer: puzzle?.answer ?? "",
    hint: puzzle?.hint ?? "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const data = { ...form, hint: form.hint || undefined };
      if (isNew) {
        await api.admin.createPuzzle(data);
      } else {
        await api.admin.updatePuzzle(puzzle.id, data);
      }
      router.push("/admin/puzzles");
      router.refresh();
    } catch (err: any) {
      setError(err.message ?? "Failed to save");
    } finally { setLoading(false); }
  }

  const fieldStyle = { width: "100%", marginBottom: 12 };
  const labelStyle = { color: "var(--muted)", display: "block", marginBottom: 4 };

  return (
    <form onSubmit={handleSubmit}>
      <div style={fieldStyle}>
        <label style={labelStyle}><span className="gt">&gt;</span> Date (YYYY-MM-DD)</label>
        <input type="date" value={form.puzzle_date} onChange={(e) => set("puzzle_date", e.target.value)} required style={{ width: "100%" }} />
      </div>

      <div style={fieldStyle}>
        <label style={labelStyle}><span className="gt">&gt;</span> Type</label>
        <select value={form.puzzle_type} onChange={(e) => set("puzzle_type", e.target.value)} style={{ width: "100%" }}>
          {PUZZLE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      <div style={fieldStyle}>
        <label style={labelStyle}><span className="gt">&gt;</span> Name</label>
        <input type="text" value={form.puzzle_name} onChange={(e) => set("puzzle_name", e.target.value)} placeholder="Puzzle display name" style={{ width: "100%" }} />
      </div>

      <div style={fieldStyle}>
        <label style={labelStyle}><span className="gt">&gt;</span> Question</label>
        <textarea value={form.question} onChange={(e) => set("question", e.target.value)} required rows={4} style={{ width: "100%", resize: "vertical" }} placeholder={QUESTION_HINTS[form.puzzle_type] ?? ""} />
      </div>

      <div style={fieldStyle}>
        <label style={labelStyle}><span className="gt">&gt;</span> Answer <span className="muted">(| for alternatives, ~ prefix for unordered)</span></label>
        <input type="text" value={form.answer} onChange={(e) => set("answer", e.target.value)} required style={{ width: "100%" }} />
      </div>

      <div style={fieldStyle}>
        <label style={labelStyle}><span className="gt">&gt;</span> Hint <span className="muted">(optional)</span></label>
        <input type="text" value={form.hint} onChange={(e) => set("hint", e.target.value)} style={{ width: "100%" }} />
      </div>

      {error && <div className="error" style={{ marginBottom: 12 }}>{error}</div>}

      <button type="submit" className="action-btn" disabled={loading}>
        <span className="gt">&gt;</span>{loading ? "Saving..." : isNew ? "Create Puzzle" : "Save Changes"}
      </button>
    </form>
  );
}
