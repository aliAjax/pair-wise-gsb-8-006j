import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { loadCampaign, createSession, saveCampaign } from './campaignStorage.js';
import ChapterDesk from './ChapterDesk.jsx';

function App() {
  const [data, setData] = useState(loadCampaign);
  const [tab, setTab] = useState('timeline');
  const [active, setActive] = useState(() => loadCampaign().sessions[0]?.id);
  const [show, setShow] = useState(false);
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState({ title: '', date: '2024-07-01', summary: '', tag: '主线' });

  useEffect(() => saveCampaign(data), [data]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(''), 2600);
    return () => clearTimeout(timer);
  }, [notice]);

  const cur = data.sessions.find((session) => session.id === active) || data.sessions[0];

  const add = () => {
    if (!form.title) {
      setNotice('请先填写章节标题');
      return;
    }
    const next = createSession(data, form);
    const session = next.sessions[next.sessions.length - 1];
    setData(next);
    setActive(session.id);
    setForm({ title: '', date: '2024-07-01', summary: '', tag: '主线' });
    setShow(false);
    setNotice('新章节已建立，请先出席点名并指定操作者');
  };

  const exportData = () => {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    link.download = 'campaign-attendance.json';
    link.click();
    setNotice('出席托管记录已导出');
  };

  return (
    <div className="shell">
      <aside>
        <div className="logo"><span>✦</span> CAMPAIGNER</div>
        <div className="campaign">
          <small>当前战役</small>
          <strong>{data.name}</strong>
          <span>{data.system} · 2024</span>
        </div>
        <nav>
          {[
            ['timeline', '◌', '出席托管台'],
            ['characters', '♙', '角色与阵营'],
            ['places', '⌖', '地点图鉴'],
            ['loot', '◇', '战利品']
          ].map(([id, icon, label]) => (
            <button className={tab === id ? 'active' : ''} onClick={() => setTab(id)} key={id}>
              <i>{icon}</i>{label}
            </button>
          ))}
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
            <h1>{tab === 'timeline' ? '出席托管台' : tab === 'characters' ? '角色与阵营' : tab === 'places' ? '地点图鉴' : '战利品'}</h1>
          </div>
          <div className="actions">
            <button onClick={exportData} className="outline">↓ 导出</button>
            <button onClick={() => setShow(true)} className="primary">＋ 新建章节</button>
          </div>
        </header>

        {tab === 'timeline' && (
          <div className="timeline-layout desk-layout">
            <section className="timeline">
              <div className="timeline-intro">
                <div>
                  <span>ATTENDANCE & CUSTODY</span>
                  <h2>每一章，谁在场、谁操作</h2>
                </div>
                <span className="count">{data.sessions.length} CHAPTERS</span>
              </div>
              {data.sessions.map((session, index) => {
                const absent = data.players.filter((player) => session.attendance?.[player.id] !== 'present');
                return (
                  <button
                    className={`chapter ${cur?.id === session.id ? 'selected' : ''}`}
                    onClick={() => setActive(session.id)}
                    key={session.id}
                  >
                    <div className="date">
                      <b>{new Date(session.date).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })}</b>
                      <small>{new Date(session.date).getFullYear()}</small>
                    </div>
                    <div className="line">
                      <span style={{ background: session.color }}></span>
                      {index < data.sessions.length - 1 && <i />}
                    </div>
                    <div className="chapter-copy">
                      <div className="tag">{session.archived ? '已收档' : session.tag}</div>
                      <h3>{session.title}</h3>
                      <p>
                        {absent.length ? `缺席：${absent.map((player) => player.name).join('、')}` : '全员在场'}
                        {' · '}{data.characters.length} 名角色均需指定操作者
                      </p>
                    </div>
                    <span className="arrow">↗</span>
                  </button>
                );
              })}
            </section>

            <section className="detail-panel desk-panel">
              <div className="detail-cover" style={{ background: cur?.color }}>
                <span>CHAPTER {String(data.sessions.findIndex((session) => session.id === cur?.id) + 1).padStart(2, '0')}</span>
                <i>✦</i>
              </div>
              <div className="detail-body">
                <span className="tag">{cur?.archived ? '已收档' : cur?.tag}</span>
                <h2>{cur?.title}</h2>
                <p>{cur?.summary}</p>
                <div className="meta-grid">
                  <div><small>游戏日期</small><strong>{cur?.date}</strong></div>
                  <div>
                    <small>在场玩家</small>
                    <strong>{data.players.filter((player) => cur?.attendance?.[player.id] === 'present').length} / {data.players.length}</strong>
                  </div>
                </div>
                {cur && <ChapterDesk campaign={data} session={cur} setData={setData} setNotice={setNotice} />}
              </div>
            </section>
          </div>
        )}

        {tab === 'characters' && (
          <section className="cards">
            <div className="section-note">角色资料保持只读；每一场的操作者和代管记录请到“出席托管台”查看。</div>
            {data.characters.map((character) => {
              const player = data.players.find((item) => item.id === character.playerId);
              return (
                <article className="char-card" key={character.id}>
                  <div className="avatar" style={{ background: character.color }}>{character.name[0]}</div>
                  <div>
                    <small>{character.role}</small>
                    <h3>{character.name}</h3>
                    <p>玩家 · {player?.name}</p>
                  </div>
                  <button onClick={() => setNotice(`${character.name} 的角色资料只读，代管不覆盖角色卡`)}>♙</button>
                </article>
              );
            })}
          </section>
        )}

        {tab === 'places' && (
          <section className="empty">
            <div>⌖</div>
            <h2>地点图鉴</h2>
            <p>从章节笔记中收集地点。当前已记录灰港、雾林和失落钟楼。</p>
            <div className="place-list">
              <span>01　灰港 <b>已探索</b></span>
              <span>02　失落钟楼 <b>已探索</b></span>
              <span>03　雾林 <b>待探索</b></span>
            </div>
          </section>
        )}

        {tab === 'loot' && (
          <section className="empty">
            <div>◇</div>
            <h2>战利品清单</h2>
            <p>追踪旅途中获得的装备、遗物和金币。</p>
            <div className="place-list">
              <span>月光草 × 3 <b>消耗品</b></span>
              <span>古老铜币 × 1 <b>遗物</b></span>
              <span>灰港守卫徽章 × 2 <b>任务物品</b></span>
            </div>
          </section>
        )}
      </main>

      {show && (
        <div className="modal-bg">
          <div className="modal">
            <button className="close" onClick={() => setShow(false)}>×</button>
            <span className="crumb">NEW CHAPTER</span>
            <h2>记录新的章节</h2>
            <label>章节标题
              <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="例：第三章：月下集市" />
            </label>
            <label>游戏日期
              <input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} />
            </label>
            <label>章节摘要
              <textarea rows="3" value={form.summary} onChange={(event) => setForm({ ...form, summary: event.target.value })} placeholder="发生了什么？" />
            </label>
            <label>章节类型
              <select value={form.tag} onChange={(event) => setForm({ ...form, tag: event.target.value })}>
                <option>主线</option>
                <option>支线</option>
                <option>番外</option>
              </select>
            </label>
            <button className="primary full" onClick={add}>建立并安排出席</button>
          </div>
        </div>
      )}

      {notice && <div className="toast">{notice}</div>}
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
