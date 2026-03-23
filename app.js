import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getDatabase, ref, push, get, remove, set } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyCYV-OOz55TvJ7cLPfJkDP7idGL25MXxis",
    authDomain: "leituramineiros.firebaseapp.com",
    databaseURL: "https://leituramineiros-default-rtdb.firebaseio.com",
    projectId: "leituramineiros",
    storageBucket: "leituramineiros.firebasestorage.app",
    messagingSenderId: "221434879480",
    appId: "1:221434879480:web:1ca32bfc8ad743b5974a0d"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

const PERFIS = {
    'jane@siavel.com': { nome: 'Jane', escolas: ['Paniago', 'Otalécio', 'Maria Eduarda', 'Salviano', 'Dom Bosco', 'Santo Antônio', 'Elias Carrijo', 'Tonico', 'Professor Juarez'], series: ['4º Ano', '5º Ano'], modo: 'padrao' },
    'wellita@siavel.com': { nome: 'Wellita', escolas: ['Paniago', 'Otalécio', 'Maria Eduarda', 'Salviano', 'Dom Bosco', 'Santo Antônio', 'Elias Carrijo', 'Tonico', 'Professor Juarez'], series: ['3º Ano'], modo: 'padrao' },
    'marcia@siavel.com': { nome: 'Marcia', escolas: ['Reverendo Eudóxio', 'Comecinho de Vida', 'Castelo Branco', 'Maria Eduarda', 'Padre Maximino', 'Dom Bosco', 'Professor Salviano Neves Amorim', 'Santo Antônio', 'Professor Juarez', 'Tonico Corredeira', 'Elias Carrijo de Souza', 'Paniago'], series: ['1º Ano', '2º Ano'], modo: 'padrao' },
    'welma@siavel.com': { nome: 'Welma', escolas: ['ESCOLA AMÉRICO CAETANO', 'ESCOLA FARROUPILHA', 'ESCOLA FARROUPILHA EXTENSÃO', 'ESCOLA ANTONIO ALVES', 'ESCOLA GUSTAVO ALVES', 'ESCOLA ANTONIO MESSIAS', 'ESCOLA CAINDÃO', 'ESCOLA SALTO', 'ESCOLA MORRO DOIS IRMÃOS', 'ESCOLA PINGUELA'], series: ['Multisseriada'], modo: 'rural' },
    'adm@siavel.com': { nome: 'Admin', modo: 'admin' }
};

const NIVEIS = ["Nível 1", "Nível 2", "Nível 3", "Nível 4", "Iniciante", "Fluente"];
const PESO_NIVEL = { "Ausente": 0, "Nível 1": 1, "Nível 2": 2, "Nível 3": 3, "Nível 4": 4, "Iniciante": 5, "Fluente": 6 };

let usuarioAtual = null;
let dadosTurma = {};
let meusEnviosCache = [];
let todosDadosAdm = []; 
window.turmaAtualEdicao = null; 

const rowsPerPage = 10;
let currentPageProf = 1;
let filteredProfData = []; 
let currentPageAdm = 1;
let filteredAdmData = [];

let nivelImpressaoAtual = "";
let modoRelatorioAvancadoIsProf = true; 

window.carregarHistoricoProf = async () => {
    const sel = document.getElementById('prof-filtro-escola');
    if (sel) {
        sel.innerHTML = '<option value="TODAS">Todas as Escolas</option>';
        if (usuarioAtual && usuarioAtual.escolas) {
            const escolasFixas = [...usuarioAtual.escolas].sort();
            escolasFixas.forEach(e => sel.innerHTML += `<option value="${e}">${e}</option>`);
        }
    }

    try {
        const dbRef = ref(db, 'avaliacoes');
        const snapshot = await get(dbRef);
        meusEnviosCache = [];
        
        if (snapshot.exists()) {
            const all = Object.entries(snapshot.val()).map(([key, value]) => ({ ...value, id: key }));
            if (usuarioAtual && usuarioAtual.nome) {
                meusEnviosCache = all.filter(d => d.professor && String(d.professor).toLowerCase().includes(String(usuarioAtual.nome).toLowerCase()));
                meusEnviosCache.sort((a, b) => new Date(b.data_envio || 0) - new Date(a.data_envio || 0));
            }
        }
    } catch(e) {
        console.error("Erro ao buscar histórico:", e);
    }
    
    window.aplicarFiltrosProf();
    window.prepararComparativo(); 
};

(function initDias() { 
    const s = document.getElementById('sel-dia'); 
    for(let i=1; i<=31; i++){ 
        let o = document.createElement('option'); o.value = i < 10 ? "0"+i : i; o.innerText = i; s.appendChild(o.cloneNode(true));
    } 
})();

window.login = () => {
    const e = document.getElementById('email').value;
    const s = document.getElementById('senha').value;
    signInWithEmailAndPassword(auth, e, s).catch(err => document.getElementById('msg-login').innerText = "Erro no Login. Verifique e-mail e senha.");
};

window.logout = () => signOut(auth);

onAuthStateChanged(auth, (user) => {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    if (user) {
        const email = user.email;
        if (PERFIS[email]) {
            usuarioAtual = { ...PERFIS[email], email: email };
            if (usuarioAtual.modo === 'admin') {
                document.getElementById('screen-admin').classList.add('active');
                window.carregarAdmin();
            } else {
                document.getElementById('screen-app').classList.add('active');
                window.configurarInterfaceProfessor();
                window.carregarHistoricoProf();
            }
        } else { alert("Usuário não configurado."); window.logout(); }
    } else { document.getElementById('screen-login').classList.add('active'); }
});

window.mudarAbaProf = (aba) => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    ['view-nova','view-hist','view-evo'].forEach(id => document.getElementById(id).classList.add('hidden'));
    if(aba === 'nova') { document.getElementById('tab-nova').classList.add('active'); document.getElementById('view-nova').classList.remove('hidden'); }
    else if(aba === 'hist') { document.getElementById('tab-hist').classList.add('active'); document.getElementById('view-hist').classList.remove('hidden'); window.carregarHistoricoProf(); }
    else if(aba === 'evo') { document.getElementById('tab-evo').classList.add('active'); document.getElementById('view-evo').classList.remove('hidden'); window.prepararComparativo(); }
};

window.configurarInterfaceProfessor = () => {
    document.getElementById('header-user').innerText = `Olá, ${usuarioAtual.nome} (Avaliadora)`;
    const se = document.getElementById('sel-escola'); se.innerHTML = '<option value="">Selecione...</option>';
    usuarioAtual.escolas.forEach(esc => se.innerHTML += `<option>${esc}</option>`);
    const ss = document.getElementById('sel-serie'); ss.innerHTML = '';
    usuarioAtual.series.forEach(ser => ss.innerHTML += `<option>${ser}</option>`);
    window.mudarAbaProf('nova');
};

