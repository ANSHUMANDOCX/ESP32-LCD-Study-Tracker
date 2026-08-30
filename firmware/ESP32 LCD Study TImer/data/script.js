// Fetch CSV from /data and convert to the JSON-like shape the UI expects.
function parseCsvToData(text){
  const data = { physics: '00:00:00', chemistry: '00:00:00', math: '00:00:00', pcm_total: '00:00:00', log: [] };
  if(!text || typeof text !== 'string') return data;
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length>0);
  if(lines.length === 0) return data;
  // Skip header if present
  let start = 0;
  if(lines[0].toLowerCase().includes('date')) start = 1;
  for(let i = start; i < lines.length; i++){
    const line = lines[i];
    const parts = line.split(',');
    if(parts.length < 5) continue;
    const datetime = parts[0].trim();
    const phy = parts[1].trim();
    const chem = parts[2].trim();
    const math = parts[3].trim();
    const pcm = parts[4].trim();
    data.log.push({ datetime: datetime, physics: phy, chemistry: chem, math: math, pcm: pcm });
  }
  // Use last row (most recent) for top-level totals if available
  if(data.log.length>0){
    const last = data.log[data.log.length-1];
    data.physics = last.physics || data.physics;
    data.chemistry = last.chemistry || data.chemistry;
    data.math = last.math || data.math;
    data.pcm_total = last.pcm || data.pcm_total;
  }
  return data;
}

function fetchData(){
  return fetch('/data')
    .then(r => r.text())
    .then(txt => {
      const d = parseCsvToData(txt);
      // reuse existing rendering logic by dispatching to the older handler
      // Top-line fields
      const phEl = document.getElementById('physics'); if(phEl) phEl.innerText = d.physics;
      const chEl = document.getElementById('chemistry'); if(chEl) chEl.innerText = d.chemistry;
      const maEl = document.getElementById('math'); if(maEl) maEl.innerText = d.math;
      const pcmEl = document.getElementById('pcm_total'); if(pcmEl) pcmEl.innerText = d.pcm_total;

      // Update last-updated time (local)
      const now = new Date();
      const lastEl = document.getElementById('lastUpdated'); if(lastEl) lastEl.innerText = 'Last updated: ' + now.toLocaleString();

      // Populate logs table (newest first)
      let table = document.getElementById('logsTable');
      table.innerHTML = `
        <tr>
          <th>Date & Time</th>
          <th>Physics</th>
          <th>Chemistry</th>
          <th>Math</th>
          <th>PCM Total</th>
        </tr>`;
      if(!d.log || d.log.length === 0){
        const tr = document.createElement('tr');
        tr.className = 'empty-state';
        tr.innerHTML = `<td colspan="5">No logs yet — press "Log Now" to add an entry.</td>`;
        table.appendChild(tr);
      } else {
        for(let i = d.log.length - 1; i >= 0; i--) {
          const row = d.log[i];
          let tr = document.createElement('tr');
          tr.innerHTML = `<td>${row.datetime}</td><td>${row.physics}</td><td>${row.chemistry}</td><td>${row.math}</td><td>${row.pcm}</td>`;
          table.appendChild(tr);
        }
      }

      // Update target and weekly UI pieces that use d.log
      try{ updateTargetFromPCM(d.pcm_total); }catch(e){ console.warn('target update error', e); }
      const windowDays = getSelectedWindowDays();
      const avgSecs = computeAvgPerDayLastNDays(d.log || [], windowDays);
      // Debug: expose computed avg and log counts to console for troubleshooting
      try{ console.debug('[fetchData] avgSecs=', avgSecs, 'windowDays=', windowDays, 'logCount=', (d.log||[]).length); }catch(e){}
      // Also write a friendly debug string into the last-updated element so it's visible without DevTools
      try{
        const lastElDbg = document.getElementById('lastUpdated');
        if(lastElDbg){
          lastElDbg.innerText = 'Last updated: ' + now.toLocaleString() + ' — avg/day: ' + secsToHms(avgSecs) + ' (logs=' + (d.log||[]).length + ')';
        }
      }catch(e){}
      updateWeeklyTargetFromAvg(avgSecs);

      // Monthly grouping and controls wiring
      const months = groupLogsByMonth(d.log || []);
      const monthKeys = Object.keys(months).sort().reverse();
      const todayKey = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0');
      const monthSelect = document.getElementById('monthSelect');
      if(monthSelect){
        const curVal = monthSelect.value;
        monthSelect.innerHTML = '<option value="">— Latest 15 days —</option>';
        monthKeys.forEach(k => {
          if(k < todayKey){
            const opt = document.createElement('option');
            opt.value = k;
            const parts = k.split('-');
            const y = parts[0], m = parseInt(parts[1],10)-1;
            const label = new Date(y, m, 1).toLocaleString(undefined,{month:'short', year:'numeric'});
            opt.text = label;
            monthSelect.appendChild(opt);
          }
        });
        try{ if(curVal) monthSelect.value = curVal; }catch(e){ }
      }

      // Wire controls to refresh when changed
      if(monthSelect) monthSelect.onchange = () => fetchData();
      const avgSelect = document.getElementById('avgWindowSelect'); if(avgSelect) avgSelect.onchange = () => fetchData();
      const q15 = document.getElementById('quick15'); const q30 = document.getElementById('quick30');
      if(q15) q15.onclick = () => { if(avgSelect) avgSelect.value = '15'; fetchData(); };
      if(q30) q30.onclick = () => { if(avgSelect) avgSelect.value = '30'; fetchData(); };

      // Monthly avg display
      const monthDisplay = document.getElementById('monthlyAvgDisplay');
      if(monthDisplay){
        if(monthSelect && monthSelect.value && months[monthSelect.value]){
          const avg = computeMonthlyAverageSecondsForMonth(months[monthSelect.value]);
          monthDisplay.innerText = 'Avg/day: ' + secsToHms(avg);
        } else {
          monthDisplay.innerText = 'Avg/day: ' + secsToHms(avgSecs);
        }
      }

    })
    .catch(err => {
      const lastEl = document.getElementById('lastUpdated'); if(lastEl) lastEl.innerText = 'Error fetching data';
      console.error('fetchData error', err);
    });
}

