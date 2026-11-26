'use client';
import {useEffect,useRef,useState} from 'react';
import {Button} from '../components/ui/button';
import {Input} from '../components/ui/input';
import {Checkbox} from '../components/ui/checkbox';
import WeekTimeline, {clock, minutes} from './WeekTimeline';
import {Calendar} from '../components/ui/calendar';
import {Popover,PopoverTrigger,PopoverContent} from '../components/ui/popover';
import {Select,SelectTrigger,SelectValue,SelectContent,SelectItem} from '../components/ui/select';
import {DndContext,DragOverlay,PointerSensor,pointerWithin,useDraggable,useDroppable,useSensor,useSensors} from '@dnd-kit/core';
import {ko} from 'react-day-picker/locale';
import {MapPin,ChevronLeft,ChevronRight,LocateFixed} from 'lucide-react';
const load = (key,fallback) => {try{return JSON.parse(localStorage.getItem(key)) ?? fallback;}catch{return fallback;}};
const dateKey = date => [date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
export function Nearby({db,open}) {
  const mapNode=useRef(null), map=useRef(null), markers=useRef(null);
  const [center,setCenter]=useState([37.5665,126.978]),[radius,setRadius]=useState(5),[query,setQuery]=useState(''),[error,setError]=useState(''),[mapReady,setMapReady]=useState(false);
  const [position,setPosition]=useState(null);
  const [companies,setCompanies]=useState([]);
  const [mapError,setMapError]=useState('');
  const [panel,setPanel]=useState(false);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      const latitudeSpan = radius / 110;
      const longitudeSpan = latitudeSpan / Math.max(0.01, Math.cos(center[0] * Math.PI / 180));
      const { data, error: requestError } = await db.from('company_locations')
        .select('latitude,longitude,companies!inner(*)')
        .gte('latitude', center[0] - latitudeSpan).lte('latitude', center[0] + latitudeSpan)
        .gte('longitude', center[1] - longitudeSpan).lte('longitude', center[1] + longitudeSpan)
        .or('data_month.is.null,and(snapshot_present.eq.true,pension_status.eq.1)', { referencedTable: 'companies' })
        .order('company_id').limit(500).abortSignal(controller.signal);
      if (controller.signal.aborted) return;
      setMapError(requestError ? '주변 업체를 불러오지 못했습니다.' : '');
      setCompanies((data ?? []).map(({latitude,longitude,companies:company}) => ({...company,latitude,longitude})));
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [db, center, radius]);
  const located=companies.filter(row=>Number.isFinite(Number(row.latitude)) && row.latitude != null && Number.isFinite(Number(row.longitude)) && row.longitude != null);
  const distance=row=>{const r=Math.PI/180;const a=Math.sin((Number(row.latitude)-center[0])*r/2)**2+Math.cos(center[0]*r)*Math.cos(Number(row.latitude)*r)*Math.sin((Number(row.longitude)-center[1])*r/2)**2;return 6371*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));};
  const rows=located.filter(row=>distance(row)<=radius && row.name.includes(query)).sort((a,b)=>distance(a)-distance(b));
  useEffect(()=>{let active=true;import('leaflet').then(L=>{if(!active)return;const instance=L.map(mapNode.current).setView(center,12);map.current=instance;L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap contributors',maxZoom:19}).addTo(instance);markers.current=L.layerGroup().addTo(instance);setMapReady(true);instance.on('moveend',()=>{const c=instance.getCenter();setCenter([c.lat,c.lng]);});});return()=>{active=false;map.current?.remove();map.current=null;};},[]);
  useEffect(()=>{if(!map.current || !markers.current)return;import('leaflet').then(L=>{if(!markers.current || !map.current)return;markers.current.clearLayers();if(position)L.circleMarker(position,{radius:9,color:'#fff',fillColor:'#2563eb',fillOpacity:1,weight:3}).addTo(markers.current).bindTooltip('내 위치');for(const row of rows)L.circleMarker([Number(row.latitude),Number(row.longitude)],{radius:7,color:'#fff',weight:2,fillColor:'#222',fillOpacity:1}).addTo(markers.current).bindTooltip(document.createTextNode(row.name).textContent.replaceAll('&','&amp;').replaceAll('<','&lt;')).on('click',()=>open(row));});},[center,radius,query,companies,mapReady,position]);
  function locate(){
    if (!navigator.geolocation) { setError('이 브라우저에서 현재 위치를 사용할 수 없습니다.'); return; }
    navigator.geolocation.getCurrentPosition(position=>{setPosition([position.coords.latitude,position.coords.longitude]);map.current?.setView([position.coords.latitude,position.coords.longitude],14);setError('');},()=>setError('위치 권한을 확인해 주세요. 지도를 이동해서도 검색할 수 있습니다.'));
  }
  return <section className="nearby-screen"><div className="screen-toolbar"><h1>주변 업체</h1><Input aria-label="주변 업체명 검색" placeholder="업체명 검색" value={query} onChange={e=>setQuery(e.target.value)}/><select aria-label="조회 반경" value={radius} onChange={e=>setRadius(Number(e.target.value))}>{[1,3,5,10,20].map(n=><option key={n} value={n}>{n}km</option>)}</select><Button variant="outline" onClick={locate}><LocateFixed size={14}/>현재 위치</Button></div>
    {(error || mapError) && <p role="status">{error || mapError}</p>}<div className="nearby-body map-first"><Button className="map-list-toggle" variant="outline" aria-label="주변 업체 목록" aria-expanded={panel} onClick={()=>setPanel(!panel)}><MapPin size={18}/></Button>{panel && <div className="nearby-list"><p className="muted">{rows.length}개 업체 · 지도 중심 기준</p>{rows.map(row=><button key={row.id} onClick={()=>{map.current?.panTo([row.latitude,row.longitude]);open(row);}}><strong>{row.name}</strong><span>{row.industry}</span><small>{row.city || row.region} · {distance(row).toFixed(1)}km</small></button>)}{!rows.length && <div className="screen-empty"><MapPin size={24}/><strong>주변에 표시할 업체가 없어요</strong><p>{located.length?'지도를 이동하거나 반경을 넓혀보세요.':'위치 좌표가 등록된 업체가 아직 없습니다.'}</p></div>}</div>}<div ref={mapNode} className="nearby-map" aria-label="주변 업체 지도"/></div></section>;
}
function CalendarSelect({label,options,...props}){
  return <Select {...props}>
    <SelectTrigger className="h-9" aria-label={label}><SelectValue placeholder={label}/></SelectTrigger>
    <SelectContent>{options.map(([value,text])=><SelectItem key={value} value={String(value)}>{text}</SelectItem>)}</SelectContent>
  </Select>;
}

function MonthEvent({item,name,onOpen}){
  const drag=useDraggable({id:item.id,data:{item}});
  return <button ref={drag.setNodeRef} {...drag.attributes} {...drag.listeners}
    className="calendar-month-event" data-done={item.done} data-dragging={drag.isDragging}
    onClick={event=>onOpen(event,item)}>{item.time} {name(item)}</button>;
}

function MonthDay({day,dayKey,outside,today,items,name,show}){
  const drop=useDroppable({id:dayKey});
  return <div ref={drop.setNodeRef} className="calendar-month-day" data-outside={outside} data-over={drop.isOver}>
    <button className="calendar-date-hit" aria-label={dayKey+' 일정 등록'} onClick={event=>show(dayKey,'09:00',event)}><b data-today={dayKey===today}>{day.getDate()}</b></button>
    {items.map(item=><MonthEvent key={item.id} item={item} name={name} onOpen={(event,value)=>show(dayKey,value.time,event,value)}/>)}
  </div>;
}

export function Schedule({saved}) {
  const [period,setPeriod]=useState('week');
  const [date,setDate]=useState(()=>new Date());
  const [items,setItems]=useState([]);
  const [popup,setPopup]=useState(null);
  const [message,setMessage]=useState('');
  const [dragged,setDragged]=useState(null);
  const [datePicker,setDatePicker]=useState(false);
  const monthSensors=useSensors(useSensor(PointerSensor,{activationConstraint:{distance:5}}));
  const lastSlide=useRef(0);
  const touchStart=useRef(null);
  useEffect(()=>setItems(load('outbounding.schedule',[])),[]);
  function update(next){
    try {
      localStorage.setItem('outbounding.schedule',JSON.stringify(next));
      setItems(next);
      setMessage('');
      return true;
    } catch {
      setMessage('일정을 저장하지 못했습니다.');
      return false;
    }
  }
  function step(amount){
    setPopup(null);
    setDate(current=>{
      const next=new Date(current);
      if(period==='month') return new Date(next.getFullYear(),next.getMonth()+amount,1);
      next.setDate(next.getDate()+amount*(period==='week'?7:1));
      return next;
    });
  }
  function slide(event){
    if(Math.abs(event.deltaX)<12 || Math.abs(event.deltaX)<=Math.abs(event.deltaY))return;
    if(event.currentTarget.scrollWidth>event.currentTarget.clientWidth){
      const {scrollLeft,scrollWidth,clientWidth}=event.currentTarget;
      if(event.deltaX<0?scrollLeft>1:scrollLeft+clientWidth<scrollWidth-1)return;
    }
    if(Date.now()-lastSlide.current<420)return;
    lastSlide.current=Date.now();
    step(Math.sign(event.deltaX));
  }
  function show(day,time,event,item=null){
    const bounds=event.currentTarget.getBoundingClientRect();
    const x=event.detail?event.clientX:bounds.right;
    const y=event.detail?event.clientY:bounds.top;
    setMessage('');
    setDatePicker(false);
    setPopup({day,time,item,x:Math.max(8,Math.min(x+10,window.innerWidth-316)),y:Math.max(8,Math.min(y+8,window.innerHeight-390))});
  }
  const first=period==='month'?new Date(date.getFullYear(),date.getMonth(),1):new Date(date);
  if(period!=='day')first.setDate(first.getDate()-(first.getDay()+6)%7);
  const days=Array.from({length:period==='month'?42:period==='week'?7:1},(_,index)=>{
    const day=new Date(first);
    day.setDate(day.getDate()+index);
    return day;
  });
  const keys=days.map(dateKey);
  const visible=items.filter(item=>keys.includes(item.date));
  const today=dateKey(new Date());
  const name=item=>saved[item.company]?.company.name || '삭제된 거래처';
  const editing=popup?.item;
  function submit(event){
    event.preventDefault();
    const data=new FormData(event.currentTarget);
    const time=data.get('time'),duration=Number(data.get('duration'));
    if(minutes(time)+duration>1440){setMessage('일정이 자정을 넘지 않도록 시간을 조정해 주세요.');return;}
    const entry={...editing,id:editing?.id || crypto.randomUUID(),done:editing?.done || false,date:data.get('date'),company:data.get('company'),time,duration,memo:data.get('memo')};
    if(update(editing?items.map(item=>item.id===editing.id?entry:item):[...items,entry])){
      if(!keys.includes(entry.date))setDate(new Date(entry.date+'T12:00:00'));
      setPopup(null);
    }
  }
  return <section className="schedule-screen">
    <div className="screen-toolbar calendar-toolbar">
      <h1>{date.getFullYear()}년 {date.getMonth()+1}월</h1>
      <div>
        <Button variant="ghost" size="icon" aria-label="이전 기간" onClick={()=>step(-1)}><ChevronLeft size={16}/></Button>
        <Button variant="ghost" size="icon" aria-label="다음 기간" onClick={()=>step(1)}><ChevronRight size={16}/></Button>
        <Button variant="outline" onClick={()=>{setPopup(null);setDate(new Date());}}>오늘</Button>
        <CalendarSelect label="캘린더 보기" value={period} options={[['day','1일'],['week','1주'],['month','1달']]}
          onValueChange={value=>{setPopup(null);setPeriod(value);}}/>
      </div>
    </div>
    {!popup && message && <p role="alert">{message}</p>}
    <div className="calendar-gesture" onTouchStart={event=>{
      const point=event.touches[0];
      touchStart.current=event.target.closest('.timeline-event, .calendar-month-event')?null:[point.clientX,point.clientY];
    }} onTouchEnd={event=>{
      const start=touchStart.current;
      touchStart.current=null;
      if(!start)return;
      const point=event.changedTouches[0], dx=start[0]-point.clientX;
      if(Math.abs(dx)>70 && Math.abs(dx)>Math.abs(start[1]-point.clientY)*1.5){
        const scroll=event.target.closest('.timeline-scroll');
        if(scroll && (dx>0?scroll.scrollLeft+scroll.clientWidth<scroll.scrollWidth-1:scroll.scrollLeft>1))return;
        step(Math.sign(dx));
      }
    }}>
    {period==='month'?<DndContext sensors={monthSensors} collisionDetection={pointerWithin}
      onDragStart={event=>setDragged(event.active.data.current.item)} onDragCancel={()=>setDragged(null)}
      onDragEnd={({active,over})=>{
        if(over && over.id!==active.data.current.item.date) update(items.map(item=>item.id===active.id?{...item,date:over.id}:item));
        setDragged(null);
      }}>
      <div className="calendar-month" onWheel={dragged?undefined:slide}>
        {[...'월화수목금토일'].map(day=><span className="calendar-weekday" key={day}>{day}</span>)}
        {days.map((day,index)=><MonthDay key={keys[index]} dayKey={keys[index]} day={day} today={today}
          outside={day.getMonth()!==date.getMonth()} name={name} show={show}
          items={visible.filter(item=>item.date===keys[index]).sort((a,b)=>a.time.localeCompare(b.time))}/>)}
      </div>
      <DragOverlay>{dragged && <div className="calendar-month-event">{dragged.time} {name(dragged)}</div>}</DragOverlay>
    </DndContext>:<WeekTimeline dates={keys} items={visible} today={today} name={name} onSlide={slide}
      onSlot={show} onDay={day=>{setDate(new Date(day+'T12:00:00'));setPeriod('day');}}
      onOpen={(item,event)=>show(item.date,item.time,event,item)}
      onMove={(id,destination)=>update(items.map(item=>item.id===id?{...item,...destination}:item))}/>}
    </div>
    {popup && <div className="calendar-popup-layer" onClick={()=>setPopup(null)}>
      <form key={editing?.id || popup.time} className="calendar-popup" role="dialog" aria-label={editing?'일정 수정':'일정 등록'} style={{left:popup.x,top:popup.y}}
        onClick={event=>event.stopPropagation()} onKeyDown={event=>{if(event.key==='Escape')setPopup(null);}} onSubmit={submit}>
        <header><strong>{editing?'일정 수정':'일정 등록'}</strong><Button type="button" variant="ghost" size="sm" onClick={()=>setPopup(null)}>닫기</Button></header>
        <label>거래처</label>
        <CalendarSelect label="거래처 선택" name="company" defaultValue={editing?.company} required
          options={[...(editing && !saved[editing.company] ? [[editing.company,'삭제된 거래처']] : []),
            ...Object.values(saved).map(({company})=>[company.id,company.name])]}/>
        <div className="calendar-form-row">
          <div><label>날짜</label><input type="hidden" name="date" value={popup.day}/>
            <Popover open={datePicker} onOpenChange={setDatePicker}>
              <PopoverTrigger asChild><Button type="button" variant="outline" className="w-full">{popup.day}</Button></PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" locale={ko} defaultMonth={new Date(popup.day+'T12:00:00')}
                  selected={new Date(popup.day+'T12:00:00')} onSelect={day=>{if(day)setPopup({...popup,day:dateKey(day)});setDatePicker(false);}}/>
              </PopoverContent>
            </Popover>
          </div>
          <div><label>시간</label><CalendarSelect label="시간" name="time" defaultValue={popup.time}
            options={[...new Set([...Array.from({length:96},(_,i)=>clock(i*15)),popup.time])].sort().map(time=>[time,time])}/></div>
        </div>
        <label>소요 시간</label>
        <CalendarSelect label="소요 시간" name="duration" defaultValue={String(editing?.duration || 30)}
          options={[...new Set([...Array.from({length:96},(_,i)=>(i+1)*15),editing?.duration || 30])].sort((a,b)=>a-b).map(value=>[value,value+'분'])}/>
        <label>메모<Input defaultValue={editing?.memo || ''} name="memo" maxLength={200}/></label>
        {!editing && !Object.keys(saved).length && <small>내 거래처에 업체를 먼저 추가해 주세요.</small>}
        {message && <small role="alert">{message}</small>}
        <footer className="calendar-form-actions">
          {editing && <Button type="button" variant="outline" className="calendar-delete" onClick={()=>{if(update(items.filter(item=>item.id!==editing.id)))setPopup(null);}}>삭제</Button>}
          <Button className="ml-auto" disabled={!editing && !Object.keys(saved).length}>저장</Button>
        </footer>
      </form>
    </div>}
  </section>;
}
export function Settings({user,member,count,onAccountAction,accountBusy}) {
  const [compact,setCompact]=useState(false);
  useEffect(()=>setCompact(load('outbounding.compact',false)),[]);
  return <section className="settings-screen"><h1>설정</h1><section><h2>계정</h2><div className="setting-row"><span>사용 계정</span><span>{user?.email || (member ? '소셜 계정' : '체험 계정')}</span></div><div className="setting-row"><span>내 거래처</span><span>{count}개</span></div><Button variant="outline" disabled={accountBusy} onClick={onAccountAction}>{member ? '로그아웃' : '가입 · 로그인'}</Button></section><section><h2>화면</h2><label className="setting-row"><span>촘촘한 리스트</span><Checkbox checked={compact} onCheckedChange={checked=>{const value=checked===true;localStorage.setItem('outbounding.compact',JSON.stringify(value));setCompact(value);document.documentElement.dataset.compact=String(value);}}/></label></section></section>;
}
