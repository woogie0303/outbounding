'use client';
import { useState } from 'react';

export default function Picker({ fields }) {
  const [active, setActive] = useState('업종');
  const [term, setTerm] = useState('');
  const field = fields[active];
  const normalize = (s) => s.replaceAll(' ', '').toLowerCase();
  const matches = Object.entries(field.groups).map(([name, options]) => [
    name, options.filter((option) => normalize(name + option).includes(normalize(term)))
  ]).filter(([, options]) => options.length);
  return <div className="option-browser">
    <div className="option-tabs">{Object.entries(fields).map(([label, item]) =>
      <button key={label} type="button" aria-pressed={active === label} onClick={() => {setActive(label); setTerm('');}}>
        <small>{label}</small><strong>{item.value || label + ' 선택'}</strong>
      </button>)}</div>
    <input className="option-search" type="search" aria-label={active + ' 검색'} placeholder={active + ' 이름으로 찾기'} value={term} onChange={(e) => setTerm(e.target.value)} onKeyDown={(e) => {if (e.key === 'Enter') e.preventDefault();}} />
    <div className="option-list" key={active}>
      {matches.map(([name, options]) => <section key={name}><h3>{name}</h3><div>{options.map((option) =>
        <button key={option} type="button" aria-pressed={field.value === option} onClick={() => {
          field.change(option); setTerm(''); if (active === '업종' && !fields['지역'].value) setActive('지역');
        }}>{option}</button>)}</div></section>)}
      {!matches.length && <p>일치하는 항목이 없습니다.</p>}
    </div>
  </div>;
}
