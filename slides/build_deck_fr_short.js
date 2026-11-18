// Deck court FR (10 slides) : traduction de build_deck_en_short.js.
// Build (from the project root): PPTX_SKILL=<skill dir> NODE_PATH=slides/node_modules node slides/build_deck_en.js
// Output: slides/BSA_night_IR_EN.pptx. Assets: slides/make_assets.py (same images as the French deck).
const path = require("path");
const pptxgen = require("pptxgenjs");
const { applyTheme } = require(path.join(process.env.PPTX_SKILL, "scripts/apply_theme.js"));

const A = (f) => path.join(__dirname, "assets", f);
const OUT = path.join(__dirname, "BSA_nuit_IR_FR_court.pptx");

// Night ink dominates; thermal orange = the single sharp accent; cool blue = RGB; amber = highlights on dark.
const THEME = {
  name: "Nuit thermique", headFontFace: "Cambria", bodyFontFace: "Calibri",
  colors: { dk1: "14182E", lt1: "FFFFFF", dk2: "3A4160", lt2: "EEF1F7",
            accent1: "E8743B", accent2: "4C7BD9", accent3: "F2B33D", accent4: "8A90A6", accent5: "2E9E78", accent6: "C8414F",
            hlink: "4C7BD9", folHlink: "8A90A6" },
};
const H = THEME.colors; // hex: charts only (pptxgenjs needs hex there)

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.333 x 7.5 in
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
pres.title = "Détection multimodale RGB-thermique de piétons avec peu de données annotées";
pres.author = "Projet personnel";
const C = pres.SchemeColor;

const FOOT = "Voir la nuit sans données de nuit · projet personnel, données publiques LLVIP";
const foot = { text: { text: FOOT, options: { x: 0.6, y: 7.0, w: 9, h: 0.3, fontSize: 10, color: C.accent4, margin: 0 } } };
const num = { x: 12.1, y: 7.0, w: 0.6, h: 0.3, fontSize: 10, color: C.accent4, align: "right" };
pres.defineSlideMaster({
  title: "TITLE", background: { color: C.text1 },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: 0.8, y: 1.9, w: 7.0, h: 1.9, fontSize: 40, bold: true, color: C.background1, valign: "bottom", align: "left", margin: 0 }, text: "" } },
    { placeholder: { options: { name: "body", type: "body", x: 0.8, y: 4.0, w: 7.0, h: 1.5, fontSize: 18, color: C.accent3, valign: "top", align: "left", margin: 0 }, text: "" } },
  ],
});
pres.defineSlideMaster({
  title: "SECTION", background: { color: C.text1 },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: 0.8, y: 1.2, w: 11.7, h: 1.2, fontSize: 40, bold: true, color: C.background1, valign: "bottom", align: "left", margin: 0 }, text: "" } },
    foot,
  ],
  slideNumber: num,
});
pres.defineSlideMaster({
  title: "CONTENT", background: { color: C.background1 },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: 0.6, y: 0.55, w: 12.1, h: 0.85, fontSize: 30, bold: true, color: C.text1, valign: "middle", align: "left", margin: 0 }, text: "" } },
    foot,
  ],
  slideNumber: num,
});
pres.defineSlideMaster({
  title: "DARK", background: { color: C.text1 },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: 0.6, y: 0.55, w: 12.1, h: 0.85, fontSize: 30, bold: true, color: C.background1, valign: "middle", align: "left", margin: 0 }, text: "" } },
    foot,
  ],
  slideNumber: num,
});

