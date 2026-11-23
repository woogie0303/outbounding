'use client';
import {useRef, useState} from 'react';
import {DndContext, DragOverlay, PointerSensor, useDraggable, useSensor, useSensors} from '@dnd-kit/core';
import './week-timeline.css';

export const minutes = time => {
  const [hours, mins] = time.split(':').map(Number);
  return hours * 60 + mins;
};
export const clock = mins => [Math.floor(mins / 60), mins % 60].map(n => String(n).padStart(2, '0')).join(':');
const lengthOf = item => Math.min(item.duration || 30, 1440 - minutes(item.time));
const hourHeight = 76;

// A connected group shares its peak number of columns. Adjacent intervals can reuse a lane.
export function pack(items) {
  const sorted = [...items].sort((a,b) => a.time.localeCompare(b.time) || lengthOf(b) - lengthOf(a) || String(a.id).localeCompare(String(b.id)));
  let group = [], ends = [], end = -1;
  const result = [];
  function flush() {
    for (const row of group) result.push({...row, columns: ends.length});
    group = []; ends = [];
  }
  for (const item of sorted) {
    const start = minutes(item.time);
    if (start >= end) { flush(); end = -1; }
    let lane = ends.findIndex(value => value <= start);
    if (lane < 0) lane = ends.length;
    ends[lane] = start + lengthOf(item);
    end = Math.max(end, ends[lane]);
    group.push({item, lane});
  }
  flush();
  return result;
}

function EventCard({row, first, name, onOpen, preview, landed, onLand}) {
  const {item,lane,columns} = row;
  const drag = useDraggable({id:item.id});
  const color = [...String(item.company)].reduce((n,c) => n + c.charCodeAt(0),0) % 4;
  return <button ref={drag.setNodeRef} {...drag.attributes} {...drag.listeners}
    className="timeline-event" data-tone={color} data-done={item.done} data-preview={preview} data-landed={landed} onAnimationEnd={landed ? onLand : undefined}
    title={name + ' · ' + item.time + '–' + clock(minutes(item.time)+lengthOf(item))}
    style={{top:(minutes(item.time)-first*60)*hourHeight/60,height:Math.max(2,lengthOf(item)*hourHeight/60-2),
      left:'calc('+lane/columns*100+'% + 2px)',width:'calc('+100/columns+'% - 4px)'}}
    onClick={()=>onOpen(item)}>
    <strong>{name}</strong><small>{item.time}–{clock(minutes(item.time)+lengthOf(item))}</small>
  </button>;
}

export default function WeekTimeline({dates,items,today,name,onSlot,onDay,onOpen,onMove}) {
  const body = useRef(null);
  const [active,setActive] = useState(null), [target,setTarget] = useState(null);
  const [landed,setLanded] = useState(null);
  const sensors = useSensors(useSensor(PointerSensor,{activationConstraint:{distance:5}}));
  const first = Math.min(8,...items.map(item=>Math.floor(minutes(item.time)/60)));
  const last = Math.max(20,...items.map(item=>Math.ceil((minutes(item.time)+lengthOf(item))/60)));
  const hours = Array.from({length:last-first},(_,i)=>first+i);
  const displayed = active && target ? items.map(item=>item.id===active.id?{...item,...target}:item) : items;
  function destination(event) {
    const rect = body.current.getBoundingClientRect();
    const box = event.active.rect.current.translated;
    const item = items.find(it=>it.id===event.active.id);
    if (!box || !item) return null;
    const x = box.left + box.width/2 - rect.left, y = box.top - rect.top;
    if (x<0 || x>=rect.width || y < -hourHeight/4 || y>=rect.height) return null;
    const start = Math.max(first*60,Math.min(last*60-lengthOf(item),first*60+Math.round(y/hourHeight*4)*15));
    return {date:dates[Math.floor(x/rect.width*7)],time:clock(start)};
  }
  function reset(){setActive(null);setTarget(null);}
  // Keep the draggable mounted in its original column. Render its landing slot independently.
  return <DndContext sensors={sensors} onDragStart={e=>{setLanded(null);setActive(items.find(i=>i.id===e.active.id));}}
    onDragMove={e=>setTarget(destination(e))} onDragCancel={reset}
    onDragEnd={e=>{const dest=destination(e);if(dest){onMove(e.active.id,dest);setLanded(e.active.id);}reset();}}>
    <div className="timeline-scroll"><div className="timeline-sheet">
      <div className="timeline-heading"><span>시간</span>{dates.map((date,i)=><button key={date} data-today={today===date} onClick={()=>onDay(date)}>{'월화수목금토일'[i]} <b>{Number(date.slice(-2))}</b></button>)}</div>
      <div className="timeline-main"><div className="timeline-hours">{hours.map(h=><small key={h}>{clock(h*60)}</small>)}</div>
      <div ref={body} className="timeline-days">{dates.map(date=>{
        const rows = pack(displayed.filter(it=>it.date===date));
        const landing = rows.find(row=>row.item.id===active?.id);
        const staticRows = rows.filter(row=>row.item.id!==active?.id);
        if(active?.date===date) {
          staticRows.push(pack(items.filter(item=>item.date===date)).find(row=>row.item.id===active.id));
        }
        return <div className="timeline-day" key={date}>
          {hours.map(h=><button className="timeline-slot" key={h} aria-label={date+' '+h+'시 일정 추가'} onClick={e=>{
            const offset=e.detail?e.clientY-e.currentTarget.getBoundingClientRect().top:0;
            onSlot(date,clock(h*60+15*Math.min(3,Math.max(0,Math.floor(offset/hourHeight*4)))));
          }}/>)}
          {staticRows.map(row=><EventCard key={row.item.id} row={row} first={first} name={name(row.item)}
            onOpen={onOpen} landed={landed===row.item.id} onLand={()=>setLanded(null)} preview={active?.id===row.item.id}/>)}
          {target && landing && <div className="timeline-target" style={{
            top:(minutes(landing.item.time)-first*60)*hourHeight/60,
            height:lengthOf(landing.item)*hourHeight/60-2,
            left:landing.lane/landing.columns*100+'%',width:100/landing.columns+'%'
          }}/>}

        </div>;
      })}</div></div>
    </div></div>
    <DragOverlay dropAnimation={null}>{active && <div className="timeline-lift"><strong>{name(active)}</strong><small>{target?.date.slice(5)} {target?.time || active.time}</small></div>}</DragOverlay>
  </DndContext>;
}
