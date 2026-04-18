import { useState, useEffect } from 'react';
import { supabase } from './supabase';

const CATEGORIES = [
  { id: 'fashion', label: '패션/잡화', emoji: '👗' },
  { id: 'beauty', label: '화장품/미용', emoji: '💄' },
  { id: 'living', label: '생필품/살림', emoji: '🧴' },
  { id: 'food', label: '식료품/식품', emoji: '🛒' },
  { id: 'daily', label: '일상비용', emoji: '🚗' },
  { id: 'study', label: '학습/책', emoji: '📚' },
  { id: 'etc', label: '기타', emoji: '📦' },
];

function getTodayStr() { return new Date().toISOString().slice(0, 10); }
function getThisMonthStr() { return new Date().toISOString().slice(0, 7); }

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const today = getTodayStr();
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const label = `${d.getMonth() + 1}월 ${d.getDate()}일`;
  if (dateStr === today) return `오늘 · ${label}`;
  if (dateStr === yesterday) return `어제 · ${label}`;
  return label;
}

function groupByDate(txs) {
  return txs.reduce((acc, tx) => {
    if (!acc[tx.date]) acc[tx.date] = [];
    acc[tx.date].push(tx);
    return acc;
  }, {});
}

const BAR_COLORS = ['#7ec8a0', '#c8a07e', '#7e9ec8', '#c87e7e', '#a07ec8', '#c8c87e', '#7ec8c8'];
const inp = { width: '100%', background: '#1a1a1a', border: '0.5px solid #2a2a2a', borderRadius: '12px', padding: '12px 14px', color: '#f0ede6', fontSize: '14px', boxSizing: 'border-box' };

function newItem() {
  return { _key: Date.now() + Math.random(), name: '', amount: '', category: 'food', type: 'expense' };
}

