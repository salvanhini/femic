# Fechamento da Agenda Semanal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deixar a agenda semanal mais leve, estável e visualmente consistente, sem alterar a arquitetura ou as regras de negócio principais.

**Architecture:** A implementação permanece concentrada em `js/femic-agenda.js` e `css/femic-agenda.css`. O JavaScript passa a preparar os dados visíveis da semana uma vez por render e a reutilizar essa estrutura no cabeçalho, no layout dos eventos e no resumo do card; o CSS passa a ter uma camada final única e previsível para os cards semanais, reduzindo sobreposição de estilos antigos.

**Tech Stack:** HTML estático, JavaScript vanilla, CSS, renderização local da agenda FEMIC.

---

### Task 1: Consolidar o pipeline de dados da semana

**Files:**
- Modify: `js/femic-agenda.js:873`
- Modify: `js/femic-agenda.js:2635`
- Modify: `js/femic-agenda.js:2697`

- [ ] **Step 1: Escrever a estrutura de apoio para filtros e agrupamento semanal**

```js
function agendaActiveFilters(){
  return {
    status: $('agendaStatusFilter')?.value || 'all',
    serviceId: $('agendaServiceFilter')?.value || 'all'
  };
}

function matchesAgendaFilters(appointment, filters){
  if(filters.status !== 'all' && appointment.status !== filters.status) return false;
  if(filters.serviceId !== 'all' && String(appointment.service_id) !== String(filters.serviceId)) return false;
  return true;
}

function buildWeekAgendaData(visibleDays){
  const filters = agendaActiveFilters();
  const byDate = Object.create(null);

  visibleDays.forEach(day => {
    byDate[isoDate(day)] = [];
  });

  appointments.forEach(appointment => {
    const date = String(appointment.appointment_date || '');
    if(!byDate[date]) return;
    if(!matchesAgendaFilters(appointment, filters)) return;
    byDate[date].push(appointment);
  });

  Object.keys(byDate).forEach(date => {
    byDate[date].sort((a, b) =>
      normalizeTime(a.start_time).localeCompare(normalizeTime(b.start_time)) ||
      normalizeTime(a.end_time).localeCompare(normalizeTime(b.end_time))
    );
  });

  return { filters, byDate };
}
```

- [ ] **Step 2: Rodar verificação de sintaxe antes de integrar no fluxo**

Run: `node --check js/femic-agenda.js`
Expected: exit `0` e nenhuma mensagem de erro de sintaxe.

- [ ] **Step 3: Substituir o uso repetido de `agendaFiltered(appointments.filter(...))` por dados preparados**

```js
function weekV3ItemsForDay(dayAppointments, bounds){
  return dayAppointments.map(a => {
    const st = timeToMin(normalizeTime(a.start_time));
    let en = timeToMin(normalizeTime(a.end_time));
    if(!Number.isFinite(st)) return null;
    if(!Number.isFinite(en) || en <= st){
      const fallbackDuration = Number(a.duration_minutes || serviceById(a.service_id).duration_minutes || 45);
      en = st + (Number.isFinite(fallbackDuration) && fallbackDuration > 0 ? fallbackDuration : 45);
    }
    const start = femicClamp(st, bounds.start, bounds.end);
    const end = femicClamp(en, bounds.start, bounds.end);
    if(end <= start) return null;
    return {
      start,
      end,
      startLabel: normalizeTime(a.start_time),
      endLabel: normalizeTime(a.end_time),
      appointment: a,
      col: 0,
      cols: 1
    };
  }).filter(Boolean).sort((a, b) =>
    (a.start - b.start) ||
    (a.end - b.end) ||
    patientName(a.appointment.patient_id).localeCompare(patientName(b.appointment.patient_id), 'pt-BR')
  );
}
```

- [ ] **Step 4: Integrar o pipeline no `renderWeek()`**

