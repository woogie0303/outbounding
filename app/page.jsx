'use client';

import { MapPin, CalendarDays, Settings as SettingsIcon, Columns3, List, MoreHorizontal, ListChecks as CheckboxIcon } from 'lucide-react';
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
import { DropdownMenu as Menu } from 'radix-ui';
import Picker from './Picker';
import AccountBoard from './AccountBoard';
import { SalesDashboard, ContactLog } from './SalesDashboard';
import LeadContacts from './LeadContacts';
import {Nearby, Schedule, Settings} from './WorkspaceScreens';
import {stages,readStage} from './stages.mjs';
import companies from './companies.json';
import { infer, industryGroups, regionGroups, regionTerm, safeUrl } from './data.mjs';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const db = url && key ? createClient(url, key, { auth: { flowType: 'pkce' } }) : null;
const savedKey = 'outbounding.saved';
const trialSearchKey = 'outbounding.trial-searches';
const providers = [['네이버', 'custom:naver'], ['카카오', 'kakao'], ['Google', 'google']];
let trialSession;
async function ensureSession() {
  if (!trialSession) {
    trialSession = (async () => {
      const { data, error } = await db.auth.getSession();
      if (error) throw error;
      if (data.session?.user) return data.session.user;
      const result = await db.auth.signInAnonymously();
      if (result.error) throw result.error;
      return result.data.user;
    })().finally(() => { trialSession = null; });
  }
  return trialSession;
}
const searchPageSize = 50;
const within = (value, min, max) => {
  if (!min && !max) return true;
  if (value === null || value === undefined || value === '') return false;
  const number = Number(value);
  return Number.isFinite(number) && (!min || number >= Number(min)) && (!max || number <= Number(max));
};
const phoneSearchUrl = (row) => 'https://www.google.com/search?' +
  new URLSearchParams({ q: [row.name, row.region, row.city, '전화번호'].filter(Boolean).join(' ') });