window.verificarHistoricoTurma = async () => {
    const esc = document.getElementById('sel-escola').value;
    const ser = document.getElementById('sel-serie').value;
    const tur = document.getElementById('sel-turma').value;
    const msg = document.getElementById('msg-importacao');
    const txtLista = document.getElementById('lista-alunos');

    msg.style.display = 'none';
    txtLista.value = "";
    dadosTurma = {}; 

    if(esc && ser && tur) {
        msg.innerText = "⏳ Buscando alunos...";
        msg.style.display = 'inline-block';
        msg.style.color = "#f57c00";

        try {
            const dbRef = ref(db, 'avaliacoes');
            const snapshot = await get(dbRef);
            
            if (snapshot.exists()) {
                const all = Object.values(snapshot.val());
                const matches = all.filter(d => d.escola === esc && d.serie === ser && d.turma === tur);
                
                if (matches.length > 0) {
                    matches.sort((a, b) => new Date(b.data_envio || 0) - new Date(a.data_envio || 0));
                    const ultima = matches[0];
                    
                    let detArr = ultima.detalhes ? (Array.isArray(ultima.detalhes) ? ultima.detalhes : Object.values(ultima.detalhes)) : [];
                    detArr = detArr.filter(a => a !== null); 

                    if (detArr.length > 0) {
                        const nomes = detArr.map(a => a.nome).join('\n');
                        txtLista.value = nomes;
                        msg.innerText = `📋 Lista importada de ${ultima.data_avaliacao}`;
                        msg.style.color = "var(--primary)";
                    }
                } else {
                    msg.innerText = "✨ Turma nova (Digite os nomes abaixo)";
                    msg.style.color = "#666";
                    msg.style.background = "#eee";
                }
            } else {
                msg.style.display = 'none';
            }
        } catch (error) {
            msg.style.display = 'none';
        }
    }
};

window.iniciarAvaliacao = () => {
    const escola = document.getElementById('sel-escola').value;
    const lista = document.getElementById('lista-alunos').value.split('\n').filter(n=>n.trim()!=='');
    const d = document.getElementById('sel-dia').value;
    const m = document.getElementById('sel-mes').value;
    const a = document.getElementById('sel-ano').value;
    if(!d) return alert("Selecione o Dia!");
    if (!escola || lista.length === 0) return alert("Preencha dados da escola e cole os alunos!");

    dadosTurma.alunos = lista.map(nome => ({ nome, nivel: '', laudo: false, serieRural: '', transferido: false }));

    dadosTurma.escola = escola;
    dadosTurma.serie = document.getElementById('sel-serie').value;
    dadosTurma.turma = document.getElementById('sel-turma').value;
    dadosTurma.data = `${d}/${m}/${a}`;

    window.renderizarAvaliacao();
    document.getElementById('area-config').classList.add('hidden');
    document.getElementById('area-avaliacao').classList.remove('hidden');
};

window.renderizarAvaliacao = () => {
    document.getElementById('resumo-titulo').innerText = dadosTurma.escola;
    document.getElementById('resumo-data').innerText = dadosTurma.data;
    document.getElementById('resumo-sub').innerText = `${dadosTurma.serie} - Turma ${dadosTurma.turma}`;
    const container = document.getElementById('container-alunos'); container.innerHTML = '';
    
    if(!dadosTurma.alunos) dadosTurma.alunos = [];

    dadosTurma.alunos.forEach((aluno, idx) => {
        const div = document.createElement('div'); div.className = 'aluno-row'; div.id = `row-${idx}`;
        let htmlSerie = '';
        if (usuarioAtual.modo === 'rural') {
            htmlSerie = `<select class="sel-serie-rural" onchange="window.updateLocal(${idx}, this.value)" ${aluno.transferido?'disabled':''}><option value="">Série...</option>${["1º Ano","2º Ano","3º Ano","4º Ano","5º Ano"].map(s=>`<option value="${s}" ${aluno.serieRural===s?'selected':''}>${s}</option>`).join('')}</select>`;
        }
        
        if(aluno.transferido) div.classList.add('transferido');

        div.innerHTML = `
            <div style="display:flex; justify-content:space-between;"><strong>${aluno.nome} <span class="tag-laudo">(LAUDO)</span></strong></div>
            <div class="controls">
                <label class="laudo-chk"><input type="checkbox" onchange="window.toggleLaudo(${idx})" ${aluno.laudo?'checked':''} ${aluno.transferido?'disabled':''}> Laudo</label>
                <label class="laudo-chk" style="color:var(--red);"><input type="checkbox" onchange="window.toggleTransferido(${idx})" ${aluno.transferido?'checked':''}> Transf.</label>
                ${htmlSerie}
                <select onchange="window.updateNivel(${idx}, this.value)" ${aluno.transferido?'disabled':''}>
                    <option value="">Avaliar...</option><option value="Ausente">⚠️ Ausente</option>${NIVEIS.map(n=>`<option value="${n}" ${aluno.nivel===n?'selected':''}>${n}</option>`).join('')}
                </select>
            </div>`;
        container.appendChild(div);
        if(aluno.laudo) div.classList.add('com-laudo');
    });
    window.atualizarStats();
};

window.toggleLaudo = (idx) => { dadosTurma.alunos[idx].laudo = !dadosTurma.alunos[idx].laudo; document.getElementById(`row-${idx}`).classList.toggle('com-laudo'); };
window.toggleTransferido = (idx) => { dadosTurma.alunos[idx].transferido = !dadosTurma.alunos[idx].transferido; if(dadosTurma.alunos[idx].transferido) { dadosTurma.alunos[idx].nivel = ""; } window.renderizarAvaliacao(); };
window.updateNivel = (idx, val) => { dadosTurma.alunos[idx].nivel = val; const row = document.getElementById(`row-${idx}`); row.className = 'aluno-row ' + (dadosTurma.alunos[idx].laudo ? 'com-laudo' : ''); if (val === 'Ausente') row.classList.add('ausente'); else if (val) row.classList.add('avaliado'); window.atualizarStats(); };
window.updateLocal = (idx, val) => { dadosTurma.alunos[idx].serieRural = val; };
window.addExtra = () => { const nome = document.getElementById('extra-nome').value; if(nome) { dadosTurma.alunos.push({ nome, nivel: '', laudo: false, serieRural: '', transferido: false }); window.renderizarAvaliacao(); document.getElementById('extra-nome').value = ''; } };
window.voltarConfig = () => { 
    if(confirm("Tem certeza que deseja voltar? As avaliações não salvas serão perdidas.")) { 
        document.getElementById('area-avaliacao').classList.add('hidden'); 
        document.getElementById('area-config').classList.remove('hidden'); 
        dadosTurma = {}; 
        const btn = document.getElementById('btn-finalizar');
        if(btn) { btn.innerText = "🚀 FINALIZAR E SALVAR AVALIAÇÃO"; btn.disabled = false; btn.style.background = "var(--success)"; }
    } 
};

window.atualizarStats = () => { 
    const ativos = dadosTurma.alunos.filter(a => !a.transferido);
    const aval = ativos.filter(a => a.nivel && a.nivel !== 'Ausente').length; 
    const aus = ativos.filter(a => a.nivel === 'Ausente').length; 
    document.getElementById('stats-rapido').innerText = `Status: ${aval} Avaliados | ${aus} Ausentes`; 
};