// ---------------- helpers (fresh option objects every call) ----------------
const shadow = () => ({ type: "outer", color: "000000", opacity: 0.12, blur: 6, offset: 2, angle: 90 });
let n = 0; const nm = (s) => `${s} ${++n}`;
function card(s, x, y, w, h, fill = C.background2, line) {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, fill: { color: fill }, line: { color: line || fill, width: line ? 1 : 0.75 }, rectRadius: 0.12, shadow: shadow(), objectName: nm("Card") });
}
function txt(s, text, o) { s.addText(text, Object.assign({ isTextBox: true, margin: 0, valign: "top", objectName: nm("Text") }, o)); }
function dot(s, x, y, label, d = 0.5, fill = C.accent1) {
  s.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: fill }, line: { color: fill }, objectName: nm("Dot") });
  txt(s, label, { x, y, w: d, h: d, fontSize: d > 0.45 ? 16 : 12, bold: true, color: C.background1, align: "center", valign: "middle" });
}
function kicker(s, label, dark = false) { txt(s, label.toUpperCase(), { x: 0.6, y: 0.22, w: 9, h: 0.3, fontSize: 12, bold: true, color: dark ? C.accent3 : C.accent1, charSpacing: 1 }); }
function arrow(s, x, y, w = 0.35, h = 0.3, color = C.accent4) {
  s.addShape(pres.shapes.RIGHT_ARROW, { x, y, w, h, fill: { color }, line: { color }, objectName: nm("Arrow") });
}
function img(s, file, x, y, w, h, alt) { s.addImage({ path: A(file), x, y, w, h, altText: alt, objectName: nm("Image") }); }
function stat(s, x, y, w, big, small, col = C.accent1, bigSize = 36) {
  txt(s, big, { x, y, w, h: 0.8, fontSize: bigSize, bold: true, color: col, fontFace: THEME.headFontFace });
  txt(s, small, { x, y: y + 0.8, w, h: 0.75, fontSize: 13, color: C.text2 });
}
function para(s, runs, o) { // runs: [text, {bold, color}] list -> paragraphs
  txt(s, runs.map(([t, opt], i) => ({ text: t, options: Object.assign({ breakLine: i < runs.length - 1 }, opt || {}) })), Object.assign({ fontSize: 15, color: C.text1, paraSpaceAfter: 8 }, o));
}
function chartBase(extra) {
  return Object.assign({
    catAxisLabelColor: H.dk2, valAxisLabelColor: H.dk2, catAxisLabelFontSize: 12, valAxisLabelFontSize: 11,
    catAxisLabelFontFace: "+mn-lt", valAxisLabelFontFace: "+mn-lt", dataLabelFontFace: "+mn-lt", legendFontFace: "+mn-lt",
    titleFontFace: "+mn-lt", valGridLine: { color: "D9DDE8", size: 0.75 }, catGridLine: { style: "none" },
    legendFontSize: 11, legendColor: H.dk2, dataLabelColor: H.dk1, dataLabelFontSize: 11, titleFontSize: 13, titleColor: H.dk2,
    objectName: nm("Chart"),
  }, extra);
}
function stripLabels(s, x, y, w, labels, colors) { // labels above a 4-cell image strip (cells 320 px, gaps 8 px, total 1304)
  const cw = w * 320 / 1304, g = w * 8 / 1304;
  labels.forEach((l, i) => txt(s, l, { x: x + i * (cw + g), y, w: cw, h: 0.35, fontSize: 13, bold: true, color: (colors && colors[i]) || C.text1, align: "center" }));
}
const SEC = ["1 · Objectif", "2 · Méthodes d'étiquetage", "3 · Scénarios", "4 · Résultats", "5 · Leçons"];
let sec = -1;
function section(i) { sec = i; pres.addSection({ title: SEC[i] }); }
function slide(master) { return pres.addSlide({ masterName: master, sectionTitle: SEC[sec] }); }
const fmt = (v) => v.toFixed(3).replace(".", ",");

function reasonCard(sl, x, y, w, h, calc, reason) {
  card(sl, x, y, w, h);
  para(sl, [["Le calcul", { bold: true, color: C.accent1 }], [calc, {}], ["La raison", { bold: true, color: C.accent1 }], [reason, { bold: true }]],
       { x: x + 0.25, y: y + 0.15, w: w - 0.5, h: h - 0.3, fontSize: 13, paraSpaceAfter: 5 });
}

// ======================= 1. OBJECTIF =======================
section(0);
let s = slide("TITLE");
s.addText("Détection multimodale RGB–thermique de piétons avec peu de données annotées", { placeholder: "title", fontSize: 30 });
s.addText([{ text: "Voir la nuit sans données de nuit", options: { italic: true, bold: true, fontSize: 20, color: C.accent3, breakLine: true } },
           { text: "Objectif : détecter les piétons en infrarouge thermique avec 0 à 100 images IR annotées, et continuer à détecter quand une caméra tombe en panne", options: { fontSize: 15, color: C.background1 } }],
          { placeholder: "body", paraSpaceBefore: 0, paraSpaceAfter: 8 });
img(s, "ir_panel.jpg", 8.3, 1.9, 4.4, 3.33, "Image infrarouge de nuit avec trois piétons détectés");
txt(s, "Caméra thermique, nuit (LLVIP) : 3 piétons détectés", { x: 8.3, y: 5.35, w: 4.4, h: 0.4, fontSize: 11, color: C.accent4 });
txt(s, "Projet personnel · données publiques (LLVIP) · GPU loués · YOLO11s · mAP50-95 sur l'IR réel de test", { x: 0.8, y: 6.7, w: 9, h: 0.4, fontSize: 12, color: C.accent4 });
s.addNotes("Objectif du projet.");

