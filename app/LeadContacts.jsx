'use client';

import { useEffect, useState } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';

export default function LeadContacts({ db, userId, companyId }) {
  const [contacts, setContacts] = useState(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const table = () => db.from('lead_contacts');

  useEffect(() => {
    let active = true;
    async function load() {
      const rows = [];
      for (let offset = 0; ; offset += 500) {
        const { data, error } = await table().select('id,name,phone')
          .eq('user_id', userId).eq('company_id', companyId).order('id').range(offset, offset + 499);
        if (!active) return;
        if (error) {
          setMessage('담당자 목록을 불러오지 못했습니다.');
          return;
        }
        rows.push(...data);
        if (data.length < 500) break;
      }
      setContacts(rows);
    }
    void load();
    return () => { active = false; };
  }, [db, userId, companyId]);

  function reset() {
    setEditing(null);
    setName('');
    setPhone('');
  }

  async function save() {
    if (busy || !name.trim()) return;
    setBusy(true);
    setMessage('');
    try {
      const fields = { name: name.trim(), phone: phone.trim() };
      const change = editing ? table().update(fields).eq('id', editing)
        : table().insert({ ...fields, company_id: companyId });
      const { data, error } = await change.select('id,name,phone').single();
      if (error) throw error;
      setContacts((rows) => editing ? rows.map((row) => row.id === editing ? data : row) : [...rows, data]);
      reset();
    } catch {
      setMessage('담당자를 저장하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  }

  async function remove(id) {
    if (busy) return;
    setBusy(true);
    setMessage('');
    try {
      const { error } = await table().delete().eq('id', id);
      if (error) throw error;
      setContacts((rows) => rows.filter((row) => row.id !== id));
      if (editing === id) reset();
    } catch {
      setMessage('담당자를 삭제하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  }

  return <section className="detail-section">
    {contacts?.length === 0 && <p>등록된 담당자가 없어요.</p>}
    {contacts?.map((contact) => <div className="setting-row" key={contact.id}>
      <span><strong>{contact.name}</strong>{contact.phone && <><br />{contact.phone}</>}</span>
      <span>
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => {
          setEditing(contact.id); setName(contact.name); setPhone(contact.phone);
        }}>수정</Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => remove(contact.id)}>삭제</Button>
      </span>
    </div>)}
    {contacts && <div className="lead-contact-fields">
      <Label htmlFor="contact-name">담당자 이름</Label>
      <Input id="contact-name" value={name} maxLength={120} disabled={busy} onChange={(event) => setName(event.target.value)} />
      <Label htmlFor="contact-phone">직통 연락처</Label>
      <Input id="contact-phone" type="tel" value={phone} maxLength={120} disabled={busy} onChange={(event) => setPhone(event.target.value)} />
      <div>
        <Button disabled={busy || !name.trim()} onClick={save}>{editing ? '수정 저장' : '담당자 추가'}</Button>
        {editing && <Button variant="ghost" disabled={busy} onClick={reset}>취소</Button>}
      </div>
    </div>}
    {message && <p role="status">{message}</p>}
  </section>;
}