// ---------------- Target (client-side) ----------------
function parseHmsToSeconds(hms){
  // Accepts H:MM:SS or HH:MM:SS or MM:SS
  if(!hms || typeof hms !== 'string') return 0;
  const parts = hms.split(':').map(s => parseInt(s,10));
  if(parts.length===3) return parts[0]*3600 + parts[1]*60 + parts[2];
  if(parts.length===2) return parts[0]*60 + parts[1];
  if(parts.length===1) return parts[0];
  return 0;
}

// ----- Weekly & Monthly utilities -----
function computeWeeklyAverageSeconds(logs){
  // Average per-day over the last 7 days (includes days with zero logs).
  if(!logs || !logs.length) return 0;
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7*24*3600*1000);
  const dayTotals = {}; // map YYYY-MM-DD -> seconds
  logs.forEach(row => {
    const d = new Date(row.datetime.replace(' ','T'));
    if(isNaN(d)) return;
    if(d > weekAgo && d <= now){
      const key = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
      dayTotals[key] = (dayTotals[key] || 0) + parseHmsToSeconds(row.pcm);
    }
  });
  let sum = 0;
  Object.keys(dayTotals).forEach(k => sum += dayTotals[k]);
  try{ console.debug('[computeWeeklyAverageSeconds] dayCount=', Object.keys(dayTotals).length, 'sum=', sum); }catch(e){}
  return Math.round(sum / 7);
}

// Compute average-per-day over the last `nDays` days (includes days with zero logs)
function computeAvgPerDayLastNDays(logs, nDays){
  if(nDays<=0) return 0;
  if(!logs || !logs.length) return 0;
  const now = new Date();
  const start = new Date(now.getTime() - nDays*24*3600*1000);
  // aggregate per-day totals so multiple logs on same day are combined
  const dayTotals = {}; // key YYYY-MM-DD -> seconds
  logs.forEach(row => {
    const d = new Date(row.datetime.replace(' ','T'));
    if(isNaN(d)) return;
    if(d > start && d <= now){
      const key = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
      dayTotals[key] = (dayTotals[key] || 0) + parseHmsToSeconds(row.pcm);
    }
  });
  let sum = 0;
  Object.keys(dayTotals).forEach(k => sum += dayTotals[k]);
  const avg = Math.round(sum / nDays);
  try{ console.debug('[computeAvgPerDayLastNDays] dayCount=', Object.keys(dayTotals).length, 'sum=', sum, 'nDays=', nDays, 'avg=', avg); }catch(e){}
  return avg;
}

function getSelectedWindowDays(){
  const sel = document.getElementById('avgWindowSelect');
  if(!sel) return 30;
  const v = parseInt(sel.value,10);
  return isNaN(v) ? 30 : v;
}