s = slide("CONTENT"); kicker(s, SEC[0]);
s.addText("Deux budgets : l'IR annoté est rare, les paires sont gratuites", { placeholder: "title" });
[["12 025", "images IR annotées : la référence, 0,623 mAP50-95", C.text1], ["0 à 100", "images IR annotées : le budget réaliste", C.text1], ["1 000", "paires RGB / IR non annotées, alignées au pixel près", C.accent1]]
  .forEach(([b, t, col], i) => { const x = 0.6 + i * 4.1; card(s, x, 1.65, 3.8, 1.9); stat(s, x + 0.3, 1.8, 3.2, b, t, col, 40); });
img(s, "nominal_row.jpg", 0.6, 3.95, 8.2, 2.19, "Vue RGB, vue IR et vue fusionnée de la même scène, têtes floutées");
txt(s, "RGB · IR · fusion : même scène, têtes floutées", { x: 0.6, y: 6.2, w: 8.2, h: 0.3, fontSize: 11, color: C.accent4 });
txt(s, [{ text: "Jeu de données : LLVIP ", options: { bold: true, color: C.accent1 } },
        { text: "(Jia et al., ICCV Workshops 2021) · 15 488 paires visible / thermique alignées au pixel, scènes de rue de nuit · 12 025 train / 3 463 test", options: { color: C.text1 } }],
    { x: 0.6, y: 6.5, w: 12.1, h: 0.35, fontSize: 12 });
card(s, 9.1, 3.95, 3.6, 2.35);
para(s, [["Les deux questions", { bold: true, color: C.accent1 }], ["Avec 0 à 100 labels IR et des paires gratuites, jusqu'où approcher 0,623 ?", {}], ["Si une caméra tombe, la détection survit-elle ?", {}]],
     { x: 9.35, y: 4.1, w: 3.1, h: 2.1, fontSize: 15 });
s.addNotes("mAP50-95 : précision des boîtes, de 0 à 1. Toutes les détections sont testées sur les 3 463 images d'IR réel de test (scènes jamais vues).");

// ======================= 2. MÉTHODES D'ÉTIQUETAGE =======================
section(1);
s = slide("CONTENT"); kicker(s, SEC[1]);
s.addText("Deux façons d'obtenir gratuitement des labels IR", { placeholder: "title" });
// A. traduire
card(s, 0.6, 1.55, 6.0, 5.1);
txt(s, "A. Traduire le RGB en IR", { x: 0.85, y: 1.7, w: 5.5, h: 0.45, fontSize: 18, bold: true, color: C.accent1 });
txt(s, "pix2pix-turbo (SD-Turbo + LoRA) entraîné sur 100 / 1 000 paires → IR synthétique, qui garde les vraies boîtes du RGB", { x: 0.85, y: 2.15, w: 5.5, h: 0.6, fontSize: 13, color: C.text2 });
stripLabels(s, 0.85, 2.85, 5.5, ["RGB (entrée)", "synth. T100", "synth. T1000", "IR réel"], [C.accent2, C.accent1, C.accent1, C.text1]);
img(s, "gen_turbo_row_people.jpg", 0.85, 3.2, 5.5, 1.08, "Piétons : gris dans l'IR synthétique, chauds dans l'IR réel");
para(s, [["12 025 images d'IR synthétique, labels = annotations du RGB réel.", {}],
         ["Les piétons sortent gris, pas chauds : le générateur copie la luminosité du RGB, pas la température.", { bold: true }]],
     { x: 0.85, y: 4.5, w: 5.5, h: 2.0, fontSize: 13, paraSpaceAfter: 6 });
// B. pseudo-étiqueter
card(s, 6.75, 1.55, 5.95, 5.1);
txt(s, "B. Pseudo-étiqueter l'IR réel", { x: 7.0, y: 1.7, w: 5.5, h: 0.45, fontSize: 18, bold: true, color: C.accent1 });
txt(s, "Un détecteur COCO générique (jamais vu LLVIP) tourne sur le RGB et sur l'IR ; l'union de ses boîtes (NMS 0,5) étiquette l'image IR réelle", { x: 7.0, y: 2.15, w: 5.5, h: 0.6, fontSize: 13, color: C.text2 });
s.addChart(pres.charts.BAR, [
  { name: "Précision (boîtes justes)", labels: ["COCO sur RGB", "COCO sur IR", "RGB + IR fusionnés"], values: [0.87, 0.83, 0.83] },
  { name: "Rappel (piétons trouvés)", labels: ["COCO sur RGB", "COCO sur IR", "RGB + IR fusionnés"], values: [0.34, 0.42, 0.50] }],
  chartBase({ x: 7.0, y: 2.8, w: 5.5, h: 2.6, barDir: "col", barGrouping: "clustered", chartColors: [H.dk2, H.accent1], showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0.00",
    valAxisMinVal: 0, valAxisMaxVal: 1, valAxisLabelFormatCode: "0.0", showLegend: true, legendPos: "b", showTitle: true, title: "Qualité des pseudo-labels sur 1 000 paires", catAxisLabelFontSize: 11 }));
