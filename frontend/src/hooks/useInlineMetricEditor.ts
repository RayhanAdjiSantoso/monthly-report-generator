import { useState, type DragEvent } from 'react';

// Shared "click name to rename, click-and-hold to drag-reorder" interaction
// used directly on table rows/column headers (KpiTable, DemoBreakdownCard,
// MultiMetricTable) — no separate pill/list control. This hook only owns the
// ephemeral UI state (which id is being edited/dragged); the caller owns
// where the renamed label and the new order actually get stored.
export function useInlineMetricEditor({ onRename, onReorder }: { onRename: (id: string, newLabel: string) => void; onReorder: (fromId: string, toId: string) => void }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  function startEdit(id: string, currentLabel: string) {
    setEditingId(id);
    setEditingValue(currentLabel);
  }
  function commitEdit() {
    if (editingId && editingValue.trim()) onRename(editingId, editingValue.trim());
    setEditingId(null);
  }
  function cancelEdit() {
    setEditingId(null);
  }

  function dragHandlers(id: string) {
    return {
      draggable: editingId !== id,
      onDragStart: () => setDragId(id),
      onDragOver: (e: DragEvent) => {
        e.preventDefault();
        if (dragId !== null) setDragOverId(id);
      },
      onDragLeave: () => setDragOverId((prev) => (prev === id ? null : prev)),
      onDrop: (e: DragEvent) => {
        e.preventDefault();
        if (dragId !== null && dragId !== id) onReorder(dragId, id);
        setDragId(null);
        setDragOverId(null);
      },
      onDragEnd: () => {
        setDragId(null);
        setDragOverId(null);
      },
    };
  }

  function dragClass(id: string): string {
    let cls = '';
    if (dragId === id) cls += ' dragging';
    if (dragOverId === id && dragId !== null && dragId !== id) cls += ' drag-over';
    return cls;
  }

  return { editingId, editingValue, setEditingValue, startEdit, commitEdit, cancelEdit, dragHandlers, dragClass };
}

// Reorders `order` by moving `fromId` to sit right where `toId` was — shared
// splice logic for every caller's onReorder.
export function reorderIds(order: string[], fromId: string, toId: string): string[] {
  const from = order.indexOf(fromId);
  if (from === -1 || fromId === toId) return order;
  const next = [...order];
  next.splice(from, 1);
  const to = next.indexOf(toId);
  if (to === -1) return order;
  next.splice(to, 0, fromId);
  return next;
}