function groupLogsByMonth(logs){
  const months = {}; // key: YYYY-MM
  logs.forEach(row => {
    const d = new Date(row.datetime.replace(' ','T'));
    if(isNaN(d)) return;
    const key = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0');
    if(!months[key]) months[key] = [];
    months[key].push(row);
  });
  return months;
}

function computeMonthlyAverageSecondsForMonth(rows){
  // Return average seconds per day for the month represented by `rows`.
  // If rows are empty, return 0.
  if(!rows || !rows.length) return 0;
  // Determine year/month from first row to compute days in that month
  const firstDate = new Date(rows[0].datetime.replace(' ','T'));
  if(isNaN(firstDate)) return 0;
  const year = firstDate.getFullYear();
  const monthIndex = firstDate.getMonth(); // 0-based
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  // aggregate per-day totals for the month
  const dayTotals = {};
  rows.forEach(r => {
    const d = new Date(r.datetime.replace(' ','T'));
    if(isNaN(d)) return;
    const key = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
    dayTotals[key] = (dayTotals[key] || 0) + parseHmsToSeconds(r.pcm);
  });
  let sum = 0;
  Object.keys(dayTotals).forEach(k => sum += dayTotals[k]);
  const avg = Math.round(sum / daysInMonth);
  try{ console.debug('[computeMonthlyAverageSecondsForMonth] dayCount=', Object.keys(dayTotals).length, 'sum=', sum, 'daysInMonth=', daysInMonth, 'avg=', avg); }catch(e){}
  return avg;
}

// ----- Weekly target persistence (localStorage + device) -----
function getSavedWeeklyTargetSeconds(){
  const t = localStorage.getItem('study_weekly_target_secs');
  return t ? parseInt(t,10) : 0;
}
function setSavedWeeklyTargetSeconds(s){ localStorage.setItem('study_weekly_target_secs', String(Math.max(0,Math.round(s)))); }

function updateWeeklyTargetUI(){
  const targetSecs = getSavedWeeklyTargetSeconds();
  const disp = document.getElementById('weeklyTargetDisplay');
  if(!disp) return;
  if(targetSecs<=0){ disp.innerText = 'Weekly target: Not set'; document.getElementById('weeklyTargetProgress').style.width='0%'; return; }
  disp.innerText = 'Weekly target: ' + secsToHms(targetSecs);
}

function updateWeeklyTargetFromAvg(avgSecs){
  // avgSecs is average-per-day. Convert to weekly total for comparison vs weekly target.
  const target = getSavedWeeklyTargetSeconds(); // target is stored as weekly seconds
  const studiedPerDay = avgSecs || 0;
  const studiedPerWeek = studiedPerDay * 7;
  const pct = target > 0 ? Math.min(100, Math.round((studiedPerWeek / target) * 100)) : 0;
  const prog = document.getElementById('weeklyTargetProgress');
  if(prog) prog.style.width = pct + '%';
  const weeklyAvgEl = document.getElementById('weeklyAvg');
  if(weeklyAvgEl) weeklyAvgEl.innerText = secsToHms(studiedPerDay) + ' /day (' + secsToHms(studiedPerWeek) + '/wk)';
}

function secsToHms(secs){
  secs = Math.max(0, Math.round(secs));
  const h = Math.floor(secs/3600);
  const m = Math.floor((secs%3600)/60);
  const s = secs%60;
  return [h,m,s].map(x=>String(x).padStart(2,'0')).join(':');
}

function getSavedTargetSeconds(){
  const t = localStorage.getItem('study_target_secs');
  return t ? parseInt(t,10) : 0;
}

function setSavedTargetSeconds(s){ localStorage.setItem('study_target_secs', String(Math.max(0,Math.round(s)))); }

function updateTargetUI(){
  const targetSecs = getSavedTargetSeconds();
  const disp = document.getElementById('targetDisplay');
  if(!disp) return;
  if(targetSecs<=0){ disp.innerText = 'Not set'; document.getElementById('targetProgress').style.width='0%'; return; }
  disp.innerText = secsToHms(targetSecs);
}

function updateTargetFromPCM(pcmStr){
  // pcmStr is total studied time today returned from server like "HH:MM:SS"
  const studied = parseHmsToSeconds(pcmStr);
  const target = getSavedTargetSeconds();
  const remaining = Math.max(0, target - studied);
  const pct = target>0 ? Math.min(100, Math.round((studied/target)*100)) : 0;
  const prog = document.getElementById('targetProgress');
  if(prog) prog.style.width = pct + '%';
  const disp = document.getElementById('targetDisplay');
  if(disp){
    if(target<=0) disp.innerText = 'Not set';
    else disp.innerText = `${secsToHms(studied)} / ${secsToHms(target)} (${pct}%) — left ${secsToHms(remaining)}`;
  }
}