para(s, [["Possible car RGB et IR sont alignés au pixel près : une boîte se recopie telle quelle. Aucun label du dataset utilisé.", { bold: true }]],
     { x: 7.0, y: 5.6, w: 5.5, h: 0.9, fontSize: 13 });
s.addNotes("Méthode A : traduire les images, garder les labels RGB. Méthode B : garder les vraies images IR, transférer les labels d'un détecteur générique appliqué aux deux modalités. Fusionner les deux modalités fait passer le rappel des pseudo-labels de 34 % à 50 %.");

// ======================= 3. SCÉNARIOS =======================
section(2);
s = slide("CONTENT"); kicker(s, SEC[2] + " · fusion");
s.addText("Fusionner deux caméras : late fusion ou early fusion", { placeholder: "title" });
function fusionDiagram(x, title, sub, early) {
  card(s, x, 1.55, 5.9, 3.6);
  txt(s, title, { x: x + 0.3, y: 1.7, w: 5.3, h: 0.45, fontSize: 18, bold: true, color: C.accent1 });
  txt(s, sub, { x: x + 0.3, y: 2.15, w: 5.3, h: 0.45, fontSize: 13, color: C.text2 });
  const box = (bx, by, bw, bh, t, fill, col) => { s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: bx, y: by, w: bw, h: bh, fill: { color: fill }, line: { color: fill }, rectRadius: 0.08, objectName: nm("Bloc") }); txt(s, t, { x: bx, y: by, w: bw, h: bh, fontSize: 12, bold: true, color: col, align: "center", valign: "middle" }); };
  if (!early) {
    box(x + 0.3, 2.8, 1.1, 0.6, "RGB", C.accent2, C.background1); box(x + 0.3, 3.9, 1.1, 0.6, "IR", C.accent1, C.background1);
    arrow(s, x + 1.5, 2.95, 0.3, 0.3); arrow(s, x + 1.5, 4.05, 0.3, 0.3);
    box(x + 1.9, 2.8, 1.5, 0.6, "Détecteur RGB", C.text1, C.background1); box(x + 1.9, 3.9, 1.5, 0.6, "Détecteur IR", C.text1, C.background1);
    arrow(s, x + 3.5, 3.5, 0.3, 0.3);
    box(x + 3.9, 3.3, 1.7, 0.75, "Fusion des boîtes (WBF)", C.accent3, C.text1);
  } else {
    box(x + 0.3, 2.8, 1.1, 0.6, "RGB", C.accent2, C.background1); box(x + 0.3, 3.9, 1.1, 0.6, "IR", C.accent1, C.background1);
    arrow(s, x + 1.5, 3.5, 0.3, 0.3);
    box(x + 1.9, 3.15, 1.5, 1.05, "Image 4 canaux\nR · G · B · IR", C.accent3, C.text1);
    arrow(s, x + 3.5, 3.5, 0.3, 0.3);
    box(x + 3.9, 3.3, 1.7, 0.75, "Un seul détecteur", C.text1, C.background1);
  }
}
fusionDiagram(0.6, "Late fusion", "deux détecteurs indépendants, boîtes fusionnées selon leur confiance", false);
fusionDiagram(6.8, "Early fusion", "les deux images empilées, un seul réseau", true);
txt(s, "Modulaire : si une caméra meurt, l'autre détecteur continue seul.", { x: 0.9, y: 4.65, w: 5.3, h: 0.4, fontSize: 13, italic: true, color: C.text1 });
txt(s, "Plus précise, mais le réseau peut devenir dépendant de l'IR.", { x: 7.1, y: 4.65, w: 5.3, h: 0.4, fontSize: 13, italic: true, color: C.text1 });
card(s, 0.6, 5.4, 12.1, 1.25, C.text1);
para(s, [["Dropout de modalité (early fusion, à l'entraînement seulement) : ", { bold: true, color: C.accent3 }],
         ["70 % des images d'entraînement gardent RGB + IR, 15 % ont l'IR mis à zéro, 15 % le RGB mis à zéro. Le réseau apprend à détecter avec chaque capteur seul et à lire « canal à zéro = capteur absent ». Ablation : le même modèle entraîné sans dropout.", { color: C.background1 }]],
     { x: 0.85, y: 5.45, w: 11.6, h: 1.15, fontSize: 14, paraSpaceAfter: 2, valign: "middle" });
