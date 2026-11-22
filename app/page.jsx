'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { Checkbox } from '../components/ui/checkbox';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../components/ui/dialog';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableCaption } from '../components/ui/table';
import Picker from './Picker';
import companies from './companies.json';
import { findCompanies, infer, industries, industryGroups, regions, safeUrl, toCsv } from './data.mjs';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const db = url && key ? createClient(url, key) : null;
const savedKey = 'outbounding.saved';
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
  const [results, setResults] = useState(null);
  const [searched, setSearched] = useState(null);
  const [saved, setSaved] = useState({});
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState([]);
  const [showConditions, setShowConditions] = useState(false);
  const [detail, setDetail] = useState(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [writing, setWriting] = useState(false);
  const [user, setUser] = useState(null);
  const [message, setMessage] = useState('');
  const [initialized, setInitialized] = useState(false);
  const detailTrigger = useRef(null);
  const writeLock = useRef(false);

  useEffect(() => {
    let active = true;
    async function start() {
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
      setResults(findCompanies(rows, industry, region));
      if (!query.trim()) setQuery([region, industry].join(" "));
      setSearched({ industry, region });
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
  const visible = list;
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
    detailTrigger.current = document.activeElement;
    setMessage('');
    setDetail(row);
    setNote(saved[row.id]?.note ?? '');
  }

  const landing = tab === 'search' && results === null;
  return (
    <div className={landing ? 'shell landing' : 'shell workspace'}>
      {!landing && <header className="topbar">
        <Button variant="ghost" className="brand" onClick={() => { setResults(null); setQuery(''); setIndustry(''); setRegion(''); changeTab('search'); }}><span aria-hidden="true" className="route-mark" /> 아웃바운딩</Button>
        <Tabs value={tab} onValueChange={changeTab}><TabsList aria-label="워크스페이스">
          <TabsTrigger value="search"><Icon name="search" size={15} /> 업체 발굴</TabsTrigger>
          <TabsTrigger value="saved"><Icon name="saved" size={15} /> 마이페이지</TabsTrigger>
        </TabsList></Tabs>
      </header>}
      {landing && <Button className="my-page-link" variant="ghost" onClick={() => changeTab('saved')}>마이페이지</Button>}
      <main>
        <div className="content">
          {tab === 'search' && <section className="search-stage" aria-label="업체 발굴">
            <h1 className="sr-only">아웃바운딩 업체 검색</h1>
            <form className="search-box" onSubmit={search}>
              {landing && <div className="composer-brand"><span aria-hidden="true" className="route-mark" />Outbounding</div>}
              <div className="search-line">
                <Icon name="search" size={22} />
                <Label className="sr-only" htmlFor="query">검색 조건</Label>
                <Input id="query" type="search" value={query} readOnly={busy} maxLength={160} onChange={(event) => applyQuery(event.target.value)} placeholder="찾고 싶은 업체를 입력하세요" />
                <Button variant="ghost" type="button" className="condition-toggle" disabled={busy} aria-label="검색 필터" aria-expanded={showConditions} aria-controls="search-conditions" onClick={() => setShowConditions(!showConditions)}><Icon name="sliders" size={18} /></Button>
                <Button type="submit" className="search-submit" aria-label="업체 찾기" disabled={busy}><Icon name="arrow" size={21} /></Button>
              </div>
              <div id="search-conditions" className="condition-reveal" data-open={showConditions} inert={!showConditions}>
                <div className="condition-inner"><h2 className="filter-heading">검색 상세</h2>
                  {showConditions && <Picker fields={{
                    업종: { groups: industryGroups, value: industry, change: setIndustry },
                    지역: { groups: { 광역: regions.slice(0, 3), 경기권: regions.slice(3) }, value: region, change: setRegion }
                  }} />}
                  <div className="search-controls option-actions">
                    <Button type="submit" className="primary" disabled={busy || !industry || !region}>이 조건으로 검색 <Icon name="arrow" size={15} /></Button>
                  </div>
                </div>
              </div>
            </form>
            {busy && <p className="search-status" role="status">업체를 찾고 있어요…</p>}
          </section>}
          {message && !detail && <p className="notice" role="status">{message}</p>}
          {(tab === 'saved' || (results !== null && !busy)) && <section className="results" key={tab === 'saved' ? tab : JSON.stringify(searched)}>
            <div className="section-heading">
              <div><h2>{tab === 'saved' ? '저장한 업체' : '발굴한 업체'} <span>{visible.length}개</span></h2>{tab === 'search' && searched && <p>{searched.region} · {searched.industry}</p>}</div>
              <Button variant="outline" className="outline" onClick={exportCsv} disabled={!visible.length}><Icon name="download" size={16} /> CSV 내보내기</Button>
            </div>
            {visible.length > 0 && <div className="toolbar">
              <Button variant="ghost" type="button" className="batch-toggle" aria-pressed={selecting} disabled={!visible.length && !selecting} onClick={() => { setSelecting(!selecting); setSelected([]); }}>{selecting ? '선택 종료' : '목록 선택'}</Button>
              {selecting && <Label><Checkbox checked={visible.length > 0 && chosen.length === visible.length} disabled={!visible.length} onCheckedChange={(checked) => setSelected(checked === true ? visible.map((row) => row.id) : [])} /> 전체 선택</Label>}
              {chosen.length > 0 && <Button variant="outline" className="outline" disabled={isDisabled} onClick={() => persist(chosen, tab === 'saved' ? 'remove' : 'add')}>{chosen.length}개 {tab === 'saved' ? '삭제' : '저장'}</Button>}
            </div>}
            {visible.length === 0 && <div className="empty">
              <span className="empty-icon"><Icon name={tab === 'saved' ? 'saved' : 'search'} size={20} /></span>
              <strong>{tab === 'saved' ? '아직 저장한 업체가 없어요' : '검색된 업체가 없어요'}</strong>
              <p>{tab === 'saved' ? '통화할 업체를 저장하면 여기에 모입니다.' : '다른 업종이나 인근 지역으로 검색해 보세요.'}</p>
              <Button variant="outline" onClick={() => { changeTab('search'); setShowConditions(true); window.scrollTo(0,0); }}>{tab === 'saved' ? '업체 찾기' : '검색 조건 변경'}</Button>
            </div>}
            {visible.length > 0 && <div className="crm-register">
              <div className="crm-table-wrap"><Table className="crm-table"><TableCaption className="sr-only">업체 레코드</TableCaption><TableHeader><TableRow>
                {selecting && <TableHead>선택</TableHead>}<TableHead>업체명</TableHead><TableHead className="industry-col">업종</TableHead><TableHead>지역</TableHead><TableHead className="phone-col">대표전화</TableHead><TableHead className="date-col">확인일</TableHead><TableHead>저장</TableHead>
              </TableRow></TableHeader><TableBody>{visible.map((row) => <TableRow key={row.id}>
                {selecting && <TableCell><Checkbox aria-label={`${row.name} 선택`} checked={selected.includes(row.id)} onCheckedChange={(checked) => setSelected(checked === true ? [...selected, row.id] : selected.filter((id) => id !== row.id))} /></TableCell>}
                <TableCell><Button variant="ghost" className="crm-name" onClick={() => openDetail(row)}><span className="account-glyph" aria-hidden="true">{row.name.slice(0,1)}</span>{row.name}</Button></TableCell>
                <TableCell className="industry-col"><Badge variant="secondary" data-tone={industries.indexOf(row.industry) % 3}>{row.industry}</Badge></TableCell><TableCell>{row.city || row.region}</TableCell><TableCell className="phone-col">{row.phone || '확인 필요'}</TableCell><TableCell className="date-col">{row.verified_on}</TableCell><TableCell><Button variant="ghost" className={saved[row.id] ? 'outline is-saved' : 'outline'} disabled={isDisabled} onClick={() => persist([row], saved[row.id] ? 'remove' : 'add')}><Icon name="saved" size={16} /> {saved[row.id] ? '저장됨' : '저장'}</Button></TableCell>
              </TableRow>)}</TableBody></Table></div>

            </div>}
          </section>}

        </div>
      </main>
      <Dialog open={Boolean(detail)} onOpenChange={(open) => { if (!open) { setDetail(null); setMessage(''); } }}>
        {detail && <DialogContent className="detail" onCloseAutoFocus={(event) => { event.preventDefault(); detailTrigger.current?.focus(); }}>
          <div className="record-identity"><span aria-hidden="true" className="record-initial">{detail.name.slice(0,1)}</span><DialogTitle>{detail.name}</DialogTitle></div>
          <DialogDescription>{detail.region} {detail.city} · {detail.industry}</DialogDescription>
          <Tabs defaultValue="overview" className="record-tabs">
            <TabsList aria-label="업체 상세"><TabsTrigger value="overview">업체 정보</TabsTrigger><TabsTrigger value="note">영업 메모</TabsTrigger></TabsList>
            <TabsContent value="overview">
          <section className="detail-section"><h3>기본 정보</h3><dl><dt>주소</dt><dd>{detail.address || '확인 필요'}</dd><dt>대표전화</dt><dd>{detail.phone || '확인 필요'}</dd><dt>사업용 이메일</dt><dd>{detail.email || '확인 필요'}</dd><dt>홈페이지</dt><dd>{safeUrl(detail.website) ? <a href={safeUrl(detail.website)} target="_blank" rel="noreferrer">홈페이지 열기 ↗</a> : '확인 필요'}</dd></dl></section>
          <section className="detail-section"><h3>조사 근거</h3><p>{detail.evidence}</p><p><a href={safeUrl(detail.source_url)} target="_blank" rel="noreferrer">출처 열기 ↗</a> · {detail.verified_on} 확인</p>
          </section></TabsContent><TabsContent value="note"><section className="detail-section"><Label htmlFor="note"><strong>영업 메모</strong></Label><Textarea id="note" value={note} maxLength={2000} placeholder="다음 연락에서 확인할 내용을 적어보세요." onChange={(event) => setNote(event.target.value)} /></section>
          <Button className="primary" disabled={isDisabled} onClick={() => persist([detail], 'note')}>{saved[detail.id] ? '메모 저장' : '업체와 메모 저장'}</Button></TabsContent></Tabs>
          {message && <p className="notice" role="status">{message}</p>}
        </DialogContent>}
      </Dialog>
    </div>
  );
}
