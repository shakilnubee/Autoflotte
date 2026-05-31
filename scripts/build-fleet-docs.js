// Script ponctuel : croise les fichiers Drive (permis + mémos assurance) avec la flotte
// et génère assets/js/fleet-docs.js. Lancé manuellement par Claude, pas embarqué dans le site.
const fs = require('fs');
const path = require('path');

// --- Charge data.js pour récupérer la flotte (immat + chauffeur) ---
global.window = {};
const dataJs = fs.readFileSync(path.join(__dirname, '../assets/js/data.js'), 'utf8');
eval(dataJs.replace(/^﻿/, ''));
const vehicules = global.window.FP_DATA.vehicules;

// --- Normalisation ---
const stripAccents = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
const normImmat = (s) => stripAccents(String(s || '')).toUpperCase().replace(/[^A-Z0-9]/g, '');
const tokens = (s) => stripAccents(String(s || '')).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean);
const firstNameKey = (s) => tokens(s)[0] || '';

// --- Mémos assurance FRANCE (titre → id), nommés par immatriculation ---
const memos = [
  ['ET 095 LV','1oV_3PEqlFCmZed1XqJO5lSGjeG1dJRYK'],['FT-338-AJ','1HX34MyRmDqpcUsMTe-QnXCmDa35MKI9h'],
  ['ED-160-TZ','1oeRctB9cZmqn8__jXdeKDTj2CsTfKOh_'],['GJ-529-WE','1aav0hed8Xsbu457Wlt1I_VwohRC4uo_g'],
  ['GP-795-YL','1XCJ7uGJkvWen0o-3n2aVGJ_v3z3-u0sn'],['FZ-501-YZ','1Mvjqs9qnpSMj1l5o3H6qJcgNChMEAQJo'],
  ['FT-671-XC','1kGKS3kPUmm44mQlAQSfv2sT-rR9PQW6y'],['GC-885-LB','13nWRpfZm_7LHl3ZzY08MJSomwf6mDzRb'],
  ['FQ-695-MW','1M9_-NdbUi_KemUa3q-kxZVjLpxOUXiVE'],['FF-304-GL','1hv0tgmVlxIpw6m6q5Za4Rd4R2h493CxU'],
  ['GR-467-HP','1-REQVXpe1WsDJe3shh2dPsMFWnQpHaxs'],['GT-818-LC','1Q4AR8_mO7fUMqq7Hk-QNiZV8bhJm6UgP'],
  ['GR 019 ZG','1RmjoGJKXGBGwwsQTh1c-qZI5HecQfjRh'],['GR-585-HP','1W84ECQA9XYmXKn_pJg0TeeJvxdTmwO6O'],
  ['GR-302-HP','1Qr9Dl7KFr7xOxI9IM3DUfsvTDvDXnZYQ'],['GQ-470-ZN','1Xyu-s7uCGIBnt1QH87NR-sklPW9Y0r_m'],
  ['GE-948-WY','1aRhfnhUhLYl9U3H-bH7DXuL-HUAoaTBf'],['FS-998-XS','1vw73wuUyYtYwDdnFT5HPzpQaUwhJBFpJ'],
  ['GW-173-JV','1E1AkhiAnozFK6p2FFYfqiINA72dqeOte'],['GY-860-FG','1v40aiccbVRndJCbw3EpYHbkrMc1s0_1x'],
  ['GW-075-EZ','1ViRep019R7svGiEad_1sK4d1doCRyGgn'],['GW-087-EZ','1suDQ6tPgYVVlCqtySKynJsgTVoWmee-d'],
  ['GT-565-XR','1dAdcMixMBu9wQmZpfdArBNlJq-MRa7X4'],['GR-745-LR','1JQchfGxdlM7TgNORk4BYP1NdwQokAGLI'],
  ['GP-333-QJ','1ygVM8d9nIXwlwWo3Q6V20SRmx-xMZ-FT'],['GH-994-AR','1JTO69qaolS5hln0Sdevf3bo_8zndb27n'],
  ['GM-548-QA','18Alw3KKq_k2qlGeH_tnS3ryYJT-O6AC0'],['GK-281-CC','1CH0uc_EBOt7F85qXmodpl1L4-uNo8dK2'],
  ['GE-349-FZ','1QhO_RHcWWf3T8tBkO61CUvrPwzzecMwv'],['GD-056-CR','1XlrDs2q06mL3Ejc1ze34lSuMj2Y8X1Bc'],
  ['GA-333-PZ','1nsN5JDlCgPnXQjUvS8gVOhKibEesoEYQ'],['FZ-301-YZ','1zN5AiWW_vGvha4R03QuYwNvNPBKQ8Rrr'],
  ['GA-313-PK','1-SK8d8WmnzEWd5qyy2oOkWFwU4ztqGxr'],['FS-224-PB','1yTMWNrGOjqmHyS7R6xTjEs8EVFFNkbH2'],
  ['FR-449-RK','1Ok9UXBboSEhd6OjLQQYhEtsrOSv1d9Lj'],['FF-777-XK','1r0FQl6v0m9yzFgTwPisGw0RkWLUAtxoQ'],
  ['FR-141-MP','1niJ2QEKsQoFNzYVXuGoPhqKnQmsCZXtR'],['EV-499-AY','1x6AunctOtDCP5yB-rjGPUOfaATikHzW7'],
  ['EB-516-ZY','1_RNCb4lXri_8Cjpb6J2SshPfSLmDLwnt'],['DZ-170-WT','1LbFS1-Y27pnQFBGTxe9R20539ZoT70Sw'],
  ['FJ-607-QH','1ft2-T2_YBJs8SHiGmTHJtGgBOriahhGo'],['HJ-804-VM','1_L9D2bL-ds6GosAE2C6Pw64iPhp4VMTv'],
  ['HJ-181-RN','1hiPS5j3uRvnuNlwuNREeJbovuiSwXBbB'],['HH-285-FL','1XJDVOm1f03DYREqsALneM0HA1kCH5J-j'],
  ['HH-464-LQ','1SAwSp0ofZgSUfB2MCk1hw9X0c_ZJqY4R'],['HH-458-LQ','10c7gOy7ivXbdlrDFrSKx9ebGZBvQTTV5'],
  ['HH-613-KE','1Bxacg6JCmFB2_o4QuAiiCc566FzN4FFJ'],['HG-763-VP','1Z44LPDV4peQ8aVhkx1U1f9A8B1WNIoCY'],
  ['HF-749-VD','1SExsAIraQma4jDjUana_7S0nbqOrTmFW'],['HG-709-CH','1w7m7h9kRULGFLOum-34quc1x_nT1_Ts3'],
  ['HF-477-XW','1HcC9OvaMnchQ0Z_WIZ-Pmx3mwn2wO9e7'],['HE-739-WP','1E5b8uIf-mIE2WRGb0L5aEYFMLQU-fOEH'],
  ['HB-733-DE','1gtXuixV6rMtGjyBr0HufVoSUinp0JWdd'],['HB-844-DE','1ZXZl4D_4EInw26qVyQWbfQcIlRRDlhwE'],
];