const read = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
};
const symbols = { sliders: 'M4 7h16M4 17h16M9 4v6m6 4v6', search: 'M21 21l-4.35-4.35M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z', saved:'M6 4h12v17l-6-4-6 4z', clock:'M12 8v5l3 2m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z', arrow:'M4 12h15m-6-6 6 6-6 6', globe:'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Z M2 12h20M12 2c-5 5-5 15 0 20m0-20c5 5 5 15 0 20', download:'M12 3v12m-4-4 4 4 4-4M5 16v5h14v-5', building:'M4 21h16M7 21V4h10v17M10 8h1m2 0h1m-4 4h1m2 0h1m-4 4h1m2 0h1', pin:'M19 9c0 5-7 11-7 11S5 14 5 9a7 7 0 1 1 14 0Zm-7-2a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z', close:'m6 6 12 12M18 6 6 18' };
function Icon({ name, size = 18 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={symbols[name]} /></svg>;
}

function SelectionCount({value}) {
  const previous = useRef(value);
  const [numbers, setNumbers] = useState({from:value,to:value});
  useEffect(() => {
    setNumbers({from:previous.current,to:value});
    previous.current = value;
  }, [value]);
  return <span className="selection-count" aria-label={String(value)}>
    <span key={numbers.to} className="count-reel" aria-hidden="true">
      <span>{numbers.from}</span><span>{numbers.to}</span>
    </span>
  </span>;
}

export default function Workspace() {
  const [accountView, setAccountView] = useState('board');
  const [tab, setTab] = useState('search');
  const [query, setQuery] = useState('');
  const [revenueMin, setRevenueMin] = useState('');
  const [revenueMax, setRevenueMax] = useState('');
  const [peopleMin, setPeopleMin] = useState('');
  const [peopleMax, setPeopleMax] = useState('');
  const [savedQuery, setSavedQuery] = useState('');
  const [industry, setIndustry] = useState('');
  const [region, setRegion] = useState('');
  const [results, setResults] = useState(null);
  const [searched, setSearched] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [saved, setSaved] = useState({});
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState([]);
  const [showConditions, setShowConditions] = useState(false);
  const [detail, setDetail] = useState(null);
  const [detailKeywords, setDetailKeywords] = useState([]);
  const [detailMonth, setDetailMonth] = useState(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [writing, setWriting] = useState(false);
  const [user, setUser] = useState(null);
  const [authDialog, setAuthDialog] = useState('');
  const [authError, setAuthError] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [existingLogin, setExistingLogin] = useState(false);
  const member = user?.is_anonymous === false;
  const [message, setMessage] = useState('');
  const [initialized, setInitialized] = useState(false);
  const detailTrigger = useRef(null);
  const accountRef = useRef(null);
  const writeLock = useRef(false);
  const pendingNote = useRef(null);
  const noteTimer = useRef(null);
  function flushNote() {
    clearTimeout(noteTimer.current);
    const pending = pendingNote.current;
    if (!pending || writeLock.current) return;
    pendingNote.current = null;
    void persist([pending.company], 'note', pending.value);
  }
  function editNote(value) {
    setNote(value);
    pendingNote.current = {company:detail,value};
    clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(flushNote,600);
  }

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
        const callback = new URL(window.location.href);
        if (callback.searchParams.has('error') || new URLSearchParams(callback.hash.slice(1)).has('error')) {
          setAuthError('로그인을 완료하지 못했어요. 이미 가입한 계정이면 기존 회원 로그인을 선택해 주세요.');
          setAuthDialog('가입 또는 로그인');
          window.history.replaceState(null, '', callback.pathname);
        }
        const account = session.data.session?.user;
        if (!account) return;
        if (active) {
          accountRef.current = account;
          setUser(account);
          await loadSaved(account);
        }
      } catch {
        if (active) setMessage('저장 목록을 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.');
      } finally {
        if (active) setInitialized(true);
      }
    }
    document.documentElement.dataset.compact=String(read('outbounding.compact',false));
    start();
    const subscription = db?.auth.onAuthStateChange((event, session) => {
      if (!active || event === 'INITIAL_SESSION') return;
      const account = session?.user;
      const previous = accountRef.current;
      if (!account) {
        if (event === 'SIGNED_OUT') resetWorkspace();
        return;
      }
      if (previous?.id === account.id && previous.is_anonymous === account.is_anonymous) return;
      if (previous && previous.id !== account.id) resetWorkspace();
      accountRef.current = account;
      setUser(account);
      if (account.is_anonymous === false) {
        setTimeout(() => {
          if (active && accountRef.current?.id === account.id) {
            loadSaved(account).catch(() => {
              if (active && accountRef.current?.id === account.id) setMessage('저장 목록을 불러오지 못했습니다.');
            });
          }
        }, 0);
      }
    }).data.subscription;
    return () => { active = false; subscription?.unsubscribe(); };
  }, []);

  useEffect(() => { if (member) setTab('dashboard'); }, [member]);
  function promptSignup(reason) {
    setAuthDialog(reason);
    setAuthError('');
    setExistingLogin(false);
  }

  async function login(provider) {
    if (!db || authBusy) return;
    setAuthBusy(true);
    setAuthError('');
    try {
      const { data, error } = await db.auth.getSession();
      if (error) throw error;
      const options = { redirectTo: window.location.origin + window.location.pathname };
      const response = data.session?.user.is_anonymous && !existingLogin
        ? await db.auth.linkIdentity({ provider, options })
        : await db.auth.signInWithOAuth({ provider, options });
      if (response.error) throw response.error;
    } catch {
      setAuthError('로그인을 시작하지 못했어요. 잠시 후 다시 시도해 주세요.');
      setAuthBusy(false);
    }
  }

  async function logout() {
    const { error } = await db.auth.signOut({ scope: 'local' });
    if (error) {
      setMessage('로그아웃하지 못했습니다.');
      return;
    }
    resetWorkspace();
  }

  function resetWorkspace() {
    accountRef.current = null;
    clearTimeout(noteTimer.current);
    pendingNote.current = null;
    setDetail(null);
    setUser(null);
    setSaved({});
    setResults(null);
    setHasMore(false);
    setSearched(null);
    changeTab('search');
  }

  useEffect(() => {
    setDetailKeywords([]);
    setDetailMonth(null);
    if (!db || !detail) return;
    let active = true;
    async function loadDetails() {
      const [keywords, snapshot] = await Promise.all([
        db.from('company_keywords').select('keyword,source_url,verified_on')
          .eq('company_id', detail.id).not('verified_on', 'is', null).order('keyword'),
        detail.data_month && detail.snapshot_present
          ? db.from('pension_snapshot').select('data_month').maybeSingle()
          : null,
      ]);
      if (!active) return;
      if (!keywords.error) setDetailKeywords(keywords.data);
      if (snapshot?.data) setDetailMonth(snapshot.data.data_month);
    }
    void loadDetails();
    return () => { active = false; };
  }, [detail]);

  async function loadSaved(account) {
    const entries = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await db.from('saved_companies')
        .select('note,stage,next_contact_on,companies(*)').eq('user_id', account.id)
        .order('company_id').range(offset, offset + 499);
      if (error) throw error;
      for (const row of data) {
        if (row.companies) entries.push([row.companies.id, { company: row.companies, note: row.note, stage: row.stage, next: row.next_contact_on }]);
      }
      if (data.length < 500) break;
    }
    if (accountRef.current?.id === account.id) setSaved(Object.fromEntries(entries));
  }

  async function search(event, append = false) {
    event?.preventDefault();
    if (busy || !initialized) return;
    if (!append && !industry && !region && !query.trim()) {
      setShowConditions(true);
      setMessage('업종, 지역 또는 키워드를 입력해 주세요.');
      return;
    }
    const inferred = infer(query);
    const selectedRegion = region || inferred.region || '';
    const selectedIndustry = industry || (!db ? inferred.industry : '') || '';
    let keyword = query.trim();
    if (selectedIndustry && inferred.industry === selectedIndustry) {
      keyword = keyword.replace(selectedIndustry, '');
      const alias = { '식자재 유통사': '식자재', '식품 제조업체': '식품 제조', '화장품 업체': '화장품' }[selectedIndustry];
      if (alias && keyword === query.trim()) keyword = keyword.replace(alias, '');
    }
    if (selectedRegion && inferred.region === selectedRegion) {
      keyword = keyword.replace(regionTerm(selectedRegion), ' ');
    }
    const filters = append ? searched : { request: crypto.randomUUID(), industry: selectedIndustry, region: selectedRegion, keyword: keyword.replaceAll(',', ' ').trim(), peopleMin, peopleMax, revenueMin, revenueMax };
    setSelecting(false);
    setBusy(true);
    setShowConditions(false);

    setMessage('');
    setSelected([]);
    try {
      let rows;
      if (db) {
        const account = await ensureSession();
        if (accountRef.current?.id !== account.id) return;
        const { data, error } = await db.rpc('search_companies', {
          p_request: filters.request,
          p_industry: filters.industry || null,
          p_region: filters.region || null,
          p_query: filters.keyword || null,
          p_people_min: filters.peopleMin ? Number(filters.peopleMin) : null,
          p_people_max: filters.peopleMax ? Number(filters.peopleMax) : null,
          p_require_revenue: Boolean(filters.revenueMin || filters.revenueMax),
          p_after: append ? results.at(-1).id : null,
          p_limit: searchPageSize + 1,
        }).order('id');
        if (accountRef.current?.id !== account.id) return;
        if (error) throw error;
        rows = data;
      } else {
        const attempts = read(trialSearchKey, 0);
        if (!append && attempts >= 10) {
          promptSignup('검색 10회를 모두 사용했어요. 가입하면 계속 검색할 수 있어요.');
          return;
        }
        if (!append) localStorage.setItem(trialSearchKey, JSON.stringify(attempts + 1));
        const terms = filters.keyword.toLowerCase().split(/\s+/u).filter(Boolean);
        rows = companies.filter((row) => {
          const text = [row.name, row.industry, row.region, row.city].join(' ').toLowerCase();
          return (!filters.industry || row.industry === filters.industry) &&
            (!filters.region || [row.region, row.city].includes(filters.region)) &&
            terms.every((term) => text.includes(term)) &&
            within(row.employee_count ?? row.headcount, filters.peopleMin, filters.peopleMax) &&
            within(row.revenue, filters.revenueMin ? Number(filters.revenueMin) * 100000000 : '',
              filters.revenueMax ? Number(filters.revenueMax) * 100000000 : '');
        });
      }
      setHasMore(rows.length > searchPageSize);
      setResults(append ? [...results, ...rows.slice(0, searchPageSize)] : rows.slice(0, searchPageSize));
      setSearched(filters);
    } catch (error) {
      if (error.message === 'SIGNUP_SEARCH_LIMIT') promptSignup('검색 10회를 모두 사용했어요. 가입하면 계속 검색할 수 있어요.');
      else if (error.message === 'SEARCH_PAGE_EXPIRED') {
        setHasMore(false);
        setMessage('검색 결과가 만료되었어요. 다시 검색해 주세요.');
      } else setMessage('검색을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    } finally { setBusy(false); }
  }

  function changeTab(value) {
    if (value === 'nearby' && !member) {
      promptSignup('주변 업체를 보려면 가입해 주세요.');
      return;
    }
    setSelecting(false);
    setTab(value);
    setShowConditions(false);
    setMessage('');
    setSelected([]);
  }

  async function persist(rows, mode, memo = '') {
    if (!initialized || writeLock.current || !rows.length) return false;
    const newCompanies = new Set(rows.filter((row) => !saved[row.id]).map((row) => row.id));
    if (!member && ['add', 'note'].includes(mode) && newCompanies.size && Object.keys(saved).length + newCompanies.size > 5) {
      promptSignup('거래처를 5개 넘게 저장하려면 가입해 주세요.');
      return false;
    }
    writeLock.current = true;
    setWriting(true);
    setMessage('');
    try {
      if (db) {
        const account = await ensureSession();
        if (accountRef.current?.id !== account.id) return false;
        const table = db.from('saved_companies');
        const ids = rows.map((row) => row.id);
        const fields = mode === 'note' ? { note: memo } : mode === 'stage' ? { stage: memo } : {};
        const records = ids.map((id) => ({ user_id: account.id, company_id: id, ...fields }));
        const response = mode === 'remove' ? await table.delete().eq('user_id', account.id).in('company_id', ids)
          : mode === 'stage' ? await table.update(fields).eq('user_id', account.id).eq('company_id', ids[0]).select('company_id').single()
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
      return true;

    } catch (error) {
      if (error.message === 'SIGNUP_SAVED_LIMIT') promptSignup('거래처를 5개 넘게 저장하려면 가입해 주세요.');
      else setMessage('변경을 완료하지 못했습니다. 연결 상태를 확인하고 다시 시도해 주세요.');
      return false;
    } finally {
      setWriting(false);
      writeLock.current = false;
      if (pendingNote.current) flushNote();
    }
  }

  const list = tab === 'saved' ? Object.values(saved).map((entry) => entry.company) : results ?? [];
  const visible = tab === 'saved' ? list.filter((row) => [row.name, row.industry, row.city, row.region, row.phone].filter(Boolean).join(' ').toLowerCase().includes(savedQuery.trim().toLowerCase())) : list;
  const chosen = visible.filter((row) => selected.includes(row.id));
  const isDisabled = !initialized || writing;

  async function exportCsv() {
    if (!visible.length) return;
    try {
      const {Workbook} = await import('exceljs');
      const book = new Workbook();
      const sheet = book.addWorksheet('업체 목록');
      sheet.columns = [{header:'업체명',key:'name',width:24},{header:'업종',key:'industry',width:22},{header:'지역',key:'region',width:20},{header:'대표전화',key:'phone',width:20},{header:'인원수',key:'headcount',width:14},{header:'매출액',key:'revenue',width:20}];
      for (const row of chosen.length ? chosen : visible) sheet.addRow({...row,region:row.city || row.region,headcount:row.employee_count ?? row.headcount ?? ''});
      const file = new Blob([await book.xlsx.writeBuffer()],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
      const href = URL.createObjectURL(file);
      const link = document.createElement('a');
      link.href=href;link.download='outbounding-업체목록.xlsx';link.click();
      setTimeout(()=>URL.revokeObjectURL(href),1000);
    } catch {setMessage('엑셀 다운로드에 실패했습니다. 다시 시도해 주세요.');}
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
      {!landing && <><aside className="workspace-sidebar">
        <Button variant="ghost" className="brand" onClick={() => {setResults(null); changeTab('search');}}><span aria-hidden="true" className="route-mark"/> Outbounding</Button>
        <nav aria-label="주 메뉴">
          
          <Button variant="ghost" onClick={()=>changeTab('dashboard')}>대시보드</Button>
          <Button variant="ghost" aria-current={tab === 'search' ? 'page' : undefined} onClick={() => changeTab('search')}><Icon name="building" size={15}/> 기업 검색</Button>
          <Button variant="ghost" aria-current={tab === 'saved' ? 'page' : undefined} onClick={() => changeTab('saved')}><Icon name="saved" size={15}/> 내 거래처 <span className="sidebar-count">{Object.keys(saved).length}</span></Button>
          <Button variant="ghost" aria-current={tab === 'nearby' ? 'page' : undefined} onClick={()=>changeTab('nearby')}><MapPin size={15}/>주변 업체</Button>
          <Button variant="ghost" aria-current={tab === 'schedule' ? 'page' : undefined} onClick={()=>changeTab('schedule')}><CalendarDays size={15}/>연락 일정</Button>
        </nav><Button className="sidebar-settings" variant="ghost" aria-current={tab === 'settings' ? 'page' : undefined} onClick={()=>changeTab('settings')}><SettingsIcon size={15}/>설정</Button>
      </aside>
      </>}
      <main>
        <div className="content">
          {tab === 'dashboard' && <SalesDashboard key={user?.id} db={db} user={user} saved={saved} open={openDetail} save={persist}/>}
          {tab === 'nearby' && member && <Nearby db={db} open={openDetail}/>}
          {tab === 'schedule' && <Schedule saved={saved} open={openDetail}/>}
          {tab === 'settings' && <Settings user={user} member={member} count={Object.keys(saved).length}
            onAccountAction={() => member ? logout() : promptSignup('가입 또는 로그인')} accountBusy={writing || busy}/>}
          {tab === 'search' && landing && <section className="search-stage" aria-label="업체 발굴">
            <h1 className="sr-only">아웃바운딩 업체 검색</h1>
            <form className="search-box" onSubmit={search}>
              {landing && <div className="composer-brand"><span aria-hidden="true" className="route-mark" />Outbounding</div>}
              <div className="search-line">
                <Icon name="search" size={22} />
                <Label className="sr-only" htmlFor="query">검색 조건</Label>
                <Input id="query" type="search" value={query} readOnly={busy} maxLength={160} onChange={(event) => setQuery(event.target.value)} placeholder="찾고 싶은 업체를 입력하세요" />
                <Button variant="ghost" type="button" className="condition-toggle" disabled={busy} aria-label="검색 필터" aria-expanded={showConditions} aria-controls="search-conditions" onClick={() => setShowConditions(!showConditions)}><Icon name="sliders" size={18} /></Button>
                <Button type="submit" className="search-submit" aria-label="업체 찾기" disabled={busy}><Icon name="arrow" size={21} /></Button>
              </div>
              <div id="search-conditions" className="condition-reveal" data-open={showConditions} inert={!showConditions}>
                <div className="condition-inner"><h2 className="filter-heading">검색 상세</h2>
                  {showConditions && <Picker fields={{
                    업종: { groups: industryGroups, value: industry, change: setIndustry },
                    지역: { groups: regionGroups, value: region, change: setRegion }
                  }} />}
                  <div className="range-condition"><Label>매출액</Label><div className="range-options" role="group" aria-label="매출액 범위">{[['전체','',''],['10억 미만','0','9.99999999'],['10–50억','10','49.99999999'],['50–100억','50','99.99999999'],['100–500억','100','499.99999999'],['500억 이상','500','']].map(([label,min,max]) => <Button key={label} type="button" variant="outline" aria-pressed={revenueMin === min && revenueMax === max} onClick={() => {setRevenueMin(min);setRevenueMax(max);}}>{label}</Button>)}</div></div>
                  <div className="range-condition"><Label>인원수</Label><div className="range-options" role="group" aria-label="인원수 범위">{[['전체','',''],['1–10명','1','10'],['11–50명','11','50'],['51–100명','51','100'],['101–300명','101','300'],['301명 이상','301','']].map(([label,min,max]) => <Button key={label} type="button" variant="outline" aria-pressed={peopleMin === min && peopleMax === max} onClick={() => {setPeopleMin(min);setPeopleMax(max);}}>{label}</Button>)}</div></div>
                  <p className="range-hint">매출액·인원수 조건을 지정하면 해당 정보가 확인된 업체만 표시됩니다.</p>

                </div>
              </div>
            </form>
            <div className="landing-account-actions"><Button variant="ghost" onClick={()=>changeTab('dashboard')}>대시보드</Button>
              <Button variant="ghost" onClick={() => member ? changeTab('settings') : promptSignup('가입 또는 로그인')}>{member ? '내 계정' : '가입 · 로그인'}</Button>
              <Button variant="ghost" onClick={() => changeTab('nearby')}><MapPin size={15}/>주변 업체</Button>
            </div>
            {busy && <p className="search-status" role="status">업체를 찾고 있어요…</p>}
          </section>}
          {message && !detail && <p className="notice" role="status">{message}</p>}
          {(tab === 'saved' || (tab === 'search' && results !== null && !busy)) && <section className="results" key={tab === 'saved' ? tab : JSON.stringify(searched)}>
            <div className="section-heading">
              <div><h2>{tab === 'saved' ? '내 거래처' : '기업 검색'} <span>{visible.length}개</span></h2>{tab === 'search' && searched && <p>{[searched.region, searched.industry, searched.keyword].filter(Boolean).join(' · ')}</p>}</div>
              <div className="list-actions">
                <form className="list-search" onSubmit={tab === 'search' ? search : (event) => event.preventDefault()}>
                  <Icon name="search" size={15}/>
                  <Input aria-label={tab === 'saved' ? '저장한 업체 검색' : '업체 검색'} value={tab === 'saved' ? savedQuery : query} maxLength={160} onChange={(event) => tab === 'saved' ? setSavedQuery(event.target.value) : setQuery(event.target.value)} placeholder={tab === 'saved' ? '저장한 업체 검색' : '업체 검색'} />
                  {tab === 'search' && <Button type="button" variant="ghost" size="icon" aria-label="검색 필터" title="검색 필터" onClick={() => setShowConditions(!showConditions)}><Icon name="sliders" size={16}/></Button>}
                </form>
                {tab === 'search' && showConditions && <form className="list-filter-dropdown" onSubmit={search}>
                  <div className="dropdown-heading"><strong>검색 조건</strong><Button type="button" variant="ghost" size="icon" aria-label="검색 조건 닫기" onClick={() => setShowConditions(false)}><Icon name="close" size={14}/></Button></div>
                  <Picker fields={{
                    업종: {groups: industryGroups, value: industry, change: setIndustry},
                    지역: {groups: regionGroups, value: region, change: setRegion}
                  }}/>
                  <div className="range-condition"><Label>매출액</Label><div className="range-options" role="group" aria-label="매출액 범위">{[['전체','',''],['10억 미만','0','9.99999999'],['10–50억','10','49.99999999'],['50–100억','50','99.99999999'],['100–500억','100','499.99999999'],['500억 이상','500','']].map(([label,min,max]) => <Button key={label} type="button" variant="outline" aria-pressed={revenueMin === min && revenueMax === max} onClick={() => {setRevenueMin(min);setRevenueMax(max);}}>{label}</Button>)}</div></div>
                  <div className="range-condition"><Label>인원수</Label><div className="range-options" role="group" aria-label="인원수 범위">{[['전체','',''],['1–10명','1','10'],['11–50명','11','50'],['51–100명','51','100'],['101–300명','101','300'],['301명 이상','301','']].map(([label,min,max]) => <Button key={label} type="button" variant="outline" aria-pressed={peopleMin === min && peopleMax === max} onClick={() => {setPeopleMin(min);setPeopleMax(max);}}>{label}</Button>)}</div></div>
                  <p className="range-hint">매출액·인원수 조건을 지정하면 해당 정보가 확인된 업체만 표시됩니다.</p>
                  <Button type="submit" disabled={busy || (revenueMin && revenueMax && Number(revenueMin) > Number(revenueMax)) || (peopleMin && peopleMax && Number(peopleMin) > Number(peopleMax))}>적용</Button>
                </form>}


                <Button className={'selection-action' + (chosen.length ? ' has-selection' : '')} variant={chosen.length ? 'default' : 'ghost'} aria-pressed={selecting} aria-label={chosen.length ? tab === 'search' ? '거래처 추가' : '선택 삭제' : '목록 선택'} disabled={chosen.length ? isDisabled : !visible.length} onClick={async () => {
                  if (!chosen.length) {setSelecting(!selecting);return;}
                  if (await persist(chosen, tab === 'saved' ? 'remove' : 'add')) { setSelecting(false);setSelected([]); }
                }}>{chosen.length ? <span className="selection-label" key="action"><SelectionCount value={chosen.length}/>개 {tab === 'search' ? '거래처 추가' : '삭제'}</span> : <CheckboxIcon key="icon" size={17}/>}</Button>

                <Menu.Root><Menu.Trigger asChild><Button variant="ghost" size="icon" aria-label="더보기"><MoreHorizontal size={18}/></Button></Menu.Trigger>
                  <Menu.Portal><Menu.Content className="more-menu" align="end" sideOffset={8}>
                    {tab === 'saved' && <><Menu.RadioGroup className="menu-view-toggle" value={accountView} onValueChange={setAccountView} aria-label="거래처 보기">
                      <Menu.RadioItem className="menu-view-item" value="board" aria-label="보드 보기"><Columns3 size={16}/></Menu.RadioItem>
                      <Menu.RadioItem className="menu-view-item" value="list" aria-label="리스트 보기"><List size={16}/></Menu.RadioItem>
                    </Menu.RadioGroup><Menu.Separator className="more-separator"/></>}


                    <Menu.Item className="more-item" disabled={!visible.length} onSelect={exportCsv}><Icon name="download" size={15}/> 엑셀 다운로드</Menu.Item>
                  </Menu.Content></Menu.Portal>
                </Menu.Root>
              </div>
            </div>
            {visible.length === 0 && tab !== 'saved' && <div className="empty">
              <span className="empty-icon"><Icon name={tab === 'saved' ? 'saved' : 'search'} size={20} /></span>
              <strong>{tab === 'saved' ? '아직 저장한 업체가 없어요' : '검색된 업체가 없어요'}</strong>
              <p>{tab === 'saved' ? '통화할 업체를 저장하면 여기에 모입니다.' : '다른 업종이나 인근 지역으로 검색해 보세요.'}</p>
              <Button variant="outline" onClick={() => { changeTab('search'); setShowConditions(true); window.scrollTo(0,0); }}>{tab === 'saved' ? '업체 찾기' : '검색 조건 변경'}</Button>
            </div>}
            {tab === 'saved' && selecting && accountView === 'board' && <Label className="board-select-all"><Checkbox checked={visible.length > 0 && chosen.length === visible.length ? true : chosen.length ? 'indeterminate' : false} onCheckedChange={checked=>setSelected(checked === true ? visible.map(row=>row.id) : [])}/>전체 선택</Label>}
            {tab === 'saved' && accountView === 'board' && <AccountBoard rows={visible} saved={saved} open={openDetail} onError={setMessage} onStageChange={db ? (row, stage) => persist([row], 'stage', stage) : undefined} selecting={selecting} selected={selected} onSelect={(id,checked)=>setSelected(current=>checked ? [...new Set([...current,id])] : current.filter(value=>value!==id))}/>}

            {(tab === 'search' || (tab === 'saved' && accountView === 'list')) && visible.length > 0 && <div className="crm-register">
              <div className="crm-table-wrap"><Table className="crm-table"><TableCaption className="sr-only">업체 레코드</TableCaption><TableHeader><TableRow>
                {selecting && <TableHead className="selection-cell"><Checkbox aria-label="전체 업체 선택" checked={chosen.length === visible.length ? true : chosen.length > 0 ? 'indeterminate' : false} onCheckedChange={(checked) => setSelected(checked === true ? visible.map((row) => row.id) : [])}/></TableHead>}<TableHead>업체명</TableHead><TableHead className="industry-col">업종</TableHead><TableHead>지역</TableHead><TableHead className="phone-col">대표전화</TableHead><TableHead>인원수</TableHead><TableHead>매출액</TableHead>
              </TableRow></TableHeader><TableBody>{visible.map((row) => <TableRow key={row.id}>
                {selecting && <TableCell className="selection-cell"><Checkbox aria-label={`${row.name} 선택`} checked={selected.includes(row.id)} onCheckedChange={(checked) => setSelected(checked === true ? [...selected, row.id] : selected.filter((id) => id !== row.id))} /></TableCell>}
                <TableCell><Button variant="ghost" className="crm-name" onClick={() => openDetail(row)}><span className="account-glyph" aria-hidden="true">{row.name.slice(0,1)}</span>{row.name}{tab === 'saved' ? <span className="stage-badge" data-stage-index={stages.indexOf(saved[row.id]?.stage ?? readStage(row.id))}>{saved[row.id]?.stage ?? readStage(row.id)}</span> : saved[row.id] && <span className="added-mark">추가됨</span>}</Button></TableCell>
                <TableCell className="industry-col"><Badge variant="secondary" data-tone={Array.from(row.industry).reduce((sum, char) => sum + char.charCodeAt(0), 0) % 6}>{row.industry}</Badge></TableCell><TableCell>{row.city || row.region}</TableCell><TableCell className="phone-col">{row.phone || '확인 필요'}</TableCell><TableCell><span className="metric-value">{row.headcount ?? row.employee_count ?? '미확인'}</span></TableCell><TableCell><span className="metric-value">{row.revenue ?? '미확인'}</span></TableCell>
              </TableRow>)}</TableBody></Table></div>

            </div>}
            {tab === 'search' && hasMore && <Button variant="outline" onClick={() => search(null, true)}>다음 업체 보기</Button>}
          </section>}

        </div>
      </main>
      <Dialog open={Boolean(detail)} onOpenChange={(open) => { if (!open) { flushNote(); setDetail(null); setMessage(''); } }}>
        {detail && <DialogContent className="detail" onCloseAutoFocus={(event) => { event.preventDefault(); detailTrigger.current?.focus(); }}>
          <div className="record-identity"><span aria-hidden="true" className="record-initial">{detail.name.slice(0,1)}</span><DialogTitle>{detail.name}</DialogTitle></div>
          <DialogDescription>{detail.region} {detail.city} · {detail.industry}</DialogDescription>
          <Tabs defaultValue="overview" className="record-tabs">
            <TabsList aria-label="업체 상세"><TabsTrigger value="overview">업체 정보</TabsTrigger><TabsTrigger value="note">영업 메모</TabsTrigger><TabsTrigger value="history">연락 기록</TabsTrigger><TabsTrigger value="contacts">담당자</TabsTrigger></TabsList>
            <TabsContent value="overview">
          <section className="detail-section"><h3>기본 정보</h3><dl><dt>주소</dt><dd>{detail.address || '확인 필요'}</dd><dt>대표전화</dt><dd>{detail.phone || <a href={phoneSearchUrl(detail)} target="_blank" rel="noreferrer">전화번호 검색 ↗</a>}</dd><dt>사업용 이메일</dt><dd>{detail.email || '확인 필요'}</dd><dt>홈페이지</dt><dd>{safeUrl(detail.website) ? <a href={safeUrl(detail.website)} target="_blank" rel="noreferrer">홈페이지 열기 ↗</a> : '확인 필요'}</dd>
          {detail.data_month && <><dt>사업자등록번호{detail.business_number && !/^\d{10}$/.test(detail.business_number) ? ' (일부 공개)' : ''}</dt><dd>{detail.business_number || '미제공'}</dd><dt>국민연금 가입 상태</dt><dd>{detail.pension_status === 1 ? '등록' : '탈퇴'}{!detail.snapshot_present && ' · 최신 파일에서 미확인'}</dd><dt>가입자 수</dt><dd>{detail.employee_count ?? '미제공'}</dd><dt>원본 업종코드</dt><dd>{detail.industry_code || '미제공'}</dd>{detail.industry_group && <><dt>업종 대분류</dt><dd>{detail.industry_group}</dd></>}<dt>데이터 기준월</dt><dd>{(detailMonth ?? detail.data_month).slice(0, 7)}</dd><dt>마지막 정보 변경일</dt><dd>{detail.updated_at?.slice(0, 10)}</dd></>}</dl></section>
          {detailKeywords.length > 0 && <section className="detail-section"><h3>확인된 키워드</h3><ul>{detailKeywords.map(({ keyword, source_url, verified_on }) => <li key={keyword}><a href={safeUrl(source_url)} target="_blank" rel="noreferrer">{keyword} ↗</a> · {verified_on} 확인</li>)}</ul></section>}
          <section className="detail-section"><h3>조사 근거</h3><p>{detail.evidence}</p><p><a href={safeUrl(detail.source_url)} target="_blank" rel="noreferrer">출처 열기 ↗</a> · {detail.verified_on} 확인</p>
          </section></TabsContent><TabsContent value="note"><section className="detail-section"><Label htmlFor="note"><strong>영업 메모</strong></Label><Textarea id="note" value={note} maxLength={2000} placeholder="다음 연락에서 확인할 내용을 적어보세요." onBlur={flushNote} onChange={(event) => editNote(event.target.value)} /></section>
</TabsContent>
            <TabsContent value="history">{db && user && saved[detail.id] ? <ContactLog key={detail.id} db={db} user={user} company={detail} entry={saved[detail.id]} onSaved={loadSaved}/> : <p>연락을 기록하려면 거래처에 먼저 저장해 주세요.</p>}</TabsContent><TabsContent value="contacts">
              {db && saved[detail.id] && user ? <LeadContacts key={user.id + ':' + detail.id} db={db} userId={user.id} companyId={detail.id}/>
                : <section className="detail-section">
                  {db ? <Button disabled={isDisabled} onClick={() => persist([detail], 'add')}>거래처로 저장</Button>
                    : <p>담당자를 저장하려면 Supabase 연결이 필요해요.</p>}
                </section>}
            </TabsContent>
          </Tabs>
          {message && <p className="notice" role="status">{message}</p>}
        </DialogContent>}
      </Dialog>
      <Dialog open={Boolean(authDialog)} onOpenChange={(open) => { if (!open) setAuthDialog(''); }}>
        <DialogContent>
          <DialogTitle>회원가입 · 로그인</DialogTitle>
          <DialogDescription>{authDialog}</DialogDescription>
          <div className="auth-provider-list">
            {providers.map(([label, provider]) => <Button key={provider} variant="outline" disabled={!db || authBusy}
              onClick={() => login(provider)}>{label}로 {existingLogin ? '로그인' : '계속하기'}</Button>)}
            {user?.is_anonymous && <Button variant="ghost" disabled={authBusy} onClick={() => {
              setExistingLogin(!existingLogin); setAuthError('');
            }}>{existingLogin ? '체험 데이터로 가입하기' : '기존 회원 로그인'}</Button>}
          </div>
          {existingLogin && <p>기존 계정의 거래처가 열려요. 이 브라우저에서 체험으로 저장한 거래처는 기존 계정에 합쳐지지 않아요.</p>}
          {!db && <p>가입 기능을 사용하려면 Supabase 연결이 필요해요.</p>}
          {authError && <p role="alert">{authError}</p>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
