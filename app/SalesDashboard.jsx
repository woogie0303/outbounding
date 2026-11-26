'use client';
import {useEffect,useState} from 'react';
import {Button} from '../components/ui/button';
import {Input} from '../components/ui/input';
const split = text => [...new Set(text.split(',').map(s=>s.trim()).filter(Boolean))];
const day = date => date.toLocaleDateString('sv-SE',{timeZone:'Asia/Seoul'});
export function SalesDashboard({db,user,saved,open,save,refresh}) {
 const [fields,setFields]=useState(['','','']),[edit,setEdit]=useState(false),[rows,setRows]=useState([]),[recent,setRecent]=useState([]),[error,setError]=useState(''),[version,reload]=useState(0);
 const member=user?.is_anonymous===false;
 useEffect(()=>{let active=true;
 async function load(){
 if(!db||!user)return;
 const history=await db.from('lead_contact_history').select('id,company_id,contact_name,contacted_at,note').eq('user_id',user.id).order('contacted_at',{ascending:false}).limit(5);
 if(!active)return;
 if(history.error)setError(history.error.message);else setRecent(history.data);
 if(!member)return;
 const [prefs,recs]=await Promise.all([db.from('sales_preferences').select('*').eq('user_id',user.id).maybeSingle(),db.rpc('recommended_companies')]);
 if(!active)return;
 if(prefs.error||recs.error){setError((prefs.error||recs.error).message);return;}
 const p=prefs.data;
 setFields([p?.regions,p?.industries,p?.keywords].map(v=>v?.join(', ')||''));setEdit(!p);setRows(recs.data);
 }load();return()=>{active=false};},[db,user?.id,member,version,saved,refresh]);
 async function store(skip){
 const [regions,industries,keywords]=skip?[[],[],[]]:fields.map(split);
 if(!skip&&(!regions.length||!industries.length||keywords.length>3)){setError('지역과 업종을 입력하고 키워드는 3개까지 선택하세요.');return;}
 const {error}=await db.from('sales_preferences').upsert({user_id:user.id,regions,industries,keywords});
 if(error)setError(error.message);else{setError('');reload(v=>v+1);}
 }
 const today=day(new Date()),end=new Date(today+'T12:00:00+09:00');end.setUTCDate(end.getUTCDate()+(7-end.getUTCDay())%7);
 const entries=Object.values(saved).filter(v=>v.next).sort((a,b)=>a.next.localeCompare(b.next));
 return <section className="settings-screen"><h1>대시보드</h1>{error&&<p role="alert">{error}</p>}
 {[['기한 지난 연락',d=>d<today],['오늘 연락',d=>d===today],['이번 주 남은 연락',d=>d>today&&d<=day(end)]].map(([title,test])=>{const items=entries.filter(v=>test(v.next));return <section key={title}><h2>{title} · {items.length}건</h2>{items.map(v=><Button key={v.company.id} variant="ghost" onClick={()=>open(v.company)}>{v.company.name} · {v.next}</Button>)}</section>})}
 <section><h2>최근 상담</h2>{recent.length===0&&<p>아직 기록된 상담이 없습니다.</p>}{recent.map(h=><p key={h.id}><button onClick={()=>saved[h.company_id]&&open(saved[h.company_id].company)}>{saved[h.company_id]?.company.name} · {h.contact_name} · {day(new Date(h.contacted_at))} · {h.note}</button></p>)}</section>
 {member&&<section><h2>추천 거래처</h2>{edit?<div className="lead-contact-fields">{['지역 (쉼표로 구분)','업종 (쉼표로 구분)','키워드 (최대 3개)'].map((label,i)=><label key={label}>{label}<Input value={fields[i]} onChange={e=>setFields(f=>f.map((v,j)=>j===i?e.target.value:v))}/></label>)}<Button onClick={()=>store(false)}>추천 조건 저장</Button><Button variant="ghost" onClick={()=>store(true)}>건너뛰기</Button></div>:<Button variant="outline" onClick={()=>setEdit(true)}>영업 조건 설정</Button>}
 {rows.map(({company,matched})=><div className="setting-row" key={company.id}><button onClick={()=>open(company)}>{company.name} · {[company.region,company.industry,...matched].join(' · ')}</button><Button onClick={()=>save([company],'add')}>거래처 저장</Button></div>)}</section>}</section>;
}
export function ContactLog({db,user,company,entry,onSaved}){
 const [person,setPerson]=useState(''),[note,setNote]=useState(''),[next,setNext]=useState(entry.next||''),[at,setAt]=useState(()=>{const d=new Date();return new Date(d-d.getTimezoneOffset()*60000).toISOString().slice(0,16)}),[history,setHistory]=useState([]),[names,setNames]=useState([]),[error,setError]=useState(''),[busy,setBusy]=useState(false),[revision,reload]=useState(0);
 useEffect(()=>{let active=true;async function load(){const [h,n]=await Promise.all([db.from('lead_contact_history').select('*').eq('company_id',company.id).eq('user_id',user.id).order('contacted_at',{ascending:false}),db.from('lead_contacts').select('name').eq('user_id',user.id).eq('company_id',company.id)]);if(active){setHistory(h.data||[]);setNames(n.data||[]);if(h.error||n.error)setError((h.error||n.error).message);}}load();return()=>{active=false}},[revision,user.id,company.id,db]);
 return <form className="lead-contact-fields" onSubmit={async e=>{e.preventDefault();if(busy)return;setBusy(true);try{const {error}=await db.rpc('record_contact',{p_company:company.id,p_name:person,p_time:new Date(at).toISOString(),p_note:note.trim(),p_next:next||null});if(error)throw error;setNote('');setError('');reload(v=>v+1);await onSaved(user);}catch(err){setError(err.message)}finally{setBusy(false)}}}>
 <label>담당자<Input list="lead-names" value={person} onChange={e=>setPerson(e.target.value)}/></label><datalist id="lead-names">{names.map((n,i)=><option key={i} value={n.name}/>)}</datalist>
 <label>연락 일시<Input required type="datetime-local" value={at} onChange={e=>setAt(e.target.value)}/></label><label>상담 내용<textarea required maxLength={2000} value={note} onChange={e=>setNote(e.target.value)}/></label><label>다음 연락일 (비우면 후속 연락 완료)<Input type="date" value={next} onChange={e=>setNext(e.target.value)}/></label><Button disabled={busy||!note.trim()}>연락 기록 저장</Button>{error&&<p role="alert">{error}</p>}{history.map(h=><p key={h.id}>{day(new Date(h.contacted_at))} · {h.contact_name} · {h.note}</p>)}</form>;
}