s.addNotes("Late fusion = WBF de deux détecteurs. Early fusion = un détecteur sur une image 4 canaux, avec ou sans dropout de modalité.");

s = slide("CONTENT"); kicker(s, SEC[2] + " · capteurs");
s.addText("Éprouver le système : trois familles de scénarios", { placeholder: "title" });
const vw = 1.35, vh = 1.0;
const fams = [["Capteurs normaux", "niveau de base", [["sc_rgb_nominal.jpg", "RGB nominal"], ["sc_ir_nominal.jpg", "IR nominal"]]],
              ["Capteur dégradé", "le signal existe, mais il est mauvais : l'autre capteur compense-t-il ?", [["sc_rgb_fog.jpg", "RGB brouillard"], ["sc_rgb_dark.jpg", "RGB nuit noire"]]],
              ["Capteur mort", "plus aucun signal : le système a-t-il été conçu pour perdre un capteur ?", [["sc_rgb_dead.jpg", "RGB mort"], ["sc_ir_dead.jpg", "IR mort"]]],
              ["Bonus", "peut-on halluciner le capteur manquant ?", [["sc_ir_reconstructed.jpg", "IR reconstruit depuis le RGB"]]]];
let fx = 0.6;
fams.forEach(([h, sub, ims], i) => {
  const w = ims.length * (vw + 0.15) + 0.25;
  card(s, fx, 1.6, w, 4.15, C.background2);
  txt(s, h, { x: fx + 0.15, y: 1.72, w: w - 0.3, h: 0.4, fontSize: 16, bold: true, color: i === 2 ? C.accent6 : C.accent1 });
  txt(s, sub, { x: fx + 0.15, y: 2.12, w: w - 0.3, h: 0.95, fontSize: 12, color: C.text2 });
  ims.forEach(([f, l], j) => {
    const ix = fx + 0.15 + j * (vw + 0.15);
    img(s, f, ix, 3.3, vw, vh, l);
    if (f.includes("dead")) txt(s, "aucun signal", { x: ix, y: 3.3, w: vw, h: vh, fontSize: 12, bold: true, color: C.accent6, align: "center", valign: "middle" });
    txt(s, l, { x: ix, y: 4.4, w: vw, h: 0.75, fontSize: 12, bold: true, color: C.text1, align: "center" });
  });
  fx += w + 0.2;
});
card(s, 0.6, 5.95, 12.1, 0.75, C.text1);
txt(s, "Chaque scénario est appliqué aux 3 463 paires RGB + IR réelles de test ; chaque détecteur est noté par le même évaluateur (mAP50-95).",
    { x: 0.85, y: 5.95, w: 11.6, h: 0.75, fontSize: 14, bold: true, color: C.background1, valign: "middle" });
s.addNotes("Brouillard : image mélangée à un voile clair + bruit. Nuit noire : gamma 2,5, gain 0,35, bruit de capteur. Mort : image entièrement noire. Reconstruit : IR généré depuis le RGB par le générateur.");

// ======================= 4. RÉSULTATS =======================
section(3);
s = slide("CONTENT"); kicker(s, SEC[3] + " · qualité des images de synthèse");
s.addText("Proche de l'IR en apparence, moins utile que le RGB", { placeholder: "title" });
const l4lab = ["IR réel (contrôle)", "IR synthétique T100", "IR synthétique T1000", "RGB réel"];
s.addChart(pres.charts.BAR, [{ name: "KID×1000", labels: l4lab, values: [0.09, 173, 163, 228] }],
  chartBase({ x: 0.6, y: 1.55, w: 4.1, h: 4.1, barDir: "col", chartColors: [H.accent5, H.accent1, H.accent1, H.accent2], showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "General",
    valAxisMinVal: 0, valAxisMaxVal: 260, valAxisLabelFormatCode: "0", showLegend: false, showTitle: true, title: "Distance à l'IR réel : KID×1000 (bas = proche)", catAxisLabelFontSize: 10 }));
s.addChart(pres.charts.BAR, [{ name: "Utilité", labels: l4lab, values: [0.623, 0.328, 0.384, 0.468] }],
  chartBase({ x: 4.85, y: 1.55, w: 4.1, h: 4.1, barDir: "col", chartColors: [H.accent5, H.accent1, H.accent1, H.accent2], showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0.000",
    valAxisMinVal: 0, valAxisMaxVal: 0.7, valAxisLabelFormatCode: "0.0", showLegend: false, showTitle: true, title: "Utilité : entraîné sur ce type → testé sur IR réel", catAxisLabelFontSize: 10 }));
