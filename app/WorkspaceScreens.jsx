'use client';
import {useEffect,useRef,useState} from 'react';
import {Button} from '../components/ui/button';
import {Input} from '../components/ui/input';
import {Checkbox} from '../components/ui/checkbox';
import {MapPin,ChevronLeft,ChevronRight,Plus,LocateFixed} from 'lucide-react';
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
  const [month,setMonth]=useState(()=>new Date()),[selected,setSelected]=useState(()=>dateKey(new Date())),[items,setItems]=useState([]),[ready,setReady]=useState(false),[adding,setAdding]=useState(false),[message,setMessage]=useState('');
  useEffect(()=>{setItems(load('outbounding.schedule',[]));setReady(true);},[]);
  function update(next){try{localStorage.setItem('outbounding.schedule',JSON.stringify(next));setItems(next);setMessage('');}catch{setMessage('일정을 저장하지 못했습니다.');}}
  const start=new Date(month);
  start.setDate(start.getDate()-(start.getDay()+6)%7);
  const days=Array.from({length:7},(_,i)=>new Date(start.getFullYear(),start.getMonth(),start.getDate()+i));
  const weekItems=items.filter(item=>days.some(day=>dateKey(day)===item.date));
  const hours=weekItems.map(item=>Number(item.time.slice(0,2)));
  const firstHour=Math.min(8,...hours), lastHour=Math.max(19,...hours);
  const [agenda,setAgenda]=useState(false);
  const [defaultTime,setDefaultTime]=useState('09:00');
  function stepWeek(amount){const next=new Date(month);next.setDate(next.getDate()+amount*7);setMonth(next);setSelected(dateKey(next));}
  function chooseDay(day){setSelected(dateKey(day));setAgenda(true);}
  return <section className="schedule-screen"><div className="screen-toolbar"><h1>{month.getFullYear()}년 {month.getMonth()+1}월</h1><Button variant="outline" onClick={()=>{setMonth(new Date());setSelected(dateKey(new Date()));}}>오늘</Button><Button variant="ghost" size="icon" aria-label="이전 주" onClick={()=>stepWeek(-1)}><ChevronLeft size={16}/></Button><Button variant="ghost" size="icon" aria-label="다음 주" onClick={()=>stepWeek(1)}><ChevronRight size={16}/></Button><Button className="toolbar-end" onClick={()=>{setAdding(true);setAgenda(true);}}><Plus size={15}/>일정 추가</Button></div>
    {message && <p role="status">{message}</p>}<div className="week-layout"><div className="week-scroll"><div className="week-grid">
      <div className="week-head">시간</div>{days.map(day=><button className="week-head" key={dateKey(day)} onClick={()=>chooseDay(day)}>{['일','월','화','수','목','금','토'][day.getDay()]} <b data-today={dateKey(day)===dateKey(new Date())}>{day.getDate()}</b></button>)}
      {Array.from({length:lastHour-firstHour+1},(_,i)=>i+firstHour).map(hour=><div className="week-row" key={hour}><small>{String(hour).padStart(2,'0')}:00</small>{days.map(day=><div className="week-cell" key={dateKey(day)}><button className="slot-add" aria-label={dateKey(day)+' '+hour+'시 일정 추가'} onClick={()=>{chooseDay(day);setDefaultTime(String(hour).padStart(2,'0')+':00');setAdding(true);}}/>{weekItems.filter(item=>item.date===dateKey(day) && Number(item.time.slice(0,2))===hour).sort((a,b)=>a.time.localeCompare(b.time)).map(item=><button className="week-event" data-done={item.done} key={item.id} onClick={()=>{chooseDay(day);setAdding(false);}}>{item.time} {saved[item.company]?.company.name || '삭제된 거래처'}</button>)}</div>)}</div>)}
    </div></div>{agenda && <aside className="day-agenda"><Button className="agenda-close" variant="ghost" onClick={()=>{setAgenda(false);setAdding(false);}}>닫기</Button><h2>{selected}</h2>{adding && <form onSubmit={e=>{e.preventDefault();const data=new FormData(e.currentTarget);update([...items,{id:crypto.randomUUID(),date:selected,company:data.get('company'),time:data.get('time'),memo:data.get('memo'),done:false}]);setAdding(false);}}><label>거래처<select name="company" required><option value="">거래처 선택</option>{Object.values(saved).map(({company})=><option key={company.id} value={company.id}>{company.name}</option>)}</select></label><label>시간<Input name="time" type="time" defaultValue={defaultTime} required/></label><label>메모<Input name="memo" maxLength={200}/></label><Button disabled={!ready || !Object.keys(saved).length}>추가</Button></form>}
    {!items.some(item=>item.date===selected) && <p className="muted">등록된 연락 일정이 없습니다.</p>}{items.filter(item=>item.date===selected).sort((a,b)=>a.time.localeCompare(b.time)).map(item=><div className="agenda-item" key={item.id}><Checkbox aria-label="연락 완료" checked={item.done} onCheckedChange={done=>update(items.map(value=>value.id===item.id?{...value,done:done===true}:value))}/><div><small>{item.time}</small><button onClick={()=>saved[item.company] && open(saved[item.company].company)}>{saved[item.company]?.company.name || '삭제된 거래처'}</button><p>{item.memo}</p></div><Button variant="ghost" size="sm" onClick={()=>update(items.filter(value=>value.id!==item.id))}>삭제</Button></div>)}</aside>}</div></section>;
}
export function Settings({user,count}) {
  const [compact,setCompact]=useState(false);
  useEffect(()=>setCompact(load('outbounding.compact',false)),[]);
  return <section className="settings-screen"><h1>설정</h1><section><h2>계정</h2><div className="setting-row"><span>사용 계정</span><span>{user?.email || (user?'익명 계정':'이 브라우저에 저장')}</span></div><div className="setting-row"><span>내 거래처</span><span>{count}개</span></div></section><section><h2>화면</h2><label className="setting-row"><span>촘촘한 리스트</span><Checkbox checked={compact} onCheckedChange={checked=>{const value=checked===true;localStorage.setItem('outbounding.compact',JSON.stringify(value));setCompact(value);document.documentElement.dataset.compact=String(value);}}/></label></section><section><h2>데이터 보관</h2><p className="muted">영업 단계, 카드 순서와 연락 일정은 이 브라우저에 저장됩니다.</p></section></section>;
}
