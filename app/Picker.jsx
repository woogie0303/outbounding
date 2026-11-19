'use client';
import { useRef, useState } from 'react';

export default function Picker({ label, groups, value, onChange }) {
  const dialog = useRef(null);
  const [term, setTerm] = useState('');
  const normalize = (text) => text.replaceAll(' ', '').toLowerCase();
  const matches = Object.entries(groups).map(([group, entries]) => [
    group, entries.filter((entry) => normalize(group + entry).includes(normalize(term.trim())))
  ]).filter(([, entries]) => entries.length);
  return <>
    <button type="button" className="picker-trigger" aria-haspopup="dialog" onClick={() => { setTerm(''); dialog.current.showModal(); }}>{value || label + ' 선택'} <span aria-hidden="true">⌄</span></button>
    <dialog ref={dialog} className="picker-sheet" aria-label={label + ' 선택'} onClick={(event) => { if (event.target === dialog.current) dialog.current.close(); }}>
      <section>
        <header><h2>{label} 선택</h2><button type="button" aria-label="닫기" onClick={() => dialog.current.close()}>×</button></header>
        <input type="search" autoFocus aria-label={label + ' 검색'} placeholder={label + ' 검색'} value={term} onChange={(event) => setTerm(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') event.preventDefault(); }} />
        <div className="picker-list">{matches.map(([group, entries]) => <div key={group}><h3>{group}</h3><div className="picker-options">{entries.map((entry) => <button key={entry} type="button" aria-pressed={entry === value} onClick={() => { onChange(entry); dialog.current.close(); }}>{entry}{entry === value && <span>✓</span>}</button>)}</div></div>)}{!matches.length && <p>일치하는 항목이 없습니다. 다른 이름으로 검색해 보세요.</p>}</div>
      </section>
    </dialog>
  </>;
}
