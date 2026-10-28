/*
 * ESCALA KALUNGA — lógica da aplicação
 *
 * Organização deste arquivo:
 * 1. Configurações e armazenamento local
 * 2. Datas, domingos e feriados
 * 3. Status, filtros e indicadores
 * 4. Renderização do calendário, equipe e relatórios
 * 5. Alertas, escala de limpeza e notificações
 * 6. Eventos de interface, cadastro e exportação
 *
 * Para alterar aparência, edite styles.css. Para alterar textos e estrutura
 * das áreas fixas da página, edite index.html. Evite alterar STORAGE_KEY sem
 * planejar uma migração: essa chave identifica os dados salvos no navegador.
 */
(() => {
  // Atalhos para selecionar um elemento (#id) ou vários elementos (lista).
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  // Nome usado para salvar os dados no navegador (localStorage).
  const STORAGE_KEY = 'escalakalunga-data-v3';
  // Cargos permitidos no cadastro. Atualize também o seletor em index.html.
  const departments = ['Auxiliar de Loja','Gerente de Loja','Assistente Administrativo','Vendedores','Jovem Aprendiz'];
  // Ordem em que os status são alternados ao clicar em uma célula do calendário.
  const statuses = ['trabalha','folga','feriado','ferias','afastado','capacitacao'];
  const pad = n => String(n).padStart(2,'0');
  const dateKey = (y,m,d) => `${y}-${pad(m+1)}-${pad(d)}`;
  const today = new Date();
  let viewDate = new Date(today.getFullYear(), today.getMonth(), 1);
  let viewMode = 'month';
  let toastTimer;
  // Cria uma estrutura vazia para uma instalação sem dados anteriores.
  function seedData(){ return {employees:[],statuses:{},cleaningDays:{},lastRestDates:{},settings:{firstSundayTeam:'A',defaultRule:'6x1'}}; }
  // Carrega dados do navegador e preenche campos ausentes de versões antigas.
  function loadData(){
    try { const raw=localStorage.getItem(STORAGE_KEY); if(raw){const parsed=JSON.parse(raw);if(Array.isArray(parsed.employees)&&parsed.statuses){parsed.settings=parsed.settings||{firstSundayTeam:'A',defaultRule:'6x1'};parsed.cleaningDays=parsed.cleaningDays||{};parsed.lastRestDates=parsed.lastRestDates||{};return parsed;}} }
    catch(e){}
    return seedData();
  }
  let state=loadData();
  // Salva a equipe e as marcações no navegador deste dispositivo.
  function save(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));}catch(e){showToast('Não foi possível salvar neste navegador.');}}
  function escapeHTML(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function initials(name){return name.trim().split(/\s+/).slice(0,2).map(s=>s[0]||'').join('').toUpperCase();}
  function monthName(date){return date.toLocaleDateString('pt-BR',{month:'long',year:'numeric'}).replace(/^./,s=>s.toUpperCase());}
  function firstSundayOfMonth(y,m){const d=new Date(y,m,1);d.setDate(1+((7-d.getDay())%7));return d;}
  // Calcula automaticamente Trabalha/Folga nos domingos conforme os grupos A e B.
  function autoSundayStatus(employeeId,key){
    const [y,mm,dd]=key.split('-').map(Number),date=new Date(y,mm-1,dd);
    if(date.getDay()!==0)return null;
    const employee=state.employees.find(e=>e.id===employeeId);
    if(!employee||!employee.team||employee.department==='Jovem Aprendiz')return null;
    const settings=state.settings||{};
    // A âncora guarda o domingo inicial; a alternância continua entre meses, sem reiniciar no dia 1.
    const anchorKey=settings.rotationAnchorDate;
    const anchor=anchorKey?new Date(anchorKey+'T12:00:00'):firstSundayOfMonth(y,mm-1);
    // Compare dates in UTC calendar days to avoid DST/time-zone shifts changing the rotation.
    const utcDay=d=>Date.UTC(d.getFullYear(),d.getMonth(),d.getDate());
    const weeks=Math.round((utcDay(date)-utcDay(anchor))/(7*24*60*60*1000));
    const first=settings.rotationAnchorTeam||settings.firstSundayTeam||'A';
    const workingTeam=Math.abs(weeks)%2===0?first:(first==='A'?'B':'A');
    return employee.team===workingTeam?'trabalha':'folga';
  }
  // Calcula a data da Páscoa para identificar a Sexta-feira Santa.
  function easterSunday(year){const a=year%19,b=Math.floor(year/100),c=year%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,mm=Math.floor((a+11*h+22*l)/451),month=Math.floor((h+l-7*mm+114)/31),day=((h+l-7*mm+114)%31)+1;return new Date(year,month-1,day);}
  // Lista feriados nacionais fixos e a Sexta-feira Santa para o ano solicitado.
  function holidaysForYear(year){
    const fixed=[['01-01','Confraternização Universal'],['04-21','Tiradentes'],['05-01','Dia Mundial do Trabalho'],['09-07','Independência do Brasil'],['10-12','Nossa Senhora Aparecida'],['11-02','Finados'],['11-15','Proclamação da República'],['11-20','Dia Nacional de Zumbi e da Consciência Negra'],['12-25','Natal']];
    const map={};for(const [md,name] of fixed)map[`${year}-${md}`]=name;
    const easter=easterSunday(year),goodFriday=new Date(easter);goodFriday.setDate(easter.getDate()-2);map[dateKey(goodFriday.getFullYear(),goodFriday.getMonth(),goodFriday.getDate())]='Paixão de Cristo (Sexta-feira Santa)';return map;
  }
  function currentMonthHolidays(){const y=viewDate.getFullYear(),m=viewDate.getMonth(),all=holidaysForYear(y);return Object.entries(all).filter(([key])=>key.startsWith(`${y}-${pad(m+1)}-`)).sort(([a],[b])=>a.localeCompare(b));}
  function renderHolidayNotice(){const host=$('#holidayNotice');if(!host)return;const items=currentMonthHolidays();host.innerHTML=items.length?`<strong>Feriados nacionais de ${escapeHTML(monthName(viewDate))}</strong><div class="holiday-items">${items.map(([key,name])=>{const day=Number(key.slice(-2));return `<span><b>${pad(day)}/${pad(viewDate.getMonth()+1)}</b> ${escapeHTML(name)}</span>`;}).join('')}</div><small>Feriados nacionais. Feriados estaduais e municipais podem variar conforme a localidade.</small>`:'<strong>Nenhum feriado nacional neste mês.</strong><small>Feriados estaduais e municipais podem variar conforme a localidade.</small>';}
  // Retorna o status manual; se não houver, calcula o domingo ou usa Trabalha.
  function statusOf(id,key){const manual=state.statuses[`${id}|${key}`];if(manual)return manual==='dsr'?'folga':manual;const employee=state.employees.find(e=>e.id===id);if(employee?.department==='Jovem Aprendiz'){const [y,mm,dd]=key.split('-').map(Number);const weekday=new Date(y,mm-1,dd).getDay();if(weekday===0||weekday===6)return 'folga';}return autoSundayStatus(id,key)||'trabalha';}
  // Dias sem marcação especial são considerados Trabalha no planejamento.
  // Textos, abreviações e classes CSS de cada status.
  const statusInfo = {
    trabalha:{label:'Trabalha',short:'T',cls:'status-work'},
    folga:{label:'Folga',short:'F',cls:'status-off'},
    feriado:{label:'Feriado',short:'FE',cls:'status-holiday'},
    ferias:{label:'Férias',short:'FE',cls:'status-vacation'},
    afastado:{label:'Afastado',short:'AF',cls:'status-away'}, capacitacao:{label:'Capacitação teórica',short:'CT',cls:'status-training'}
  };
  function statusLabel(s){return statusInfo[s]?.label||'Trabalha';}
  function statusClass(s){return statusInfo[s]?.cls||'status-work';}
  function statusShort(s){return statusInfo[s]?.short||'T';}
  function isRestStatus(s){return s==='folga';}
  function daysInMonth(){return new Date(viewDate.getFullYear(),viewDate.getMonth()+1,0).getDate();}
  // Ordem padrão dos cargos em calendários, listas e relatórios: gerentes, assistentes, vendedores e auxiliares. Outros cargos ficam ao final.
  // Define a ordem dos cargos nas listas, calendário e relatórios.
  function departmentOrder(department){const d=String(department||'').toLocaleLowerCase('pt-BR');if(d.includes('gerente'))return 0;if(d.includes('assistente'))return 1;if(d.includes('vendedor'))return 2;if(d.includes('auxiliar'))return 3;if(d.includes('aprendiz'))return 4;return 5;}
  function sortEmployees(list){return list.slice().sort((a,b)=>departmentOrder(a.department)-departmentOrder(b.department)||a.name.localeCompare(b.name,'pt-BR'));}
  function filteredEmployees(){const q=$('#searchEmployee').value.trim().toLocaleLowerCase('pt-BR'),dep=$('#departmentFilter').value;return sortEmployees(state.employees.filter(e=>(dep==='all'||e.department===dep)&&(!q||e.name.toLocaleLowerCase('pt-BR').includes(q)||e.department.toLocaleLowerCase('pt-BR').includes(q))));}
  function renderDepartments(){const sel=$('#departmentFilter'),old=sel.value;sel.innerHTML='<option value="all">Todos os departamentos</option>'+departments.map(d=>`<option value="${escapeHTML(d)}">${escapeHTML(d)}</option>`).join('');sel.value=departments.includes(old)?old:'all';}
  // Atualiza os cartões de resumo no topo da página.
  function renderStats(){const y=viewDate.getFullYear(),m=viewDate.getMonth(),prefix=`${y}-${pad(m+1)}-`;let counts={folga:0,feriado:0,ferias:0,afastado:0};Object.entries(state.statuses).forEach(([k,v])=>{if(k.includes('|'+prefix)&&counts[v]!==undefined)counts[v]++;});const todayKey=dateKey(today.getFullYear(),today.getMonth(),today.getDate());const working=state.employees.filter(e=>statusOf(e.id,todayKey)==='trabalha').length;$('#totalEmployees').textContent=state.employees.length;$('#totalDaysOff').textContent=counts.folga;$('#totalShifts').textContent=counts.feriado+counts.ferias+counts.afastado;$('#workingToday').textContent=working;$('#employeeCount').textContent=state.employees.length;}
  function ruleWorkLimit(){
    return (state.settings?.defaultRule || $('#globalRule')?.value || '6x1') === '5x2' ? 5 : 6;
  }
  // Sinaliza visualmente o dia de trabalho que ultrapassa o regime selecionado.
  // 6x1: o 7º dia consecutivo de trabalho fica vermelho.
  // 5x2: o dia fica vermelho quando seria o 6º dia trabalhado em uma janela
  // móvel de 7 dias, pois a janela precisa conter pelo menos dois descansos.
  // Identifica dias que precisam de atenção por sequência de trabalho.
  function nextRestDueKey(employee, targetKey){
    if(statusOf(employee.id,targetKey)!=='trabalha')return false;
    const target=new Date(`${targetKey}T12:00:00`);
    const rule=state.settings?.defaultRule || $('#globalRule')?.value || '6x1';
    if(rule==='5x2'){
      let worked=0;
      for(let offset=0;offset<7;offset++){
        const d=new Date(target);d.setDate(d.getDate()-offset);
        const key=dateKey(d.getFullYear(),d.getMonth(),d.getDate());
        if(statusOf(employee.id,key)==='trabalha')worked++;
      }
      return worked>5 ? targetKey : false;
    }
    let consecutive=0;
    for(let offset=0;offset<14;offset++){
      const d=new Date(target);d.setDate(d.getDate()-offset);
      const key=dateKey(d.getFullYear(),d.getMonth(),d.getDate());
      const st=statusOf(employee.id,key);
      if(st==='trabalha')consecutive++;
      else break;
    }
    return consecutive>6 ? targetKey : false;
  }
  // Desenha o calendário mensal ou a escala de limpeza na página.
  function renderCalendar(){
    $('#monthTitle').textContent=monthName(viewDate);
    const n=daysInMonth(),y=viewDate.getFullYear(),m=viewDate.getMonth(),weekdays=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
    const employees=filteredEmployees();
    renderHolidayNotice();
    $('#calendarContainer').innerHTML=buildCalendarTable(employees,n,y,m,weekdays,false);
    $('#calendarContainer').classList.toggle('hidden',viewMode!=='month');
    $('#listContainer').classList.toggle('hidden',viewMode!=='list');
    if(viewMode==='list')renderList(employees);
  }
  // Monta a tabela de datas e células de cada colaborador.
  function buildCalendarTable(employees,n,y,m,weekdays,isCleaning){
    let html='<table class="calendar-table"><thead><tr><th>Colaborador</th>';
    const holidays=holidaysForYear(y);for(let d=1;d<=n;d++){const dt=new Date(y,m,d),key=dateKey(y,m,d),holiday=holidays[key];const dueEmployees=employees.filter(emp=>statusOf(emp.id,key)==='trabalha'&&nextRestDueKey(emp,key)===key);const dueNames=dueEmployees.map(emp=>emp.name).join(', ');const dueDescription=dueEmployees.length?`Descanso previsto hoje pelo regime ${state.settings?.defaultRule||'6x1'}: ${dueNames}. Confira e marque Folga se aplicável.`:'';const title=[holiday,dueDescription].filter(Boolean).join(' · ');html+=`<th class="${dt.getDay()===0?'sunday-column ':''}${holiday?'holiday-date ':''}${dueEmployees.length?'rest-due-date':''}" ${title?`title="${escapeHTML(title)}"`:''}><span class="day-number">${pad(d)}</span><span class="day-name">${weekdays[dt.getDay()]}</span>${dueEmployees.length?`<span class="rest-due-header" aria-label="${escapeHTML(dueDescription)}">!${dueEmployees.length>1?dueEmployees.length:''}</span>`:''}</th>`;}html+='</tr></thead><tbody>';
    if(!employees.length)html+=`<tr><td colspan="${n+1}"><div class="empty-state empty-team-state"><strong>${isCleaning?'Nenhum Auxiliar de Loja cadastrado':'Adicione seu quadro de funcionários'}</strong><span>${isCleaning?'Cadastre colaboradores com o cargo Auxiliar de Loja para montar a escala de limpeza.':'Cadastre os colaboradores da equipe para começar a montar a escala mensal.'}</span><button class="button primary" type="button" data-add-first>＋ Adicionar colaborador</button></div></td></tr>`;
    employees.forEach(e=>{html+=`<tr><th><div class="employee-cell"><span class="employee-avatar">${escapeHTML(initials(e.name))}</span><span class="employee-meta"><strong title="${escapeHTML(e.name)}">${escapeHTML(e.name)}</strong><small>${escapeHTML(e.department)}</small></span></div></th>`;for(let d=1;d<=n;d++){const key=dateKey(y,m,d),isToday=y===today.getFullYear()&&m===today.getMonth()&&d===today.getDate();if(isCleaning){const marked=!!state.cleaningDays?.[`${e.id}|${key}`];html+=`<td class="${new Date(y,m,d).getDay()===0?'sunday-column ':''}${holidays[key]?'holiday-column':''}"><button class="day-button cleaning-day ${marked?'is-cleaning':''} ${isToday?'today':''}" data-cleaning-employee="${escapeHTML(e.id)}" data-date="${key}" title="${escapeHTML(e.name)} — ${d} de ${monthName(viewDate)}: ${marked?'Limpeza marcada':'Sem limpeza'} (clique para alternar)" aria-label="${escapeHTML(e.name)}, dia ${d}: ${marked?'limpeza marcada':'sem limpeza'}">${marked?'L':'—'}</button></td>`;}else{const st=statusOf(e.id,key),nextDue=!isRestStatus(st)&&nextRestDueKey(e,key)===key;html+=`<td class="${new Date(y,m,d).getDay()===0?'sunday-column ':''}${holidays[key]?'holiday-column':''}"><button class="day-button ${statusClass(st)} ${nextDue?'work-rule-violation':''} ${isToday?'today':''}" data-employee="${escapeHTML(e.id)}" data-date="${key}" title="${escapeHTML(e.name)} — ${d} de ${monthName(viewDate)}: ${statusLabel(st)}${nextDue?' · Descanso necessário conforme regime':''} (clique para alterar)" aria-label="${escapeHTML(e.name)}, dia ${d}: ${statusLabel(st)}${nextDue?', próxima folga recomendada':''}">${statusShort(st)}${nextDue?'<span class="rest-due-dot">!</span>':''}</button></td>`;}}html+='</tr>';});
    return html+'</tbody></table>';
  }
  function renderList(employees){const y=viewDate.getFullYear(),m=viewDate.getMonth(),n=daysInMonth();let items=[];employees.forEach(e=>{for(let d=1;d<=n;d++){const key=dateKey(y,m,d),st=statusOf(e.id,key);if(st!=='trabalha')items.push({e,d,s:st});}});items.sort((a,b)=>a.d-b.d||a.e.name.localeCompare(b.e.name,'pt-BR'));$('#listContainer').innerHTML=items.length?items.map(x=>`<div class="list-item"><div><strong>${escapeHTML(x.e.name)}</strong><small>${escapeHTML(x.e.department)}</small></div><div class="list-date">${pad(x.d)}/${pad(m+1)}/${y}</div><span class="list-status ${statusClass(x.s)}">${statusLabel(x.s)}</span></div>`).join(''):'<div class="empty-state">Nenhum status especial marcado neste período.</div>';}
  // Desenha a lista de colaboradores e seus botões Editar/Remover.
  function renderEmployees(){const list=$('#employeeList');if(!state.employees.length){list.innerHTML='<div class="empty-state">Nenhum colaborador cadastrado.</div>';return;}list.innerHTML=sortEmployees(state.employees).map(e=>`<div class="employee-list-item"><span class="employee-avatar">${escapeHTML(initials(e.name))}</span><button type="button" class="details employee-edit-trigger" data-edit="${escapeHTML(e.id)}" aria-label="Editar cadastro de ${escapeHTML(e.name)}" title="Clique para editar nome e cargo"><strong>${escapeHTML(e.name)}</strong><small>${escapeHTML(e.department)}</small></button><button type="button" class="employee-action edit-employee-button" data-edit="${escapeHTML(e.id)}" aria-label="Editar ${escapeHTML(e.name)}" title="Editar nome ou cargo">Editar</button><button type="button" class="employee-action delete-employee-button" data-remove="${escapeHTML(e.id)}" aria-label="Remover ${escapeHTML(e.name)}" title="Remover colaborador">Remover</button></div>`).join('');}
  function monthlyCounts(e){const n=daysInMonth(),y=viewDate.getFullYear(),m=viewDate.getMonth(),c={feriado:0,folga:0,trabalha:0,ferias:0,afastado:0};for(let d=1;d<=n;d++)c[statusOf(e.id,dateKey(y,m,d))]++;return c;}
  // Atualiza a área de relatório exibida na aplicação.
  function renderReport(){
    const head=$('#reportBody').closest('table').querySelector('thead');
    if($('#reportType')?.value==='limpeza'){
      const employees=cleaningEligible().slice().sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
      const n=daysInMonth(),y=viewDate.getFullYear(),m=viewDate.getMonth(),holidays=holidaysForYear(y),assignments=cleaningAssignments();
      const assigned=new Map(assignments.map(r=>[`${r.employee.id}|${dateKey(y,m,r.day)}`,true]));
      head.innerHTML='<tr><th>Colaborador</th><th>Departamento</th>'+Array.from({length:n},(_,i)=>{const d=i+1,key=dateKey(y,m,d),holiday=holidays[key];return `<th class="${holiday?'holiday-date':''}" title="${holiday?escapeHTML(holiday):''}">${pad(d)}</th>`;}).join('')+'<th>Total</th></tr>';
      $('#reportBody').innerHTML=employees.length?employees.map(e=>{let total=0;const cells=Array.from({length:n},(_,i)=>{const d=i+1,key=dateKey(y,m,d),isAssigned=assigned.has(`${e.id}|${key}`);if(isAssigned)total++;return `<td class="${isAssigned?'cleaning-report-mark':''}">${isAssigned?'L':'—'}</td>`;}).join('');return `<tr><td><strong>${escapeHTML(e.name)}</strong></td><td>${escapeHTML(e.department)}</td>${cells}<td>${total}</td></tr>`;}).join(''):'<tr><td colspan="40"><div class="empty-state">Não há Auxiliares de Loja cadastrados para gerar a escala de limpeza.</div></td></tr>';
      return;
    }
    head.innerHTML='<tr><th>Colaborador</th><th>Departamento</th><th>Feriados</th><th>Folgas</th><th>Trabalha</th><th>Férias</th><th>Afastado</th></tr>';
    const rows=state.employees.map(e=>({...e,counts:monthlyCounts(e)}));
    $('#reportBody').innerHTML=rows.length?rows.map(e=>`<tr><td><strong>${escapeHTML(e.name)}</strong></td><td>${escapeHTML(e.department)}</td><td>${e.counts.feriado}</td><td><span class="status-pill status-off">${e.counts.folga}</span></td><td>${e.counts.trabalha}</td><td>${e.counts.ferias}</td><td>${e.counts.afastado}</td></tr>`).join(''):'<tr><td colspan="8"><div class="empty-state">Cadastre colaboradores para gerar o relatório.</div></td></tr>';
  }
  // Mostra avisos de descanso e verificações da escala.
  function renderCompliance(){
    const box=$('#complianceAlerts');
    if(!state.employees.length){box.innerHTML='<p class="empty-state">Cadastre colaboradores para verificar a escala.</p>';return;}
    const y=viewDate.getFullYear(),m=viewDate.getMonth(),n=daysInMonth(),rule=state.settings?.defaultRule||'6x1',sundays=[];
    for(let d=1;d<=n;d++){if(new Date(y,m,d).getDay()===0)sundays.push(dateKey(y,m,d));}
    const alerts=[];
    state.employees.forEach(emp=>{
      const worked=sundays.map(k=>statusOf(emp.id,k)==='trabalha');
      const consecutive=worked.some((v,i)=>v&&worked[i+1]);
      if(emp.gender==='F'&&consecutive) alerts.push(`<div class="compliance-alert warning"><strong>Atenção — ${escapeHTML(emp.name)}</strong><span>Há domingos trabalhados consecutivos. Confira o revezamento e a convenção coletiva.</span></div>`);
      else if(emp.gender==='M'&&worked.some((v,i)=>v&&worked[i+1]&&worked[i+2])) alerts.push(`<div class="compliance-alert warning"><strong>Atenção — ${escapeHTML(emp.name)}</strong><span>Há três domingos trabalhados consecutivos. Confira as regras aplicáveis à atividade.</span></div>`);
    });
    if(!alerts.length) alerts.push('<div class="compliance-alert success"><strong>Verificação visual do descanso</strong><span>Os avisos consideram automaticamente a escala do mês anterior para identificar sequências de trabalho e descanso. Os indicadores aparecem no dia correspondente; passe o cursor sobre “!” para ver os detalhes. São auxiliares de conferência e não certificam conformidade jurídica.</span></div>');
    box.innerHTML=alerts.join('');
  }
  // Mostra os seletores dos grupos de revezamento dos domingos.
  function renderSundayAssignments(){
    const host=$('#sundayAssignmentList');
    const eligible=sortEmployees(state.employees.filter(e=>e.department!=='Jovem Aprendiz'));
    if(!eligible.length){host.innerHTML='<p class="empty-state">Cadastre colaboradores (exceto Jovem Aprendiz) para montar os grupos de domingo.</p>';$('#sundayAssignmentSummary').textContent='';return;}
    // Inicialmente distribui os colaboradores sem grupo alternadamente entre os dois domingos.
    let next='A'; eligible.forEach(e=>{if(!['A','B'].includes(e.team)){e.team=next;next=next==='A'?'B':'A';}});
    const first=eligible.filter(e=>e.team==='A'),second=eligible.filter(e=>e.team==='B');
    const list=(items,team)=>items.length?items.map(e=>{const firstName=e.name.trim().split(/\s+/)[0];return `<label class="sunday-person"><span>${escapeHTML(firstName)}</span><input type="checkbox" data-sunday-person="${escapeHTML(e.id)}" data-sunday-team="${team}" checked aria-label="Manter ${escapeHTML(firstName)} no grupo do ${team==='A'?'1º':'2º'} domingo"></label>`;}).join(''):'<p class="sunday-empty">Nenhum colaborador selecionado.</p>';
    host.innerHTML=`<div class="sunday-groups-grid"><section class="sunday-group sunday-group-one"><h3>Domingo 1 <span>${first.length}</span></h3><div class="sunday-people-list">${list(first,'A')}</div></section><section class="sunday-group sunday-group-two"><h3>Domingo 2 <span>${second.length}</span></h3><div class="sunday-people-list">${list(second,'B')}</div></section></div>`;
    $('#sundayAssignmentSummary').textContent=`${eligible.length} colaboradores distribuídos · ${first.length} no grupo Domingo 1 · ${second.length} no grupo Domingo 2. Jovem Aprendiz não participa.`;
  }
  // Atualiza todas as áreas dependentes dos dados ou do mês selecionado.
  function renderAll(){renderDepartments();renderStats();renderCalendar();renderEmployees();renderReport();renderCompliance();renderPendingAndCoverage();renderSundayAssignments();$('#todayLabel').textContent=today.toLocaleDateString('pt-BR',{day:'2-digit',month:'long',year:'numeric'});}
  function renderPendingAndCoverage(){
    const y=viewDate.getFullYear(),m=viewDate.getMonth(),n=daysInMonth(),holidays=holidaysForYear(y);
    const p=$('#pendingNotice');
    p.innerHTML='<strong>Planejamento mensal</strong><span>Verificação de cobertura: o sistema alerta quando muitas pessoas da equipe ficam de folga no mesmo dia, independentemente do cargo, e sugere datas alternativas com menos folgas.</span>';
    const alerts=[];
    const dayKey=d=>dateKey(y,m,d);
    const offOnDay=(d,department=null)=>state.employees.filter(e=>(!department||e.department===department)&&statusOf(e.id,dayKey(d))==='folga');
    const canMoveTo=(person,day)=>{
      const key=dayKey(day),dt=new Date(y,m,day),status=state.statuses[`${person.id}|${key}`];
      if(dt.getDay()===0||holidays[key]||statusOf(person.id,key)!=='trabalha')return false;
      return true;
    };
    const findSuggestions=(people,day,scope)=>{
      const suggestions=[];
      for(const person of people){
        const candidates=[];
        for(let alt=1;alt<=n;alt++){
          if(alt===day||!canMoveTo(person,alt))continue;
          const off=offOnDay(alt).length;
          const scopedOff=scope?offOnDay(alt,scope).length:off;
          const scopedTotal=scope?state.employees.filter(e=>e.department===scope).length:state.employees.length;
          const scopedWorking=scopedTotal-scopedOff;
          if(scopedWorking<1)continue;
          candidates.push({day:alt,off,scopedOff,distance:Math.abs(alt-day)});
        }
        candidates.sort((a,b)=>a.off-b.off||a.scopedOff-b.scopedOff||a.distance-b.distance||a.day-b.day);
        if(candidates.length)suggestions.push({person,target:candidates[0]});
        if(suggestions.length>=3)break;
      }
      return suggestions;
    };
    for(let d=1;d<=n;d++){
      const key=dayKey(d),dt=new Date(y,m,d);
      // Domingos e feriados são excluídos da análise, pois a loja opera com equipe reduzida nesses dias.
      if(dt.getDay()===0||holidays[key])continue;
      const off=offOnDay(d);
      // Cobertura geral: alerta quando 3 ou mais pessoas e pelo menos 30% da equipe folgam no mesmo dia.
      if(state.employees.length>=3&&off.length>=Math.max(3,Math.ceil(state.employees.length*.30))){
        const suggestions=findSuggestions(off,d,null);
        const items=suggestions.length?suggestions.map(s=>`<li><strong>${escapeHTML(s.person.name)}</strong>: considerar transferir a folga de ${pad(d)}/${pad(m+1)} para ${pad(s.target.day)}/${pad(m+1)} (atualmente ${s.target.off} pessoa(s) de folga no total nessa data).</li>`).join(''):'<li>Não foi encontrada uma alternativa adequada fora de domingos e feriados neste mês. Revise manualmente a cobertura.</li>';
        alerts.push(`<div class="compliance-alert warning coverage-role-alert"><strong>${pad(d)}/${pad(m+1)} — Cobertura geral: ${off.length} de ${state.employees.length} pessoas de folga</strong><span>Há várias folgas no mesmo dia, mesmo que sejam de cargos diferentes. Confira se a loja terá equipe suficiente.</span><ul>${items}</ul><small>Domingos e feriados são ignorados na análise e nas sugestões. As sugestões priorizam datas com menos folgas no total e não alteram a escala automaticamente.</small></div>`);
      }
    }
    $('#coverageNotice').innerHTML=alerts.join('');
  }
  // Apenas Auxiliares de Loja podem receber atribuições automáticas de limpeza.
  function cleaningEligible(){return state.employees.filter(e=>e.department==='Auxiliar de Loja');}
  // Distribui a limpeza de forma equilibrada entre quem está disponível.
  function cleaningAssignments(){const y=viewDate.getFullYear(),m=viewDate.getMonth(),n=daysInMonth();const eligible=cleaningEligible().slice().sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));if(!eligible.length)return [];const counts=new Map(eligible.map(e=>[e.id,0]));const rows=[];let lastId=null;for(let day=1;day<=n;day++){const key=dateKey(y,m,day);const available=eligible.filter(e=>statusOf(e.id,key)==='trabalha');if(!available.length)continue;available.sort((a,b)=>(counts.get(a.id)-counts.get(b.id))||a.name.localeCompare(b.name,'pt-BR'));let chosen=available.find(e=>e.id!==lastId)||available[0];rows.push({day,employee:chosen});counts.set(chosen.id,counts.get(chosen.id)+1);lastId=chosen.id;}return rows;}
  function showToast(msg){const el=$('#toast');el.textContent=msg;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2500);}
  // Navegação do calendário: mês anterior e próximo mês.
  $('#prevMonth').addEventListener('click',()=>{viewDate=new Date(viewDate.getFullYear(),viewDate.getMonth()-1,1);renderAll();});
  $('#nextMonth').addEventListener('click',()=>{viewDate=new Date(viewDate.getFullYear(),viewDate.getMonth()+1,1);renderAll();});
  $('#calendarContainer').addEventListener('click',e=>{if(e.target.closest('[data-add-first]')){dialog.showModal();return;}const b=e.target.closest('[data-employee][data-date]');if(!b)return;const key=`${b.dataset.employee}|${b.dataset.date}`,current=statusOf(b.dataset.employee,b.dataset.date),currentIndex=statuses.indexOf(current),next=statuses[((currentIndex<0?0:currentIndex)+1)%statuses.length];if(next==='trabalha')delete state.statuses[key];else state.statuses[key]=next;save();renderAll();showToast(`Status atualizado: ${statusLabel(next)}.`);});
  $('#calendarContainer').addEventListener('contextmenu',e=>{const b=e.target.closest('[data-employee][data-date], [data-cleaning-employee][data-date]');if(!b)return;e.preventDefault();if(b.dataset.cleaningEmployee){const key=`${b.dataset.cleaningEmployee}|${b.dataset.date}`;delete state.cleaningDays[key];}else{const key=`${b.dataset.employee}|${b.dataset.date}`;delete state.statuses[key];}save();renderAll();showToast('Marcação apagada.');});
  $('#searchEmployee').addEventListener('input',renderCalendar);$('#departmentFilter').addEventListener('change',renderCalendar);$('#clearFilters').addEventListener('click',()=>{$('#searchEmployee').value='';$('#departmentFilter').value='all';renderCalendar();});
  $$('.view-switch button').forEach(b=>b.addEventListener('click',()=>{viewMode=b.dataset.mode;$$('.view-switch button').forEach(x=>x.classList.toggle('selected',x===b));renderCalendar();}));
  // Cadastro e edição de colaboradores usam o mesmo formulário.
  const dialog=$('#employeeDialog');let editingEmployeeId=null;
  function openEmployeeEditor(employee=null){editingEmployeeId=employee?.id||null;$('#employeeDialogEyebrow').textContent=employee?'EDITAR CADASTRO':'CADASTRO';$('#employeeDialogTitle').textContent=employee?'Editar colaborador':'Novo colaborador';$('#saveEmployeeButton').textContent=employee?'Salvar alterações':'Adicionar';$('#employeeName').value=employee?.name||'';$('#employeeDepartment').value=employee?.department||departments[0];dialog.showModal();}
  $('#openEmployeeModal').addEventListener('click',()=>openEmployeeEditor());$('#closeEmployeeModal').addEventListener('click',()=>dialog.close());$('#cancelEmployee').addEventListener('click',()=>dialog.close());
  $('#employeeForm').addEventListener('submit',e=>{e.preventDefault();const name=$('#employeeName').value.trim(),department=$('#employeeDepartment').value;if(!name||!departments.includes(department))return;if(state.employees.some(x=>x.id!==editingEmployeeId&&x.name.toLocaleLowerCase('pt-BR')===name.toLocaleLowerCase('pt-BR'))){showToast('Já existe um colaborador com esse nome.');return;}if(editingEmployeeId){const emp=state.employees.find(x=>x.id===editingEmployeeId);if(!emp)return;emp.name=name;emp.department=department;emp.gender=emp.gender||'X';emp.team=emp.team||'A';emp.rule=state.settings.defaultRule;showToast('Cadastro do colaborador atualizado.');}else{state.employees.push({id:`e${Date.now()}${Math.random().toString(16).slice(2,6)}`,name,gender:'X',department,team:null,rule:state.settings.defaultRule});showToast('Colaborador adicionado à equipe.');}save();$('#employeeForm').reset();editingEmployeeId=null;dialog.close();renderAll();});
  $('#employeeList').addEventListener('click',e=>{const edit=e.target.closest('[data-edit]');if(edit){const emp=state.employees.find(x=>x.id===edit.dataset.edit);if(emp)openEmployeeEditor(emp);return;}const b=e.target.closest('[data-remove]');if(!b)return;const emp=state.employees.find(x=>x.id===b.dataset.remove);if(!emp||!confirm(`Remover ${emp.name} da equipe? Todas as marcações dessa pessoa também serão removidas.`))return;state.employees=state.employees.filter(x=>x.id!==emp.id);Object.keys(state.statuses).forEach(k=>{if(k.startsWith(emp.id+'|'))delete state.statuses[k];});Object.keys(state.cleaningDays||{}).forEach(k=>{if(k.startsWith(emp.id+'|'))delete state.cleaningDays[k];});save();renderAll();showToast('Colaborador removido.');});
  $('#globalRule').value=state.settings?.defaultRule||'6x1';
  $('#globalRule').addEventListener('change',()=>{state.settings=state.settings||{};state.settings.defaultRule=$('#globalRule').value;save();renderAll();});
  $('#saveGlobalRule').addEventListener('click',()=>{state.settings=state.settings||{};state.settings.defaultRule=$('#globalRule').value;$('#defaultRule').value=state.settings.defaultRule;state.employees.forEach(emp=>emp.rule=state.settings.defaultRule);save();renderAll();showToast('Regra global salva e aplicada à equipe.');});
  $('#sundayAssignmentList').addEventListener('change',e=>{const input=e.target.closest('[data-sunday-person]');if(!input)return;const emp=state.employees.find(x=>x.id===input.dataset.sundayPerson);if(!emp)return;emp.team=input.dataset.sundayTeam==='A'?'B':'A';save();renderAll();});
  $('#applySundayRotation').addEventListener('click',()=>{ 
    const eligible=state.employees.filter(e=>e.department!=='Jovem Aprendiz');
    const unassigned=eligible.filter(e=>!['A','B'].includes(e.team));
    if(unassigned.length&&!confirm(`${unassigned.length} colaborador(es) ficaram sem grupo de domingo. Deseja prosseguir mesmo assim?`))return;

    state.settings=state.settings||{};
    state.settings.firstSundayTeam=state.settings.firstSundayTeam||'A';
    state.settings.defaultRule=state.settings.defaultRule||$('#globalRule').value||'6x1';
    // Recalcula os domingos do mês visível para deixar o resultado explícito na escala.
    // Status especiais (feriado, férias, afastamento ou capacitação) são preservados.
    const y=viewDate.getFullYear(), m=viewDate.getMonth(), n=daysInMonth();
    // Na primeira aplicação, o domingo 1 do mês selecionado vira a âncora; depois a rotação nunca reinicia.
    if(!state.settings.rotationAnchorDate){
      const anchor=firstSundayOfMonth(y,m);
      state.settings.rotationAnchorDate=dateKey(anchor.getFullYear(),anchor.getMonth(),anchor.getDate());
      state.settings.rotationAnchorTeam=state.settings.firstSundayTeam;
    }
    for(let day=1;day<=n;day++){
      const date=new Date(y,m,day);
      if(date.getDay()!==0) continue;
      const sundayKey=dateKey(y,m,day);
      for(const emp of eligible){
        if(!['A','B'].includes(emp.team)) continue;
        const key=`${emp.id}|${sundayKey}`;
        const existing=state.statuses[key];
        // Preserve real absences/holidays, but always refresh the automatic work/rest assignment.
        if(existing && !['trabalha','folga','dsr'].includes(existing)) continue;
        const scheduled=autoSundayStatus(emp.id,sundayKey);
        if(scheduled) state.statuses[key]=scheduled;
        else delete state.statuses[key];
      }
    }
    save();renderAll();showToast('Revezamento aplicado: os domingos foram marcados automaticamente na escala.');
  });
  function reportRows(){const y=viewDate.getFullYear(),m=viewDate.getMonth(),n=daysInMonth();const rows=[['RELATÓRIO DE ESCALA',monthName(viewDate)],['Gerado em',today.toLocaleDateString('pt-BR')],[],['Colaborador','Departamento',...Array.from({length:n},(_,i)=>`${pad(i+1)}/${pad(m+1)}`)]];sortEmployees(state.employees).forEach(e=>{rows.push([e.name,e.department,...Array.from({length:n},(_,i)=>statusLabel(statusOf(e.id,dateKey(y,m,i+1))))]);});return rows;}
  $('#exportCsv').addEventListener('click',()=>{let rows;if($('#reportType').value==='limpeza'){const y=viewDate.getFullYear(),m=viewDate.getMonth(),n=daysInMonth(),employees=cleaningEligible().slice().sort((a,b)=>a.name.localeCompare(b.name,'pt-BR')),assigned=new Set(cleaningAssignments().map(r=>`${r.employee.id}|${dateKey(y,m,r.day)}`));rows=[['Colaborador','Departamento',...Array.from({length:n},(_,i)=>pad(i+1)),'Total']];employees.forEach(e=>{let total=0;const cells=Array.from({length:n},(_,i)=>{const yes=assigned.has(`${e.id}|${dateKey(y,m,i+1)}`);if(yes)total++;return yes?'L':'—';});rows.push([e.name,e.department,...cells,total]);});}else rows=reportRows();const csv='\uFEFF'+rows.map(r=>r.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(';')).join('\r\n'),blob=new Blob([csv],{type:'text/csv;charset=utf-8;'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`relatorio-escala-${viewDate.getFullYear()}-${pad(viewDate.getMonth()+1)}.csv`;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);showToast('Relatório completo exportado.');});
  // Gera uma página de impressão separada para não imprimir a interface do site.
  $('#printReport').addEventListener('click',()=>{
    const w=window.open('','_blank');if(!w){showToast('Permita pop-ups para imprimir o relatório.');return;}
    const y=viewDate.getFullYear(),m=viewDate.getMonth(),n=daysInMonth(),isCleaning=$('#reportType').value==='limpeza',holidays=holidaysForYear(y),holidayItems=currentMonthHolidays();let table='';
    // Desempenho: pré-calcula os metadados do mês uma única vez, evitando
    // recriar datas e consultar feriados dentro de cada célula da tabela.
    const weekdayShort=['DOM','SEG','TER','QUA','QUI','SEX','SÁB'];
    const dayMeta=Array.from({length:n},(_,i)=>{const d=i+1,key=dateKey(y,m,d),weekdayIndex=new Date(y,m,d).getDay(),holiday=holidays[key]||'';return {d,key,weekdayIndex,weekday:weekdayShort[weekdayIndex],holiday,sunday:weekdayIndex===0,headClass:`${weekdayIndex===0?'sunday-head ':''}${holiday?'holiday-date holiday-column':''}`,cellClass:`${weekdayIndex===0?'sunday-column ':''}${holiday?'holiday-column':''}`};});
    const dateHeaders=dayMeta.map(day=>`<th class="day-head ${day.headClass}" title="${day.holiday?escapeHTML(day.holiday):''}"><strong>${pad(day.d)}</strong><small>${day.weekday}</small></th>`).join('');
    if(isCleaning){
      const employees=cleaningEligible().slice().sort((a,b)=>a.name.localeCompare(b.name,'pt-BR')),assignments=cleaningAssignments(),assigned=new Set(assignments.map(r=>`${r.employee.id}|${dateKey(y,m,r.day)}`));
      let body='';employees.forEach(e=>{let total=0;body+=`<tr><td>${escapeHTML(e.name)}</td><td>${escapeHTML(e.department)}</td>`;for(const day of dayMeta){const yes=assigned.has(`${e.id}|${day.key}`);if(yes)total++;body+=`<td class="${day.cellClass} ${yes?'cleaning-report-mark':''}">${yes?'L':'—'}</td>`;}body+='</tr>';});
      table=`<table class="report-table"><thead><tr><th>Colaborador</th><th>Departamento</th>${dateHeaders}</tr></thead><tbody>${body||'<tr><td colspan="40">Cadastre Auxiliares de Loja para gerar a escala de limpeza.</td></tr>'}</tbody></table>`;
    }else{
      let body='';sortEmployees(state.employees).forEach(e=>{body+=`<tr><td>${escapeHTML(e.name)}</td><td>${escapeHTML(e.department)}</td>`;for(const day of dayMeta){const st=statusOf(e.id,day.key);body+=`<td class="${day.cellClass} status ${statusInfo[st].cls}">${escapeHTML(statusShort(st))}</td>`;}body+='</tr>';});
      table=`<table class="report-table"><thead><tr><th>Colaborador</th><th>Departamento</th>${dateHeaders}</tr></thead><tbody>${body||'<tr><td colspan="40">Cadastre colaboradores para gerar o relatório.</td></tr>'}</tbody></table>`;
    }
    const holidayDescription=holidayItems.length?`<div class="holiday-description"><strong>Feriados nacionais de ${escapeHTML(monthName(viewDate))}:</strong> ${holidayItems.map(([key,name])=>`${pad(Number(key.slice(-2)))}/${pad(m+1)} — ${escapeHTML(name)}`).join(' · ')}<small>Feriados estaduais e municipais podem variar conforme a localidade.</small></div>`:`<div class="holiday-description"><strong>Nenhum feriado nacional neste mês.</strong><small>Feriados estaduais e municipais podem variar conforme a localidade.</small></div>`;
    w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Escala Kalunga - ${isCleaning?'Escala de limpeza':'Escala de folgas'} - ${monthName(viewDate)}</title><style>body{font:11px Arial,sans-serif;color:#17263d;margin:0;background:#fff}h1{font-size:22px;margin:0 0 5px;padding-bottom:4px;border-bottom:2px solid #17263d;letter-spacing:.1px}p{margin:0 0 8px;color:#52627a;font-size:10px}.holiday-description{margin:0 0 8px;padding:6px 9px;border-left:4px solid #e7a11a;background:#fff4d9;color:#704b08;font-size:9px}.holiday-description small{display:block;margin-top:3px;color:#826b42}table{border-collapse:collapse;width:100%;table-layout:fixed;font-size:8.5px;margin:10px 0 12px}.report-table{border:1px solid #cbd0d7}.report-table tbody tr{height:24px;break-inside:avoid}.report-table tbody td{height:24px;max-height:24px;line-height:1.1;padding:2px 1px;vertical-align:middle;overflow:hidden}thead{display:table-header-group}tr{break-inside:avoid}th,td{border:1px solid #cfd7e3;padding:4px 1px;text-align:center;overflow-wrap:anywhere;vertical-align:middle}th{background:#f4f7fb;font-weight:700}th:first-child,td:first-child{width:120px;text-align:left;padding-left:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}th:nth-child(2),td:nth-child(2){width:100px;text-align:left;padding-left:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.day-head strong,.day-head small{display:block}.day-head strong{font-size:8.5px}.day-head small{font-size:6.5px;font-weight:600;margin-top:2px}.sunday-head{background:#606873!important;color:#fff!important;border-left:1px solid #606873!important;border-right:1px solid #606873!important}.sunday-column{background:#e7e9ec!important;border-left:1px solid #c5c9cf!important;border-right:1px solid #c5c9cf!important;background-image:linear-gradient(rgba(94,102,114,.10),rgba(94,102,114,.10))!important}.report-table tbody tr:nth-child(even) td{background-image:linear-gradient(rgba(94,102,114,.075),rgba(94,102,114,.075))}.report-table tbody tr:nth-child(odd) td{background-image:none}.report-table tbody tr:nth-child(even) td.sunday-column{background-image:linear-gradient(rgba(94,102,114,.16),rgba(94,102,114,.16))!important}.report-table tbody tr:nth-child(odd) td.sunday-column{background-image:linear-gradient(rgba(94,102,114,.10),rgba(94,102,114,.10))!important}.report-table tbody td.status-off{background:#b7f0e4!important;background-image:none!important;color:#075e54!important;font-weight:700}.report-table tbody td:first-child,.report-table tbody td:nth-child(2){font-weight:600}.report-table tbody tr:nth-child(even) td:first-child,.report-table tbody tr:nth-child(even) td:nth-child(2){background-color:#f0f1f3!important}.report-table tbody tr:nth-child(odd) td:first-child,.report-table tbody tr:nth-child(odd) td:nth-child(2){background-color:#fff!important}.holiday-date{background:#f4bd45!important;color:#653d00;font-weight:bold}.holiday-column{background:#fff8e8!important;border-left:1px solid #f0d7a0!important;border-right:1px solid #f0d7a0!important}.sunday-column.holiday-column{background:#fff8e8!important}.status-off{background:#b7f0e4}.status-holiday{background:#ffe8b8}.status-work{background:#eaf0f7}.status-vacation{background:#dce9ff}.status-away{background:#f7dfe4}.status-training{background:#eee2ff}.cleaning-report-mark{background:#b7f0e4;color:#075e54;font-weight:bold}.status-legend{margin-top:10px;padding:9px 10px;border-top:2px solid #d8e0eb;background:#f7f9fc;border-radius:0 0 5px 5px;font-size:9px;color:#52627a;line-height:1.7}.status-legend strong{color:#17263d}@page{size:A4 landscape;margin:6mm}@media print{body{margin:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}table{font-size:7.5px;margin:8px 0 10px}th,td{padding:4px 0}th:first-child,td:first-child{width:105px}th:nth-child(2),td:nth-child(2){width:85px}.day-head small{font-size:5.5px}.status-legend{padding-top:5px}}</style></head><body><h1>Escala Kalunga — ${isCleaning?'Escala de limpeza':'Escala de folgas'}</h1><p>Período: ${monthName(viewDate)} · Gerado em ${today.toLocaleDateString('pt-BR')}</p>${holidayDescription}${table}<div class="status-legend"><strong>Descrição dos status:</strong> ${isCleaning?'L = Limpeza':'T = Trabalha · F = Folga · FE = Feriado · FE (azul) = Férias · AF = Afastado · CT = Capacitação teórica'}</div><script>window.onload=()=>window.print()<\/script></body></html>`);
    w.document.close();
  });

  $('#reportType').addEventListener('change',renderReport);
  // Backup e restauração permitem transferir os dados entre navegadores/dispositivos.
  $('#backupData').addEventListener('click',()=>{const blob=new Blob([JSON.stringify({app:'Escala Kalunga',version:1,state},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='backup-escala-kalunga.json';a.click();URL.revokeObjectURL(url);showToast('Backup baixado. Guarde-o fora do navegador.');});
  $('#restoreData').addEventListener('click',()=>$('#restoreFile').click());
  $('#restoreFile').addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;try{const data=JSON.parse(await file.text()),restored=data.state||data;if(!Array.isArray(restored.employees)||!restored.statuses)throw Error();if(!confirm('Restaurar este backup substituirá os dados atuais. Continuar?'))return;state=restored;save();renderAll();showToast('Backup restaurado.');}catch(err){showToast('Arquivo de backup inválido.');}finally{e.target.value='';}});
    renderAll();
})();