// Edit target flow
document.addEventListener('DOMContentLoaded', ()=>{
  updateTargetUI();
  updateWeeklyTargetUI();
  const editBtn = document.getElementById('editTargetBtn');
  const form = document.getElementById('targetForm');
  const hoursIn = document.getElementById('targetHours');
  const minsIn = document.getElementById('targetMinutes');
  const saveBtn = document.getElementById('saveTargetBtn');
  const cancelBtn = document.getElementById('cancelTargetBtn');
  if(editBtn && form){
    editBtn.addEventListener('click', ()=>{
      // show form and populate with saved value
      const secs = getSavedTargetSeconds();
      hoursIn.value = Math.floor(secs/3600) || '';
      minsIn.value = Math.floor((secs%3600)/60) || '';
      form.style.display = 'flex';
      form.setAttribute('aria-hidden','false');
      editBtn.setAttribute('aria-expanded','true');
    });

    cancelBtn.addEventListener('click', ()=>{
      form.style.display = 'none';
      form.setAttribute('aria-hidden','true');
      editBtn.setAttribute('aria-expanded','false');
    });

    saveBtn.addEventListener('click', ()=>{
      const h = parseInt(hoursIn.value||0,10) || 0;
      const m = parseInt(minsIn.value||0,10) || 0;
      const secs = Math.max(0, h*3600 + m*60);
      // try to persist to device
      fetch(`/settarget?secs=${secs}`)
        .then(r=>{
          if(r.ok){
            setSavedTargetSeconds(secs);
          } else {
            // fallback
            setSavedTargetSeconds(secs);
          }
        })
        .catch(()=>{
          // unreachable device, store locally
          setSavedTargetSeconds(secs);
        })
        .finally(()=>{
          updateTargetUI();
          const pcmText = document.getElementById('pcm_total') ? document.getElementById('pcm_total').innerText : '00:00:00';
          updateTargetFromPCM(pcmText);
          form.style.display = 'none';
          form.setAttribute('aria-hidden','true');
          editBtn.setAttribute('aria-expanded','false');
        });
    });

    // Preset buttons
    const presets = form.querySelectorAll('.preset');
    presets.forEach(btn => {
      btn.addEventListener('click', ()=>{
        const mins = parseInt(btn.getAttribute('data-mins'),10)||0;
        const cur = getSavedTargetSeconds();
        const newSecs = cur + mins*60;
        // try to persist to device
        fetch(`/settarget?secs=${newSecs}`)
          .then(r=>{ if(r.ok) setSavedTargetSeconds(newSecs); else setSavedTargetSeconds(newSecs); })
          .catch(()=> setSavedTargetSeconds(newSecs))
          .finally(()=>{
            updateTargetUI();
            const pcmText = document.getElementById('pcm_total') ? document.getElementById('pcm_total').innerText : '00:00:00';
            updateTargetFromPCM(pcmText);
            // update form inputs
            hoursIn.value = Math.floor(newSecs/3600) || '';
            minsIn.value = Math.floor((newSecs%3600)/60) || '';
          });
      });
    });
  }
});