// --- Permis (titre → id) ---
const permisFiles = [
  ['Permis Maxime GOV','1G2j9SKnq0yIYDyMRFzXJVF-s6nHRGa2L'],['Permis Thierry GOV','16EIxAy9jHU_BvqqqGsg3o-vYSSf4JwLB'],
  ['ROUDAUT Pauline','1VfkZ1M4QeDZL6qRD7MxJT1Gu3YPRJK33'],['BAUDRY Mona','14vmu863HLN89_UrE_0-1L_VxxaUtfNmW'],
  ['ROCHET Jocelyn','1CKJ9Gi2m6tSGYc7gzWJlJv-PpaLFBVbl'],['GOV Jimmy','1f6P931T4rdDcF7xv6jjLkzEbY8AD8qTb'],
  ['Enguerrand Permis','1dO836DHDqlY7_LBYYOcveoK4AMSU0ELX'],['ROY Alice','1s4keZmc0rv3rwMQbsiSY2bDI0nzKMDLX'],
  ['DIKOUME Daniel','1r8EEHC8IFpJgcPk_S-B9OKLZ6qE_4VR2'],['DE MESMAY Mathieu','1URDSUuoz_nZqN5KQsh6PSbZ--ctWc1bM'],
  ['MANOHA Geoffrey','1PzXQwJBVMPYHydqxF2pw4PG0p305flY3'],['CHEN Guangyue (Conu)','1AP9lPpyQW8WDXRzP0aeAJVPD8n0yruow'],
  ['TRAN Eugénie','1iTUQHNA7YXREC_3zi3n_eWunz-sKsURm'],['LE GUENNEC Gaetan','1G88hfW1NTAgxTqZ-ARNS1mdDv8MWJLk5'],
  ['ZHANG Lucie','1O0phxaBsl5wGfI8z3KRO3Mvx6QScWkIs'],['MAYA Pedro','1pjkghjcLdcPu-P6YjxDaGdUGAyVN99ym'],
  ['SITOUAH Ahmed','1io2Jv3WQ7gjELBYsLLx-sGg1jBbbJsL2'],['MANSOURI Nawelle','1ysxYMm4g9pRxnturJyGRTJc-xtdiLrY0'],
  ['DA COSTA Megane','1-joos2TmftDIf-mCi1zj-ZKpXTLYjP2T'],['WEN Shaohui','1hAXkWw0LPR-yXzIG5qpFe5h2lV8k83wa'],
  ['WU Jennifer','1E2zJF4TL2dJ03k5xKExiw3wxGLzlKvJy'],['ANADIN Benisoi','1IoOAr-J-5ufkSvfMMmQGac8Y47U3Qkh8'],
  ['LAMARQUE-BRUNET Romuald','12PdP496oowijBYt2tY6ogA3bMZqLL_YE'],['GUIEAU Ambre','13UJLk436wBPjCCaYi_PyC86GZWadeM8z'],
  ['DUVIGNAC François-Xavier','1MMmwgCiaQBhJyV0x66EN1640wnz4_ex4'],['BEUN Frédéric','1JAumdKRJS1kMyD26fOGU3Xyn5ZU39zj-'],
  ['RIOU Nicolas','1K7wUlrgLySJfHnBvCv4oIOFTDhsLJ2hg'],['LENOIR Guerric','11uj6lRKWD_bsfDQCldW7o90wKF-t-pxA'],
  ['BICHERON Martin','1R1J8h0xaqawJWuO-SsJBs2dCL0gjjDI_'],['HELAL Fahissal','1w6T_p-JohGelppusn8HJXS8APnn64qT3'],
  ['DONCARLI Gregory','127QYF60tr9akRYISlFV0vAjfe7W7XLNX'],['DAI GOV Xiu-Feng','1c6ReGqbSlv5VNlYHIDqA2N6FvSdvvn3P'],
  ['MONIAK Julien','1SilbqJRoB_4RpJY-cTJOsDm6L730O7C1'],['DEPAUX Jeremie','1niHCafnYaTCeAPKKu70V7X47J32smk9U'],
  ['LENNON Charles','13NP91iSm44TE12qi2PRHpn1vGV0n9wQr'],['LEJOT Mathieu','1LQeFAF-BkLXaJ5Z-gBXybMqRMVK2XX11'],
  ['GOV Philippe','1L2TPdHrMrMHQJK2-fVj0xN5tYAD-6zZ_'],['OUATTARA Youssouf','1qRqlO8pv_p4u5xTFQSDh2aCALwHEdApO'],
  ['AOURAGHE Halim','1nTChHfNHh3RUw-aHUyNiMxqP6LyeHvvi'],
];