```js
const weekData = buildWeekAgendaData(visibleDays);

visibleDays.forEach(d => {
  const ds = isoDate(d);
  const dayAppointments = weekData.byDate[ds] || [];
  const openCount = dayAppointments.filter(a => a.status !== 'cancelado').length;
  const weekLabel = d.toLocaleDateString('pt-BR', { weekday:'short' }).replace('.', '');
  html += `<div class="week-v3-head ${ds===todayIso()?'today':''}"><span>${weekLabel}</span><strong>${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}</strong><small>${openCount} ag.</small></div>`;
});

visibleDays.forEach(d => {
  const ds = isoDate(d);
  const dayAppointments = weekData.byDate[ds] || [];
  const items = layoutWeekV3Items(weekV3ItemsForDay(dayAppointments, bounds));
  const closed = isClosedForView(ds);
  html += `<div class="week-v3-day ${ds===todayIso()?'today':''} ${closed?'closed':''}" style="height:${timelineHeight}px;--hour-height:${hourHeight}px" onclick="femicWeekClickV1434(event,'${ds}',{start:${bounds.start},end:${bounds.end}},${pxPerMin})">`;
  items.forEach(item => {
    const key = 'a' + (itemIndex++);
    const a = item.appointment;
    window.FEMICWeekV3Cache[key] = { date: ds, startLabel: item.startLabel, endLabel: item.endLabel, appointmentId: String(a.id || '') };
    const top = Math.round((item.start - bounds.start) * pxPerMin);
    const height = Math.max(54, Math.round((item.end - item.start) * pxPerMin));
    const laneWidth = 100 / Math.max(item.cols, 1);
    const left = laneWidth * item.col;
    html += `<button class="week-v3-event ${weekV3StatusClass(a.status||'agendado')} status-${a.status||'agendado'}" type="button" style="top:${top}px;height:${height}px;left:calc(${left}% + 4px);width:calc(${laneWidth}% - 8px)" onclick="event.stopPropagation();openWeekAppointmentSummary('${key}')"><div class="week-v3-event-time"><span>${item.startLabel}-${item.endLabel}</span></div><strong class="week-v3-event-name">${esc(patientName(a.patient_id))}</strong></button>`;
  });
  html += `</div>`;
});
```

- [ ] **Step 5: Rodar a verificação de sintaxe após a integração**

Run: `node --check js/femic-agenda.js`
Expected: exit `0` e nenhuma mensagem de erro.

- [ ] **Step 6: Commit**

```bash
git add js/femic-agenda.js
git commit -m "refactor: reduce weekly agenda recomputation"
```

### Task 2: Endurecer o resumo do card semanal sem mudar o comportamento

**Files:**
- Modify: `js/femic-agenda.js:2670`
- Modify: `index.html:900`
- Modify: `agenda.html:177`

- [ ] **Step 1: Ajustar o cache semanal para depender apenas de dados já preparados**

```js
window.FEMICWeekV3Cache[key] = {
  date: ds,
  startLabel: item.startLabel,
  endLabel: item.endLabel,
  appointmentId: String(a.id || '')
};
```

- [ ] **Step 2: Reidratar o resumo pelo `appointmentId` antes de abrir o modal**

```js
function openWeekAppointmentSummary(key){
  const cached = window.FEMICWeekV3Cache && window.FEMICWeekV3Cache[key];
  if(!cached) return;
  const a = appointments.find(row => String(row.id) === String(cached.appointmentId));
  if(!a) return;
  const patient = patientById(a.patient_id);
  const statusLabel = {
    agendado: 'Agendado',
    confirmado: 'Confirmado',
    concluido: 'Concluído',
    cancelado: 'Cancelado'
  }[a.status] || a.status;
  if(title) title.textContent = `${fmtWeekday(cached.date)}, ${fmtDate(cached.date)} · ${cached.startLabel}-${cached.endLabel}`;
  if(subtitle) subtitle.textContent = `${patient.name||'Paciente'} · ${serviceName(a.service_id)} · ${statusLabel}`;
  if(body){
    body.innerHTML = '<div class="slot-summary-list">' +
      `<div class="slot-summary-row status-${a.status}">
        <div class="slot-summary-main">
          <strong>${esc(patient.name||'Paciente')}</strong>
          <span>${normalizeTime(a.start_time)}-${normalizeTime(a.end_time)} · ${esc(serviceName(a.service_id))}</span>
          <span class="status-chip ${a.status}">${statusLabel}</span>
        </div>
        <div class="slot-summary-actions">${slotSummaryStatusButtons(a)}</div>
      </div>` +
    '</div>';
  }
}
```

- [ ] **Step 3: Garantir que os pontos de abertura continuem consistentes**

```js
if(addBtn){
  addBtn.onclick = function(){
    closeModal('slotSummaryModal');
    openAppt(cached.date, null, cached.startLabel);
  };
}
```

- [ ] **Step 4: Verificar a sintaxe do HTML que contém a superfície da semana**

Run: `grep -n "slotSummaryModal\|weekView\|weekBoard" index.html agenda.html`
Expected: linhas dos IDs continuam presentes em ambos os arquivos sem renomeação acidental.

- [ ] **Step 5: Rodar a verificação de sintaxe após o endurecimento**

Run: `node --check js/femic-agenda.js`
Expected: exit `0` e nenhuma mensagem de erro.

