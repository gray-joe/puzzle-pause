"use client";

import { useState } from "react";
import { DndContext, closestCenter, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Puzzle } from "@/lib/api";

interface Props { puzzle: Puzzle; solved: boolean; onSubmit: (g: string) => void; loading: boolean; }

interface OrderData { prompt: string; items: string[] }

function SortableItem({ id, label }: { id: string; label: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`drag-item${isDragging ? " dragging" : ""}`}
      {...attributes}
      {...listeners}
    >
      <span className="gt">&gt;</span>{"  "}{label}
    </div>
  );
}

export default function OrderPuzzle({ puzzle, solved, onSubmit, loading }: Props) {
  const data: OrderData = JSON.parse(puzzle.question);
  const [order, setOrder] = useState(() => data.items.map((_, i) => String(i)));

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
        <SortableContext items={order} strategy={verticalListSortingStrategy}>
          {order.map((id) => (
            <SortableItem key={id} id={id} label={data.items[Number(id)]} />
          ))}
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
