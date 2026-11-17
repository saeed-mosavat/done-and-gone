'use client';

// THROWAWAY: selected canvas direction. Blue, board-first layout with drag-to-trash.
import { useEffect, useRef, useState, type PointerEvent } from 'react';

type Card = { id: string; title: string; description: string; column: string };
type Column = { id: string; name: string };
type Draft = { id?: string; title: string; description: string; column: string };
const startingColumns = [{ id: 'todo', name: 'Todo' }, { id: 'doing', name: 'Doing' }, { id: 'done', name: 'Done' }];
const samples: Card[] = [
  { id: '1', column: 'todo', title: 'Make room for what matters', description: 'A little less noise. A little more progress. Start with one small thing.' },
  { id: '2', column: 'todo', title: 'Collect ideas for the weekend', description: 'The bookshop, a long walk, and absolutely no meetings.' },
  { id: '3', column: 'todo', title: 'بررسی طراحی Doneward', description: 'نسخه جدید UI را بررسی کنیم و بازخورد بدهیم.\nCheck the layout on mobile, too.' },
  { id: '4', column: 'doing', title: 'Build something worth finishing', description: 'Keep the first version small. Make the important things feel effortless.' },
  { id: '5', column: 'doing', title: 'Find a quieter workflow', description: 'No accounts. No setup. Just a place to think and move forward.' },
  { id: '6', column: 'done', title: 'Take the first step', description: 'You don’t need a perfect plan to begin.' },
];