window.finalizarAvaliacao = async () => {
    const btn = document.getElementById('btn-finalizar');
    btn.innerText = "⏳ Salvando no banco de dados...";
    btn.disabled = true;

    const ativos = dadosTurma.alunos.filter(a => !a.transferido);
    const cont = {}; NIVEIS.forEach(n => cont[n] = 0); let aval = 0, aus = 0;
    ativos.forEach(a => { if (a.nivel === 'Ausente') aus++; else if (a.nivel) { aval++; cont[a.nivel]++; } });
    
    const pacote = { 
        escola: dadosTurma.escola, turma: dadosTurma.turma, serie: dadosTurma.serie, professor: usuarioAtual.nome, 
        data_avaliacao: dadosTurma.data, data_envio: new Date().toISOString(), 
        total_alunos: ativos.length, total_avaliados: aval, total_ausentes: aus, 
        resultados: cont, detalhes: dadosTurma.alunos 
    };
    try { 
        await push(ref(db, 'avaliacoes'), pacote); 
        btn.innerText = "✅ SALVO COM SUCESSO";
        btn.style.background = "#2E7D32";
        document.getElementById('modal-sucesso').classList.remove('hidden');
    } catch (e) { 
        console.error(e); 
        alert("Erro ao salvar: " + e.message); 
        btn.innerText = "☁️ Tentar Novamente"; 
        btn.disabled = false;
    }
};

window.fecharSucessoEVoltar = () => {
    document.getElementById('modal-sucesso').classList.add('hidden');
    document.getElementById('lista-alunos').value = ""; 
    document.getElementById('area-avaliacao').classList.add('hidden'); 
    document.getElementById('area-config').classList.remove('hidden'); 
    dadosTurma = {}; 
    const btn = document.getElementById('btn-finalizar');
    if(btn) { 
        btn.innerText = "🚀 FINALIZAR E SALVAR AVALIAÇÃO"; 
        btn.disabled = false; 
        btn.style.background = "var(--success)";
    }
    window.carregarHistoricoProf();
};