txt(s, "Gauche : chaque jeu (moitié B du test) ↔ IR réel test moitié A, 1 700 images, mêmes scènes (contrôle = IR réel B ↔ A). Droite : détecteur entraîné sur 12 025 images train de ce type. FID et FD-DINOv2 donnent le même ordre.",
    { x: 0.6, y: 5.75, w: 8.35, h: 0.9, fontSize: 11, color: C.accent4 });
reasonCard(s, 9.2, 1.55, 3.5, 5.1, "Le RGB est le plus loin de l'IR réel (KID 228) et le plus utile (0,468). Densité et couverture : 0 pour tous les jeux non réels.",
  "Sur l'image entière, les métriques jugent l'apparence globale, dominée par le fond (les piétons font ~3 % des pixels). Le détecteur a besoin de la forme des piétons : nette en RGB, dégradée en synthétique.");
s.addNotes("Les métriques de synthèse comparent deux jeux d'images ; l'utilité = mAP d'un détecteur entraîné uniquement sur ce jeu, testé sur l'IR réel.");

s = slide("CONTENT"); kicker(s, SEC[3] + " · qualité des images de synthèse");
s.addText("Sur les piétons, la distance DINOv2 suit l'utilité", { placeholder: "title" });
const BEST = "FD-DINOv2 · boîtes";
const rho = [[BEST, 0.94], ["FD-DINOv2 · image", 0.90], ["KID · boîtes", 0.85], ["FID · image", 0.80], ["KID · image", 0.75], ["FID · boîtes", 0.73],
             ["Détectabilité (détecteur IR)", 0.51], ["FD-YOLO-IR · boîtes", 0.49], ["Corrélation de contraste · boîtes", 0.49], ["L1 apparié · boîtes", 0.28], ["Erreur de contraste · boîtes", 0.21], ["FD-YOLO-IR · image", 0.15]].reverse();
s.addChart(pres.charts.BAR, [{ name: "Spearman ρ", labels: rho.map((r) => r[0]), values: rho.map((r) => r[1]) }],
  chartBase({ x: 0.6, y: 1.5, w: 5.6, h: 5.15, barDir: "bar", chartColors: rho.map((r) => r[1] >= 0.62 ? (r[0] === BEST ? H.accent1 : H.accent4) : H.accent6),
    showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0.00", valAxisMinVal: 0, valAxisMaxVal: 1.1, valAxisLabelFormatCode: "0.0", showLegend: false,
    showTitle: true, title: "Corrélation de rang métrique ↔ utilité (11 jeux ; significatif si ρ ≥ 0,62)", catAxisLabelFontSize: 10 }));
img(s, "scatter_dinov2_box.png", 6.4, 1.5, 3.3, 3.0, "Nuage de points : FD-DINOv2 dans les boîtes en abscisse, utilité en ordonnée ; les 11 jeux s'alignent");
txt(s, "x : FD-DINOv2 boîtes · y : utilité", { x: 6.4, y: 4.5, w: 3.3, h: 0.3, fontSize: 10, color: C.accent4, align: "center" });
card(s, 6.4, 4.9, 3.3, 1.75);
para(s, [["11 jeux", { bold: true, color: C.accent1 }], ["IR réel, IR + VAE, gris, gris inversé, RGB, 6 générateurs ou checkpoints. Utilité : détecteur entraîné sur 3 000 images du jeu, testé sur IR réel.", {}]],
     { x: 6.55, y: 5.0, w: 3.0, h: 1.6, fontSize: 10, paraSpaceAfter: 2 });
reasonCard(s, 9.9, 1.5, 2.8, 5.15, "FD-DINOv2 sur les découpes de piétons : ρ = 0,94 (Pearson 0,98), stable si on retire un jeu. Les caractéristiques du détecteur IR : ρ ≈ 0,5.",
  "Le détecteur IR juge la ressemblance à l'IR : le RGB lui paraît étranger, mais il entraîne bien. DINOv2 décrit la forme des objets, quelle que soit la modalité.");
s.addNotes("11 jeux, 12 métriques ; la FD-DINOv2 dans les boîtes passe le seuil de Bonferroni (p < 0,004).");