export default function App() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [activeTab, setActiveTab] = useState('list');
  const [currentMonth, setCurrentMonth] = useState(getThisMonthStr());
  const [toast, setToast] = useState('');
  const [date, setDate] = useState(getTodayStr());
  const [items, setItems] = useState([newItem()]);
  const [activeCatKey, setActiveCatKey] = useState(null);

  const [year, month] = currentMonth.split('-').map(Number);
  const isThisMonth = currentMonth === getThisMonthStr();

  // Supabase에서 데이터 불러오기
  useEffect(() => {
    fetchTransactions();
  }, []);

  async function fetchTransactions() {
    setLoading(true);
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .order('date', { ascending: false });
    if (!error) setTransactions(data || []);
    setLoading(false);
  }

  const monthTxs = transactions.filter(t => t.date.startsWith(currentMonth));
  const totalIncome = monthTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalExpense = monthTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const balance = totalIncome - totalExpense;

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 2000);
  }

  function changeMonth(dir) {
    const d = new Date(year, month - 1 + dir, 1);
    setCurrentMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  function openAdd() {
    setEditTarget(null);
    setDate(getTodayStr());
    setItems([newItem()]);
    setActiveCatKey(null);
    setShowModal(true);
  }

  function openEdit(tx) {
    setEditTarget(tx.id);
    setDate(tx.date);
    const item = { _key: tx.id, name: tx.name, amount: String(tx.amount), category: tx.category, type: tx.type };
    setItems([item]);
    setActiveCatKey(tx.id);
    setShowModal(true);
  }

  function updateItem(key, field, value) {
    setItems(items.map(it => it._key === key ? { ...it, [field]: value } : it));
  }

  function addItem() {
    const ni = newItem();
    setItems([...items, ni]);
    setActiveCatKey(ni._key);
  }

  function removeItem(key) {
    if (items.length === 1) return;
    setItems(items.filter(it => it._key !== key));
    if (activeCatKey === key) setActiveCatKey(null);
  }

  async function handleSave() {
    const valid = items.filter(it => it.name.trim() && it.amount);
    if (!valid.length) return;

    if (editTarget) {
      const it = valid[0];
      const { error } = await supabase
        .from('transactions')
        .update({ date, name: it.name.trim(), amount: parseInt(it.amount), type: it.type, category: it.category })
        .eq('id', editTarget);
      if (!error) { showToast('수정됐어요 ✓'); fetchTransactions(); }
    } else {
      const newTxs = valid.map(it => ({
        date,
        name: it.name.trim(),
        amount: parseInt(it.amount),
        type: it.type,
        category: it.category,
      }));
      const { error } = await supabase.from('transactions').insert(newTxs);
      if (!error) { showToast(`${valid.length}개 저장됐어요 ✓`); fetchTransactions(); }
    }

    setShowModal(false);
  }

  async function handleDelete(id) {
    if (!window.confirm('삭제할까요?')) return;
    const { error } = await supabase.from('transactions').delete().eq('id', id);
    if (!error) { showToast('삭제됐어요'); fetchTransactions(); }
  }

  const getCat = (id) => CATEGORIES.find(c => c.id === id) || CATEGORIES[6];
  const grouped = groupByDate([...monthTxs].sort((a, b) => b.date.localeCompare(a.date)));
  const catStats = CATEGORIES.map((cat, i) => {
    const total = monthTxs.filter(t => t.category === cat.id && t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    return { ...cat, total, color: BAR_COLORS[i] };
  }).filter(c => c.total > 0).sort((a, b) => b.total - a.total);
  const maxStat = catStats[0]?.total || 1;
  const itemsTotal = items.reduce((s, it) => s + (parseInt(it.amount) || 0), 0);

  return (
    <div style={{ background: '#0a0a0a', minHeight: '100vh', color: '#f0ede6', fontFamily: 'system-ui, sans-serif', display: 'flex', justifyContent: 'center', paddingBottom: '100px' }}>
      <div style={{ width: '100%', maxWidth: '390px', padding: '48px 20px 20px' }}>

        <div style={{ fontSize: '11px', color: '#555', letterSpacing: '2px', textTransform: 'uppercase', textAlign: 'center', marginBottom: '8px' }}>총 지출</div>
        <div style={{ fontSize: '40px', fontWeight: '500', textAlign: 'center', letterSpacing: '-1px', marginBottom: '4px' }}>
          {loading ? '...' : `₩ ${totalExpense.toLocaleString()}`}
        </div>
        <div style={{ fontSize: '12px', color: '#444', textAlign: 'center', marginBottom: '20px' }}>
          수입 ₩{totalIncome.toLocaleString()} · 잔액 ₩{balance.toLocaleString()}
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', marginBottom: '8px' }}>
          <button onClick={() => changeMonth(-1)} style={{ width: '32px', height: '32px', borderRadius: '50%', border: '0.5px solid #2a2a2a', background: 'transparent', color: '#666', fontSize: '18px', cursor: 'pointer' }}>‹</button>
          <div style={{ fontSize: '14px', color: '#888', minWidth: '90px', textAlign: 'center' }}>{year}년 {month}월</div>
          <button onClick={() => changeMonth(1)} style={{ width: '32px', height: '32px', borderRadius: '50%', border: '0.5px solid #2a2a2a', background: 'transparent', color: '#666', fontSize: '18px', cursor: 'pointer' }}>›</button>
        </div>

        {!isThisMonth && (
          <div style={{ textAlign: 'center', marginBottom: '8px' }}>
            <button onClick={() => { setCurrentMonth(getThisMonthStr()); setActiveTab('list'); }}
              style={{ background: 'transparent', border: '0.5px solid #2a2a2a', borderRadius: '20px', color: '#888', fontSize: '12px', padding: '6px 16px', cursor: 'pointer' }}>
              이번 달로 ↩
            </button>
          </div>
        )}

        <div style={{ marginBottom: '20px' }} />

        <div style={{ display: 'flex', gap: '10px', marginBottom: '28px' }}>
          {[{ label: '수입', val: totalIncome, color: '#7ec8a0', sign: '+' }, { label: '지출', val: totalExpense, color: '#c87e7e', sign: '−' }].map(item => (
            <div key={item.label} style={{ flex: 1, background: '#111', border: '0.5px solid #1e1e1e', borderRadius: '14px', padding: '14px' }}>
              <div style={{ fontSize: '10px', color: '#444', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '6px' }}>{item.label}</div>
              <div style={{ fontSize: '18px', fontWeight: '500', color: item.color }}>{item.sign}{item.val.toLocaleString()}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
          {[['list', '내역'], ['stats', '통계']].map(([tab, label]) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              style={{ flex: 1, padding: '10px', borderRadius: '10px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '500', background: activeTab === tab ? '#f0ede6' : '#111', color: activeTab === tab ? '#0a0a0a' : '#555' }}>
              {label}
            </button>
          ))}
        </div>

        {activeTab === 'list' && (
          <>
            {loading && <div style={{ textAlign: 'center', color: '#333', padding: '40px 0' }}>불러오는 중...</div>}
            {!loading && Object.keys(grouped).length === 0 && (
              <div style={{ textAlign: 'center', padding: '60px 0' }}>
                <div style={{ fontSize: '32px', marginBottom: '12px' }}>🗂</div>
                <div style={{ color: '#333', fontSize: '14px' }}>이번 달 내역이 없어요</div>
                <div style={{ color: '#2a2a2a', fontSize: '12px', marginTop: '6px' }}>+ 버튼으로 추가해보세요</div>
              </div>
            )}
            {Object.entries(grouped).map(([d, txs]) => (
              <div key={d} style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ fontSize: '12px', color: '#444' }}>{formatDate(d)}</div>
                  <div style={{ fontSize: '11px', color: '#333' }}>−{txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0).toLocaleString()}</div>
                </div>
                {txs.map(tx => {
                  const cat = getCat(tx.category);
                  return (
                    <div key={tx.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', background: '#0f0f0f', borderRadius: '12px', border: '0.5px solid #1a1a1a', marginBottom: '2px' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', flexShrink: 0 }}>{cat.emoji}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '13px', color: '#d0cdc6', fontWeight: '500' }}>{tx.name}</div>
                        <div style={{ fontSize: '11px', color: '#444', marginTop: '2px' }}>{cat.label}</div>
                      </div>
                      <div style={{ fontSize: '14px', fontWeight: '500', color: tx.type === 'income' ? '#7ec8a0' : '#c87e7e', flexShrink: 0 }}>
                        {tx.type === 'income' ? '+' : '−'}{tx.amount.toLocaleString()}
                      </div>
                      <button onClick={() => openEdit(tx)} style={{ background: 'transparent', border: 'none', color: '#444', fontSize: '14px', cursor: 'pointer', padding: '4px' }}>✎</button>
                      <button onClick={() => handleDelete(tx.id)} style={{ background: 'transparent', border: 'none', color: '#333', fontSize: '18px', cursor: 'pointer', padding: '4px' }}>×</button>
                    </div>
                  );
                })}
              </div>
            ))}
          </>
        )}

        {activeTab === 'stats' && (
          <>
            {catStats.length === 0 && (
              <div style={{ textAlign: 'center', padding: '60px 0' }}>
                <div style={{ fontSize: '32px', marginBottom: '12px' }}>📊</div>
                <div style={{ color: '#333', fontSize: '14px' }}>이번 달 지출이 없어요</div>
              </div>
            )}
            {catStats.map(cat => (
              <div key={cat.id} style={{ marginBottom: '18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                  <span style={{ color: '#888' }}>{cat.emoji} {cat.label}</span>
                  <div>
                    <span style={{ color: '#d0cdc6', fontWeight: '500' }}>₩{cat.total.toLocaleString()}</span>
                    <span style={{ color: '#444', fontSize: '11px', marginLeft: '8px' }}>{Math.round(cat.total / totalExpense * 100)}%</span>
                  </div>
                </div>
                <div style={{ height: '4px', borderRadius: '2px', background: '#1a1a1a' }}>
                  <div style={{ height: '4px', borderRadius: '2px', background: cat.color, width: `${Math.round(cat.total / maxStat * 100)}%`, transition: 'width 0.4s ease' }} />
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      <button onClick={openAdd} style={{ position: 'fixed', bottom: '32px', left: '50%', transform: 'translateX(-50%)', width: '56px', height: '56px', borderRadius: '50%', background: '#f0ede6', border: 'none', fontSize: '28px', color: '#0a0a0a', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>+</button>

      {toast && (
        <div style={{ position: 'fixed', bottom: '100px', left: '50%', transform: 'translateX(-50%)', background: '#1e1e1e', color: '#f0ede6', padding: '10px 20px', borderRadius: '20px', fontSize: '13px', zIndex: 200, border: '0.5px solid #2a2a2a' }}>
          {toast}
        </div>
      )}

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 100 }} onClick={() => setShowModal(false)}>
          <div style={{ background: '#111', borderRadius: '24px 24px 0 0', padding: '24px 20px 48px', width: '100%', maxWidth: '390px', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>

            <div style={{ fontSize: '16px', fontWeight: '500', marginBottom: '20px', textAlign: 'center' }}>
              {editTarget ? '내역 수정' : '새 내역 추가'}
            </div>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <input style={{ ...inp, flex: 1 }} placeholder="2025-04-18" value={date} onChange={e => setDate(e.target.value)} />
              <input type="date" style={{ ...inp, width: '44px', padding: '12px 10px', cursor: 'pointer', flexShrink: 0 }} value={date} onChange={e => setDate(e.target.value)} />
            </div>

            {items.map((it, idx) => (
              <div key={it._key}
                style={{ background: '#0f0f0f', border: activeCatKey === it._key ? '0.5px solid #3a3a3a' : '0.5px solid #1a1a1a', borderRadius: '14px', padding: '14px', marginBottom: '8px' }}
                onClick={() => setActiveCatKey(it._key)}>

                <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', alignItems: 'center' }}>
                  <div style={{ fontSize: '11px', color: '#444', minWidth: '20px' }}>{idx + 1}</div>
                  <div style={{ display: 'flex', gap: '6px', flex: 1 }}>
                    {[['expense', '지출', '#3a1a1a', '#c87e7e'], ['income', '수입', '#1a3a2a', '#7ec8a0']].map(([type, label, bg, color]) => (
                      <button key={type} onClick={e => { e.stopPropagation(); updateItem(it._key, 'type', type); }}
                        style={{ flex: 1, padding: '6px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: '500', background: it.type === type ? bg : '#1a1a1a', color: it.type === type ? color : '#555' }}>
                        {label}
                      </button>
                    ))}
                  </div>
                  {items.length > 1 && (
                    <button onClick={e => { e.stopPropagation(); removeItem(it._key); }}
                      style={{ background: 'transparent', border: 'none', color: '#444', fontSize: '18px', cursor: 'pointer', padding: '0 4px' }}>×</button>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '8px', marginBottom: activeCatKey === it._key ? '10px' : '0' }}>
                  <input style={{ ...inp, width: '110px', flexShrink: 0 }} placeholder="금액" type="number" value={it.amount}
                    onClick={e => e.stopPropagation()}
                    onChange={e => updateItem(it._key, 'amount', e.target.value)} />
                  <input style={{ ...inp, flex: 1 }} placeholder="항목명" value={it.name}
                    onClick={e => e.stopPropagation()}
                    onChange={e => updateItem(it._key, 'name', e.target.value)} />
                </div>

                {activeCatKey === it._key && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                    {CATEGORIES.map(cat => (
                      <button key={cat.id} onClick={e => { e.stopPropagation(); updateItem(it._key, 'category', cat.id); }}
                        style={{ background: it.category === cat.id ? '#f0ede6' : '#1a1a1a', color: it.category === cat.id ? '#0a0a0a' : '#888', border: '0.5px solid #2a2a2a', borderRadius: '8px', padding: '8px 4px', fontSize: '10px', cursor: 'pointer', textAlign: 'center' }}>
                        <div style={{ fontSize: '18px', marginBottom: '3px' }}>{cat.emoji}</div>
                        <div>{cat.label}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {!editTarget && (
              <button onClick={addItem}
                style={{ width: '100%', padding: '12px', background: 'transparent', border: '0.5px dashed #2a2a2a', borderRadius: '12px', color: '#555', fontSize: '13px', cursor: 'pointer', marginBottom: '16px' }}>
                + 항목 추가
              </button>
            )}

            {items.length > 1 && itemsTotal > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#888', marginBottom: '16px', padding: '0 4px' }}>
                <span>합계</span>
                <span style={{ color: '#f0ede6', fontWeight: '500' }}>₩{itemsTotal.toLocaleString()}</span>
              </div>
            )}

            <button onClick={handleSave}
              style={{ width: '100%', padding: '16px', background: '#f0ede6', color: '#0a0a0a', border: 'none', borderRadius: '14px', fontSize: '15px', fontWeight: '500', cursor: 'pointer' }}>
              {editTarget ? '수정하기' : `${items.filter(it => it.name && it.amount).length}개 저장`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}