window.gerarPDF = () => { 
    const el = document.getElementById('area-avaliacao'); 
    document.querySelectorAll('#area-avaliacao .no-print').forEach(e => e.style.display = 'none'); 
    
    window.scrollTo(0, 0); 
    
    const opt = {
        margin:       [10, 10, 10, 10],
        filename:     `${dadosTurma.escola}_${dadosTurma.serie}_${dadosTurma.turma}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, scrollY: 0, useCORS: true }, 
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak:    { mode: ['avoid-all', 'css', 'legacy'] } 
    };
    
    html2pdf().set(opt).from(el).save().then(() => { 
        document.querySelectorAll('#area-avaliacao .no-print').forEach(e => e.style.display = ''); 
    }); 
};

window.compartilharZap = () => { let txt = `*${dadosTurma.escola}*\nSérie: ${dadosTurma.serie} ${dadosTurma.turma}\nData: ${dadosTurma.data}\nAvaliados: ${dadosTurma.alunos.filter(a=>a.nivel&&a.nivel!='Ausente' && !a.transferido).length}\n\n`; dadosTurma.alunos.forEach(a => { if(!a.transferido && a.nivel) txt += `${a.nivel==='Ausente'?'⚠️':'✅'} ${a.nome}: ${a.nivel}\n`; }); window.open("https://wa.me/?text=" + encodeURIComponent(txt)); };

window.fecharModal = () => {
    document.getElementById('modal-detalhes').classList.add('hidden');
    window.turmaAtualEdicao = null;
};

window.excluirAvaliacao = async (id) => {
    if(confirm("Tem certeza que deseja EXCLUIR essa avaliação inteira? Não poderá desfazer.")) {
        try { 
            await remove(ref(db, 'avaliacoes/' + id)); 
            alert("✅ Excluído com sucesso!"); 
            window.carregarHistoricoProf(); 
        } catch(e) { 
            alert("Erro ao excluir: " + e.message); 
        }
    }
};

window.renderizarTabelaModal = (isProf) => {
    const isRural = window.turmaAtualEdicao.serie === 'Multisseriada' || window.turmaAtualEdicao.professor === 'Welma';
    let profFiltroSerie = 'TODAS';
    let admChkSeries = [];
    if (isRural) {
        if (isProf) { profFiltroSerie = document.getElementById('prof-filtro-serie').value; } 
        else { admChkSeries = Array.from(document.querySelectorAll('#chk-series input:checked')).map(c => c.value); }
    }

    let html = `<div style="margin-bottom: 15px; padding: 10px 15px; background: #f8f9fa; border-radius: 8px; border: 1px solid #e0e0e0; display: flex; align-items: center; gap: 10px;">
        <span style="font-weight: bold; color: #555;">Data da Avaliação:</span>`;
    if (isProf) {
        html += `<input type="text" value="${window.turmaAtualEdicao.data_avaliacao || ''}" oninput="window.turmaAtualEdicao.data_avaliacao = this.value" maxlength="10" placeholder="DD/MM/AAAA" style="padding: 6px 10px; border: 1px solid #ccc; border-radius: 6px; width: 110px; font-weight: bold; color: var(--secondary); font-size: 0.95rem; margin: 0; text-align: center;">`;
    } else {
        html += `<span style="font-weight: bold; color: var(--secondary); font-size: 0.95rem;">${window.turmaAtualEdicao.data_avaliacao || ''}</span>`;
    }
    html += `</div>`;

    html += '<table class="modal-table"><thead><tr><th>Aluno</th>';
    if (isRural) html += '<th>Série</th>';
    html += '<th>Laudo</th><th>Transf.</th><th>Avaliação</th></tr></thead><tbody>';
    let exibiuAlunos = false;

    if (window.turmaAtualEdicao.detalhes) {
        window.turmaAtualEdicao.detalhes = Array.isArray(window.turmaAtualEdicao.detalhes) ? window.turmaAtualEdicao.detalhes : Object.values(window.turmaAtualEdicao.detalhes);
        window.turmaAtualEdicao.detalhes = window.turmaAtualEdicao.detalhes.filter(a => a !== null); 
    } else {
        window.turmaAtualEdicao.detalhes = [];
    }

    window.turmaAtualEdicao.detalhes.forEach((aluno, idx) => {
        if (isRural) {
            if (isProf && profFiltroSerie !== "TODAS" && String(aluno.serieRural || "").trim() !== profFiltroSerie) return; 
            if (!isProf && admChkSeries.length > 0 && !admChkSeries.includes(String(aluno.serieRural || "").trim())) return; 
        }
        exibiuAlunos = true;

        if (isProf) {
            let options = `<option value="">- Sem Nota -</option><option value="Ausente" ${aluno.nivel==='Ausente'?'selected':''}>Ausente</option>`;
            NIVEIS.forEach(n => { options += `<option value="${n}" ${aluno.nivel===n?'selected':''}>${n}</option>`; });
            let ruralTd = '';
            if (isRural) {
                ruralTd = `<td><select onchange="window.turmaAtualEdicao.detalhes[${idx}].serieRural = this.value" ${aluno.transferido?'disabled':''} style="padding:4px; border-radius:4px; border:1px solid #ccc; max-width:85px;">
                    <option value="">Série...</option>${["1º Ano","2º Ano","3º Ano","4º Ano","5º Ano"].map(s=>`<option value="${s}" ${aluno.serieRural===s?'selected':''}>${s}</option>`).join('')}</select></td>`;
            }
            html += `<tr class="${aluno.transferido ? 'transferido' : ''}">
                <td><strong>${aluno.nome}</strong></td>${ruralTd}
                <td><input type="checkbox" onchange="window.turmaAtualEdicao.detalhes[${idx}].laudo = this.checked" ${aluno.laudo?'checked':''} ${aluno.transferido?'disabled':''}></td>
                <td><input type="checkbox" onchange="window.turmaAtualEdicao.detalhes[${idx}].transferido = this.checked; if(this.checked){window.turmaAtualEdicao.detalhes[${idx}].nivel=''} window.renderizarTabelaModal(true)" ${aluno.transferido?'checked':''}></td>
                <td><select onchange="window.turmaAtualEdicao.detalhes[${idx}].nivel = this.value" ${aluno.transferido?'disabled':''}>${options}</select></td>
            </tr>`;
        } else {
            let badgeTransf = aluno.transferido ? '<span style="color:var(--gray)">Sim</span>' : 'Não';
            let badgeLaudo = aluno.laudo ? '<span style="color:var(--purple)">Sim</span>' : 'Não';
            let stilo = aluno.transferido ? 'class="transferido"' : '';
            let ruralTd = isRural ? `<td>${aluno.serieRural || '-'}</td>` : '';
            html += `<tr ${stilo}><td>${aluno.nome}</td>${ruralTd}<td>${badgeLaudo}</td><td>${badgeTransf}</td><td><strong>${aluno.nivel || '-'}</strong></td></tr>`;
        }
    });

    if (!exibiuAlunos) html += `<tr><td colspan="${isRural ? 5 : 4}" style="text-align:center; padding: 20px;">Nenhum aluno corresponde ao filtro selecionado.</td></tr>`;
    html += '</tbody></table>';
    document.getElementById('modal-body').innerHTML = html;
};

window.abrirModalTurma = (id, isAdmin) => {
    const listaBase = isAdmin ? todosDadosAdm : meusEnviosCache;
    const item = listaBase.find(d => d.id === id);
    if(item) {
        window.turmaAtualEdicao = JSON.parse(JSON.stringify(item)); 
        if(!window.turmaAtualEdicao.detalhes) window.turmaAtualEdicao.detalhes = [];
        document.getElementById('modal-titulo').innerText = `${item.escola} | ${item.serie} ${item.turma}`;
        window.renderizarTabelaModal(!isAdmin);
        const footer = document.getElementById('modal-footer');
        if (isAdmin) { footer.classList.add('hidden'); } else { footer.classList.remove('hidden'); }
        document.getElementById('modal-detalhes').classList.remove('hidden');
    }
};

window.salvarEdicaoModal = async () => {
    const btn = document.querySelector('#modal-footer .btn-main');
    btn.innerText = "⏳ Salvando...";
    const ativos = window.turmaAtualEdicao.detalhes.filter(a => a !== null && !a.transferido);
    const cont = {}; NIVEIS.forEach(n => cont[n] = 0); let aval = 0, aus = 0;
    ativos.forEach(a => { if (a.nivel === 'Ausente') aus++; else if (a.nivel) { aval++; cont[a.nivel]++; } });

    window.turmaAtualEdicao.total_alunos = ativos.length;
    window.turmaAtualEdicao.total_avaliados = aval;
    window.turmaAtualEdicao.total_ausentes = aus;
    window.turmaAtualEdicao.resultados = cont;

    let idSalvar = window.turmaAtualEdicao.id;
    let payload = { ...window.turmaAtualEdicao };
    delete payload.id; 

    try {
        await set(ref(db, 'avaliacoes/' + idSalvar), payload);
        alert("✅ Alterações salvas com sucesso!");
        window.fecharModal();
        window.carregarHistoricoProf(); 
    } catch (e) {
        console.error(e);
        alert("Erro ao salvar: " + e.message);
    } finally { btn.innerText = "💾 SALVAR ALTERAÇÕES"; }
};

window.abrirModalRelatorioAvancado = (isProf) => {
    modoRelatorioAvancadoIsProf = isProf;
    
    document.querySelectorAll('.chk-nivel').forEach(chk => chk.checked = false);
    document.getElementById('conteudo-pdf-avancado').innerHTML = "";
    document.getElementById('btn-print-avancado').style.display = 'none';
    
    document.getElementById('modal-relatorio-avancado').classList.remove('hidden');
};

window.gerarVisualizacaoRelatorioAvancado = () => {
    const checkboxes = document.querySelectorAll('.chk-nivel:checked');
    const niveisSelecionados = Array.from(checkboxes).map(c => c.value);

    if (niveisSelecionados.length === 0) {
        alert("Selecione pelo menos um nível para visualizar a lista.");
        return;
    }

    const listaBase = modoRelatorioAvancadoIsProf ? filteredProfData : filteredAdmData;
    let temAlunos = false;
    
    let html = `<div id="documento-pdf-avancado" style="padding: 20px; font-family: 'Segoe UI', sans-serif; color: #333; background: white;">
        <div style="text-align: center; margin-bottom: 25px; border-bottom: 2px solid var(--primary); padding-bottom: 10px;">
            <h2 style="color: var(--primary); margin: 0 0 5px 0;">Relatório de Intervenção Pedagógica</h2>
            <h3 style="margin: 0; color: #555; font-weight: normal; font-size: 1rem;">Níveis: <strong style="color: black;">${niveisSelecionados.join(' | ')}</strong></h3>
        </div>`;

    listaBase.forEach(item => {
        const d = item.originalData;
        const isRural = String(d.serie || "").trim() === 'Multisseriada' || String(d.professor || "").trim() === 'Welma';
        const fSer = modoRelatorioAvancadoIsProf ? String(document.getElementById('prof-filtro-serie').value).trim() : "TODAS"; 
        const admChkSeries = modoRelatorioAvancadoIsProf ? [] : Array.from(document.querySelectorAll('#chk-series input:checked')).map(c => String(c.value).trim());

        let alunosNesteFiltro = [];

        if (d.detalhes) {
            let detArr = Array.isArray(d.detalhes) ? d.detalhes : Object.values(d.detalhes);
            detArr = detArr.filter(a => a !== null); 

            detArr.forEach(aluno => {
                if (aluno.transferido) return;
                if (!niveisSelecionados.includes(String(aluno.nivel || "").trim())) return;

                if (isRural) {
                    let sRural = String(aluno.serieRural || "").trim();
                    if (modoRelatorioAvancadoIsProf && fSer !== "TODAS" && sRural !== fSer) return;
                    if (!modoRelatorioAvancadoIsProf && admChkSeries.length > 0 && !admChkSeries.includes(sRural)) return;
                }
                alunosNesteFiltro.push(aluno);
            });
        }

        if (alunosNesteFiltro.length > 0) {
            temAlunos = true;
            let tituloTurma = `${d.escola} | ${d.serie} ${d.turma}`;
            if (isRural && item.exibeSerie) {
               tituloTurma = `${d.escola} | ${item.exibeSerie.replace(/<[^>]*>?/gm, '')} ${d.turma}`;
            }

            html += `
            <div style="margin-bottom: 15px; border: 1px solid #ddd; border-radius: 6px; overflow: hidden; page-break-inside: avoid;">
                <div style="background: #f4f4f9; padding: 10px; font-weight: bold; border-bottom: 1px solid #ddd; font-size: 1rem;">
                    🏫 ${tituloTurma} <span style="float: right; font-weight: normal; font-size: 0.85rem;">(${alunosNesteFiltro.length} aluno${alunosNesteFiltro.length>1?'s':''})</span>
                </div>
                <ul style="margin: 0; padding: 10px 15px 10px 35px; list-style-type: square; font-size: 0.95rem;">`;
            
            alunosNesteFiltro.forEach(a => {
                let nivelAluno = String(a.nivel || "").trim();
                let corNivel = "var(--primary)";
                if(nivelAluno === "Nível 1" || nivelAluno === "Nível 2") corNivel = "var(--red)";
                if(nivelAluno === "Nível 3" || nivelAluno === "Nível 4") corNivel = "var(--orange)";
                if(nivelAluno === "Fluente") corNivel = "var(--success)";
                if(nivelAluno === "Ausente") corNivel = "var(--red)";

                let infoExtra = ` <span style='color:${corNivel}; font-weight:bold; font-size: 0.85rem;'>[${nivelAluno}]</span>`;
                if(a.laudo) infoExtra += " <b style='color:var(--purple); font-size: 0.8rem;'>[Laudo]</b>";
                if(isRural) infoExtra += ` <span style='color:var(--gray); font-size: 0.85rem;'>- ${a.serieRural}</span>`;
                
                html += `<li style="padding: 6px 0; border-bottom: 1px dashed #eee; page-break-inside: avoid;">${a.nome}${infoExtra}</li>`;
            });
            
            html += `</ul></div>`;
        }
    });

    html += `</div>`;

    if (!temAlunos) {
        html = `<div style="padding: 40px; text-align: center; color: #666; font-size: 1.1rem;">Nenhum aluno encontrado para os níveis selecionados.<br><br><small>Dica: Verifique se o mês e a escola estão filtrados corretamente no painel anterior.</small></div>`;
        document.getElementById('btn-print-avancado').style.display = 'none';
    } else {
        document.getElementById('btn-print-avancado').style.display = 'inline-block';
    }

    document.getElementById('conteudo-pdf-avancado').innerHTML = html;
};

window.imprimirRelatorioAvancado = () => {
    const btn = document.getElementById('btn-print-avancado');
    btn.innerText = "⏳ GERANDO PDF...";
    const el = document.getElementById('documento-pdf-avancado'); 
    
    document.querySelector('#modal-relatorio-avancado .modal-body').scrollTop = 0;
    
    const opt = {
        margin:       [10, 10, 10, 10],
        filename:     `LeituraMineiros_Relatorio.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, scrollY: 0, useCORS: true }, 
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak:    { mode: ['avoid-all', 'css', 'legacy'] } 
    };
    
    html2pdf().set(opt).from(el).save().then(() => {
        btn.innerText = "🖨️ GERAR PDF DESTA LISTA";
    });
};