const TAGS = new Set(['gov','permis','de','le','dai','la','du','des']);

// === Mémos assurance : clé = immat normalisée ===
const fleetImmats = new Set(vehicules.map(v => normImmat(v.immat)));
const assurance = {};
const memosUnmatched = [];
memos.forEach(([title, id]) => {
  const key = normImmat(title);
  if (fleetImmats.has(key)) assurance[key] = id;
  else memosUnmatched.push(title);
});

// === Permis : clé = prénom normalisé du chauffeur ===
// Prénoms de chauffeurs présents dans la flotte (hors étiquettes non-personnes)
const NON_PERSONS = new Set(['siege','depot','navette','vendu','x','fenwick','']);
const driverNames = {}; // key -> label affiché
vehicules.forEach(v => {
  const raw = (v.chauffeur || '').trim();
  const key = firstNameKey(raw);
  if (!NON_PERSONS.has(key)) driverNames[key] = raw;
});

// Index des fichiers permis par token
const permisByToken = {};
permisFiles.forEach(([title, id]) => {
  tokens(title).forEach(tok => {
    if (TAGS.has(tok) || tok.length < 2) return;
    (permisByToken[tok] = permisByToken[tok] || []).push({ title, id });
  });
});

const permis = {};
const matched = [];
const driversUnmatched = [];
Object.keys(driverNames).forEach(key => {
  const hits = permisByToken[key] || [];
  if (hits.length === 1) {
    permis[key] = { id: hits[0].id, name: hits[0].title };
    matched.push(`${driverNames[key]}  →  ${hits[0].title}`);
  } else if (hits.length > 1) {
    driversUnmatched.push(`${driverNames[key]} (ambigu : ${hits.map(h=>h.title).join(' / ')})`);
  } else {
    driversUnmatched.push(driverNames[key]);
  }
});

