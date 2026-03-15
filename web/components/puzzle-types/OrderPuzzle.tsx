"use client";

import { useState } from "react";
import { DndContext, closestCenter, DragEndEvent, PointerSensor, TouchSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Puzzle } from "@/lib/api";
import { parseQuestion } from "./parseQuestion";

interface Props { puzzle: Puzzle; solved: boolean; onSubmit: (g: string) => void; loading: boolean; }

interface OrderData { prompt: string; items: string[] }

function SortableItem({ id, label, isFirst, isLast, onMoveUp, onMoveDown, solved }: {
  id: string; label: string; isFirst: boolean; isLast: boolean;
  onMoveUp: () => void; onMoveDown: () => void; solved: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, display: "flex", alignItems: "center", gap: 8 }}
      className={`drag-item${isDragging ? " dragging" : ""}`}
    >
      <span style={{ flex: 1, cursor: "grab", touchAction: "none" }} {...attributes} {...listeners}>
        <span className="gt">&gt;</span>{"  "}{label}
      </span>
      {!solved && (
        <span style={{ display: "flex", flexDirection: "column", gap: 2, flexShrink: 0 }}>
          <button
            type="button"
            onClick={onMoveUp}
            disabled={isFirst}
            style={{ background: "none", border: "1px solid var(--border)", borderRadius: 4, padding: "2px 8px", cursor: isFirst ? "default" : "pointer", opacity: isFirst ? 0.3 : 1, color: "var(--fg)" }}
            aria-label="Move up"
          >▲</button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={isLast}
            style={{ background: "none", border: "1px solid var(--border)", borderRadius: 4, padding: "2px 8px", cursor: isLast ? "default" : "pointer", opacity: isLast ? 0.3 : 1, color: "var(--fg)" }}
            aria-label="Move down"
          >▼</button>
        </span>
      )}
    </div>
  );
}

export default function OrderPuzzle({ puzzle, solved, onSubmit, loading }: Props) {
  const data = parseQuestion<OrderData>(puzzle.question);
  const [order, setOrder] = useState(() => data?.items.map((_, i) => String(i)) ?? []);

  const pointerSensor = useSensor(PointerSensor, { activationConstraint: { distance: 5 } });
  const touchSensor = useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } });
  const sensors = useSensors(pointerSensor, touchSensor);

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

  function move(index: number, direction: -1 | 1) {
    setOrder((prev) => arrayMove(prev, index, index + direction));
  }

  function handleSubmit() {
    onSubmit(order.join(","));
  }

  if (!data) return <div className="error" data-testid="puzzle-question">Invalid puzzle data.</div>;

  return (
    <>
      <div className="content-meta" data-testid="puzzle-question">{data.prompt}</div>
      <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd} sensors={sensors}>
        <SortableContext items={order} strategy={verticalListSortingStrategy}>
          {order.map((id, idx) => (
            <SortableItem
              key={id}
              id={id}
              label={data.items[Number(id)]}
              isFirst={idx === 0}
              isLast={idx === order.length - 1}
              onMoveUp={() => move(idx, -1)}
              onMoveDown={() => move(idx, 1)}
              solved={solved}
            />
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