export function BoardPrototype() {
  const [columns, setColumns] = useState(startingColumns);
  const [cards, setCards] = useState(samples);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [dark, setDark] = useState(false);
  const [drag, setDrag] = useState<{ id: string; x: number; y: number; overTrash: boolean; overColumn?: string } | null>(null);
  const gesture = useRef<{ id: string; x: number; y: number; active: boolean } | null>(null);
  const suppressClick = useRef(false);
  useEffect(() => { setDark(window.matchMedia('(prefers-color-scheme: dark)').matches); }, []);

  function newCard(column: string) { setDraft({ title: '', description: '', column }); }
  function addColumn() {
    const name = window.prompt('Column name');
    if (name?.trim()) setColumns([...columns, { id: crypto.randomUUID(), name: name.trim() }]);
  }
  function removeCard(id: string) {
    const card = cards.find(c => c.id === id);
    if (window.confirm(`Delete “${card?.title ?? 'this card'}”?`)) { setCards(cards.filter(c => c.id !== id)); setDraft(null); }
  }
  function save() {
    if (!draft?.title.trim()) return;
    const card = { ...draft, id: draft.id ?? crypto.randomUUID(), title: draft.title.trim() };
    setCards(draft.id ? cards.map(c => c.id === draft.id ? card : c) : [...cards, card]);
    setDraft(null);
  }
  function startDrag(event: PointerEvent<HTMLButtonElement>, id: string) {
    if (event.button !== 0) return;
    suppressClick.current = false;
    gesture.current = { id, x: event.clientX, y: event.clientY, active: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function moveDrag(event: PointerEvent<HTMLButtonElement>) {
    const current = gesture.current;
    if (!current) return;
    if (!current.active && Math.hypot(event.clientX - current.x, event.clientY - current.y) < 7) return;
    current.active = true;
    suppressClick.current = true;
    const target = document.elementFromPoint(event.clientX, event.clientY);
    setDrag({ id: current.id, x: event.clientX, y: event.clientY, overTrash: !!target?.closest('[data-trash]'), overColumn: target?.closest<HTMLElement>('[data-column]')?.dataset.column });
  }
  function endDrag(event: PointerEvent<HTMLButtonElement>) {
    const current = gesture.current;
    gesture.current = null;
    setDrag(null);
    if (!current?.active) return;
    const target = document.elementFromPoint(event.clientX, event.clientY);
    if (target?.closest('[data-trash]')) { removeCard(current.id); return; }
    const column = target?.closest<HTMLElement>('[data-column]')?.dataset.column;
    const before = target?.closest<HTMLElement>('[data-card]')?.dataset.card;
    if (column && before !== current.id) {
      setCards(previous => {
        const moving = previous.find(c => c.id === current.id)!;
        const rest = previous.filter(c => c.id !== current.id);
        const index = before ? rest.findIndex(c => c.id === before) : -1;
        rest.splice(index < 0 ? rest.length : index, 0, { ...moving, column });
        return rest;
      });
    }
  }
  function cardView(card: Card) {
    return <button key={card.id} data-card={card.id} className={`task ${drag?.id === card.id ? 'dragging' : ''} ${card.column === 'done' ? 'completed' : ''}`}
      onPointerDown={e => startDrag(e, card.id)} onPointerMove={moveDrag} onPointerUp={endDrag}
      onPointerCancel={() => { gesture.current = null; setDrag(null); }}
      onLostPointerCapture={() => { gesture.current = null; setDrag(null); }}
      onClick={() => { if (!suppressClick.current) setDraft({ ...card }); suppressClick.current = false; }}>
      <span className="task-title" dir="auto">{card.title}</span>
      {card.description && <span className="task-description">{card.description}</span>}
    </button>;
  }

  return <div className={`prototype ${dark ? 'dark' : ''}`}>
    <header className="topbar">
      <a className="brand" href="/prototype/board"><span className="brand-mark">d<span>↗</span></span>doneward<span className="brand-period">.</span></a>
      <div className="toolbar"><button title="Toggle theme" aria-label="Toggle theme" onClick={() => setDark(!dark)}>{dark ? '☀' : '☾'}</button></div>
    </header>
    <main>
      <div className="canvas-board">{columns.map((column, index) => <section key={column.id} data-column={column.id} className={`canvas-column ${drag?.overColumn === column.id ? 'drop-column' : ''}`}><div className="column-header"><ColumnTitle column={column} count={cards.filter(c => c.column === column.id).length} index={index} /><button aria-label={`Add card to ${column.name}`} onClick={() => newCard(column.id)}>＋</button></div><div className="card-stack">{cards.filter(c => c.column === column.id).map(cardView)}<button className="add-card" onClick={() => newCard(column.id)}>＋ Add a card</button></div></section>)}<button className="add-column" onClick={addColumn}>＋<span>Add column</span></button></div>
      <details className="state-panel"><summary>Prototype state</summary><p>Throwaway design. Changes reset on reload. Drag cards to move, reorder, or delete.</p><pre>{JSON.stringify({ columns, cards }, null, 2)}</pre></details>
    </main>
    {drag && <><div className="drag-preview" style={{ left: drag.x, top: drag.y }} dir="auto">{cards.find(c => c.id === drag.id)?.title}</div><div data-trash className={`trash-target ${drag.overTrash ? 'trash-active' : ''}`}><svg width="27" height="27" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" /></svg><span>{drag.overTrash ? 'Release to delete' : 'Drop here to delete'}</span></div></>}
    {draft && <div className="modal-scrim" onClick={() => setDraft(null)}><section role="dialog" aria-modal="true" aria-labelledby="dialog-title" className="editor" onClick={e => e.stopPropagation()}>
      <div className="editor-top"><h2 id="dialog-title">{draft.id ? 'Edit card' : 'New card'}</h2><button aria-label="Close dialog" onClick={() => setDraft(null)}>✕</button></div>
      <label>Title<input autoFocus dir="auto" maxLength={200} placeholder="What’s on your mind?" value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} /></label>
      <label>Description<textarea dir="auto" maxLength={20000} placeholder="Give it a little context…" value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} /></label>
      {draft.id && <label>Column<select value={draft.column} onChange={e => setDraft({ ...draft, column: e.target.value })}>{columns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}
      <div className="editor-bottom">{draft.id && <button className="danger" onClick={() => removeCard(draft.id!)}>Delete card</button>}<div><button onClick={() => setDraft(null)}>Cancel</button><button className="primary" disabled={!draft.title.trim()} onClick={save}>Save card</button></div></div>
    </section></div>}
  </div>;
}

function ColumnTitle({ column, count, index }: { column: Column; count: number; index: number }) {
  return <div className="column-title"><span className={`column-dot dot-${index % 3}`} /><h2 dir="auto">{column.name}</h2><span className="count">{count}</span></div>;
}
