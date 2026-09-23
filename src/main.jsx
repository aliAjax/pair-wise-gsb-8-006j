import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { DM, isAbsent } from './eligibility.js';
import * as store from './store.js';
import AttendanceBoard from './AttendanceBoard.jsx';

function App() {
  const [data, setData] = useState(store.load);
  const [actor, setActor] = useState(() => localStorage.getItem('campaign-actor') || DM);
  const [tab, setTab] = useState('timeline');
  const [active, setActive] = useState(2);
  const [show, setShow] = useState(false);
  const [editing, setEditing] = useState(null);
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState({ title: '', date: '2024-07-01', summary: '', tag: '主线' });
  const [editForm, setEditForm] = useState({ title: '', date: '', summary: '', tag: '主线', reason: '' });

  useEffect(() => store.save(data), [data]);
  useEffect(() => localStorage.setItem('campaign-actor', actor), [actor]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(''), 3600);
    return () => clearTimeout(t);
  }, [notice]);

  const act = (fn, ...args) => {
    const r = fn(data, ...args);
    if (r.ok) {
      setData(r.data);
      setNotice(r.message || '已保存');
    } else {
      setNotice(r.error || '操作被拒绝');
    }
    return r.ok;
  };

  const cur = data.sessions.find(x => x.id === active) || data.sessions[0];
  const identities = [DM, ...new Set(data.characters.map(c => c.player))];
  const presentCount = cur ? data.characters.filter(c => !isAbsent(cur, c.player)).length : 0;
  const absentCount = data.characters.length - presentCount;

  const add = () => {
    if (!form.title) return;
    const s = { ...form, id: Date.now(), color: '#d8a153' };
    if (act(store.addSession, s)) {
      setActive(s.id);
      setForm({ title: '', date: '2024-07-01', summary: '', tag: '主线' });
      setShow(false);
    }
  };

  const openEdit = () => {
    if (!cur) return;
    setEditForm({ title: cur.title, date: cur.date, summary: cur.summary, tag: cur.tag, reason: '' });
    setEditing(cur.id);
  };
  const saveEdit = () => {
    const { title, date, summary, tag, reason } = editForm;
    if (act(store.editChapter, editing, actor, { title, date, summary, tag }, reason)) setEditing(null);
  };

  const exportData = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    a.download = 'campaign.json';
    a.click();
    setNotice('战役记录已导出');
  };

  return <div className="shell">
    <aside>
      <div className="logo"><span>✦</span> CAMPAIGNER</div>
      <div className="campaign">
        <small>当前战役</small>
        <strong>{data.name}</strong>
        <span>{data.system} · 2024</span>
      </div>
      <nav>
        {[['timeline', '◌', '时间线'], ['characters', '♙', '角色与阵营'], ['places', '⌖', '地点图鉴'], ['loot', '◇', '战利品']].map(([id, i, t]) =>
          <button className={tab === id ? 'active' : ''} onClick={() => setTab(id)} key={id}><i>{i}</i>{t}</button>)}
      </nav>
      <div className="side-bottom">
        <button>⚙ 偏好设置</button>
        <small>本地存储已开启</small>
      </div>
    </aside>
    <main>
      <header>
        <div>
          <span className="crumb">MY CAMPAIGN / {data.system}</span>
          <h1>{tab === 'timeline' ? '战役时间线' : tab === 'characters' ? '角色与阵营' : tab === 'places' ? '地点图鉴' : '战利品'}</h1>
        </div>
        <div className="actions">
          <label className="identity">当前身份
            <select value={actor} onChange={e => setActor(e.target.value)}>
              {identities.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
          <button onClick={exportData} className="outline">↓ 导出</button>
          <button onClick={() => setShow(true)} className="primary">＋ 新建章节</button>
        </div>
      </header>

      {tab === 'timeline' && <div className="timeline-layout">
        <section className="timeline">
          <div className="timeline-intro">
            <div><span>THE CHRONICLE</span><h2>记录每一次冒险</h2></div>
            <span className="count">{data.sessions.length} CHAPTERS</span>
          </div>
          {data.sessions.map((s, i) => {
            const abs = data.characters.filter(c => isAbsent(s, c.player)).length;
            const pend = (s.proxyNotes || []).filter(n => n.status === 'pending').length;
            return <button className={'chapter ' + (active === s.id ? 'selected' : '')} onClick={() => setActive(s.id)} key={s.id}>
              <div className="date">
                <b>{new Date(s.date).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })}</b>
                <small>{new Date(s.date).getFullYear()}</small>
              </div>
              <div className="line">
                <span style={{ background: s.color }}></span>
                {i < data.sessions.length - 1 && <i />}
              </div>
              <div className="chapter-copy">
                <div className="tag">{s.tag}</div>
                <h3>{s.title}</h3>
                <p>{s.summary}</p>
                <div className="badges">
                  {s.archived && <span className="badge arch">已收档</span>}
                  {pend > 0 && <span className="badge pend">待确认 {pend}</span>}
                  {abs > 0 && <span className="badge">缺席 {abs}</span>}
                </div>
              </div>
              <span className="arrow">↗</span>
            </button>;
          })}
        </section>
        <section className="detail-panel">
          <div className="detail-cover" style={{ background: cur?.color }}>
            <span>CHAPTER {String(data.sessions.findIndex(x => x.id === active) + 1).padStart(2, '0')}</span>
            <i>✦</i>
          </div>
          <div className="detail-body">
            <span className="tag">{cur?.tag}</span>
            <h2>{cur?.title}</h2>
            <p>{cur?.summary}</p>
            <div className="meta-grid">
              <div><small>游戏日期</small><strong>{cur?.date}</strong></div>
              <div><small>出席</small><strong>{presentCount} 在场 · {absentCount} 缺席</strong></div>
            </div>
            <div className="note">
              <span>✎</span>
              <div>
                <strong>章节信息</strong>
                <p>{cur?.archived ? '已收档：改动需填写用途说明，旧版自动保留。' : '修改标题、日期、摘要与类型。'}</p>
              </div>
              <button onClick={openEdit}>编辑</button>
            </div>
            {cur && <AttendanceBoard session={cur} characters={data.characters} actor={actor} act={act} />}
          </div>
        </section>
      </div>}

      {tab === 'characters' && <section className="cards">
        <div className="section-note">队伍中有 {data.characters.length} 位冒险者，点击卡片查看角色档案。</div>
        {data.characters.map(c =>
          <article className="char-card" key={c.name}>
            <div className="avatar" style={{ background: c.color }}>{c.name[0]}</div>
            <div><small>{c.role}</small><h3>{c.name}</h3><p>玩家 · {c.player}</p></div>
            <button onClick={() => setNotice(`${c.name} 的角色档案`)}>↗</button>
          </article>)}
      </section>}

      {tab === 'places' && <section className="empty">
        <div>⌖</div>
        <h2>地点图鉴</h2>
        <p>从章节笔记中收集地点。当前已记录灰港、雾林和失落钟楼。</p>
        <div className="place-list">
          <span>01　灰港 <b>已探索</b></span>
          <span>02　失落钟楼 <b>已探索</b></span>
          <span>03　雾林 <b>待探索</b></span>
        </div>
      </section>}

      {tab === 'loot' && <section className="empty">
        <div>◇</div>
        <h2>战利品清单</h2>
        <p>追踪旅途中获得的装备、遗物和金币。</p>
        <div className="place-list">
          <span>月光草 × 3 <b>消耗品</b></span>
          <span>古老铜币 × 1 <b>遗物</b></span>
          <span>灰港守卫徽章 × 2 <b>任务物品</b></span>
        </div>
      </section>}
    </main>

    {show && <div className="modal-bg"><div className="modal">
      <button className="close" onClick={() => setShow(false)}>×</button>
      <span className="crumb">NEW CHAPTER</span>
      <h2>记录新的章节</h2>
      <label>章节标题
        <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="例：第三章：月下集市" />
      </label>
      <label>游戏日期
        <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
      </label>
      <label>章节摘要
        <textarea rows="3" value={form.summary} onChange={e => setForm({ ...form, summary: e.target.value })} placeholder="发生了什么？" />
      </label>
      <label>章节类型
        <select value={form.tag} onChange={e => setForm({ ...form, tag: e.target.value })}>
          <option>主线</option><option>支线</option><option>番外</option>
        </select>
      </label>
      <button className="primary full" onClick={add}>保存章节</button>
    </div></div>}

    {editing && <div className="modal-bg"><div className="modal">
      <button className="close" onClick={() => setEditing(null)}>×</button>
      <span className="crumb">EDIT CHAPTER</span>
      <h2>编辑章节信息</h2>
      <label>章节标题
        <input value={editForm.title} onChange={e => setEditForm({ ...editForm, title: e.target.value })} />
      </label>
      <label>游戏日期
        <input type="date" value={editForm.date} onChange={e => setEditForm({ ...editForm, date: e.target.value })} />
      </label>
      <label>章节摘要
        <textarea rows="3" value={editForm.summary} onChange={e => setEditForm({ ...editForm, summary: e.target.value })} />
      </label>
      <label>章节类型
        <select value={editForm.tag} onChange={e => setEditForm({ ...editForm, tag: e.target.value })}>
          <option>主线</option><option>支线</option><option>番外</option>
        </select>
      </label>
      {cur?.archived && <label>用途说明（收档后改动必填，旧版将保留）
        <input value={editForm.reason} onChange={e => setEditForm({ ...editForm, reason: e.target.value })}
          placeholder="例：补录实际游戏日期" />
      </label>}
      <button className="primary full" onClick={saveEdit}>保存修改</button>
    </div></div>}

    {notice && <div className="toast">{notice}</div>}
  </div>;
}

createRoot(document.getElementById('root')).render(<App />);