window.abrirModalIntervencao = (nivel, isProf) => {
    nivelImpressaoAtual = nivel;
    const listaBase = isProf ? filteredProfData : filteredAdmData;
    let temAlunos = false;
    
    let html = `<div id="documento-pdf" style="padding: 20px; font-family: 'Segoe UI', sans-serif; color: #333; background: white;">
        <div style="text-align: center; margin-bottom: 25px; border-bottom: 2px solid var(--primary); padding-bottom: 10px;">
            <h2 style="color: var(--primary); margin: 0 0 5px 0;">Relatório de Intervenção Pedagógica</h2>
            <h3 style="margin: 0; color: #555; font-weight: normal;">Foco de Análise: <strong style="color: black;">${nivel}</strong></h3>
        </div>`;

    listaBase.forEach(item => {
        const d = item.originalData;
        const isRural = String(d.serie || "").trim() === 'Multisseriada' || String(d.professor || "").trim() === 'Welma';
        const fSer = isProf ? String(document.getElementById('prof-filtro-serie').value).trim() : "TODAS"; 
        const admChkSeries = isProf ? [] : Array.from(document.querySelectorAll('#chk-series input:checked')).map(c => String(c.value).trim());

        let alunosNesteNivel = [];

        if (d.detalhes) {
            let detArr = Array.isArray(d.detalhes) ? d.detalhes : Object.values(d.detalhes);
            detArr = detArr.filter(a => a !== null); 

            detArr.forEach(aluno => {
                if (aluno.transferido) return;
                if (String(aluno.nivel || "").trim() !== nivel) return;

                if (isRural) {
                    let sRural = String(aluno.serieRural || "").trim();
                    if (isProf && fSer !== "TODAS" && sRural !== fSer) return;
                    if (!isProf && admChkSeries.length > 0 && !admChkSeries.includes(sRural)) return;
                }
                alunosNesteNivel.push(aluno);
            });
        }

        if (alunosNesteNivel.length > 0) {
            temAlunos = true;
            let tituloTurma = `${d.escola} | ${d.serie} ${d.turma}`;
            if (isRural && item.exibeSerie) {
               tituloTurma = `${d.escola} | ${item.exibeSerie.replace(/<[^>]*>?/gm, '')} ${d.turma}`;
            }

            html += `
            <div style="margin-bottom: 15px; border: 1px solid #ddd; border-radius: 6px; overflow: hidden; page-break-inside: avoid;">
                <div style="background: #f4f4f9; padding: 10px; font-weight: bold; border-bottom: 1px solid #ddd; font-size: 1rem;">
                    🏫 ${tituloTurma} <span style="float: right; font-weight: normal; font-size: 0.85rem;">(${alunosNesteNivel.length} aluno${alunosNesteNivel.length>1?'s':''})</span>
                </div>
                <ul style="margin: 0; padding: 10px 15px 10px 35px; list-style-type: square; font-size: 0.95rem;">`;
            
            alunosNesteNivel.forEach(a => {
                let infoExtra = "";
                if(a.laudo) infoExtra += " <b style='color:var(--purple); font-size: 0.8rem;'>[Laudo]</b>";
                if(isRural) infoExtra += ` <span style='color:var(--gray); font-size: 0.85rem;'>- ${a.serieRural}</span>`;
                html += `<li style="padding: 6px 0; border-bottom: 1px dashed #eee; page-break-inside: avoid;">${a.nome}${infoExtra}</li>`;
            });
            
            html += `</ul></div>`;
        }
    });

    html += `</div>`;

    if (!temAlunos) {
        html = `<div style="padding: 40px; text-align: center; color: #666; font-size: 1.1rem;">Nenhum aluno no <b>${nivel}</b> com os filtros atuais.<br><br><small>Verifique os filtros de Data, Escola e Série.</small></div>`;
        document.getElementById('modal-interv-btn-print').style.display = 'none';
    } else {
        document.getElementById('modal-interv-btn-print').style.display = 'inline-block';
    }

    document.getElementById('conteudo-pdf-intervencao').innerHTML = html;
    document.getElementById('modal-intervencao').classList.remove('hidden');
};

