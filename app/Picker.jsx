'use client';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { BriefcaseBusiness, MapPin, ChevronDown, Check } from 'lucide-react';
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
      {matches.map(([name, options]) => <section key={name}>
        <Button type="button" className="group-choice" variant="ghost" aria-expanded={Boolean(term) || group === name}
          onClick={() => setGroup(group === name ? null : name)}>{name}<span>{options.length} <ChevronDown size={13}/></span></Button>
        {(term || group === name) && <div>{options.map((option) =>
        <Button variant="ghost" key={option} type="button" aria-pressed={field.value === option} onClick={() => {
          field.change(option); setTerm(''); setActive(null);
        }}>{option}{field.value === option && <Check size={14}/>}</Button>)}</div>}</section>)}
      {!matches.length && <p>일치하는 항목이 없습니다.</p>}
    </div></>}
  </div>;
}