s = slide("CONTENT"); kicker(s, SEC[3] + " · détection");
s.addText("Détection : transférer les labels bat traduire les images", { placeholder: "title" });
s.addChart(pres.charts.BAR, [{ name: "mAP50-95", labels: [
    "Méthode A · 12 025 IR générées (fausses) T1000, vraies boîtes RGB",
    "1 000 IR réelles, pseudo-labels du RGB seul",
    "12 025 RGB réelles, vraies boîtes (aucune IR)",
    "Méthode B · 1 000 IR réelles, pseudo-labels du RGB + IR"], values: [0.384, 0.424, 0.468, 0.529] }],
  chartBase({ x: 0.6, y: 1.55, w: 7.6, h: 4.45, barDir: "bar", chartColors: [H.accent4, H.accent4, H.accent2, H.accent1], showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0.000",
    valAxisMinVal: 0, valAxisMaxVal: 0.6, valAxisLabelFormatCode: "0.0", showLegend: false, showTitle: true, title: "Données d'entraînement de chaque YOLO11s · aucune image IR annotée à la main", catAxisLabelFontSize: 10 }));
para(s, [["Tous les scores : testés sur les 3 463 images d'IR réel de test (mAP50-95, 2 seeds). ", { bold: true, color: C.accent1 }],
         ["Références avec IR réel annoté à la main : 12 025 images = 0,623 ; meilleur score avec 100 images = 0,526.", { color: C.text1 }]],
     { x: 0.6, y: 6.05, w: 7.6, h: 0.6, fontSize: 12, paraSpaceAfter: 0 });
card(s, 8.5, 1.55, 4.2, 5.1);
txt(s, "Avec 10 images d'IR réel annotées", { x: 8.75, y: 1.65, w: 3.8, h: 0.4, fontSize: 14, bold: true, color: C.accent1 });
txt(s, "pré-entraînement (ou non), puis affinage sur 10 IR réelles · testé sur l'IR réel de test", { x: 8.75, y: 2.05, w: 3.8, h: 0.45, fontSize: 11, color: C.accent4 });
[["0,328", "sans pré-entraînement : les 10 images IR réelles seules", C.accent4], ["0,468", "pré-entraîné sur 12 025 IR générées (fausses) T100", C.accent1], ["0,500", "pré-entraîné sur 12 025 RGB réelles", C.accent2]]
  .forEach(([b, t, col], i) => { txt(s, b, { x: 8.75, y: 2.6 + i * 0.75, w: 1.4, h: 0.65, fontSize: 26, bold: true, color: col, fontFace: THEME.headFontFace, valign: "middle" }); txt(s, t, { x: 10.2, y: 2.6 + i * 0.75, w: 2.35, h: 0.65, fontSize: 12, color: C.text2, valign: "middle" }); });
para(s, [["Le pré-entraînement sur l'IR généré aide (+0,14), mais le RGB réel avec les mêmes boîtes aide plus, à tous les N (10 à 100) : le gain venait des labels RGB, pas de la traduction.", { bold: true }]],
     { x: 8.75, y: 4.95, w: 3.75, h: 1.6, fontSize: 12 });
s.addNotes("Graphique : quatre YOLO11s entraînés sans aucune image IR annotée à la main. La méthode A s'entraîne sur de l'IR généré (faux) ; les deux barres pseudo-labels s'entraînent sur de VRAIES images IR dont les labels viennent d'un détecteur COCO appliqué au RGB (ou au RGB + IR) ; la barre RGB s'entraîne sur le RGB réel avec les boîtes du dataset. Tous testés sur l'IR réel de test. 2 seeds par configuration. La méthode B, sans aucun label IR, bat toutes les méthodes à 100 labels.");

s = slide("CONTENT"); kicker(s, SEC[3] + " · robustesse");
s.addText("Robustesse : la fusion avec dropout survit à une panne", { placeholder: "title" });
const hdr = ["Scénario (test : paires RGB + IR réelles de test)", "RGB seul", "IR seul", "Late fusion", "Early + dropout", "Early sans dropout"];
const rows = [["Nominal", .516, .610, .620, .642, .610], ["RGB brouillard", .124, .610, .613, .641, .633], ["RGB nuit noire", .068, .610, .610, .617, .563],
              ["RGB mort", 0, .610, .619, .614, .550], ["IR mort", .516, 0, .514, .485, .007], ["IR reconstruit depuis le RGB", .516, .177, .507, .276, .118]];
s.addTable([hdr.map((h) => ({ text: h, options: { bold: true, color: C.background1, fill: { color: C.text1 }, fontSize: 12, align: "center", valign: "middle" } })),
            ...rows.map((r, ri) => r.map((v, ci) => {
              const o = { fontSize: 13, align: ci === 0 ? "left" : "center", valign: "middle", color: C.text1, fill: { color: ci === 4 ? C.background2 : C.background1 }, bold: ci === 4 };
              if ((ri === 4 && ci === 5) || (ri === 5 && ci === 4)) { o.color = C.accent6; o.bold = true; }
              return { text: typeof v === "number" ? fmt(v) : v, options: o };
            }))],
  { x: 0.6, y: 1.55, w: 8.1, colW: [2.6, 1.0, 1.0, 1.1, 1.2, 1.2], rowH: 0.5, border: { type: "solid", pt: 0.75, color: "D9DDE8" }, objectName: nm("Matrice robustesse") });