// Rattachements manuels (cas évidents non détectés automatiquement)
const MANUAL = {
  fx: { id: '1MMmwgCiaQBhJyV0x66EN1640wnz4_ex4', name: 'DUVIGNAC François-Xavier' },
};
Object.entries(MANUAL).forEach(([key, val]) => {
  if (driverNames[key] && !permis[key]) {
    permis[key] = val;
    matched.push(`${driverNames[key]}  →  ${val.name} (manuel)`);
    const idx = driversUnmatched.indexOf(driverNames[key]);
    if (idx >= 0) driversUnmatched.splice(idx, 1);
  }
});

// Permis non rattachés à un chauffeur actuel
const usedIds = new Set(Object.values(permis).map(p => p.id));
const permisUnused = permisFiles.filter(([t,id]) => !usedIds.has(id)).map(([t]) => t);

// === Génère fleet-docs.js ===
const out = `// Auto-flotte — documents Google Drive (cartes grises via data.js cgFileId, assurance, permis)
// Généré par scripts/build-fleet-docs.js — ne pas éditer à la main.
// Clés : assurance = immatriculation normalisée (sans tirets) ; permis = prénom normalisé.
window.FP_DOCS = ${JSON.stringify({ assurance, permis }, null, 2)};
`;
fs.writeFileSync(path.join(__dirname, '../assets/js/fleet-docs.js'), out);

// === Rapport ===
console.log('=== ASSURANCE ===');
console.log(`Mémos rattachés à un véhicule : ${Object.keys(assurance).length}`);
console.log(`Mémos sans véhicule correspondant : ${memosUnmatched.length}`, memosUnmatched);
const vehSansAssurance = vehicules.filter(v => !assurance[normImmat(v.immat)]).map(v => v.immat);
console.log(`Véhicules sans mémo assurance (${vehSansAssurance.length}) :`, vehSansAssurance.join(', '));
console.log('\n=== PERMIS ===');
console.log(`Chauffeurs rattachés à un permis : ${matched.length}`);
matched.forEach(m => console.log('  ✓ ' + m));
console.log(`\nChauffeurs SANS permis trouvé (${driversUnmatched.length}) :`);
driversUnmatched.forEach(d => console.log('  ✗ ' + d));
console.log(`\nPermis non rattachés à un chauffeur actuel (${permisUnused.length}) :`);
permisUnused.forEach(p => console.log('  · ' + p));
