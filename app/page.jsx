'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import DottedField from './DottedField';
import Picker from './Picker';
import companies from './companies.json';
import { findCompanies, infer, industries, industryGroups, regions, safeUrl, suggestions, toCsv } from './data.mjs';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const db = url && key ? createClient(url, key) : null;
const savedKey = 'outbounding.saved';
const recentKey = 'outbounding.recent';
const read = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
};
const symbols = { sliders: 'M4 7h16M4 17h16M9 4v6m6 4v6', search: 'M21 21l-4.35-4.35M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z', saved:'M6 4h12v17l-6-4-6 4z', clock:'M12 8v5l3 2m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z', arrow:'M4 12h15m-6-6 6 6-6 6', globe:'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Z M2 12h20M12 2c-5 5-5 15 0 20m0-20c5 5 5 15 0 20', download:'M12 3v12m-4-4 4 4 4-4M5 16v5h14v-5', building:'M4 21h16M7 21V4h10v17M10 8h1m2 0h1m-4 4h1m2 0h1m-4 4h1m2 0h1', pin:'M19 9c0 5-7 11-7 11S5 14 5 9a7 7 0 1 1 14 0Zm-7-2a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z', close:'m6 6 12 12M18 6 6 18' };
function Icon({ name, size = 18 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={symbols[name]} /></svg>;
}

export default function Workspace() {
  const [tab, setTab] = useState('search');
  const [query, setQuery] = useState('');
  const [industry, setIndustry] = useState('');
  const [region, setRegion] = useState('');
  const [delivery, setDelivery] = useState(false);
  const [results, setResults] = useState(null);
  const [searched, setSearched] = useState(null);
  const [saved, setSaved] = useState({});
  const [recent, setRecent] = useState([]);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState([]);
  const [filter, setFilter] = useState(false);
  const [showConditions, setShowConditions] = useState(false);
  const [detail, setDetail] = useState(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [writing, setWriting] = useState(false);
  const [user, setUser] = useState(null);
  const [message, setMessage] = useState('');
  const [initialized, setInitialized] = useState(false);
  const dialog = useRef(null);
  const writeLock = useRef(false);

  useEffect(() => {
    let active = true;
    async function start() {
      const localRecent = read(recentKey, []);
      if (active) setRecent(localRecent);
      try {
        if (!db) {
          if (active) setSaved(read(savedKey, {}));
          return;
        }
        const session = await db.auth.getSession();
        if (session.error) throw session.error;
        const account = session.data.session?.user;
        if (!account) return;
        if (active) await loadSaved(account);
      } catch {
        if (active) setMessage('저장 목록을 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.');
      } finally {
        if (active) setInitialized(true);
      }
    }
    start();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (detail && !dialog.current.open) dialog.current.showModal();
  }, [detail]);

  async function loadSaved(account) {
    const { data, error } = await db.from('saved_companies').select('note,companies(*)').eq('user_id', account.id);
    if (error) throw error;
    setSaved(Object.fromEntries(data.filter((row) => row.companies).map((row) => [row.companies.id, { company: row.companies, note: row.note }])));
    setUser(account);
  }

  function applyQuery(value) {
    setQuery(value);
    const inferred = infer(value);
    if (inferred.industry) setIndustry(inferred.industry);
    if (inferred.region) setRegion(inferred.region);
    setDelivery(/(?:자체|직접|자사)\s*(?:차량|배송)|직배송/u.test(value));
  }

  async function search(event) {
    event.preventDefault();
    if (busy) return;
    if (!industry || !region) {
      setShowConditions(true);
      setMessage('업종과 지역을 입력하거나 선택해 주세요.');
      return;
    }
    setSelecting(false);
    setBusy(true);
    setShowConditions(false);

    setMessage('');
    setSelected([]);
    setFilter(false);
    try {
      let rows = companies;
      if (db) {
        rows = [];
        for (let offset = 0; ; offset += 500) {
          const { data, error } = await db.from('companies').select('*').eq('industry', industry).or(`region.eq.${region},city.eq.${region}`).order('id').range(offset, offset + 499);
          if (error) throw error;
          rows.push(...data);
          if (data.length < 500) break;
        }
      }
      setResults(findCompanies(rows, industry, region, delivery));
      if (!query.trim()) setQuery([region, industry, delivery && "직접 배송"].filter(Boolean).join(" "));
      const conditions = { query, industry, region, delivery };
      setSearched(conditions);
      const next = [conditions, ...recent.filter((item) => item.industry !== industry || item.region !== region || item.delivery !== delivery)].slice(0, 5);
      setRecent(next);
      localStorage.setItem(recentKey, JSON.stringify(next));
    } catch {
      setMessage('검색을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    } finally { setBusy(false); }
  }

  function changeTab(value) {
    setSelecting(false);
    setTab(value);
    setShowConditions(false);
    setMessage('');
    setSelected([]);
    setFilter(false);
  }

  async function persist(rows, mode, memo = '') {
    if (!initialized || writeLock.current || !rows.length) return;
    writeLock.current = true;
    setWriting(true);
    setMessage('');
    try {
      if (db) {
        let account = user;
        if (!account) {
          const session = await db.auth.getSession();
          if (session.error) throw session.error;
          account = session.data.session?.user;
          if (!account) {
            const result = await db.auth.signInAnonymously();
            if (result.error) throw result.error;
            account = result.data.user;
          }
          await loadSaved(account);
        }
        const table = db.from('saved_companies');
        const ids = rows.map((row) => row.id);
        const records = ids.map((id) => ({ user_id: account.id, company_id: id, ...(mode === 'note' ? { note: memo } : {}) }));
        const response = mode === 'remove' ? await table.delete().eq('user_id', account.id).in('company_id', ids)
          : await table.upsert(records, { onConflict: 'user_id,company_id', ignoreDuplicates: mode === 'add' });
        if (response.error) throw response.error;
        await loadSaved(account);
      } else {
        const next = { ...saved };
        for (const row of rows) {
          if (mode === 'remove') delete next[row.id];
          else next[row.id] = { company: row, note: mode === 'note' ? memo : next[row.id]?.note ?? '' };
        }
        localStorage.setItem(savedKey, JSON.stringify(next));
        setSaved(next);
      }
      setMessage(mode === 'note' ? '메모를 저장했습니다.' : mode === 'remove' ? '저장 목록에서 삭제했습니다.' : `${rows.length}개 업체를 저장했습니다.`);
    } catch {
      setMessage('변경을 완료하지 못했습니다. 연결 상태를 확인하고 다시 시도해 주세요.');
    } finally {
      setWriting(false);
      writeLock.current = false;
    }
  }

  const list = tab === 'saved' ? Object.values(saved).map((entry) => entry.company) : results ?? [];
  const visible = filter ? list.filter((row) => row.direct_delivery) : list;
  const chosen = visible.filter((row) => selected.includes(row.id));
  const isDisabled = !initialized || writing;

  function exportCsv() {
    if (!visible.length) return;
    const file = new Blob([toCsv(chosen.length ? chosen : visible, saved)], { type: 'text/csv;charset=utf-8;' });
    const href = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = href;
    link.download = 'outbounding-업체목록.csv';
    link.click();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  }

  function openDetail(row) {
    setMessage('');
    setDetail(row);
    setNote(saved[row.id]?.note ?? '');
  }

  const landing = tab === 'search' && results === null;
  return (
    <div className={landing ? 'shell landing' : 'shell'}>
      {landing && <DottedField />}
      {!landing && <header className="topbar">
        <button className="brand" onClick={() => { setResults(null); setQuery(''); setIndustry(''); setRegion(''); setDelivery(false); changeTab('search'); }}>아웃바운딩</button>
        <nav aria-label="워크스페이스">
          <button className={tab === 'search' ? 'active' : ''} onClick={() => changeTab('search')}><Icon name="search" size={16} /> 업체 발굴</button>
          <button className={tab === 'saved' ? 'active' : ''} onClick={() => changeTab('saved')}><Icon name="saved" size={16} /> 저장 목록 <small>{Object.keys(saved).length}</small></button>
        </nav>
      </header>}
      <main>
        <div className="content">
          {tab === 'search' && <section className="search-stage" aria-label="업체 발굴">
            <h1 className="sr-only">아웃바운딩 업체 검색</h1>
            <form className="search-box" onSubmit={search}>
              {landing && <div className="composer-brand"><span aria-hidden="true" className="route-mark" />Outbounding</div>}
              <div className="search-line">
                <Icon name="search" size={22} />
                <label className="sr-only" htmlFor="query">검색 조건</label>
                <input id="query" type="search" value={query} readOnly={busy} maxLength={160} onChange={(event) => applyQuery(event.target.value)} placeholder="찾고 싶은 업체를 입력하세요" />
                <button type="button" className="condition-toggle" disabled={busy} aria-label="검색 필터" aria-expanded={showConditions} aria-controls="search-conditions" onClick={() => setShowConditions(!showConditions)}><Icon name="sliders" size={18} /></button>
                <button type="submit" className="search-submit" aria-label="업체 찾기" disabled={busy}><Icon name="arrow" size={21} /></button>
              </div>
              <div id="search-conditions" className="condition-reveal" data-open={showConditions} inert={!showConditions}>
                <div className="condition-inner">
                  {showConditions && <Picker fields={{
                    업종: { groups: industryGroups, value: industry, change: setIndustry },
                    지역: { groups: { 광역: regions.slice(0, 3), 경기권: regions.slice(3) }, value: region, change: setRegion }
                  }} />}
                  <details className="search-history"><summary>추천·최근 검색</summary>
                  <div className="suggestions"><span>추천 검색</span>{suggestions.map((value) => <button type="button" key={value} onClick={() => applyQuery(value)}>{value}</button>)}</div>
                  {recent.length > 0 && <div className="suggestions"><span>최근 검색</span>{recent.map((item) => <button type="button" key={JSON.stringify(item)} onClick={() => { setQuery(item.query); setIndustry(item.industry); setRegion(item.region); setDelivery(item.delivery); }}>{item.region} · {item.industry}{item.delivery && ' · 직접 배송'}</button>)}</div>}
                  </details>
                  {landing && <button type="button" className="saved-shortcut" onClick={() => changeTab('saved')}><Icon name="saved" size={15} /> 저장 목록</button>}
                  <div className="search-controls option-actions">
                    <button className="primary" disabled={busy || !industry || !region}>이 조건으로 검색 <Icon name="arrow" size={15} /></button>
                    <label className="plain delivery"><input type="checkbox" checked={delivery} onChange={(event) => setDelivery(event.target.checked)} /> 직접 배송</label>
                  </div>
                </div>
              </div>
            </form>
            {busy && <p className="search-status" role="status">업체를 찾고 있어요…</p>}
          </section>}
          {message && !detail && <p className="notice" role="status">{message}</p>}
          {(tab === 'saved' || (results !== null && !busy)) && <section className="results" key={tab === 'saved' ? tab : JSON.stringify(searched)}>
            <div className="section-heading">
              <div><h2>{tab === 'saved' ? '저장 목록' : '검색 결과'} <span>{visible.length}개</span></h2>{tab === 'search' && searched && <p>{searched.region} · {searched.industry}{searched.delivery && ' · 직접 배송'}</p>}</div>
              <button className="outline" onClick={exportCsv} disabled={!visible.length}><Icon name="download" size={16} /> CSV 내보내기</button>
            </div>
            <div className="toolbar">
              <button type="button" className="batch-toggle" aria-pressed={selecting} disabled={!visible.length && !selecting} onClick={() => { setSelecting(!selecting); setSelected([]); }}>{selecting ? '선택 종료' : '목록 선택'}</button>
              {selecting && <label><input type="checkbox" checked={visible.length > 0 && chosen.length === visible.length} disabled={!visible.length} onChange={(event) => setSelected(event.target.checked ? visible.map((row) => row.id) : [])} /> 전체 선택</label>}
              <label><input type="checkbox" checked={filter} onChange={(event) => { setFilter(event.target.checked); setSelected([]); }} /> 직접 배송 확인</label>
              {chosen.length > 0 && <button className="outline" disabled={isDisabled} onClick={() => persist(chosen, tab === 'saved' ? 'remove' : 'add')}>{chosen.length}개 {tab === 'saved' ? '삭제' : '저장'}</button>}
            </div>
            {visible.length === 0 && <div className="empty"><Icon name={tab === 'saved' ? 'saved' : 'search'} size={28} /><strong>{tab === 'saved' && !filter ? '저장한 업체가 없습니다' : '이 조건에 맞는 업체가 없습니다'}</strong><p>{tab === 'saved' && !filter ? '업체 발굴에서 관심 있는 업체를 저장해 보세요.' : '직접 배송 필터 또는 검색 지역을 조정해 보세요.'}</p><button className="outline" onClick={() => { if (filter) {setFilter(false); return;} changeTab('search'); setShowConditions(true); document.getElementById('query')?.focus(); window.scrollTo(0,0); }}>{filter ? '배송 필터 해제' : tab === 'saved' ? '업체 찾기' : '검색 조건 변경'}</button></div>}
            {visible.length > 0 && <div className="crm-register">
              <div className="crm-table-wrap"><table className="crm-table"><caption className="sr-only">업체 레코드</caption><thead><tr>
                {selecting && <th>선택</th>}<th>업체명</th><th>지역</th><th>대표전화</th><th>목록</th>
              </tr></thead><tbody>{visible.map((row) => <tr key={row.id}>
                {selecting && <td><input type="checkbox" aria-label={`${row.name} 선택`} checked={selected.includes(row.id)} onChange={(event) => setSelected(event.target.checked ? [...selected, row.id] : selected.filter((id) => id !== row.id))} /></td>}
                <td><button className="crm-name" onClick={() => openDetail(row)}>{row.name}</button><small>{row.industry}</small></td>
                <td>{row.city || row.region}</td><td>{row.phone || '확인 필요'}</td><td><button className={saved[row.id] ? 'outline is-saved' : 'outline'} disabled={isDisabled} onClick={() => persist([row], saved[row.id] ? 'remove' : 'add')}><Icon name="saved" size={16} /> {saved[row.id] ? '저장됨' : '저장'}</button></td>
              </tr>)}</tbody></table></div>

            </div>}
          </section>}

        </div>
      </main>
      <dialog ref={dialog} onClick={(event) => { if (event.target === dialog.current) dialog.current.close(); }} onClose={() => { setDetail(null); setMessage(''); }} aria-labelledby="detail-title">
        {detail && <div className="detail">
          <div className="section-heading"><h2 id="detail-title">{detail.name}</h2><button className="outline" aria-label="상세 닫기" onClick={() => dialog.current.close()}><Icon name="close" /></button></div>
          <p className="metadata">{detail.region} {detail.city} · {detail.industry}</p>
          <dl><dt>주소</dt><dd>{detail.address || '확인 필요'}</dd><dt>대표전화</dt><dd>{detail.phone || '확인 필요'}</dd><dt>사업용 이메일</dt><dd>{detail.email || '확인 필요'}</dd><dt>홈페이지</dt><dd>{safeUrl(detail.website) ? <a href={safeUrl(detail.website)} target="_blank" rel="noreferrer">홈페이지 열기 ↗</a> : '확인 필요'}</dd></dl>
          <h3>확인된 정보</h3><p>{detail.evidence}</p><p><a href={safeUrl(detail.source_url)} target="_blank" rel="noreferrer">출처 열기 ↗</a> · {detail.verified_on} 확인</p>
          {detail.industry === industries[0] && <><h3>첫 통화에서 확인할 질문</h3><p>{detail.direct_delivery ? '자체 배송 차량은 몇 대이고 배차는 어떻게 관리하시나요?' : '배송을 직접 운영하시나요, 외부 운송사를 이용하시나요?'}</p></>}
          <label htmlFor="note"><strong>영업 메모</strong></label><textarea id="note" value={note} maxLength={2000} placeholder="다음 연락에서 확인할 내용을 적어보세요." onChange={(event) => setNote(event.target.value)} />
          <button className="primary" disabled={isDisabled} onClick={() => persist([detail], 'note')}>{saved[detail.id] ? '메모 저장' : '업체와 메모 저장'}</button>
          {message && <p className="notice" role="status">{message}</p>}
        </div>}
      </dialog>
    </div>
  );
}
