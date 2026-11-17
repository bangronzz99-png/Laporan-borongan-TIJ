import React, {useEffect, useMemo, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {createClient} from '@supabase/supabase-js';
import {BriefcaseBusiness, LogOut, Plus, RefreshCw, Printer, Pencil, Trash2, Users, ClipboardList, ShieldCheck, X, Save, LockKeyhole} from 'lucide-react';
import './style.css';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = SUPABASE_URL && SUPABASE_ANON_KEY ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
const money = n => new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Number(n||0));
const blank = {work_date:new Date().toISOString().slice(0,10),work_type:'lining',article:'',component:'',bag_count:'',unit_price:''};

function App(){
 const [session,setSession]=useState(null),[profile,setProfile]=useState(null),[email,setEmail]=useState(''),[password,setPassword]=useState('');
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [rows,setRows]=useState([]),[members,setMembers]=useState([]),[form,setForm]=useState(blank),[editing,setEditing]=useState(null);
 const [priceDrafts,setPriceDrafts]=useState({}),[savingPrice,setSavingPrice]=useState({});
 const [recapRows,setRecapRows]=useState([]),[recapPeriod,setRecapPeriod]=useState('month'),[recapDate,setRecapDate]=useState(new Date().toISOString().slice(0,10));
 const [paymentDate,setPaymentDate]=useState(new Date().toISOString().slice(0,10)),[paymentReports,setPaymentReports]=useState([]),[paymentRows,setPaymentRows]=useState([]),[paymentHistory,setPaymentHistory]=useState([]),[paymentBusy,setPaymentBusy]=useState(false);
 const [tab,setTab]=useState('reports'),[filter,setFilter]=useState('all'),[memberFilter,setMemberFilter]=useState('all');
 const admin=profile?.role==='admin';
 useEffect(()=>{if(!supabase){setLoading(false);return;} supabase.auth.getSession().then(({data})=>{setSession(data.session);}).finally(()=>setLoading(false)); const {data:{subscription}}=supabase.auth.onAuthStateChange((_e,s)=>setSession(s)); return ()=>subscription.unsubscribe();},[]);
 useEffect(()=>{(async()=>{if(!session){setProfile(null);setRows([]);return;} const {data,error}=await supabase.from('profiles').select('*').eq('id',session.user.id).single(); if(error){setError('Profil belum tersedia. Pastikan SQL database sudah dijalankan.');return;} setProfile(data); if(!data.active){await supabase.auth.signOut();setError('Akun Anda sedang dinonaktifkan admin.');return;} await loadRows(data.role==='admin'); if(data.role==='admin') await loadMembers();})();},[session]);
 async function loadRows(isAdmin=admin){if(!supabase)return;let q=supabase.from('reports').select('*, profiles:created_by(display_name)').order('work_date',{ascending:false}).order('created_at',{ascending:false});if(!isAdmin)q=q.eq('created_by',session.user.id);if(filter!=='all')q=q.eq('work_type',filter);if(isAdmin&&memberFilter!=='all')q=q.eq('created_by',memberFilter);const {data,error}=await q;if(error)setError(error.message);else setRows(data||[]);}
 async function loadRecap(){const {data,error}=await supabase.from('reports').select('*, profiles:created_by(display_name)').order('work_date',{ascending:false});if(error)setError(error.message);else setRecapRows(data||[]);}
 const paymentRange=(()=>{const d=new Date(paymentDate+'T00:00:00');const start=new Date(d);start.setDate(d.getDate()-((d.getDay()+6)%7));const end=new Date(start);end.setDate(start.getDate()+6);const fmt=x=>x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0');return {start:fmt(start),end:fmt(end)};})();
 async function loadPayments(){
  if(!supabase||!session)return;
  const {data:reports,error:reportError}=await supabase.from('reports').select('*, profiles:created_by(display_name)').gte('work_date',paymentRange.start).lte('work_date',paymentRange.end).order('work_date');

if(reportError){setError(reportError.message);return;}
setPaymentReports(reports||[]);

let q=supabase.from('weekly_payments')
  .select('*, profiles:member_id(display_name)')
  .eq('week_start',paymentRange.start)
  .order('created_at');

if(!admin)q=q.eq('member_id',session.user.id);

const {data,error}=await q;
if(error)setError(error.message);
else setPaymentRows(data||[]);

// RIWAYAT PEMBAYARAN
const {data:history,error:historyError}=await supabase
  .from('weekly_payments')
  .select('*, profiles:member_id(display_name)')
  .order('week_start',{ascending:false});

if(historyError){
  setError(historyError.message);
}else{
  setPaymentHistory(history||[]);
}

}

// FUNGSI SIAPKAN PEMBAYARAN
async function preparePayments(){
  setPaymentBusy(true);setError('');
  const grouped=paymentReports.reduce((acc,r)=>{const id=r.created_by;if(!acc[id])acc[id]={member_id:id,total:0};if(r.unit_price!=null)acc[id].total+=Number(r.bag_count||0)*Number(r.unit_price||0);return acc;},{});
  for(const item of Object.values(grouped)){
   const existing=paymentRows.find(p=>p.member_id===item.member_id);
   if(existing?.status==='paid')continue;
   const payload={member_id:item.member_id,week_start:paymentRange.start,week_end:paymentRange.end,total_amount:item.total,status:'unpaid',paid_at:null,paid_by:null};
   const result=existing?await supabase.from('weekly_payments').update({total_amount:item.total}).eq('id',existing.id):await supabase.from('weekly_payments').insert(payload);
   if(result.error){setError(result.error.message);setPaymentBusy(false);return;}
  }
  setNotice('Tagihan mingguan berhasil disiapkan.');await loadPayments();setPaymentBusy(false);
 }
 async function markPayment(payment,status){
  if(status==='paid'){
   const unpriced=paymentReports.filter(r=>r.created_by===payment.member_id&&r.unit_price==null).length;
   if(unpriced){setError('Belum bisa menandai lunas. Masih ada '+unpriced+' laporan yang belum diberi harga.');return;}
  }
  const patch=status==='paid'?{status:'paid',paid_at:new Date().toISOString(),paid_by:session.user.id}:{status:'unpaid',paid_at:null,paid_by:null};
  const {error}=await supabase.from('weekly_payments').update(patch).eq('id',payment.id);
  if(error)setError(error.message);else{setNotice(status==='paid'?'Pembayaran ditandai lunas.':'Status pembayaran diubah menjadi belum dibayar.');await loadPayments();}
 }
 async function loadMembers(){const {data,error}=await supabase.from('profiles').select('id,display_name,email,role,active,created_at').order('display_name');if(error)setError(error.message);else setMembers(data||[]);}
 useEffect(()=>{if(session&&profile)loadRows(admin);},[filter,memberFilter]);
 useEffect(()=>{if(session&&admin&&tab==='recap')loadRecap();},[session,admin,tab]);
 useEffect(()=>{if(session&&profile&&tab==='payments')loadPayments();},[session,profile,admin,tab,paymentDate]);
 // Perbarui daftar laporan otomatis setiap 10 detik agar laporan anggota baru segera terlihat.
 useEffect(()=>{if(!session||!profile||!admin)return;const timer=setInterval(()=>loadRows(true),10000);return ()=>clearInterval(timer);},[session,profile,admin,filter,memberFilter]);
 async function login(e){e.preventDefault();setBusy(true);setError('');const {error}=await supabase.auth.signInWithPassword({email,password});if(error)setError(error.message);setBusy(false);}
 async function logout(){await supabase.auth.signOut();setProfile(null);setSession(null);}
 function newReport(){setEditing(null);setForm(blank);}
 function editReport(r){setEditing(r.id);setForm({...r,bag_count:String(r.bag_count),unit_price:r.unit_price??''});window.scrollTo({top:0,behavior:'smooth'});}
 async function saveReport(e){e.preventDefault();setBusy(true);setError('');const payload={work_date:form.work_date,work_type:form.work_type,article:form.article.trim(),component:form.component.trim(),bag_count:Number(form.bag_count),...(admin?{unit_price:form.unit_price===''?null:Number(form.unit_price)}:{})};let result;if(editing)result=await supabase.from('reports').update(payload).eq('id',editing);else result=await supabase.from('reports').insert(payload);if(result.error)setError(result.error.message);else{setNotice('Laporan berhasil disimpan.');newReport();await loadRows(admin);}setBusy(false);}
 async function saveInlinePrice(id){
  const draft=priceDrafts[id];
  if(draft===undefined)return;
  const value=draft===''?null:Number(draft);
  if(draft!==''&&(!Number.isFinite(value)||value<0)){setError('Harga harus berupa angka nol atau lebih.');return;}
  setSavingPrice(prev=>({...prev,[id]:true}));
  setError('');
  const {error}=await supabase.from('reports').update({unit_price:value}).eq('id',id);
  if(error){setError(error.message);}
  else{
   setRows(prev=>prev.map(r=>r.id===id?{...r,unit_price:value}:r));
   setPriceDrafts(prev=>{const next={...prev};delete next[id];return next;});
   setNotice('Harga laporan berhasil disimpan.');
  }
  setSavingPrice(prev=>({...prev,[id]:false}));
 }
 async function removeReport(id){if(!confirm('Hapus laporan ini?'))return;const {error}=await supabase.from('reports').delete().eq('id',id);if(error)setError(error.message);else{setNotice('Laporan dihapus.');await loadRows(admin);}}
 async function toggleMember(m){const {error}=await supabase.from('profiles').update({active:!m.active}).eq('id',m.id);if(error)setError(error.message);else await loadMembers();}
 
async function sendToSheets(sheet, headers, rowsToSend) {
  if (!admin || !session?.access_token) {
    setError('Hanya admin yang bisa mengirim data.');
    return;
  }

  if (!rowsToSend.length) {
    setError('Tidak ada data untuk dikirim.');
    return;
  }

  setError('');
  setNotice('');

  try {
    const response = await fetch('/.netlify/functions/send-to-sheets', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        sheet,
        headers,
        rows: rowsToSend
      })
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Pengiriman gagal.');
    }

    setNotice('Berhasil mengirim ' + rowsToSend.length + ' baris ke Google Sheets: ' + sheet);
  } catch (err) {
    setError(err.message);
  }
}

 const total=rows.reduce((s,r)=>s+Number(r.bag_count||0)*Number(r.unit_price||0),0);
 const recapRange=(()=>{const d=new Date(recapDate+'T00:00:00');let start=new Date(d),end=new Date(d);if(recapPeriod==='week'){const day=(d.getDay()+6)%7;start.setDate(d.getDate()-day);end=new Date(start);end.setDate(start.getDate()+6);}else if(recapPeriod==='month'){start=new Date(d.getFullYear(),d.getMonth(),1);end=new Date(d.getFullYear(),d.getMonth()+1,0);}const fmt=x=>x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0');return {start:fmt(start),end:fmt(end)};})();
 const recap=recapRows.filter(r=>r.work_date>=recapRange.start&&r.work_date<=recapRange.end).reduce((acc,r)=>{const id=r.created_by;const name=r.profiles?.display_name||'Anggota';if(!acc[id])acc[id]={id,name,reports:0,bags:0,total:0,unpriced:0};acc[id].reports++;acc[id].bags+=Number(r.bag_count||0);if(r.unit_price==null)acc[id].unpriced++;else acc[id].total+=Number(r.bag_count||0)*Number(r.unit_price||0);return acc;},{});
 const recapList=Object.values(recap).sort((a,b)=>b.total-a.total);
 if(!supabase)return <Setup/>;
 if(loading)return <div className="center">Memuat website…</div>;
 if(!session)return <main className="login"><div className="loginbox"><div className="brandmark"><BriefcaseBusiness/></div><p className="eyebrow">SISTEM LAPORAN BORONGAN</p><h1>Selamat datang</h1><p className="muted">Masuk untuk mengisi dan mengelola laporan pekerjaan.</p><form onSubmit={login}><label>Email</label><input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="nama@email.com"/><label>Password</label><input type="password" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password"/><button className="primary full" disabled={busy}>{busy?'Memproses…':'Masuk'}</button></form>{error&&<p className="error">{error}</p>}<p className="tiny">Akun dibuat oleh admin. Tidak ada pendaftaran publik.</p></div></main>;
 return <div className="app"><header><div className="brand"><div className="brandmark small"><BriefcaseBusiness/></div><div><b>Sistem Laporan Borongan</b><small>Pengelolaan pekerjaan & hasil borongan</small></div></div><div className="user"><span>{profile?.display_name||session.user.email}<small>{admin?'Administrator':'Anggota Borongan'}</small></span><button className="iconbtn" onClick={logout} title="Keluar"><LogOut size={18}/></button></div></header>
 <main className="content"><div className="welcome"><div><p className="eyebrow">{admin?'PANEL ADMIN':'PANEL ANGGOTA'}</p><h1>{admin?'Dashboard Admin':'Laporan Pekerjaan'}</h1><p className="muted">{admin?'Kontrol anggota, harga, dan seluruh laporan borongan.':'Isi laporan pekerjaan borongan Anda di bawah ini.'}</p></div><button className="outline" onClick={()=>loadRows(admin)}><RefreshCw size={16}/> Perbarui</button></div>
 {error&&<div className="alert error">{error}<button onClick={()=>setError('')}><X size={15}/></button></div>}{notice&&<div className="alert success">{notice}<button onClick={()=>setNotice('')}><X size={15}/></button></div>}
 <nav className="tabs">{admin?<><button className={tab==='reports'?'active':''} onClick={()=>setTab('reports')}><ClipboardList size={16}/> Laporan</button><button className={tab==='members'?'active':''} onClick={()=>setTab('members')}><Users size={16}/> Anggota</button><button className={tab==='recap'?'active':''} onClick={()=>setTab('recap')}><ClipboardList size={16}/> Rekap Borongan</button></>:<button className={tab==='reports'?'active':''} onClick={()=>setTab('reports')}><ClipboardList size={16}/> Laporan</button>}<button className={tab==='payments'?'active':''} onClick={()=>setTab('payments')}><ShieldCheck size={16}/> Pembayaran</button></nav>
 {tab==='reports'&&<><section className="stats"><div className="stat"><span>Jumlah laporan</span><b>{rows.length}</b></div><div className="stat"><span>Total tas</span><b>{rows.reduce((s,r)=>s+Number(r.bag_count||0),0).toLocaleString('id-ID')}</b></div>{admin&&<div className="stat"><span>Total nilai pekerjaan</span><b>{money(total)}</b></div>}</section>
 <section className="panel"><div className="panelhead"><div><h2>{editing?'Edit laporan':'Input laporan pekerjaan'}</h2><p className="muted">Harga hanya dapat diisi oleh admin.</p></div>{editing&&<button className="iconbtn" onClick={newReport}><X/></button>}</div><form className="reportform" onSubmit={saveReport}><div className="field"><label>Tanggal</label><input type="date" required value={form.work_date} onChange={e=>setForm({...form,work_date:e.target.value})}/></div><div className="field"><label>Jenis pekerjaan</label><select value={form.work_type} onChange={e=>setForm({...form,work_type:e.target.value})}><option value="lining">Borongan Linning / Tas Jadi</option><option value="cat">Pekerjaan Borongan Cat</option></select></div><div className="field"><label>Artikel</label><input required value={form.article} onChange={e=>setForm({...form,article:e.target.value})} placeholder="Nama artikel"/></div><div className="field wide"><label>Komponen yang dikerjakan</label><textarea required rows="2" value={form.component} onChange={e=>setForm({...form,component:e.target.value})} placeholder="Tuliskan komponen pekerjaan…"/></div><div className="field"><label>Jumlah tas</label><input type="number" min="1" required value={form.bag_count} onChange={e=>setForm({...form,bag_count:e.target.value})} placeholder="0"/></div>{admin&&<div className="field"><label>Harga per tas (Rp)</label><input type="number" min="0" value={form.unit_price} onChange={e=>setForm({...form,unit_price:e.target.value})} placeholder="Diisi admin"/></div>}<div className="formactions"><button className="primary" disabled={busy}><Save size={16}/>{busy?'Menyimpan…':'Simpan laporan'}</button><button type="button" className="outline" onClick={newReport}>Kosongkan</button></div></form></section>
 <section className="panel"><div className="panelhead wrap"><div><h2>Riwayat laporan</h2><p className="muted">{admin?'Isi harga langsung pada kolom Harga; tersimpan otomatis saat kolom ditinggalkan.':'Laporan yang Anda kirim'}</p></div><button className="outline" onClick={()=>window.print()}><Printer size={16}/> Cetak</button></div><div className="filters"><select value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">Semua pekerjaan</option><option value="lining">Linning / Tas Jadi</option><option value="cat">Pengecatan Cat</option></select>{admin&&<select value={memberFilter} onChange={e=>setMemberFilter(e.target.value)}><option value="all">Semua anggota</option>{members.map(m=><option key={m.id} value={m.id}>{m.display_name||m.email}</option>)}</select>}</div><div className="tablewrap"><table><thead><tr>{admin&&<th>Anggota</th>}<th>Tanggal</th><th>Jenis</th><th>Artikel</th><th>Komponen yang dikerjakan</th><th>Jumlah tas</th><th>Harga</th><th>Total</th><th>Aksi</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}>{admin&&<td>{r.profiles?.display_name||'Anggota'}</td>}<td>{new Date(r.work_date+'T00:00:00').toLocaleDateString('id-ID')}</td><td>{r.work_type==='lining'?'Linning / Tas Jadi':'Pengecatan Cat'}</td><td>{r.article}</td><td>{r.component}</td><td>{r.bag_count}</td><td>{admin?<div className="inline-price"><input aria-label={'Harga untuk '+(r.article||'laporan')} type="number" min="0" step="1" placeholder="Isi harga" style={{width:"120px",padding:"8px",border:"1px solid #cbd5e1",borderRadius:"8px"}} value={priceDrafts[r.id]!==undefined?priceDrafts[r.id]:(r.unit_price??'')} onChange={e=>setPriceDrafts(prev=>({...prev,[r.id]:e.target.value}))} onBlur={()=>saveInlinePrice(r.id)} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}} />{savingPrice[r.id]&&<small>Menyimpan…</small>}</div>:(r.unit_price==null?'Menunggu admin':money(r.unit_price))}</td><td>{r.unit_price==null?'—':money(r.bag_count*r.unit_price)}</td><td><div className="actions"><button className="iconbtn" onClick={()=>editReport(r)} title="Edit"><Pencil size={15}/></button><button className="iconbtn danger" onClick={()=>removeReport(r.id)} title="Hapus"><Trash2 size={15}/></button></div></td></tr>)}{!rows.length&&<tr><td colSpan={admin?9:8} className="empty">Belum ada laporan.</td></tr>}</tbody></table></div></section></>}
 {admin&&tab==='recap'&&<><section className="panel"><div className="panelhead wrap"><div><h2>Rekap Borongan Anggota</h2><p className="muted">Ringkasan jumlah pekerjaan dan upah berdasarkan periode.</p></div>
<>
  {admin&&<button className="primary" onClick={()=>sendToSheets(
    recapPeriod==='day'?'Harian':recapPeriod==='week'?'Mingguan':'Bulanan',
    ['Tanggal Mulai','Tanggal Selesai','Nama Anggota','Jumlah Laporan','Jumlah Tas','Total Upah','Harga Belum Diisi'],
    recapList.map(r=>[
      recapRange.start,
      recapRange.end,
      r.name,
      r.reports,
      r.bags,
      r.total,
      r.unpriced
    ])
  )}>Kirim ke Google Sheets</button>}
  <button className="outline" onClick={loadRecap}>
    <RefreshCw size={16}/> Perbarui
  </button>
</>
</div><div className="filters"><select value={recapPeriod} onChange={e=>setRecapPeriod(e.target.value)}><option value="day">Harian</option><option value="week">Mingguan</option><option value="month">Bulanan</option></select><input aria-label="Pilih tanggal acuan rekap" type="date" value={recapDate} onChange={e=>setRecapDate(e.target.value)}/><span className="muted">Periode: {new Date(recapRange.start+'T00:00:00').toLocaleDateString('id-ID')} – {new Date(recapRange.end+'T00:00:00').toLocaleDateString('id-ID')}</span></div><div className="stats"><div className="stat"><span>Anggota mengerjakan</span><b>{recapList.length}</b></div><div className="stat"><span>Total tas</span><b>{recapList.reduce((s,r)=>s+r.bags,0).toLocaleString('id-ID')}</b></div><div className="stat"><span>Total upah terhitung</span><b>{money(recapList.reduce((s,r)=>s+r.total,0))}</b></div></div><div className="tablewrap"><table><thead><tr><th>Anggota</th><th>Jumlah laporan</th><th>Jumlah tas</th><th>Total upah</th><th>Harga belum diisi</th></tr></thead><tbody>{recapList.map(r=><tr key={r.id}><td>{r.name}</td><td>{r.reports}</td><td>{r.bags.toLocaleString('id-ID')}</td><td>{money(r.total)}</td><td>{r.unpriced}</td></tr>)}{!recapList.length&&<tr><td colSpan="5" className="empty">Belum ada laporan pada periode ini.</td></tr>}</tbody></table></div><p className="tiny">Total upah hanya menghitung laporan yang harga per tasnya sudah diisi admin. Laporan tanpa harga ditampilkan pada kolom tersendiri.</p></section></>}
 {tab==='payments'&&<section className="panel"><div className="panelhead wrap"><div><h2>{admin?'Kelola Pembayaran Mingguan':'Riwayat Pembayaran Saya'}</h2><p className="muted">Periode pembayaran dihitung dari Senin sampai Minggu.</p></div><button className="outline" onClick={loadPayments}><RefreshCw size={16}/> Perbarui</button></div><div className="filters"><label htmlFor="payment-week-date">Pilih tanggal dalam minggu</label><input id="payment-week-date" type="date" value={paymentDate} onChange={e=>setPaymentDate(e.target.value)}/><span className="muted">Periode: {new Date(paymentRange.start+'T00:00:00').toLocaleDateString('id-ID')} – {new Date(paymentRange.end+'T00:00:00').toLocaleDateString('id-ID')}</span></div>{admin&&<div className="note"><b>Admin:</b> pastikan semua harga laporan pada minggu ini sudah diisi, lalu klik Siapkan Tagihan. Tagihan yang sudah berstatus lunas tidak akan dihitung ulang.</div>}{admin&&<div className="formactions"><button className="primary" disabled={paymentBusy} onClick={preparePayments}><ShieldCheck size={16}/>{paymentBusy?'Menyiapkan…':'Siapkan Tagihan Minggu Ini'}</button></div>}<div className="tablewrap"><table><thead><tr>{admin&&<th>Anggota</th>}<th>Total upah</th><th>Status</th><th>Tanggal dibayar</th>{admin&&<th>Aksi</th>}</tr></thead><tbody>{paymentRows.map(p=><tr key={p.id}>{admin&&<td>{p.profiles?.display_name||'Anggota'}</td>}<td>{money(p.total_amount)}</td><td><span className={p.status==='paid'?'status on':'status off'}>{p.status==='paid'?'Lunas':'Belum dibayar'}</span></td><td>{p.paid_at?new Date(p.paid_at).toLocaleString('id-ID'):'—'}</td>{admin&&<td>{p.status==='paid'?<button className="outline smallbtn" onClick={()=>markPayment(p,'unpaid')}>Batalkan lunas</button>:<button className="primary smallbtn" onClick={()=>markPayment(p,'paid')}>Tandai lunas</button>}</td>}</tr>)}{!paymentRows.length&&<tr><td colSpan={admin?5:3} className="empty">{admin?'Belum ada tagihan untuk minggu ini. Klik Siapkan Tagihan Minggu Ini.':'Belum ada data pembayaran untuk minggu ini.'}</td></tr>}</tbody></table></div>{!admin&&<p className="tiny">Jika status masih Belum dibayar, silakan hubungi admin untuk konfirmasi pembayaran.</p>}</section>}
  <section className="panel">
  <div className="panelhead">
    <div>
      <h2>Riwayat Pembayaran</h2>
      <p className="muted">Daftar pembayaran dari minggu ke minggu.</p>
    </div>
  </div>

  <div className="tablewrap">
    <table>
      <thead>
        <tr>
          {admin&&<th>Anggota</th>}
          <th>Minggu</th>
          <th>Total Upah</th>
          <th>Status</th>
          <th>Tanggal Dibayar</th>
        </tr>
      </thead>
      <tbody>
        {paymentHistory.map(p=><tr key={p.id}>
          {admin&&<td>{p.profiles?.display_name||'Anggota'}</td>}
          <td>
            {new Date(p.week_start+'T00:00:00').toLocaleDateString('id-ID')}
            {' – '}
            {new Date(p.week_end+'T00:00:00').toLocaleDateString('id-ID')}
          </td>
          <td>{money(p.total_amount)}</td>
          <td>
            <span className={p.status==='paid'?'status on':'status off'}>
              {p.status==='paid'?'Lunas':'Belum dibayar'}
            </span>
          </td>
          <td>{p.paid_at?new Date(p.paid_at).toLocaleString('id-ID'):'—'}</td>
        </tr>)}
        {!paymentHistory.length&&<tr>
          <td colSpan={admin?5:4} className="empty">
            Belum ada riwayat pembayaran.
          </td>
        </tr>}
      </tbody>
    </table>
  </div>
</section>
 {admin&&tab==='members'&&<section className="panel"><div className="panelhead"><div><h2>Kelola anggota</h2><p className="muted">Aktifkan atau nonaktifkan akses anggota.</p></div><span className="pill">{members.length} akun</span></div><div className="tablewrap"><table><thead><tr><th>Nama</th><th>Email</th><th>Peran</th><th>Status</th><th>Aksi</th></tr></thead><tbody>{members.map(m=><tr key={m.id}><td>{m.display_name||'—'}</td><td>{m.email||'—'}</td><td>{m.role==='admin'?'Admin':'Anggota'}</td><td><span className={m.active?'status on':'status off'}>{m.active?'Aktif':'Nonaktif'}</span></td><td>{m.role!=='admin'&&<button className="outline smallbtn" onClick={()=>toggleMember(m)}>{m.active?'Nonaktifkan':'Aktifkan'}</button>}</td></tr>)}</tbody></table></div><div className="note"><b>Menambah akun anggota:</b> buka Supabase Dashboard → Authentication → Users → Add user. Masukkan email dan password sementara. Setelah akun dibuat, tambahkan profilnya melalui SQL Editor (petunjuk ada di README). Jangan membagikan password admin.</div></section>}
 <footer>© {new Date().getFullYear()} Sistem Laporan Borongan · Data tersimpan di database online</footer></main></div>
}
function Setup(){return <main className="login"><div className="loginbox"><div className="brandmark"><LockKeyhole/></div><p className="eyebrow">PENGATURAN AWAL</p><h1>Hubungkan database</h1><p className="muted">Website sudah siap. Isi URL dan anon key Supabase pada file <code>.env</code>, lalu jalankan atau terbitkan ulang website.</p><ol><li>Buat project Supabase gratis.</li><li>Jalankan file <code>supabase/schema.sql</code>.</li><li>Salin Project URL dan anon/public key ke <code>.env</code>.</li><li>Ikuti panduan lengkap di README.</li></ol><p className="tiny">Jangan pernah memasukkan service_role key ke website atau membagikannya kepada anggota.</p></div></main>}
createRoot(document.getElementById('root')).render(<App/>);
