'use client';
import {useEffect,useRef,useState} from 'react';
import {Button} from '../components/ui/button';
import {Input} from '../components/ui/input';
import {Checkbox} from '../components/ui/checkbox';
import WeekTimeline, {minutes} from './WeekTimeline';
import {MapPin,ChevronLeft,ChevronRight,LocateFixed} from 'lucide-react';
const load = (key,fallback) => {try{return JSON.parse(localStorage.getItem(key)) ?? fallback;}catch{return fallback;}};
const dateKey = date => [date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
export function Nearby({companies,open}) {
  const mapNode=useRef(null), map=useRef(null), markers=useRef(null);
  const [center,setCenter]=useState([37.5665,126.978]),[radius,setRadius]=useState(5),[query,setQuery]=useState(''),[error,setError]=useState(''),[mapReady,setMapReady]=useState(false);
  const [panel,setPanel]=useState(false);
  const located=companies.filter(row=>Number.isFinite(Number(row.latitude)) && row.latitude != null && Number.isFinite(Number(row.longitude)) && row.longitude != null);
  const distance=row=>{const r=Math.PI/180;const a=Math.sin((Number(row.latitude)-center[0])*r/2)**2+Math.cos(center[0]*r)*Math.cos(Number(row.latitude)*r)*Math.sin((Number(row.longitude)-center[1])*r/2)**2;return 6371*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));};
  const rows=located.filter(row=>distance(row)<=radius && row.name.includes(query)).sort((a,b)=>distance(a)-distance(b));
  useEffect(()=>{let active=true;import('leaflet').then(L=>{if(!active)return;const instance=L.map(mapNode.current).setView(center,12);map.current=instance;L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap contributors',maxZoom:19}).addTo(instance);markers.current=L.layerGroup().addTo(instance);setMapReady(true);instance.on('moveend',()=>{const c=instance.getCenter();setCenter([c.lat,c.lng]);});});return()=>{active=false;map.current?.remove();map.current=null;};},[]);
  useEffect(()=>{if(!map.current || !markers.current)return;import('leaflet').then(L=>{markers.current?.clearLayers();for(const row of rows)L.circleMarker([Number(row.latitude),Number(row.longitude)],{radius:7,color:'#fff',weight:2,fillColor:'#222',fillOpacity:1}).addTo(markers.current).bindTooltip(row.name).on('click',()=>setPanel(true));});},[center,radius,query,companies,mapReady]);
  function locate(){navigator.geolocation?.getCurrentPosition(position=>{map.current?.setView([position.coords.latitude,position.coords.longitude],14);setError('');},()=>setError('위치 권한을 확인해 주세요. 지도를 이동해서도 검색할 수 있습니다.'));}
  return <section className="nearby-screen"><div className="screen-toolbar"><h1>주변 업체</h1><Input aria-label="주변 업체명 검색" placeholder="업체명 검색" value={query} onChange={e=>setQuery(e.target.value)}/><select aria-label="조회 반경" value={radius} onChange={e=>setRadius(Number(e.target.value))}>{[1,3,5,10,20].map(n=><option key={n} value={n}>{n}km</option>)}</select><Button variant="outline" onClick={locate}><LocateFixed size={14}/>현재 위치</Button></div>
    {error && <p role="status">{error}</p>}<div className="nearby-body map-first"><Button className="map-list-toggle" variant="outline" aria-label="주변 업체 목록" aria-expanded={panel} onClick={()=>setPanel(!panel)}><MapPin size={18}/></Button>{panel && <div className="nearby-list"><p className="muted">{rows.length}개 업체 · 지도 중심 기준</p>{rows.map(row=><button key={row.id} onClick={()=>{map.current?.panTo([row.latitude,row.longitude]);open(row);}}><strong>{row.name}</strong><span>{row.industry}</span><small>{row.city || row.region} · {distance(row).toFixed(1)}km</small></button>)}{!rows.length && <div className="screen-empty"><MapPin size={24}/><strong>주변에 표시할 업체가 없어요</strong><p>{located.length?'지도를 이동하거나 반경을 넓혀보세요.':'위치 좌표가 등록된 업체가 아직 없습니다.'}</p></div>}</div>}<div ref={mapNode} className="nearby-map" aria-label="주변 업체 지도"/></div></section>;
}
export function Schedule({saved,open}) {
  const [period,setPeriod]=useState('week');
  const [date,setDate]=useState(()=>new Date());
  const [items,setItems]=useState([]);
  const [popup,setPopup]=useState(null);
  const [message,setMessage]=useState('');
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
        <select aria-label="캘린더 보기" value={period} onChange={event=>{setPopup(null);setPeriod(event.target.value);}}>
          <option value="day">1일</option><option value="week">1주</option><option value="month">1달</option>
        </select>
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
    {period==='month'?<div className="calendar-month" onWheel={slide}>
      {[...'월화수목금토일'].map(day=><span className="calendar-weekday" key={day}>{day}</span>)}
      {days.map((day,index)=>{
        const key=keys[index];
        return <div className="calendar-month-day" key={key} data-outside={day.getMonth()!==date.getMonth()}>
          <button className="calendar-date-hit" aria-label={key+' 일정 등록'} onClick={event=>show(key,'09:00',event)}><b data-today={key===today}>{day.getDate()}</b></button>
          {visible.filter(item=>item.date===key).sort((a,b)=>a.time.localeCompare(b.time)).map(item=>
            <button className="calendar-month-event" key={item.id} data-done={item.done} onClick={event=>show(key,item.time,event,item)}>{item.time} {name(item)}</button>
          )}
        </div>;
      })}
    </div>:<WeekTimeline dates={keys} items={visible} today={today} name={name} onSlide={slide}
      onSlot={show} onDay={day=>{setDate(new Date(day+'T12:00:00'));setPeriod('day');}}
      onOpen={(item,event)=>show(item.date,item.time,event,item)}
      onMove={(id,destination)=>update(items.map(item=>item.id===id?{...item,...destination}:item))}/>}
    </div>
    {popup && <div className="calendar-popup-layer" onClick={()=>setPopup(null)}>
      <form key={editing?.id || popup.day+popup.time} className="calendar-popup" role="dialog" aria-label={editing?'일정 수정':'일정 등록'} style={{left:popup.x,top:popup.y}}
        onClick={event=>event.stopPropagation()} onKeyDown={event=>{if(event.key==='Escape')setPopup(null);}} onSubmit={submit}>
        <header><strong>{editing?'일정 수정':'일정 등록'}</strong><Button type="button" variant="ghost" size="sm" onClick={()=>setPopup(null)}>닫기</Button></header>
        <label>거래처<select autoFocus name="company" defaultValue={editing?.company || ''} required>
          <option value="">거래처 선택</option>
          {editing && !saved[editing.company] && <option value={editing.company}>삭제된 거래처</option>}
          {Object.values(saved).map(({company})=><option key={company.id} value={company.id}>{company.name}</option>)}
        </select></label>
        <div className="calendar-form-row"><label>날짜<Input type="date" name="date" defaultValue={popup.day} required/></label>
        <label>시간 (24시간)<Input name="time" placeholder="09:00" pattern="([01][0-9]|2[0-3]):[0-5][0-9]" maxLength={5} defaultValue={popup.time} required/></label></div>
        <label>소요 시간<select name="duration" defaultValue={editing?.duration || 30}>{[15,30,45,60,90,120].map(n=><option key={n} value={n}>{n}분</option>)}</select></label>
        <label>메모<Input defaultValue={editing?.memo || ''} name="memo" maxLength={200}/></label>
        {editing && <div className="calendar-form-actions">
          <label><Checkbox checked={editing.done} onCheckedChange={done=>{const item={...editing,done:done===true};if(update(items.map(value=>value.id===item.id?item:value)))setPopup({...popup,item});}}/>연락 완료</label>
          {saved[editing.company] && <Button type="button" variant="ghost" size="sm" onClick={()=>{setPopup(null);open(saved[editing.company].company);}}>거래처</Button>}
          <Button type="button" variant="ghost" size="sm" onClick={()=>{if(update(items.filter(item=>item.id!==editing.id)))setPopup(null);}}>삭제</Button>
        </div>}
        {!editing && !Object.keys(saved).length && <small>내 거래처에 업체를 먼저 추가해 주세요.</small>}
        {message && <small role="alert">{message}</small>}
        <Button disabled={!editing && !Object.keys(saved).length}>저장</Button>
      </form>
    </div>}
  </section>;
}
export function Settings({user,count}) {
  const [compact,setCompact]=useState(false);
  useEffect(()=>setCompact(load('outbounding.compact',false)),[]);
  return <section className="settings-screen"><h1>설정</h1><section><h2>계정</h2><div className="setting-row"><span>사용 계정</span><span>{user?.email || (user?'익명 계정':'이 브라우저에 저장')}</span></div><div className="setting-row"><span>내 거래처</span><span>{count}개</span></div></section><section><h2>화면</h2><label className="setting-row"><span>촘촘한 리스트</span><Checkbox checked={compact} onCheckedChange={checked=>{const value=checked===true;localStorage.setItem('outbounding.compact',JSON.stringify(value));setCompact(value);document.documentElement.dataset.compact=String(value);}}/></label></section><section><h2>데이터 보관</h2><p className="muted">영업 단계, 카드 순서와 연락 일정은 이 브라우저에 저장됩니다.</p></section></section>;
}