window.imprimirIntervencao = () => {
    const btn = document.getElementById('modal-interv-btn-print');
    btn.innerText = "⏳ GERANDO PDF...";
    const el = document.getElementById('documento-pdf'); 
    
    document.querySelector('#modal-intervencao .modal-body').scrollTop = 0;
    
    const opt = {
        margin:       [10, 10, 10, 10],
        filename:     `Intervencao_${nivelImpressaoAtual}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, scrollY: 0, useCORS: true }, 
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak:    { mode: ['avoid-all', 'css', 'legacy'] } 
    };
    
    html2pdf().set(opt).from(el).save().then(() => {
        btn.innerText = "🖨️ GERAR PDF DA LISTA";
    });
};

window.aplicarFiltrosProf = () => {
    const fEsc = String(document.getElementById('prof-filtro-escola').value).trim();
    const fSer = String(document.getElementById('prof-filtro-serie').value).trim();
    const fTur = String(document.getElementById('prof-filtro-turma').value).trim();
    const fMes = String(document.getElementById('prof-mes-filtro').value).trim();
    const fAno = String(document.getElementById('prof-ano-filtro').value).trim();

    let tAlunos=0, tAus=0, tAval=0, tLaudo=0;
    let tN1=0, tN2=0, tN3=0, tN4=0, tIni=0, tFlu=0;
    
    filteredProfData = []; 

    meusEnviosCache.forEach(d => {
        let esc = String(d.escola || "").trim();
        let tur = String(d.turma || "").trim();

        if (fEsc !== "TODAS" && esc !== fEsc) return;
        if (fTur !== "TODAS" && tur !== fTur) return;

        let dia = "01", mes = "01", ano = "2026";
        try {
            let dData = String(d.data_avaliacao || "").trim();
            if(dData.includes('/')) { [dia, mes, ano] = dData.split('/'); } 
            else if (dData.includes('-')) { [ano, mes, dia] = dData.split('-'); }
            if(dia) dia = String(dia).trim().padStart(2, '0');
            if(mes) mes = String(mes).trim().padStart(2, '0');
            if(ano) ano = String(ano).trim();
        } catch(e) {}

        let mostrar = true;
        let ruralSeriesMatched = false;

        if (fMes !== "TODOS" && mes !== fMes) mostrar = false;
        if (fAno !== "TODOS" && ano !== fAno) mostrar = false;

        let serie = String(d.serie || "").trim();
        let prof = String(d.professor || "").trim();
        let detArr = d.detalhes ? (Array.isArray(d.detalhes) ? d.detalhes : Object.values(d.detalhes)) : [];
        detArr = detArr.filter(a => a !== null);

        if (fSer !== "TODAS") {
            if (serie === "Multisseriada" || prof === "Welma") {
                const temAluno = detArr.some(a => String(a.serieRural || "").trim() === fSer && !a.transferido);
                if (!temAluno) mostrar = false;
                else ruralSeriesMatched = true;
            } else if (serie !== fSer) {
                mostrar = false;
            }
        }

        if (!mostrar) return;

        let avalClass = 0, ausClass = 0, alunosClass = 0, laudoClass = 0;
        let n1Class=0, n2Class=0, n3Class=0, n4Class=0, iniClass=0, fluClass=0;
        
        detArr.forEach(a => {
            if (a.transferido) return;
            let sRural = String(a.serieRural || "").trim();
            if ((serie === 'Multisseriada' || prof === 'Welma') && fSer !== "TODAS" && sRural !== fSer) {
                return; 
            }
            alunosClass++;
            if (a.laudo) laudoClass++;
            let nivel = String(a.nivel || "").trim();
            if (nivel === 'Ausente') { ausClass++; } 
            else if (nivel) {
                avalClass++;
                if (nivel === 'Nível 1') n1Class++;
                if (nivel === 'Nível 2') n2Class++;
                if (nivel === 'Nível 3') n3Class++;
                if (nivel === 'Nível 4') n4Class++;
                if (nivel === 'Iniciante') iniClass++;
                if (nivel === 'Fluente') fluClass++;
            }
        });

        tAlunos += alunosClass;
        tAval += avalClass;
        tAus += ausClass;
        tLaudo += laudoClass;
        tN1 += n1Class; tN2 += n2Class; tN3 += n3Class; tN4 += n4Class; tIni += iniClass; tFlu += fluClass;

        let txtSerie = serie || "?"; 
        if ((serie === 'Multisseriada' || prof === 'Welma') && ruralSeriesMatched) {
            txtSerie += `<br><small style="color:var(--primary); font-weight:bold;">(${fSer})</small>`;
        }

        filteredProfData.push({
            originalData: d,
            exibeSerie: txtSerie,
            id: d.id, escola: esc || "Escola?", serie: txtSerie, turma: tur || "?", data: String(d.data_avaliacao || "").trim() || "Data?"
        });
    });

    const pctN1 = tAval > 0 ? (tN1/tAval*100).toFixed(1) : 0;
    const pctN2 = tAval > 0 ? (tN2/tAval*100).toFixed(1) : 0;
    const pctN3 = tAval > 0 ? (tN3/tAval*100).toFixed(1) : 0;
    const pctN4 = tAval > 0 ? (tN4/tAval*100).toFixed(1) : 0;
    const pctIni = tAval > 0 ? (tIni/tAval*100).toFixed(1) : 0;
    const pctFlu = tAval > 0 ? (tFlu/tAval*100).toFixed(1) : 0;

    document.getElementById('prof-total').innerText = tAval;
    document.getElementById('prof-ausente').innerText = tAus; 
    document.getElementById('prof-laudo').innerText = tLaudo; 
    
    document.getElementById('prof-n1').innerText = pctN1 + "%";
    document.getElementById('prof-n2').innerText = pctN2 + "%";
    document.getElementById('prof-n3').innerText = pctN3 + "%";
    document.getElementById('prof-n4').innerText = pctN4 + "%";
    document.getElementById('prof-ini').innerText = pctIni + "%";
    document.getElementById('prof-flu').innerText = pctFlu + "%";

    currentPageProf = 1;
    window.renderTableProf();
    window.renderPaginationProf();
};

window.renderTableProf = () => {
    let html = "";
    const start = (currentPageProf - 1) * rowsPerPage;
    const pageData = filteredProfData.slice(start, start + rowsPerPage);
    if (pageData.length === 0) { html = "<tr><td colspan='3'>Nenhum dado encontrado.</td></tr>"; } 
    else {
        pageData.forEach(d => {
            html += `<tr>
                <td>${d.escola}<br><small>${d.serie} - ${d.turma}</small></td><td>${d.data}</td>
                <td><button class="btn-table" onclick="window.abrirModalTurma('${d.id}', false)">🔍</button><button class="btn-table" onclick="window.excluirAvaliacao('${d.id}')">🗑️</button></td>
            </tr>`;
        });
    }
    document.getElementById('tabela-prof').innerHTML = html;
};

window.mudarPaginaProf = (page) => { currentPageProf = page; window.renderTableProf(); window.renderPaginationProf(); };

window.renderPaginationProf = () => {
    const totalPages = Math.ceil(filteredProfData.length / rowsPerPage);
    let html = "";
    if (totalPages > 1) {
        html += `<button class="page-btn" ${currentPageProf === 1 ? 'disabled' : ''} onclick="window.mudarPaginaProf(${currentPageProf - 1})">« Ant</button>`;
        for(let i=1; i<=totalPages; i++) { html += `<button class="page-btn ${currentPageProf === i ? 'active' : ''}" onclick="window.mudarPaginaProf(${i})">${i}</button>`; }
        html += `<button class="page-btn" ${currentPageProf === totalPages ? 'disabled' : ''} onclick="window.mudarPaginaProf(${currentPageProf + 1})">Próx »</button>`;
    }
    document.getElementById('paginacao-prof').innerHTML = html;
};

window.prepararComparativo = () => {
    const select = document.getElementById('filtro-evo-turma');
    if(!select) return;
    
    select.innerHTML = '<option value="">Selecione a Turma...</option>';
    
    if (!meusEnviosCache || meusEnviosCache.length === 0) {
        select.innerHTML = '<option value="">Nenhuma avaliação encontrada</option>';
        return;
    }

    const chavesUnicas = new Set();
    meusEnviosCache.forEach(d => { 
        const esc = String(d.escola || "Escola Desconhecida").trim();
        const ser = String(d.serie || "Série Indefinida").trim();
        const tur = String(d.turma || "Única").trim();
        chavesUnicas.add(`${esc}|${ser}|${tur}`); 
    });
    
    Array.from(chavesUnicas).sort().forEach(key => { 
        const [esc, ser, tur] = key.split('|'); 
        const opt = document.createElement('option'); 
        opt.value = key; 
        opt.innerText = `${esc} - ${ser} ${tur}`; 
        select.appendChild(opt); 
    });
};

window.gerarRelatorioEvolucao = () => {
    const key = document.getElementById('filtro-evo-turma').value;
    if(!key) return alert("Selecione uma turma.");
    const [esc, ser, tur] = key.split('|');
    const avaliacoesTurma = meusEnviosCache.filter(d => 
        String(d.escola || "Escola Desconhecida").trim() === esc && 
        String(d.serie || "Série Indefinida").trim() === ser && 
        String(d.turma || "Única").trim() === tur
    );
    avaliacoesTurma.sort((a, b) => new Date(b.data_envio || 0) - new Date(a.data_envio || 0));

    if(avaliacoesTurma.length < 2) {
        document.getElementById('tabela-evo').innerHTML = "<tr><td colspan='4'>Precisa de pelo menos 2 avaliações.</td></tr>";
        document.getElementById('resultado-evo').classList.remove('hidden'); return;
    }
    const atual = avaliacoesTurma[0]; const anterior = avaliacoesTurma[1];
    document.getElementById('evo-info').innerText = `Comparando: ${atual.data_avaliacao} vs ${anterior.data_avaliacao}`;

    let html = "";
    let detArrAtual = atual.detalhes ? (Array.isArray(atual.detalhes) ? atual.detalhes : Object.values(atual.detalhes)) : [];
    let detArrAnt = anterior.detalhes ? (Array.isArray(anterior.detalhes) ? anterior.detalhes : Object.values(anterior.detalhes)) : [];

    detArrAtual = detArrAtual.filter(a => a !== null);
    detArrAnt = detArrAnt.filter(a => a !== null);

    if(detArrAtual.length > 0) {
        detArrAtual.forEach(alunoAtual => {
            if(alunoAtual.transferido) return; 

            const alunoAnt = detArrAnt.find(a => String(a.nome || "").toLowerCase().trim() === String(alunoAtual.nome || "").toLowerCase().trim());
            const nivelAtual = String(alunoAtual.nivel || "").trim() || "-";
            const nivelAnt = alunoAnt ? (String(alunoAnt.nivel || "").trim() || "-") : "Novo";
            let badge = '<span class="badge badge-same">➖ Manteve</span>';
            if (alunoAnt && PESO_NIVEL[nivelAtual] !== undefined && PESO_NIVEL[nivelAnt] !== undefined) {
                if (PESO_NIVEL[nivelAtual] > PESO_NIVEL[nivelAnt]) badge = '<span class="badge badge-up">⬆️ Evoluiu</span>';
                else if (PESO_NIVEL[nivelAtual] < PESO_NIVEL[nivelAnt]) badge = '<span class="badge badge-down">⬇️ Regrediu</span>';
            } else if (nivelAnt === "Novo") { badge = '<span class="badge" style="background:#e3f2fd; color:#1565C0;">🆕 Novo</span>'; }
            html += `<tr><td>${alunoAtual.nome}</td><td>${nivelAnt}</td><td><strong>${nivelAtual}</strong></td><td>${badge}</td></tr>`;
        });
    }
    document.getElementById('tabela-evo').innerHTML = html;
    document.getElementById('resultado-evo').classList.remove('hidden');
};

window.carregarAdmin = async () => {
    try {
        const dbRef = ref(db, 'avaliacoes');
        const snapshot = await get(dbRef);
        todosDadosAdm = [];
        
        const selEscola = document.getElementById('filtro-escola');
        selEscola.innerHTML = '<option value="TODAS">Todas as Escolas</option>';

        if (snapshot.exists()) {
            const all = Object.entries(snapshot.val()).map(([key, value]) => ({ ...value, id: key }));
            todosDadosAdm = all.sort((a, b) => new Date(b.data_envio || 0) - new Date(a.data_envio || 0));
            
            const escolasUnicas = [...new Set(todosDadosAdm.map(d => String(d.escola || "").trim()))].sort();
            escolasUnicas.forEach(esc => {
                if(esc) selEscola.innerHTML += `<option value="${esc}">${esc}</option>`;
            });
        }
        window.aplicarFiltros();
    } catch(e) {
        console.error("Erro ao carregar admin:", e);
        document.getElementById('tabela-envios').innerHTML = "<tr><td colspan='6'>Erro de conexão com o banco.</td></tr>";
    }
};

window.aplicarFiltros = () => {
    const fEscola = String(document.getElementById('filtro-escola').value).trim();
    const chkSeries = Array.from(document.querySelectorAll('#chk-series input:checked')).map(c => String(c.value).trim());
    
    let fDia = ""; let fMes = "TODOS"; let fAno = "TODOS";
    
    if (document.getElementById('adm-dia-ini')) fDia = String(document.getElementById('adm-dia-ini').value).trim();
    if (document.getElementById('adm-mes-ini')) fMes = String(document.getElementById('adm-mes-ini').value).trim();
    if (document.getElementById('adm-ano-ini')) fAno = String(document.getElementById('adm-ano-ini').value).trim();
    
    let gAlunos=0, gAus=0, gAval=0, gLaudo=0;
    let gN1=0, gN2=0, gN3=0, gN4=0, gIni=0, gFlu=0;
    
    filteredAdmData = [];

    todosDadosAdm.forEach(d => {
        let esc = String(d.escola || "").trim();
        if (fEscola !== "TODAS" && esc !== fEscola) return;
        
        let dia = "", mes = "", ano = "";
        try {
            let dData = String(d.data_avaliacao || "").trim();
            if(dData.includes('/')) { [dia, mes, ano] = dData.split('/'); } 
            else if(dData.includes('-')) { [ano, mes, dia] = dData.split('-'); }
            if(dia) dia = String(dia).trim().padStart(2, '0');
            if(mes) mes = String(mes).trim().padStart(2, '0');
            if(ano) ano = String(ano).trim();
        } catch(e) {}

        if(fDia && dia !== fDia) return;
        if(fMes !== "TODOS" && mes !== fMes) return;
        if(fAno !== "TODOS" && ano !== fAno) return;

        let contribuiu = false; 
        let tAvalLocal = 0, tFluLocal = 0;
        let ruralSeriesMatched = new Set(); 
        let serie = String(d.serie || "").trim();
        let prof = String(d.professor || "").trim();
        
        let detArr = d.detalhes ? (Array.isArray(d.detalhes) ? d.detalhes : Object.values(d.detalhes)) : [];
        detArr = detArr.filter(a => a !== null);

        if (serie === 'Multisseriada' || prof === 'Welma') {
            detArr.forEach(aluno => {
                if(aluno.transferido) return;
                let sRural = String(aluno.serieRural || "").trim();
                if (chkSeries.length > 0 && chkSeries.includes(sRural)) {
                    gAlunos++;
                    let nivel = String(aluno.nivel || "").trim();
                    if (nivel === 'Ausente') { gAus++; }
                    else if (nivel) {
                        gAval++; tAvalLocal++;
                        if (nivel === 'Nível 1') gN1++;
                        if (nivel === 'Nível 2') gN2++;
                        if (nivel === 'Nível 3') gN3++;
                        if (nivel === 'Nível 4') gN4++;
                        if (nivel === 'Iniciante') gIni++;
                        if (nivel === 'Fluente') { gFlu++; tFluLocal++; }
                    }
                    if(aluno.laudo) gLaudo++;
                    contribuiu = true;
                    ruralSeriesMatched.add(sRural); 
                }
            });
        } else {
            if (chkSeries.length > 0 && chkSeries.includes(serie)) {
                detArr.forEach(a => { 
                    if(a.transferido) return;
                    gAlunos++;
                    let nivel = String(a.nivel || "").trim();
                    if (nivel === 'Ausente') { gAus++; }
                    else if (nivel) {
                        gAval++; tAvalLocal++;
                        if (nivel === 'Nível 1') gN1++;
                        if (nivel === 'Nível 2') gN2++;
                        if (nivel === 'Nível 3') gN3++;
                        if (nivel === 'Nível 4') gN4++;
                        if (nivel === 'Iniciante') gIni++;
                        if (nivel === 'Fluente') { gFlu++; tFluLocal++; }
                    }
                    if (a.laudo) gLaudo++; 
                });
                if (detArr.length > 0) contribuiu = true;
            }
        }
        
        if (contribuiu) {
            let pct = tAvalLocal > 0 ? (tFluLocal/tAvalLocal*100).toFixed(0)+"%" : "-";
            let exibeSerie = serie;
            
            if ((serie === 'Multisseriada' || prof === 'Welma') && ruralSeriesMatched.size > 0 && ruralSeriesMatched.size < 5) {
                let arrS = Array.from(ruralSeriesMatched).sort();
                exibeSerie += `<br><small style="color:var(--primary); font-weight:bold;">(${arrS.join(', ')})</small>`;
            }

            filteredAdmData.push({
                originalData: d,
                exibeSerie: exibeSerie,
                id: d.id,
                escola: esc,
                serieTurma: `${exibeSerie} ${String(d.turma || "").trim()}`,
                data: String(d.data_avaliacao || "").trim(),
                prof: prof,
                pct: pct
            });
        }
    });

    const pctN1 = gAval > 0 ? (gN1/gAval*100).toFixed(1) : 0;
    const pctN2 = gAval > 0 ? (gN2/gAval*100).toFixed(1) : 0;
    const pctN3 = gAval > 0 ? (gN3/gAval*100).toFixed(1) : 0;
    const pctN4 = gAval > 0 ? (gN4/gAval*100).toFixed(1) : 0;
    const pctIni = gAval > 0 ? (gIni/gAval*100).toFixed(1) : 0;
    const pctFlu = gAval > 0 ? (gFlu/gAval*100).toFixed(1) : 0;

    document.getElementById('adm-total').innerText = gAval;
    document.getElementById('adm-ausente').innerText = gAus;
    document.getElementById('adm-laudo').innerText = gLaudo;
    
    document.getElementById('adm-n1').innerText = pctN1 + "%";
    document.getElementById('adm-n2').innerText = pctN2 + "%";
    document.getElementById('adm-n3').innerText = pctN3 + "%";
    document.getElementById('adm-n4').innerText = pctN4 + "%";
    document.getElementById('adm-ini').innerText = pctIni + "%";
    document.getElementById('adm-flu').innerText = pctFlu + "%";

    currentPageAdm = 1;
    window.renderTableAdm();
    window.renderPaginationAdm();
};

window.renderTableAdm = () => {
    let html = "";
    const start = (currentPageAdm - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    const pageData = filteredAdmData.slice(start, end);

    if (pageData.length === 0) {
        html = "<tr><td colspan='6'>Sem dados.</td></tr>";
    } else {
        pageData.forEach(d => {
            html += `<tr>
                <td>${d.escola}</td><td>${d.serieTurma}</td><td>${d.data}</td><td>${d.prof}</td><td>${d.pct}</td>
                <td><button class="btn-table" title="Inspecionar Avaliação" onclick="window.abrirModalTurma('${d.id}', true)">🔍</button></td>
            </tr>`;
        });
    }
    document.getElementById('tabela-envios').innerHTML = html;
};

window.mudarPaginaAdm = (page) => {
    currentPageAdm = page;
    window.renderTableAdm();
    window.renderPaginationAdm();
};

window.renderPaginationAdm = () => {
    const totalPages = Math.ceil(filteredAdmData.length / rowsPerPage);
    let html = "";
    if (totalPages > 1) {
        html += `<button class="page-btn" ${currentPageAdm === 1 ? 'disabled' : ''} onclick="window.mudarPaginaAdm(${currentPageAdm - 1})">« Ant</button>`;
        
        let startPage = Math.max(1, currentPageAdm - 2);
        let endPage = Math.min(totalPages, currentPageAdm + 2);
        
        if (startPage > 1) html += `<span style="padding: 5px;">...</span>`;
        
        for(let i = startPage; i <= endPage; i++) {
            html += `<button class="page-btn ${currentPageAdm === i ? 'active' : ''}" onclick="window.mudarPaginaAdm(${i})">${i}</button>`;
        }
        
        if (endPage < totalPages) html += `<span style="padding: 5px;">...</span>`;
        
        html += `<button class="page-btn" ${currentPageAdm === totalPages ? 'disabled' : ''} onclick="window.mudarPaginaAdm(${currentPageAdm + 1})">Próx »</button>`;
    }
    document.getElementById('paginacao-adm').innerHTML = html;
};