txt(s, "mAP50-95 · détecteurs entraînés sur le split d'entraînement · même évaluateur pour chaque case", { x: 0.6, y: 5.2, w: 8.1, h: 0.4, fontSize: 11, color: C.accent4 });
reasonCard(s, 8.95, 1.55, 3.75, 5.1, "RGB brouillard / nuit noire : l'IR et la fusion tiennent (0,61–0,64). IR mort : early fusion 0,007 sans dropout, 0,485 avec. IR reconstruit : 0,276, pire que l'IR déclaré absent.",
  "Sans dropout, le réseau s'appuie sur l'IR et une image noire est une entrée jamais vue. L'IR reconstruit ressemble à de l'IR mais porte un faux contenu : le modèle lui fait confiance et se trompe.");
card(s, 0.6, 5.75, 8.1, 0.9, C.text1);
txt(s, "Déployé : TensorRT FP16, pipeline 100 % GPU, 2,30 ms par image (435 img/s) contre 4,04 ms avec pré/post-traitement CPU, même mAP.", { x: 0.85, y: 5.75, w: 7.6, h: 0.9, fontSize: 13, bold: true, color: C.background1, valign: "middle" });
s.addNotes("Capteur dégradé : compensé par l'autre. Capteur mort : géré seulement si on l'a prévu (late fusion, ou dropout).");

// ======================= 5. LEÇONS =======================
section(4);
s = slide("DARK"); kicker(s, SEC[4], true);
s.addText("Leçons apprises", { placeholder: "title" });
const les = [["Comparer à la référence naïve la plus forte", "le RGB réel avec les mêmes boîtes bat l'IR synthétique à tous les N : le gain venait des labels"],
             ["Transférer les labels plutôt que traduire les images", "IR réel pseudo-étiqueté (RGB + IR fusionnés) : 0,529 sans aucun label IR"],
             ["Il manque de l'information au générateur, pas de la capacité", "76 % des piétons perdus sur l'IR généré T1000, dont 89 % visibles en RGB : il suit la lumière, pas la chaleur"],
             ["Mesurer les images là où regarde le détecteur", "sur l'image entière, les métriques trompent entre sources ; sur les piétons, la FD-DINOv2 suit l'utilité (ρ = 0,94)"],
             ["Un capteur mort se déclare, il ne s'hallucine pas", "dropout de modalité : IR mort 0,007 → 0,485 ; IR reconstruit 0,276"]];
les.forEach(([h, b], i) => {
  const y = 1.55 + i * 0.86;
  dot(s, 0.6, y + 0.1, "L" + (i + 1), 0.55);
  txt(s, h, { x: 1.35, y, w: 4.6, h: 0.75, fontSize: 15, bold: true, color: C.background1, valign: "middle" });
  txt(s, b, { x: 6.1, y, w: i === 2 ? 4.05 : 6.6, h: 0.75, fontSize: 13, color: C.accent4, valign: "middle" });
});
// L3 : vignette du test de plafond du VAE (IR réel passé par la compression du générateur, sans traduction)
s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 10.3, y: 3.12, w: 2.4, h: 1.0, fill: { color: "222846" }, line: { color: H.accent3, width: 1 }, rectRadius: 0.1, objectName: nm("Plafond VAE") });
txt(s, [{ text: "IR réel → 512² + VAE", options: { bold: true, color: C.background1, fontSize: 11, breakLine: true } },
        { text: "sans traduction · détecteur IR", options: { color: C.accent4, fontSize: 9, breakLine: true } },
        { text: "0,620 contre 0,618", options: { bold: true, color: C.accent3, fontSize: 16 } }],
    { x: 10.4, y: 3.15, w: 2.2, h: 0.94, align: "center", valign: "middle", fontFace: THEME.bodyFontFace });
txt(s, "Une image synthétique n'est utile que si elle apporte une information que les données disponibles n'ont pas déjà. Ici, la chaleur manquait.",
    { x: 0.6, y: 6.0, w: 12.1, h: 0.8, fontSize: 18, italic: true, bold: true, color: C.accent3, fontFace: THEME.headFontFace, valign: "middle" });
s.addNotes("Cinq leçons et la phrase de fin.");

(async () => {
  await pres.writeFile({ fileName: OUT });
  await applyTheme(OUT, THEME);
  console.log("written", OUT);
})();