// Weekly target edit handlers
document.addEventListener('DOMContentLoaded', ()=>{
  const editBtn = document.getElementById('editWeeklyTargetBtn');
  const form = document.getElementById('weeklyTargetForm');
  const hoursIn = document.getElementById('weeklyTargetHours');
  const minsIn = document.getElementById('weeklyTargetMinutes');
  const saveBtn = document.getElementById('saveWeeklyTargetBtn');
  const cancelBtn = document.getElementById('cancelWeeklyTargetBtn');
  if(editBtn && form){
    editBtn.addEventListener('click', ()=>{
      const secs = getSavedWeeklyTargetSeconds();
      hoursIn.value = Math.floor(secs/3600) || '';
      minsIn.value = Math.floor((secs%3600)/60) || '';
      form.style.display = 'flex'; form.setAttribute('aria-hidden','false');
    });
    cancelBtn.addEventListener('click', ()=>{ form.style.display = 'none'; form.setAttribute('aria-hidden','true'); });
    saveBtn.addEventListener('click', ()=>{
      const h = parseInt(hoursIn.value||0,10) || 0;
      const m = parseInt(minsIn.value||0,10) || 0;
      const secs = Math.max(0, h*3600 + m*60);
      fetch(`/setweektarget?secs=${secs}`)
        .then(r=>{ if(r.ok) setSavedWeeklyTargetSeconds(secs); else setSavedWeeklyTargetSeconds(secs); })
        .catch(()=> setSavedWeeklyTargetSeconds(secs))
        .finally(()=>{ updateWeeklyTargetUI(); form.style.display='none'; });
    });

    const presets = form.querySelectorAll('.preset-weekly');
    presets.forEach(btn => {
      btn.addEventListener('click', ()=>{
        const mins = parseInt(btn.getAttribute('data-mins'),10)||0;
        const cur = getSavedWeeklyTargetSeconds();
        const newSecs = cur + mins*60;
        fetch(`/setweektarget?secs=${newSecs}`)
          .then(r=>{ if(r.ok) setSavedWeeklyTargetSeconds(newSecs); else setSavedWeeklyTargetSeconds(newSecs); })
          .catch(()=> setSavedWeeklyTargetSeconds(newSecs))
          .finally(()=>{ updateWeeklyTargetUI(); hoursIn.value = Math.floor(newSecs/3600)||''; minsIn.value = Math.floor((newSecs%3600)/60)||''; });
      });
    });
  }
});

// On load try to sync from device target, fallback to localStorage
document.addEventListener('DOMContentLoaded', ()=>{
  fetch('/target')
    .then(r=>r.json())
    .then(j=>{
      if(j && typeof j.target_secs !== 'undefined'){
        setSavedTargetSeconds(j.target_secs);
        updateTargetUI();
        const pcmText = document.getElementById('pcm_total') ? document.getElementById('pcm_total').innerText : '00:00:00';
        updateTargetFromPCM(pcmText);
      }
    })
    .catch(()=>{ /* ignore, leave local value */ });
  // fetch weekly target from device
  fetch('/weektarget')
    .then(r=>r.json())
    .then(j=>{
      if(j && typeof j.target_secs !== 'undefined'){
        setSavedWeeklyTargetSeconds(j.target_secs);
        updateWeeklyTargetUI();
      }
    })
    .catch(()=>{/* ignore */});
});

function logNow() {
  fetch('/lognow')
    .then(r => r.text())
    .then(d => { alert(d); fetchData(); })
    .catch(e => alert('Failed: ' + e));
}

const clearBtn = document.getElementById("clearLogsBtn");
if(clearBtn){
  clearBtn.classList.add('danger');
  clearBtn.addEventListener("click", function() {
    if (confirm("⚠️ WARNING: This will delete all logged data permanently. Are you sure?")) {
      fetch("/clearlogs")
        .then(response => response.text())
        .then(data => { alert(data); fetchData(); })
        .catch(err => alert("Error: " + err));
    }
  });
}

// Upload CSV and merge logs
function uploadLogs() {
  const fileInput = document.getElementById('logsFile');
  if(!fileInput.files.length){ alert('Select a CSV first'); return; }
  const fd = new FormData();
  fd.append('file', fileInput.files[0], 'logs.csv');
  fetch('/uploadlogs',{ method:'POST', body: fd })
    .then(r=>r.text())
    .then(t=>{ alert(t); fetchData(); })
    .catch(e=>alert('Upload failed: '+e));
}

// NEW: update file label text
(function(){
  const inp = document.getElementById('logsFile');
  const label = document.querySelector('label.file-btn');
  if(inp && label){
    inp.addEventListener('change', () => {
      if(inp.files.length){
        const name = inp.files[0].name;
        label.textContent = '✅ ' + (name.length>24 ? name.slice(0,20)+'...' : name);
        label.classList.add('selected');
      } else {
        label.textContent = '📂 Choose CSV';
        label.classList.remove('selected');
      }
    });
  }

  // (theme toggle removed)
})();

// Add classes to CSV/download buttons for styling
document.addEventListener('DOMContentLoaded', () => {
  // mark primary & download buttons
  const buttons = document.querySelectorAll('.buttons button');
  if(buttons[0]) buttons[0].classList.add('primary');
  if(document.querySelector('.download-link button')) document.querySelector('.download-link button').classList.add('download');

  // initial fetch
  fetchData();
  // Refresh every 5 seconds
  setInterval(fetchData, 5000);
});

// Old JSON-based fetchData removed — CSV-aware fetchData is used instead above.
