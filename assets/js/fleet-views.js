/* fleet-views.js — Vues Total Fleet / Ulys EXTRAITES de factures.html pour être affichées
   NATIVEMENT sur la page Factures ET sur la page Contrôle (plus d'iframe). Un seul code source.
   Chargé APRÈS app.js (dépend de FP.*). Étape 1 : Ulys. FP.mountUlys(container). */
(function(){
  if(!window.FP) window.FP={};
  var FP=window.FP;
  var $=function(id){return document.getElementById(id);};
  var isUlys=function(f){try{return FP.estUlys?FP.estUlys(f):(String(f&&f.type||'').toLowerCase()==='ulys'||/\bulys\b/i.test(String(f&&f.fournisseur||'')));}catch(e){return false;}};
  var FL_CSS="  .fa-spin { display: inline-block; width: 14px; height: 14px; border: 2px solid currentColor; border-right-color: transparent; border-radius: 50%; animation: fa-spin .7s linear infinite; }\n  @keyframes fa-spin { to { transform: rotate(360deg); } }\n        .tfview-toggle{display:inline-flex;border:1px solid var(--fp-border);border-radius:9px;overflow:hidden}\n        .tfview-toggle button{padding:6px 11px;font-size:.8rem;font-weight:700;background:#fff;border:none;color:var(--fp-muted);cursor:pointer;display:inline-flex;align-items:center;gap:6px}\n        .tfview-toggle button.active{background:var(--fp-primary);color:#fff}\n        .tf-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(268px,1fr));gap:14px}\n        .tf-cards.hidden{display:none}  /* sinon .tf-cards (chargé après Tailwind) écrase .hidden → cartes + tableau visibles ensemble */\n        .tf-ccard{background:#fff;border:1px solid var(--fp-border);border-radius:14px;box-shadow:0 1px 2px rgba(15,30,61,.05),0 8px 24px -18px rgba(15,30,61,.25);padding:15px 16px;display:flex;flex-direction:column;gap:11px}\n        .tf-ccard .top{display:flex;align-items:center;justify-content:space-between;gap:10px}\n        .tf-ccard .nm{font-weight:800;color:var(--fp-primary)}\n        .tf-ccard .tot{font-size:1.28rem;font-weight:800;color:var(--fp-primary);white-space:nowrap}\n        .tf-splbar{display:flex;height:8px;border-radius:5px;overflow:hidden;background:var(--fp-border)}\n        .tf-splbar i{display:block;height:100%}\n        .tf-brk{display:flex;flex-direction:column;gap:5px;font-size:.8rem}\n        .tf-brk .r{display:flex;align-items:center;justify-content:space-between;gap:8px}\n        .tf-brk .r .k{display:inline-flex;align-items:center;gap:6px;color:var(--fp-muted)}\n        .tf-brk .r .k::before{content:\"\";width:9px;height:9px;border-radius:2px;background:var(--d,#64748B)}\n        .tf-ccard .foot{display:flex;gap:14px;border-top:1px solid var(--fp-border);padding-top:9px;font-size:.72rem;color:var(--fp-muted)}\n        .tf-ccard .foot b{display:block;font-size:.92rem;color:var(--fp-primary);font-weight:800}\n/* Mode sombre (module rendu nativement sur Contrôle) */\nbody.fp-dark .tf-ccard{background:#1e293b;border-color:#334155}\nbody.fp-dark .tf-ccard .nm,body.fp-dark .tf-ccard .tot,body.fp-dark .tf-ccard .foot b{color:#e6edf6}\nbody.fp-dark .tfview-toggle button{background:#1e293b;color:#cbd5e1}\nbody.fp-dark .tfview-toggle button.active{background:var(--fp-primary);color:#fff}";
  function injectCss(){if(document.getElementById('fleet-views-css'))return;try{var st=document.createElement('style');st.id='fleet-views-css';st.textContent=FL_CSS;(document.head||document.documentElement).appendChild(st);}catch(e){}}
  var ULYS_MARKUP="    <div id=\"view-ulys\">\n      <!-- Import (visible partout, y compris intégré dans Contrôle) — accepte un OU plusieurs PDF -->\n      <div class=\"flex flex-wrap items-center gap-2 mb-4\">\n        <button type=\"button\" id=\"uls-import-btn\" class=\"btn btn-dark text-sm\"><i data-lucide=\"file-up\" class=\"w-4 h-4\"></i> Importer un relevé Ulys <span class=\"text-xs font-normal opacity-80\">(un ou plusieurs)</span></button>\n      </div>\n      <!-- KPIs -->\n      <div class=\"grid grid-cols-2 md:grid-cols-4 gap-4 mb-6\">\n        <div class=\"kpi\"><div class=\"kpi-label\">Total péages (TTC)</div><div class=\"kpi-value\" id=\"uls-kpi-ttc\">—</div><div class=\"kpi-delta\" id=\"uls-kpi-sub\">—</div></div>\n        <div class=\"kpi\"><div class=\"kpi-label\">Total HT</div><div class=\"kpi-value\" id=\"uls-kpi-ht\">—</div><div class=\"kpi-delta\">hors taxe</div></div>\n        <div class=\"kpi\"><div class=\"kpi-label\">TVA</div><div class=\"kpi-value\" id=\"uls-kpi-tva\">—</div><div class=\"kpi-delta\">récupérable</div></div>\n        <div class=\"kpi\"><div class=\"kpi-label\">Nb factures</div><div class=\"kpi-value\" id=\"uls-kpi-count\">—</div><div class=\"kpi-delta\">filtre actif</div></div>\n      </div>\n\n      <!-- Consommation par conducteur (péages par badge) — filtres + exports CÔTE À CÔTE -->\n      <div class=\"flex flex-wrap items-center justify-between gap-3 mt-2 mb-3\">\n        <h3 class=\"text-lg font-extrabold\" style=\"color: var(--fp-primary)\">Consommation par conducteur</h3>\n        <div class=\"flex flex-wrap items-center gap-2\">\n          <select id=\"uls-conso-mois\" class=\"text-sm border border-slate-200 rounded-lg px-3 py-2\"></select>\n          <span class=\"text-xs text-slate-400\">ou période :</span>\n          <input type=\"date\" id=\"uls-conso-from\" class=\"text-sm border border-slate-200 rounded-lg px-2 py-2\" title=\"Du\" />\n          <span class=\"text-xs text-slate-400\">→</span>\n          <input type=\"date\" id=\"uls-conso-to\" class=\"text-sm border border-slate-200 rounded-lg px-2 py-2\" title=\"Au\" />\n          <button id=\"uls-conso-clear\" type=\"button\" class=\"hidden text-xs text-slate-500 underline\">effacer</button>\n          <span class=\"w-px h-6 bg-slate-200 mx-1\"></span>\n          <span class=\"tfview-toggle\" id=\"uls-conso-view\" title=\"Changer l'affichage\">\n            <button type=\"button\" data-v=\"table\"><i data-lucide=\"table\" class=\"w-4 h-4\"></i> Tableau</button>\n            <button type=\"button\" data-v=\"cards\"><i data-lucide=\"layout-grid\" class=\"w-4 h-4\"></i> Cartes</button>\n          </span>\n          <span class=\"w-px h-6 bg-slate-200 mx-1\"></span>\n          <button id=\"uls-an-csv\" type=\"button\" class=\"btn btn-outline text-xs\" title=\"Exporter la conso de la période choisie en CSV\"><i data-lucide=\"file-down\" class=\"w-3.5 h-3.5\"></i> Export CSV</button>\n          <button id=\"uls-an-pdf\" type=\"button\" class=\"btn btn-dark text-xs\" title=\"Relevé PDF de la période choisie\"><i data-lucide=\"file-text\" class=\"w-3.5 h-3.5\"></i> Relevé PDF</button>\n        </div>\n      </div>\n      <div class=\"card overflow-hidden mb-2\">\n        <div class=\"scrollable\">\n          <table class=\"fp-table\" id=\"uls-conso-table\">\n            <thead><tr><th>Conducteur</th><th style=\"text-align:right\">Trajets</th><th style=\"text-align:right\">Km</th><th style=\"text-align:right\">Total TTC</th></tr></thead>\n            <tbody id=\"uls-conso-tbody\"></tbody>\n            <tfoot id=\"uls-conso-tfoot\"></tfoot>\n          </table>\n        </div>\n        <div id=\"uls-conso-empty\" class=\"hidden p-10 text-center\"><p class=\"text-slate-500 text-sm\" id=\"uls-conso-empty-msg\">Aucun détail de consommation pour ce mois.</p></div>\n      </div>\n      <div id=\"uls-conso-cards\" class=\"tf-cards mb-6 hidden\"></div>\n      <p class=\"text-xs text-slate-500 mb-6\">Détail des péages par conducteur (reconstitué depuis les factures Ulys, par badge).</p>\n\n      <!-- Filtres -->\n      <div class=\"card p-4 mb-6\">\n        <div class=\"flex flex-wrap items-center gap-3\">\n          <div class=\"relative flex-1 min-w-[220px]\">\n            <i data-lucide=\"search\" class=\"w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400\"></i>\n            <input id=\"uls-search\" type=\"text\" placeholder=\"N° facture, description…\" class=\"w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-500\" />\n          </div>\n          <select id=\"uls-filter-annee\" class=\"text-sm border border-slate-200 rounded-lg px-3 py-2\"><option value=\"all\">Toutes les années</option></select>\n        </div>\n      </div>\n\n      <!-- Import facture Ulys : déclenché par le bouton « Importer un relevé Ulys » du HAUT de page\n           (plus de bouton en double ici). Le champ fichier + le statut/aperçu restent pour l'import. -->\n      <input type=\"file\" id=\"uls-import-file\" accept=\"application/pdf\" multiple class=\"hidden\" />\n      <div id=\"uls-import-status\" class=\"hidden mb-3 text-xs leading-relaxed rounded-lg px-3 py-2\"></div>\n      <div id=\"uls-import-preview\" class=\"hidden mb-3\"></div>\n\n      <!-- Table -->\n      <div class=\"card overflow-hidden\">\n        <div class=\"scrollable\">\n          <table class=\"fp-table\" id=\"uls-table\">\n            <thead><tr><th>Date</th><th>N° facture</th><th>Désignation</th><th>Fournisseur</th><th style=\"text-align:right\">HT</th><th style=\"text-align:right\">TVA</th><th style=\"text-align:right\">TTC</th><th></th></tr></thead>\n            <tbody id=\"uls-tbody\"></tbody>\n          </table>\n        </div>\n        <div id=\"uls-empty\" class=\"hidden p-12 text-center\">\n          <i data-lucide=\"route\" class=\"w-12 h-12 mx-auto text-slate-300 mb-3\"></i>\n          <p class=\"text-slate-500 text-sm\">Aucune facture Ulys pour le moment.</p>\n          <p class=\"text-slate-400 text-xs mt-1\">Importe tes factures de péage Ulys — elles s'afficheront ici.</p>\n        </div>\n      </div>\n      <div id=\"uls-more\" class=\"mt-3 text-center\"></div>\n      <p class=\"text-xs text-slate-500 mt-4\">Factures <b>Ulys</b> (péages VINCI Autoroutes). Même présentation que Total Fleet.</p>\n    </div>\n";
  FP.mountUlys=function(container){
    try{
      if(!container) return false;
      if(container.getAttribute('data-fl-ulys')==='1'){ try{ if(window.renderUlys) window.renderUlys(); }catch(e){} return true; }
      container.setAttribute('data-fl-ulys','1');
      injectCss();
      container.innerHTML=ULYS_MARKUP;
      try{ if(window.lucide&&lucide.createIcons) lucide.createIcons(); }catch(e){}
  (function ulysTab(){
    const ust = { search: '', annee: 'all', expanded: false };
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;' }[c]));
    // Dé-doublonné par n° de facture (comme Total Fleet) → un n° = une seule ligne, KPI = total des
    // factures affichées, jamais compté deux fois même si la base contient un doublon d'un ancien import.
    const list = () => {
      const seen = new Set(), out = [];
      (window.FP_DATA.factures || []).filter(isUlys).forEach(f => {
        const k = (f.numeroFacture || f.id || '').toString().toUpperCase();
        if (k && seen.has(k)) return; if (k) seen.add(k); out.push(f);
      });
      return out;
    };

    function render(){
      const all = list();
      const annees = [...new Set(all.map(f => (f.date || '').slice(0,4)).filter(Boolean))].sort().reverse();
      const sel = $('uls-filter-annee');
      if (sel && sel.dataset.filled !== annees.join(',')) {
        sel.innerHTML = '<option value="all">Toutes les années</option>' + annees.map(a => `<option value="${a}">${a}</option>`).join('');
        sel.value = ust.annee; sel.dataset.filled = annees.join(',');
      }
      const q = FP.norm(ust.search).trim();
      const rows = all.filter(f => {
        if (ust.annee !== 'all' && (f.date || '').slice(0,4) !== ust.annee) return false;
        if (q && !FP.norm(`${f.numeroFacture||''} ${f.description||''} ${f.fournisseur||''}`).includes(q)) return false;
        return true;
      }).sort((a,b) => (b.date||'').localeCompare(a.date||''));

      const sum = (k) => rows.reduce((s,f) => s + (Number(f[k]) || 0), 0);
      $('uls-kpi-ttc').textContent   = FP.euro(sum('montantTTC'));
      $('uls-kpi-ht').textContent    = FP.euro(sum('montantHT'));
      $('uls-kpi-tva').textContent   = FP.euro(sum('montantTVA'));
      $('uls-kpi-count').textContent = rows.length;
      $('uls-kpi-sub').textContent   = ust.annee === 'all' ? 'toutes années' : ust.annee;

      const tbody = $('uls-tbody');
      $('uls-empty').classList.toggle('hidden', rows.length > 0);
      const LIMIT = 15;
      const visible = ust.expanded ? rows : rows.slice(0, LIMIT);
      tbody.innerHTML = visible.map(f => `<tr>
        <td style="white-space:nowrap">${f.date ? FP.date(f.date) : '—'}</td>
        <td style="font-family:monospace">${esc(f.numeroFacture || '—')}</td>
        <td>${esc(f.description || '—')}</td>
        <td>${esc(f.fournisseur || 'Ulys')}</td>
        <td style="text-align:right">${f.montantHT != null ? FP.euro(f.montantHT) : '—'}</td>
        <td style="text-align:right">${f.montantTVA != null ? FP.euro(f.montantTVA) : '—'}</td>
        <td style="text-align:right;font-weight:700">${f.montantTTC != null ? FP.euro(f.montantTTC) : '—'}</td>
        <td style="text-align:right;white-space:nowrap"><button type="button" class="btn btn-outline" style="padding:3px 10px;font-size:12px" data-uls-voir="${esc(f.id)}"><i data-lucide="eye" class="w-3 h-3"></i> Voir</button> <button type="button" class="btn btn-outline" style="padding:3px 8px;font-size:12px;color:#B91C1C;border-color:#FCA5A5" data-uls-del="${esc(f.id)}" title="Supprimer cette facture"><i data-lucide="trash-2" class="w-3 h-3"></i></button></td>
      </tr>`).join('');
      const more = $('uls-more');
      if (rows.length > LIMIT){
        more.innerHTML = `<button type="button" id="uls-more-btn" class="btn btn-outline text-sm">${ust.expanded ? 'Réduire' : `Voir tout (${rows.length})`}</button>`;
        $('uls-more-btn').addEventListener('click', () => { ust.expanded = !ust.expanded; render(); });
      } else { more.innerHTML = ''; }
      if (window.lucide) lucide.createIcons();
    }

    $('uls-search').addEventListener('input', (e) => { ust.search = e.target.value; render(); });
    $('uls-filter-annee').addEventListener('change', (e) => { ust.annee = e.target.value; render(); });
    // ===== Import auto des factures Ulys (PDF) : facture + détail par conducteur =====
    const MOIS_FR = { janvier:'01',fevrier:'02',mars:'03',avril:'04',mai:'05',juin:'06',juillet:'07',aout:'08',septembre:'09',octobre:'10',novembre:'11',decembre:'12' };
    const ulsNum  = (s) => parseFloat(String(s).replace(/[\s  ]/g,'').replace(',','.')) || 0;
    const ulsNorm = (s) => (s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
    const ulsSlug = (s) => (s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toUpperCase().replace(/[^A-Z0-9]/g,'');
    function ulsKnownNames(){
      const set = new Set();
      const add = (str) => String(str||'').split(/[\s/]+/).forEach(tok => { if (tok.length>=3 && /^[A-ZÀ-Ý][a-zà-ÿ]/.test(tok)) set.add(tok); });
      (window.FP_DATA.conducteurs||[]).forEach(c => add(c.prenom||c.nom||c.label||c.conducteur||c.key));
      (window.FP_DATA.vehicules||[]).forEach(v => add(v.chauffeur));
      return set;
    }
    // Lecture Ulys = SOURCE UNIQUE FP.ulys (app.js), partagée avec le scanner unifié. On délègue.
    function parseUlys(text){ if (window.FP && FP.ulys && FP.ulys.parse) return FP.ulys.parse(text); return parseUlysLegacy(text); }
    function parseUlysLegacy(text){
      const t = text || '';
      const mNum = t.match(/Facture\s*n[°ºo]\s*([A-Z]{1,3}\d{6,})/i);
      const mEm  = t.match(/[ÉE]mise?\s*le\s*(\d{2})\/(\d{2})\/(\d{4})/i);
      const numero = mNum ? mNum[1] : null;
      const emise = mEm ? `${mEm[3]}-${mEm[2]}-${mEm[1]}` : '';
      let mois = '';
      const mPer = t.match(/Facture\s+(?:de|d['’])\s*([a-zA-ZéèûôA-ZÀ-Ý]+)\s*(\d{4})/);
      if (mPer){ const mm = MOIS_FR[ulsNorm(mPer[1])]; if (mm) mois = mPer[2] + '-' + mm; }
      if (!mois && emise){ const d = new Date(emise); d.setMonth(d.getMonth()-1); mois = d.toISOString().slice(0,7); }
      // Date de la facture = 1er jour de la PÉRIODE (ex. janvier = 2026-01-01), pas la date d'émission
      // (sinon la facture « de janvier » s'afficherait en février → confusion de mois).
      const date = mois ? (mois + '-01') : emise;
      // --- Montants (robuste & exact) -------------------------------------
      // Le vrai total est le « NET A PAYER TTC » imprimé avec le symbole € (ex. « 1 734,36 € »).
      // TVA française = 20 % : on repère dans le récap (1re page) le couple (base HT, TVA) présent
      //   où TVA = 20 % de la base — base MAXIMALE, avec base+TVA ≤ TTC. Robuste même si une part
      //   est à 0 % (péage étranger, frais de gestion). Puis HT = TTC − TVA.
      //   ⚠️ Avant : on sommait TOUS les nombres après « NET A PAYER » → TVA/HT aberrants (négatifs).
      let ht=null, tva=null, ttc=null;
      const toNums = (s) => (String(s||'').match(/\d[\d\s\u00a0\u202f\u2009]*,\d{2}/g)||[]).map(ulsNum);
      const afterNet = t.split(/NET\s*A\s*PAYER\s*TTC/i).slice(1).join(' ') || t;
      const mTtc = afterNet.match(/(\d[\d\s\u00a0\u202f\u2009]*,\d{2})\s*€/) || t.match(/(\d[\d\s\u00a0\u202f\u2009]*,\d{2})\s*€/);
      if (mTtc) ttc = ulsNum(mTtc[1]);
      const page1 = t.split(/Badge n[°ºo]/)[0];          // le récap TVA est sur la 1re page
      const p1nums = toNums(page1);
      if (ttc == null && p1nums.length) ttc = Math.max.apply(null, p1nums);
      if (ttc != null){
        let best = null;
        for (const b of p1nums) for (const tv of p1nums){
          if (tv > 0 && Math.abs(b * 0.20 - tv) <= 0.02 && b + tv <= ttc + 0.05){ if (!best || b > best.b) best = { b, tv }; }
        }
        if (best){ tva = best.tv; ht = +(ttc - tva).toFixed(2); }
        else { ht = +(ttc / 1.2).toFixed(2); tva = +(ttc - ht).toFixed(2); }   // repli : tout à 20 %
      }
      // --- Détail par collaborateur (ancré sur le N° de BADGE) ------------
      // Texte reconstruit EN LIGNES par position (cf. ulysPdfToText) :
      //   « Badge n° <id> <Nom> »
      //   « Total Badge <id> <n> consommation(s) <ttc> € TTC <km> km »
      // On rattache le prénom à son total PAR NUMÉRO DE BADGE (fiable — l'ordre des prénoms ne
      // l'est PAS, colonnes inversées). Le « Total Contrat » (grand total) est ignoré (pas « Badge »).
      const badgeSuffix = (x) => String(x).replace(/\D/g,'').slice(-5);
      const nameByBadge = {};
      { const rx = /Badge\s*n[°ºo]\s+([\d ]+\d)\s+([A-Za-zÀ-ÿ][^\n]*?)\s*$/gim; let m;
        while ((m = rx.exec(t))){ const suf = badgeSuffix(m[1]); const nm = m[2].trim();
          if (suf && nm && !nameByBadge[suf]) nameByBadge[suf] = nm; } }
      const conso = [];
      { const rx = /Total\s+Badge\s+([\d ]+?\d)\s+(\d+)\s*consommation\(s\)\s*([\d  .,]+?)\s*€\s*TTC\s*([\d  .,]+?)\s*km/gi; let m;
        const seenB = new Set();
        while ((m = rx.exec(t))){
          const suf = badgeSuffix(m[1]); if (seenB.has(suf)) continue; seenB.add(suf);
          conso.push({ conducteur: nameByBadge[suf] || ('Badge ' + suf), nb: parseInt(m[2],10)||0, ttc: ulsNum(m[3]), km: ulsNum(m[4]) });
        }
      }
      return { numero, date, mois, ht, tva, ttc, conso };
    }

    let _ulsPending = null;
    // Reconstruit le texte du PDF Ulys EN LIGNES, en triant les fragments par POSITION (y puis x).
    // Indispensable : « Badge n° <id> <Nom> » et « Total Badge <id> … <ttc> € TTC <km> km » doivent
    // rester sur une seule ligne. La lecture standard (FP.ocr) colle les fragments dans le désordre
    // (colonnes entremêlées) → montants/prénoms illisibles. Repli sur FP.ocr si pas de couche texte.
    async function ulysPdfToText(file){
      if (window.FP && FP.ulys && FP.ulys.pdfToText) return FP.ulys.pdfToText(file);
      try {
        await FP.ocr.loadScript(FP.ocr.PDFJS_CDN);
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = FP.ocr.PDFJS_WORKER;
        const buf = await file.arrayBuffer();
        const pdf = await window.pdfjsLib.getDocument({ data: buf }).promise;
        let text = '';
        for (let pg=1; pg<=pdf.numPages; pg++){
          const page = await pdf.getPage(pg);
          const tc = await page.getTextContent();
          const items = tc.items
            .filter(i => i.str && i.str.trim() !== '')
            .map(i => ({ x: i.transform[4], y: i.transform[5], s: i.str.trim() }));
          items.sort((a,b) => (b.y - a.y) || (a.x - b.x));   // haut→bas (y décroissant), puis gauche→droite
          const lines = []; let cur = null;
          for (const it of items){
            if (!cur || Math.abs(it.y - cur.y) > 2){ cur = { y: it.y, parts: [it] }; lines.push(cur); }
            else cur.parts.push(it);
          }
          for (const ln of lines){ ln.parts.sort((a,b)=>a.x-b.x); text += ln.parts.map(p=>p.s).join(' ') + '\n'; }
          text += '\n';
        }
        return text;
      } catch(e){ console.warn('[ulysPdfToText]', e); return ''; }
    }
    function ulsImpStatus(html, kind){ const el=$('uls-import-status'); el.classList.remove('hidden'); el.innerHTML=html; el.style.background = kind==='ok'?'#ECFDF5':kind==='err'?'#FEF2F2':'#F1F5F9'; el.style.color = kind==='ok'?'#047857':kind==='err'?'#B91C1C':'#334155'; }
    function ulsImpReset(){ _ulsPending=null; $('uls-import-preview').classList.add('hidden'); $('uls-import-preview').innerHTML=''; $('uls-import-status').classList.add('hidden'); }
    async function handleUlysImport(files){
      if (!files || !files.length) return;
      if (!(window.FP && FP.ocr)){ ulsImpStatus('Lecteur PDF indisponible.', 'err'); return; }
      ulsImpStatus('<span class="inline-flex items-center gap-2"><span class="fa-spin"></span> Lecture de '+files.length+' fichier(s)…</span>', 'working');
      const fac=[], rows=[], tx=[]; let skipped=0;
      for (const f of files){
        try {
          let text = await ulysPdfToText(f);                 // reconstruction par position (lignes)
          if (!text || text.replace(/\s/g,'').length < 80) text = await FP.ocr.fileToText(f, 99); // repli
          const p = parseUlys(text);
          if (!p.numero || p.ttc == null) { skipped++; console.warn('[uls-import] non reconnu :', f.name); continue; }
          p._file = f;                                       // garde le PDF d'origine → stocké au commit (bouton « Voir »)
          fac.push(p);
          p.conso.forEach(c => rows.push(Object.assign({ mois:p.mois, numero:p.numero }, c)));
          // Détail DATÉ (colonne date des consommations) → alimente total_conso_tx (péage) pour la
          // détection « conso pendant un congé » à la bonne DATE. Best-effort (dépend du format PDF).
          (p.txConso || []).forEach((c, i) => tx.push(Object.assign({ mois:p.mois, numero:p.numero, seq:i }, c)));
        } catch (e){ console.error('[uls-import]', e); skipped++; }
      }
      if (!fac.length){ ulsImpStatus('Aucune facture Ulys lisible' + (skipped ? ' ('+skipped+' fichier(s) non reconnus — le PDF doit avoir une couche texte Ulys/VINCI)' : '') + '.', 'err'); return; }
      _ulsPending = { fac, rows, tx, skipped };
      const facLines = fac.map(p => `<tr><td style="font-family:monospace">${esc(p.numero)}</td><td>${p.date?FP.date(p.date):'—'}</td><td>${esc(moisLabel(p.mois))}</td><td style="text-align:right">${p.ht!=null?FP.euro(p.ht):'—'}</td><td style="text-align:right">${p.tva!=null?FP.euro(p.tva):'—'}</td><td style="text-align:right;font-weight:700">${FP.euro(p.ttc)}</td></tr>`).join('');
      const collabs = [...new Set(rows.map(c => c.conducteur).filter(Boolean))];
      const withTtc = rows.filter(c => c.ttc != null);
      const sumTtc = withTtc.reduce((s,c) => s + (Number(c.ttc)||0), 0);
      // Bloc détail : tableau avec montants si dispo, sinon puces (noms seuls)
      let detailBlock;
      if (withTtc.length){
        const consoLines = rows.map(c => `<tr><td>${esc(c.conducteur)}</td><td>${esc(moisLabel(c.mois))}</td><td style="text-align:right">${c.nb!=null?c.nb:'—'}</td><td style="text-align:right">${c.km!=null?FP.num(c.km)+' km':'—'}</td><td style="text-align:right;font-weight:700">${c.ttc!=null?FP.euro(c.ttc):'—'}</td></tr>`).join('');
        detailBlock =
          '<div class="text-sm font-semibold mt-4 mb-2">Détail par collaborateur : '+withTtc.length+' · total '+FP.euro(sumTtc)+'</div>'
          + '<div class="scrollable" style="max-height:260px"><table class="fp-table" style="font-size:13px"><thead><tr><th>Collaborateur</th><th>Période</th><th style="text-align:right">Trajets</th><th style="text-align:right">Km</th><th style="text-align:right">TTC</th></tr></thead><tbody>'+consoLines+'</tbody></table></div>';
      } else {
        const collabChips = collabs.length
          ? collabs.map(n => `<span class="inline-block text-xs font-semibold px-2.5 py-1 rounded-full" style="background:#EEF2F6;color:#334155;margin:2px">${esc(n)}</span>`).join('')
          : '<span class="text-sm text-slate-400">Aucun collaborateur reconnu (vérifie que leurs prénoms figurent dans l\'onglet Conducteurs).</span>';
        detailBlock =
          '<div class="text-sm font-semibold mt-4 mb-1">Collaborateurs détectés : '+collabs.length+'</div>'
          + '<div class="mb-1">'+collabChips+'</div>'
          + '<div class="text-xs text-slate-500 mb-2" style="line-height:1.5">ℹ️ Les prénoms ont été détectés mais le <b>montant par collaborateur</b> n\'a pas pu être rattaché de façon fiable sur cette facture (nombre de prénoms ≠ nombre de totaux). On n\'invente pas de chiffre. Le total de la facture, lui, est correct.</div>';
      }
      $('uls-import-preview').classList.remove('hidden');
      $('uls-import-preview').innerHTML =
        '<div class="text-sm font-semibold mb-2">'+fac.length+' facture(s) Ulys</div>'
        + '<div class="scrollable" style="max-height:170px"><table class="fp-table" style="font-size:13px"><thead><tr><th>N°</th><th>Date</th><th>Période</th><th style="text-align:right">HT</th><th style="text-align:right">TVA</th><th style="text-align:right">TTC</th></tr></thead><tbody>'+facLines+'</tbody></table></div>'
        + detailBlock
        + '<div class="flex gap-2 mt-3"><button type="button" class="btn btn-outline text-sm" id="uls-import-cancel">Annuler</button><button type="button" class="btn btn-dark text-sm" id="uls-import-confirm"><i data-lucide="check" class="w-4 h-4"></i> Enregistrer</button></div>';
      ulsImpStatus('Vérifie l\'aperçu puis valide.', 'working');
      if (window.lucide) lucide.createIcons();
      $('uls-import-cancel').addEventListener('click', ulsImpReset);
      $('uls-import-confirm').addEventListener('click', commitUlys);
      // Amène l'aperçu à confirmer EN HAUT de l'écran (sinon il faut scroller pour le voir).
      try { $('uls-import-preview').scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) {}
    }
    async function commitUlys(){
      if (!_ulsPending) return;
      $('uls-import-confirm').disabled = true;
      // Détail de CE qu'on va enregistrer, montré dans l'overlay (l'utilisateur voit le contenu).
      const _nF = _ulsPending.fac.length, _nC = (_ulsPending.rows || []).filter(r => r.ttc != null).length, _nTx = (_ulsPending.tx || []).filter(c => c.date && c.conducteur).length;
      const _busy = (window.FP && FP.busy) ? FP.busy('Relevé Ulys : ' + _nF + ' facture(s) · ' + _nC + ' détail(s) conducteur · ' + _nTx + ' conso datée(s)…') : null;
      ulsImpStatus('<span class="inline-flex items-center gap-2"><span class="fa-spin"></span> Enregistrement…</span>', 'working');
      let okF=0, okC=0, _iF=0;
      for (const p of _ulsPending.fac){
        if (_busy) _busy.update('Facture ' + (++_iF) + '/' + _nF + ' · ' + p.numero + ' (' + FP.euro(p.ttc) + ')…');
        // Stocke le PDF d'origine (MÊME système que TotalEnergies) → bouton « Voir » = aperçu intégré.
        const prev = (window.FP_DATA.factures||[]).find(x => x.id === ('ULYS-'+p.numero));
        let fileUrl = null;
        if (p._file && FP.uploadScan) { try { fileUrl = await FP.uploadScan(p._file, 'factures-total', { name:'ULYS-'+p.numero }); } catch(e){ console.warn('[uls upload PDF]', e); } }
        const newF = { id:'ULYS-'+p.numero, date:p.date||null, vehiculeImmat:(prev && prev.vehiculeImmat) || null, fournisseur:'Ulys', numeroFacture:p.numero, description:'Péages Ulys — '+moisLabel(p.mois), type:'peage', montantHT:p.ht, montantTVA:p.tva, montantTTC:p.ttc,
          fileId: fileUrl || (prev && prev.fileId) || null, fileName: (p._file ? p._file.name : (prev && prev.fileName)) || null };
        const i = (window.FP_DATA.factures||[]).findIndex(x => x.id === newF.id);
        if (i>=0) window.FP_DATA.factures[i]=newF; else window.FP_DATA.factures.push(newF);
        try { await FP.persist.upsert('factures', newF); okF++; } catch(e){ console.error('[uls facture]', e); }
      }
      // Détail par collaborateur : on n'enregistre QUE si un montant fiable a pu être lu (sinon on
      // n'écrit pas de faux « 0 € » — cf. note d'import). Sur le format Ulys entremêlé, c.ttc est null.
      if (_busy && _nC) _busy.update('Détail par conducteur : ' + _nC + ' à enregistrer…');
      for (const c of _ulsPending.rows){
        if (c.ttc == null) continue;
        // ⚠️ Société = la société ACTIVE (jamais 'PXP' en dur) sinon le détail Ulys d'une autre
        // société atterrit chez PXP (fuite inter-sociétés + attribution conso faussée).
        const row = { id:'ULYSC-'+c.mois+'-'+ulsSlug(c.conducteur), mois:c.mois, conducteur:c.conducteur, nbTrajets:c.nb, km:c.km, totalTtc:c.ttc, numeroFacture:c.numero, societe:(FP.activeSociete?FP.activeSociete():'PXP') };
        try { await FP.persist.upsert('ulys_conso', row); okC++; } catch(e){ console.error('[uls conso]', e); }
      }
      // Détail DATÉ (colonne date des consommations) → total_conso_tx (péage) pour la détection
      // « conso pendant un congé » à la bonne date. Best-effort : table absente = silencieux (repli mensuel).
      let okTx = 0;
      if (_busy && _nTx) _busy.update('Conso datées (pour le suivi des congés) : ' + _nTx + '…');
      for (const c of (_ulsPending.tx || [])){
        if (!c.date || !c.conducteur) continue;
        const tr = { id:'ULYSTX-'+c.numero+'-'+(c.badge||'')+'-'+(c.seq!=null?c.seq:''), facnum:c.numero, carte:'ULYS-'+(c.badge||''),
          conducteur:c.conducteur, plaque:null, dateTx:c.date, mois:(c.date||'').slice(0,7), produit:'Péage Ulys',
          categorie:'peage', montantTtc:(c.montant!=null?c.montant:0) };
        try { const res = (FP.db && FP.db.upsert) ? await FP.db.upsert('total_conso_tx', tr) : null; if (res && res.error) throw res.error; okTx++; }
        catch (e){ break; }
      }
      const nbCollab = new Set(_ulsPending.rows.map(r => r.conducteur).filter(Boolean)).size;
      const _skip = _ulsPending.skipped || 0;
      ulsImpStatus('<b>Enregistré</b> : '+okF+' facture(s) Ulys.' + (okC ? ' Détail de '+okC+' conducteur(s).' : (nbCollab ? ' '+nbCollab+' collaborateur(s) détecté(s) (montant par personne non lu automatiquement sur ce format).' : '')) + (okTx ? ' '+okTx+' conso(s) datée(s) pour le suivi des congés.' : '') + (_skip ? ' <span style="color:#B45309">'+_skip+' fichier(s) non reconnus.</span>' : '') + ' Visible sur tous les postes.', 'ok');
      if (_busy) _busy.done('✓ Relevé Ulys enregistré — '+okF+' facture(s)' + (okTx ? ', '+okTx+' conso datées' : '') + (_skip ? ' · '+_skip+' non reconnu(s)' : ''));
      $('uls-import-preview').classList.add('hidden'); _ulsPending=null;
      render(); consoLoaded=false; loadConso();
    }
    // (Le bouton de dropzone Ulys a été retiré : l'import se lance via le bouton « Importer un relevé Ulys » du haut.)
    $('uls-import-file').addEventListener('change', (e) => { handleUlysImport(e.target.files); e.target.value=''; });
    if ($('uls-import-btn')) $('uls-import-btn').addEventListener('click', () => $('uls-import-file').click());

    function openUlsDrawer(f){
      $('drawer-num').textContent = f.numeroFacture || '—';
      $('drawer-title').textContent = f.description || 'Facture Ulys';
      $('drawer-subtitle').textContent = `${f.fournisseur || 'Ulys'} · ${f.date ? FP.date(f.date) : '—'}`;
      $('drawer-body').innerHTML = `
        <div class="grid grid-cols-3 gap-3">
          <div class="kpi p-3"><div class="kpi-label">HT</div><div class="kpi-value" style="font-size:1rem">${f.montantHT != null ? FP.euroPrecis(f.montantHT) : '—'}</div></div>
          <div class="kpi p-3"><div class="kpi-label">TVA</div><div class="kpi-value" style="font-size:1rem">${f.montantTVA != null ? FP.euroPrecis(f.montantTVA) : '—'}</div></div>
          <div class="kpi p-3"><div class="kpi-label">TTC</div><div class="kpi-value" style="font-size:1rem; color: var(--fp-primary)">${f.montantTTC != null ? FP.euroPrecis(f.montantTTC) : '—'}</div></div>
        </div>
        <div><div class="field-label">N° de facture</div><div class="text-sm bg-slate-50 p-3 rounded-lg">${esc(f.numeroFacture || '—')}</div></div>
        <div><div class="field-label">Date</div><div class="text-sm">${f.date ? FP.date(f.date) : '—'}</div></div>`;
      const openBtn = $('drawer-open-drive');
      const url = f.url || (f.fileId && !/^IMP-/.test(f.fileId) ? (/^https?:\/\//.test(f.fileId) ? f.fileId : `https://drive.google.com/file/d/${f.fileId}/view`) : null);
      if (url){ openBtn.href = url; openBtn.style.display = ''; } else { openBtn.removeAttribute('href'); openBtn.style.display = 'none'; }
      $('drawer').classList.add('open'); $('drawer-backdrop').classList.add('open');
      if (window.lucide) lucide.createIcons();
    }

    async function deleteUlsFacture(f){
      if (!(await FP.confirm(`Supprimer la facture ${f.numeroFacture || f.id} (${f.montantTTC != null ? FP.euro(f.montantTTC) : '—'}) ?`))) return;
      const idx = (window.FP_DATA.factures || []).findIndex(x => x.id === f.id);
      if (idx >= 0) window.FP_DATA.factures.splice(idx, 1);
      try { await FP.persist.delete('factures', f.id); } catch (e) { console.error('[uls-del]', e); }
      // Purge aussi le détail conso rattaché à cette facture (sinon conso orpheline → total faussé).
      try {
        const num = String(f.numeroFacture || '').trim();
        if (num && Array.isArray(conso)){
          const orphans = conso.filter(c => String(c.numeroFacture || '').trim() === num);
          for (const c of orphans){ if (c.id){ try { await FP.persist.delete('ulys_conso', c.id); } catch (_){} } }
          if (orphans.length) conso = conso.filter(c => !orphans.includes(c));
        }
      } catch (_){}
      render();
      if (consoLoaded) renderConso();
    }

    $('uls-tbody').addEventListener('click', (e) => {
      const voir = e.target.closest('[data-uls-voir]');
      // « Voir » = ouvre DIRECTEMENT le PDF dans un nouvel onglet (jamais un pop-up) — helper unique FP.openPdf.
      if (voir){ const f = (window.FP_DATA.factures || []).find(x => String(x.id) === voir.getAttribute('data-uls-voir')); if (f) { if (FP.openPdf) FP.openPdf(f.url || f.fileId, 'Aucun PDF stocké pour ce relevé Ulys — réimporte-le une fois pour l\'attacher.'); else (window.__facOpenTfDrawer ? window.__facOpenTfDrawer(f) : openUlsDrawer(f)); } return; }
      const del = e.target.closest('[data-uls-del]');
      if (del){ const f = (window.FP_DATA.factures || []).find(x => String(x.id) === del.getAttribute('data-uls-del')); if (f) deleteUlsFacture(f); }
    });

    // --- Consommation par conducteur (table ulys_conso) ---
    let conso = null, consoLoaded = false;
    const moisLabel = (m) => { const [y, mo] = (m || '').split('-'); const N = ['','Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']; return mo ? `${N[+mo]} ${y}` : m; };
    async function loadConso(){
      consoLoaded = true;
      try { const r = await FP.supabase.from('ulys_conso').select('*'); if (r.error) throw r.error; conso = r.data || []; const _soc = FP.activeSociete ? FP.activeSociete() : null; if (_soc && _soc !== '__all__') conso = conso.filter(x => !x.societe || x.societe === _soc); }
      catch (e) { console.warn('[ulys_conso] indisponible :', e && (e.message || e)); conso = null; }
      renderConso();
      try { window.showConsoRapproch && window.showConsoRapproch(); } catch (e) {}
    }
    function renderConso(){
      const sel = $('uls-conso-mois'), tbody = $('uls-conso-tbody'), tfoot = $('uls-conso-tfoot');
      const empty = $('uls-conso-empty'), emptyMsg = $('uls-conso-empty-msg');
      if (conso === null) { sel.innerHTML = ''; tbody.innerHTML = ''; tfoot.innerHTML = ''; empty.classList.remove('hidden'); emptyMsg.textContent = 'Table ulys_conso absente — lance le script SQL fourni (supabase/ulys-conso-setup.sql).'; return; }
      // ⚠️ Ne compter QUE la conso ADOSSÉE À UNE FACTURE Ulys réellement présente. Une conso orpheline
      // (facture jamais importée, ou supprimée) fausserait le total → à ne PAS compter. On relie par le
      // n° de facture ; à défaut (anciennes lignes sans n°), par le mois d'une facture Ulys existante.
      const backed = ulsBacked();
      const moisList = [...new Set(backed.map(c => c.mois).filter(Boolean))].sort().reverse();
      const filledKey = 'all,' + moisList.join(',');
      if (sel.dataset.filled !== filledKey) { sel.innerHTML = '<option value="all">Toutes les périodes</option>' + moisList.map(m => `<option value="${m}">${moisLabel(m)}</option>`).join(''); sel.dataset.filled = filledKey; sel.value = 'all'; }
      const { src, label } = ulsPeriod();
      // ⚠️ ANTI-DOUBLON : une même personne peut être stockée sous 2 orthographes (prénom seul
      // « Charles » ET nom complet « Charles LENNON ») → mêmes chiffres en double. On garde UNE seule
      // ligne par (personne, mois, facture), puis on regroupe par PERSONNE (prénom normalisé) en
      // affichant le nom le plus complet. (Ne PAS sommer les doublons — ce sont les mêmes données.)
      const _np = (s) => (FP.normPrenom ? FP.normPrenom(s) : String(s || '').trim().toLowerCase());
      const seenUC = new Set(), dedup = [], bestName = {};
      src.forEach(c => {
        const np = _np(c.conducteur);
        const uk = np + '|' + (c.mois || '') + '|' + (c.numeroFacture || c.numero_facture || '');
        if (seenUC.has(uk)) return; seenUC.add(uk);
        dedup.push(c);
        const cur = bestName[np]; if (!cur || String(c.conducteur || '').length > cur.length) bestName[np] = c.conducteur || '—';
      });
      const byCond = {};
      // Nom AFFICHÉ = fiche conducteur (unifié) ; repli sur le libellé le plus complet du relevé.
      const _nomUnif = (raw) => (FP.conducteurNomUnifie ? (FP.conducteurNomUnifie(raw) || raw) : raw);
      dedup.forEach(c => { const np = _np(c.conducteur); const k = np || (c.conducteur || '—'); const a = (byCond[k] = byCond[k] || { conducteur: _nomUnif(bestName[np] || c.conducteur || '—'), nb_trajets:0, km:0, total_ttc:0 }); a.nb_trajets += Number(c.nb_trajets)||0; a.km += Number(c.km)||0; a.total_ttc += Number(c.total_ttc)||0; });
      const rows = Object.values(byCond).sort((a,b) => b.total_ttc - a.total_ttc);
      empty.classList.toggle('hidden', rows.length > 0);
      if (!rows.length) emptyMsg.textContent = 'Aucun détail de consommation sur cette période (importe la facture Ulys correspondante).';
      tbody.innerHTML = rows.map(c => `<tr><td>${esc(c.conducteur || '—')}</td><td style="text-align:right">${c.nb_trajets ? c.nb_trajets : '—'}</td><td style="text-align:right">${c.km ? FP.num(c.km) + ' km' : '—'}</td><td style="text-align:right;font-weight:700">${FP.euro(c.total_ttc || 0)}</td></tr>`).join('');
      const tot = rows.reduce((s,c) => s + (Number(c.total_ttc)||0), 0);
      const totKm = rows.reduce((s,c) => s + (Number(c.km)||0), 0);
      tfoot.innerHTML = rows.length ? `<tr style="font-weight:700;border-top:2px solid var(--fp-border)"><td>Total ${esc(label)}</td><td></td><td style="text-align:right">${totKm ? FP.num(totKm) + ' km' : '—'}</td><td style="text-align:right">${FP.euro(tot)}</td></tr>` : '';
      // ===== Vue CARTES (Direction B) — une carte par conducteur =====
      const cardsBox = $('uls-conso-cards');
      if (cardsBox) cardsBox.innerHTML = rows.map(c => {
        const tr = Number(c.nb_trajets)||0, km = Number(c.km)||0, ttc = Number(c.total_ttc)||0;
        return `<div class="tf-ccard"><div class="top"><span class="nm">${esc(c.conducteur || '—')}</span><span class="tot">${FP.euro(ttc)}</span></div>
          <div class="foot"><div>Trajets<b>${tr || '—'}</b></div><div>Km<b>${km ? FP.num(km) + ' km' : '—'}</b></div><div>€ / trajet<b>${tr ? FP.euro(ttc / tr) : '—'}</b></div></div></div>`;
      }).join('');
      applyUlsView(!rows.length);
    }
    // Bascule Tableau / Cartes (même préférence société que Total Fleet : FP.settings.consoView).
    function applyUlsView(forceTable){
      let pref = 'table';
      try { if (window.FP && FP.settings) pref = (FP.settings.get().consoView === 'cards') ? 'cards' : 'table'; } catch (e) {}
      const v = forceTable ? 'table' : pref;
      const tbl = $('uls-conso-table'), cardsBox = $('uls-conso-cards');
      const tableCard = tbl ? tbl.closest('.card') : null;
      if (tableCard) tableCard.classList.toggle('hidden', v === 'cards');
      if (cardsBox) cardsBox.classList.toggle('hidden', v !== 'cards');
      const tg = $('uls-conso-view'); if (tg) tg.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.v === pref));
      if (window.lucide) { try { lucide.createIcons(); } catch (e) {} }
    }
    // Conso Ulys ADOSSÉE à une facture réellement présente (même règle partout).
    function ulsBacked(){
      if (!conso) return [];
      const ulsFac = (window.FP_DATA.factures || []).filter(isUlys);
      const facNums = new Set(ulsFac.map(f => String(f.numeroFacture || '').trim()).filter(Boolean));
      const facMois = new Set(ulsFac.map(f => (f.date || '').slice(0, 7)).filter(Boolean));
      return conso.filter(c => { const n = String(c.numeroFacture || '').trim(); return n ? facNums.has(n) : facMois.has(c.mois); });
    }
    // Période choisie (mois rapide OU dates) → { src, label }. Partagée table + exports.
    function ulsPeriod(){
      const sel = $('uls-conso-mois');
      const from = $('uls-conso-from').value, to = $('uls-conso-to').value;
      const dateMode = !!(from || to);
      const clr = $('uls-conso-clear'); if (clr) clr.classList.toggle('hidden', !dateMode);
      if (sel){ sel.disabled = dateMode; sel.style.opacity = dateMode ? '0.5' : ''; }
      const backed = ulsBacked();
      if (dateMode){
        const fromM = from ? from.slice(0, 7) : null, toM = to ? to.slice(0, 7) : null;
        return { src: backed.filter(c => (!fromM || (c.mois || '') >= fromM) && (!toM || (c.mois || '') <= toM)),
                 label: (from ? FP.date(from) : '…') + ' → ' + (to ? FP.date(to) : '…') };
      }
      const mois = (sel && sel.value) || 'all';
      if (mois === 'all') return { src: backed.slice(), label: 'Toutes les périodes' };
      return { src: backed.filter(c => c.mois === mois), label: moisLabel(mois) };
    }
    function ulsExportRows(){ return ulsPeriod().src; }
    const _ulsRe = () => renderConso();
    $('uls-conso-mois').addEventListener('change', _ulsRe);
    $('uls-conso-from').addEventListener('change', _ulsRe);
    $('uls-conso-to').addEventListener('change', _ulsRe);
    $('uls-conso-clear').addEventListener('click', () => { $('uls-conso-from').value = ''; $('uls-conso-to').value = ''; renderConso(); });
    { const vt = $('uls-conso-view'); if (vt) vt.querySelectorAll('button').forEach(b => b.addEventListener('click', () => { try { if (window.FP && FP.settings) { const s = FP.settings.get(); s.consoView = b.dataset.v; FP.settings.save(s); } } catch (e) {} applyUlsView(); })); }
    if (FP.filterResetButton) FP.filterResetButton($('uls-conso-mois').closest('div'), { onReset: () => { $('uls-conso-mois').value = 'all'; $('uls-conso-from').value = ''; $('uls-conso-to').value = ''; renderConso(); } });
    if ($('uls-an-csv')) $('uls-an-csv').addEventListener('click', () => {
      const rows = ulsExportRows(); if (!rows.length) { if (FP.toast) FP.toast('Aucune donnée à exporter'); return; }
      const cols = ['mois', 'conducteur', 'numeroFacture', 'nb_trajets', 'km', 'total_ttc'];
      const head = ['Mois', 'Conducteur', 'N° facture', 'Trajets', 'Km', 'TTC'];
      const numCols = { nb_trajets:1, km:1, total_ttc:1 };
      const src = rows.slice().sort((a, b) => String(a.mois).localeCompare(String(b.mois)));
      if (FP.downloadXlsx) {
        const data = src.map(c => cols.map(k => { const v = c[k]; if (numCols[k]) { const n = Number(v); return isFinite(n) ? n : ''; } return v == null ? '' : v; }));
        FP.downloadXlsx('ulys-conso', head, data, { sheet: 'Ulys' }); return;
      }
      const q = v => { const s = String(v == null ? '' : v); return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
      const lines = ['sep=;', head.join(';')].concat(src.map(c => cols.map(k => q(c[k])).join(';')));
      const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'ulys-conso.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1500);
    });
    if ($('uls-an-pdf')) $('uls-an-pdf').addEventListener('click', () => {
      if (!(FP.fiche && FP.fiche.open)) return; const { src: rows, label } = ulsPeriod(); if (!rows.length) { if (FP.toast) FP.toast('Aucune donnée sur la période'); return; }
      const g = {}; rows.forEach(c => { const n = c.conducteur || '—'; const d = g[n] || (g[n] = { nom:n, trajets:0, km:0, ttc:0 }); d.trajets += Number(c.nb_trajets) || 0; d.km += Number(c.km) || 0; d.ttc += Number(c.total_ttc) || 0; });
      const list = Object.values(g).sort((a, b) => b.ttc - a.ttc);
      FP.fiche.open({ key: 'ulys', title: 'Relevé Ulys — péages' + (label && label !== 'Toutes les périodes' ? ' — ' + label : ''), rows: list, cols: [
        { id: 'nom', label: 'Conducteur', def: true, get: r => r.nom },
        { id: 'trajets', label: 'Trajets', def: true, align: 'right', get: r => r.trajets ? String(r.trajets) : '—', sum: r => r.trajets, fmt: t => String(Math.round(t)) },
        { id: 'km', label: 'Km', def: true, align: 'right', get: r => r.km ? FP.num(r.km) + ' km' : '—', sum: r => r.km, fmt: t => FP.num(Math.round(t)) + ' km' },
        { id: 'ttc', label: 'TTC', def: true, align: 'right', get: r => FP.euro(r.ttc), sum: r => r.ttc },
      ] });
    });

    window.renderUlys = () => { render(); if (!consoLoaded) loadConso(); else renderConso(); };
    document.addEventListener('fp:data-ready', () => { if (!$('view-ulys').classList.contains('hidden')){ render(); if (consoLoaded) renderConso(); } });

    // ── Exposé pour l'IMPORT EN LOT : router les relevés Ulys vers CE traitement dédié (détail par
    //    collaborateur ancré sur le badge). Détecteur = lecture texte + parseUlys (n° + TTC présents).
    FP._importUlysReleves = handleUlysImport;
    window.__facIsUlysStatement = async (file) => {
      try {
        if (!(file.type === 'application/pdf' || /\.pdf$/i.test(file.name))) return false;
        let text = await ulysPdfToText(file);
        if (!text || text.replace(/\s/g, '').length < 80) return false; // OCR = trop coûteux juste pour détecter
        if (!/ulys|vinci\s*autoroute/i.test(text)) return false;
        const p = parseUlys(text); return !!(p && p.numero && p.ttc != null);
      } catch (e) { return false; }
    };
  })();

      return true;
    }catch(e){ console.error('[FP.mountUlys]', e); return false; }
  };
})();
