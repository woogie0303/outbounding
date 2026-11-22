'use client';
import {useEffect, useState} from 'react';
import {DndContext, PointerSensor, KeyboardSensor, useSensor, useSensors, useDroppable, closestCorners} from '@dnd-kit/core';
import {SortableContext, useSortable, sortableKeyboardCoordinates, verticalListSortingStrategy} from '@dnd-kit/sortable';
import {CSS} from '@dnd-kit/utilities';
import {GripVertical, MapPin, Phone} from 'lucide-react';
const stages = ['미접촉','접촉 중','상담 진행','제안·협의','계약 완료','종료'];
function Card({row, note, open}) {
  const {attributes,listeners,setNodeRef,transform,transition,isDragging} = useSortable({id:row.id});
  return <article ref={setNodeRef} className="account-card" style={{transform:CSS.Transform.toString(transform),transition,opacity:isDragging?.4:1}}>
    <button className="card-drag-handle" {...attributes} {...listeners} aria-label={row.name+' 이동'}><GripVertical size={15}/></button>
    <button className="board-company" onClick={() => open(row)}>{row.name}</button>
    <span className="board-industry">{row.industry}</span>
    <p><MapPin size={13}/>{row.city || row.region}</p><p><Phone size={13}/>{row.phone || '대표전화 미확인'}</p>
    {note && <p className="board-note">{note}</p>}
  </article>;
}
function Column({stage,rows,saved,open}) {
  const {setNodeRef,isOver}=useDroppable({id:stage});
  return <section ref={setNodeRef} className="board-column" data-over={isOver}><h3><span className="stage-dot"/>{stage}<span className="stage-count">{rows.length}</span></h3>
    <SortableContext items={rows.map(row=>row.id)} strategy={verticalListSortingStrategy}><div className="board-cards">{rows.map(row=><Card key={row.id} row={row} note={saved[row.id]?.note} open={open}/>)}</div></SortableContext>
  </section>;
}
export default function AccountBoard({rows,saved,open,onError}) {
  const [layout,setLayout]=useState({});
  const sensors=useSensors(useSensor(PointerSensor,{activationConstraint:{distance:6}}),useSensor(KeyboardSensor,{coordinateGetter:sortableKeyboardCoordinates}));
  useEffect(()=>{try{const current=JSON.parse(localStorage.getItem('outbounding.board') || 'null');if(current){setLayout(current);return;}const old=JSON.parse(localStorage.getItem('outbounding.stages') || '{}');setLayout(Object.fromEntries(stages.map(stage=>[stage, Object.keys(old).filter(id=>({'통화 완료':'접촉 중','후속 연락':'접촉 중','관심 없음':'종료'}[old[id]] || old[id])===stage)])));}catch{onError('거래처 정렬을 불러오지 못했습니다.');}},[]);
  const groups=Object.fromEntries(stages.map(stage=>[stage,rows.filter(row=>{
    const assigned=stages.find(value=>(layout[value] || []).includes(row.id)) || stages[0];return assigned===stage;
  }).sort((a,b)=>(layout[stage] || []).indexOf(a.id)-(layout[stage] || []).indexOf(b.id))]));
  function drop({active,over}) {
    if(!over || active.id===over.id)return;
    const target=stages.includes(over.id)?over.id:stages.find(stage=>groups[stage].some(row=>row.id===over.id));
    if(!target)return;
    const next=Object.fromEntries(stages.map(stage=>[stage,[...(layout[stage] || []),...groups[stage].map(row=>row.id).filter(id=>!(layout[stage] || []).includes(id))].filter(id=>id!==active.id)]));
    const index=next[target].indexOf(over.id);
    next[target].splice(index<0?next[target].length:index,0,active.id);
    try{localStorage.setItem('outbounding.board',JSON.stringify(next));setLayout(next);}catch{onError('정렬을 저장하지 못했습니다.');}
  }
  return <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={drop}><div className="account-board">{stages.map(stage=><Column key={stage} stage={stage} rows={groups[stage]} saved={saved} open={open}/>)}</div></DndContext>;
}
