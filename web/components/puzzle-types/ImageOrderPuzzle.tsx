"use client";

import { useState } from "react";
import { DndContext, closestCenter, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Puzzle } from "@/lib/api";

interface Props { puzzle: Puzzle; solved: boolean; onSubmit: (g: string) => void; loading: boolean; }
interface ImageOrderData { prompt: string; images: string[] }

function SortableImage({ id, src }: { id: string; src: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.7 : 1,
        cursor: "grab",
        border: `2px solid ${isDragging ? "var(--teal)" : "var(--border)"}`,
        borderRadius: 8,
        overflow: "hidden",
      }}
      {...attributes}
      {...listeners}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" style={{ width: "100%", display: "block" }} />
    </div>
  );
}

export default function ImageOrderPuzzle({ puzzle, solved, onSubmit, loading }: Props) {
  const data: ImageOrderData = JSON.parse(puzzle.question);
  const [order, setOrder] = useState(() => data.images.map((_, i) => String(i)));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setOrder((prev) => {
        const oldIdx = prev.indexOf(String(active.id));
        const newIdx = prev.indexOf(String(over.id));
        return arrayMove(prev, oldIdx, newIdx);
      });
    }
  }

  function handleSubmit() {
    onSubmit(order.join(","));
  }

  return (
    <>
      <div className="content-meta" data-testid="puzzle-question">{data.prompt}</div>
      <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={order} strategy={rectSortingStrategy}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8, margin: "12px 0" }}>
            {order.map((id) => (
              <SortableImage key={id} id={id} src={data.images[Number(id)]} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      {!solved && (
        <button className="action-btn" onClick={handleSubmit} disabled={loading} style={{ marginTop: 8 }} data-testid="submit-btn">
          <span className="gt">&gt;</span>{loading ? "Checking..." : "Submit Order"}
        </button>
      )}
    </>
  );
}