- [ ] **Step 6: Commit**

```bash
git add js/femic-agenda.js index.html agenda.html
git commit -m "fix: stabilize weekly appointment summary state"
```

### Task 3: Unificar a camada visual final dos cards semanais

**Files:**
- Modify: `css/femic-agenda.css:1508-1868`
- Modify: `css/femic-agenda.css:2317-2860`
- Modify: `css/femic-components.css:38-39`

- [ ] **Step 1: Definir uma única camada final para os cards semanais**

```css
.week-v3-event{
  border: 1px solid rgba(11, 60, 111, 0.10);
  border-left-width: 4px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 4px 14px rgba(11, 60, 111, 0.08);
  padding: 8px 9px;
  transition: transform .16s ease, box-shadow .16s ease, border-color .16s ease;
}

.week-v3-event:hover,
.week-v3-event:focus-visible{
  transform: translateY(-1px);
  box-shadow: 0 12px 26px rgba(11, 60, 111, 0.14);
}
```

- [ ] **Step 2: Reforçar a hierarquia visual de horário, nome e status**

```css
.week-v3-event-time{
  display: inline-flex;
  align-items: center;
  margin-bottom: 6px;
  padding: 2px 7px;
  border-radius: 999px;
  background: rgba(31, 182, 233, 0.10);
  color: #0a4d6e;
  font-size: .68rem;
  font-weight: 800;
}

.week-v3-event-name{
  display: block;
  color: var(--primary);
  font-size: .84rem;
  line-height: 1.22;
  letter-spacing: -.01em;
}
```

- [ ] **Step 3: Consolidar estados por status sem aparência pesada**

```css
.week-v3-event.status-agendado{ border-left-color: var(--warning); background: linear-gradient(180deg, #fffdf5, #fff); }
.week-v3-event.status-confirmado{ border-left-color: #2563eb; background: linear-gradient(180deg, #f3f7ff, #fff); }
.week-v3-event.status-concluido{ border-left-color: var(--success); background: linear-gradient(180deg, #f3fcf7, #fff); }
.week-v3-event.status-cancelado{ border-left-color: var(--danger); background: linear-gradient(180deg, #fff5f5, #fff); opacity: .78; }
```

- [ ] **Step 4: Neutralizar a concorrência das camadas antigas sem mexer no restante da agenda**

```css
/* Mantém o escopo só na visão semanal nova */
#weekView .week-appt,
#weekView .femic-week-card{
  all: unset;
}

#weekView .week-v3-event{
  box-sizing: border-box;
}
```

- [ ] **Step 5: Verificar visualmente os seletores duplicados antes de encerrar**

Run: `grep -n "week-v3-event\|femic-week-card\|week-appt" css/femic-agenda.css css/femic-components.css`
Expected: a camada final da semana nova fica clara e os seletores legados deixam de concorrer com o componente ativo.

- [ ] **Step 6: Commit**

```bash
git add css/femic-agenda.css css/femic-components.css
git commit -m "style: polish weekly patient cards"
```

### Task 4: Validar regressão funcional e fechamento visual

**Files:**
- Test: `index.html`
- Test: `agenda.html`
- Test: `js/femic-agenda.js`
- Test: `css/femic-agenda.css`

- [ ] **Step 1: Rodar a checagem final de sintaxe do JavaScript**

Run: `node --check js/femic-agenda.js`
Expected: exit `0`.

- [ ] **Step 2: Confirmar que a agenda semanal continua apontando para a mesma superfície**

Run: `grep -n "agendaStatusFilter\|agendaServiceFilter\|weekView\|weekBoard\|slotSummaryModal" index.html agenda.html`
Expected: os IDs usados pelo fluxo semanal continuam presentes.

- [ ] **Step 3: Subir um servidor local simples para inspeção manual**

Run: `python3 -m http.server 4173`
Expected: mensagem indicando servidor local ativo em `http://127.0.0.1:4173/`.

- [ ] **Step 4: Validar o fluxo principal da semana na interface renderizada**

Run: `Abrir http://127.0.0.1:4173/index.html e verificar: semana renderiza, filtros por status/serviço funcionam, clique no card abre resumo, clique no espaço da grade abre criação, status distintos seguem legíveis em desktop e mobile.`
Expected: sem erro visual crítico, sem regressão funcional visível e com cards mais limpos.

- [ ] **Step 5: Encerrar com commit de fechamento**

```bash
git add js/femic-agenda.js css/femic-agenda.css css/femic-components.css index.html agenda.html
git commit -m "chore: finalize weekly agenda optimization pass"
```
