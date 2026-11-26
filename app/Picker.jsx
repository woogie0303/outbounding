'use client';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { BriefcaseBusiness, MapPin, ChevronDown, Search, Check } from 'lucide-react';
import { useState } from 'react';

export default function Picker({ fields }) {
  const [active, setActive] = useState(null);
  const [group, setGroup] = useState(null);
  const [term, setTerm] = useState('');
  const field = fields[active];
  const normalize = (s) => s.replaceAll(' ', '').toLowerCase();
  const matches = Object.entries(field?.groups ?? {}).map(([name, options]) => [
    name, options.filter((option) => normalize(name + option).includes(normalize(term)))
  ]).filter(([, options]) => options.length);
  return <div className="option-browser">
    <div className="option-tabs">{Object.entries(fields).map(([label, item]) =>
      <Button variant="ghost" key={label} type="button" aria-expanded={active === label} onClick={() => {setActive(active === label ? null : label); setGroup(null); setTerm('');}}>
        <span className="field-icon">{label === "지역" ? <MapPin size={16}/> : <BriefcaseBusiness size={16}/>}</span><span className="field-copy"><small>{label}</small><strong>{item.value || label + " 선택"}</strong></span><ChevronDown size={14}/>
      </Button>)}</div>
    {field && <><Input autoFocus className="option-search" type="search" aria-label={active + ' 검색'} placeholder={active + ' 이름으로 찾기'} value={term} onChange={(e) => setTerm(e.target.value)} onKeyDown={(e) => {if (e.key === 'Enter') e.preventDefault();}} />
    <div className="option-list" key={active}>
      <Button variant="ghost" type="button" onClick={() => {field.change(''); setActive(null);}}>전체 {active}</Button>
      {term.trim() && !matches.some(([, options]) => options.includes(term.trim())) &&
        <Button variant="ghost" type="button" onClick={() => {field.change(term.trim()); setActive(null);}}>{term.trim()} 적용</Button>}
      {matches.map(([name, options]) => <section key={name}>
        <Button type="button" className="group-choice" variant="ghost" aria-expanded={Boolean(term) || group === name}
          onClick={() => setGroup(group === name ? null : name)}>{name}<span>{options.length} <ChevronDown size={13}/></span></Button>
        {(term || group === name) && <div>{options.map((option) =>
        <Button variant="ghost" key={option} type="button" aria-pressed={field.value === option} onClick={() => {
          field.change(option); setTerm(''); setActive(null);
        }}>{option}{field.value === option && <Check size={14}/>}</Button>)}</div>}</section>)}
      {!matches.length && <div className="empty picker-empty">
        <span className="empty-icon"><Search size={18}/></span>
        <strong role="status">찾으시는 {active === '지역' ? '지역이' : '업종이'} 없어요</strong>
        <Button variant="outline" type="button" onClick={() => setTerm('')}>전체 {active} 보기</Button>
      </div>}
    </div></>}
  </div>;
}
