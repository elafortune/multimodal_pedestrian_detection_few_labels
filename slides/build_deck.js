// Deck FR v2 « Voir la nuit sans données de nuit » — suit doc/script_for_ppt.md partie par partie.
// Build (from the project root): PPTX_SKILL=<skill dir> NODE_PATH=slides/node_modules node slides/build_deck.js
// Output: slides/BSA_nuit_IR_FR_v3.pptx. Assets: slides/make_assets.py.
const path = require("path");
const pptxgen = require("pptxgenjs");
const { applyTheme } = require(path.join(process.env.PPTX_SKILL, "scripts/apply_theme.js"));

const A = (f) => path.join(__dirname, "assets", f);
const OUT = path.join(__dirname, "BSA_nuit_IR_FR_v3.pptx");

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
pres.title = "Voir la nuit sans données de nuit";
pres.author = "Projet personnel";
const C = pres.SchemeColor;

const FOOT = "Voir la nuit sans données de nuit · projet personnel, données publiques LLVIP";
const foot = { text: { text: FOOT, options: { x: 0.6, y: 7.0, w: 9, h: 0.3, fontSize: 10, color: C.accent4, margin: 0 } } };
const num = { x: 12.1, y: 7.0, w: 0.6, h: 0.3, fontSize: 10, color: C.accent4, align: "right" };
pres.defineSlideMaster({
  title: "TITRE", background: { color: C.text1 },
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
  title: "CONTENU", background: { color: C.background1 },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: 0.6, y: 0.55, w: 12.1, h: 0.85, fontSize: 30, bold: true, color: C.text1, valign: "middle", align: "left", margin: 0 }, text: "" } },
    foot,
  ],
  slideNumber: num,
});
pres.defineSlideMaster({
  title: "SOMBRE", background: { color: C.text1 },
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
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, fill: { color: fill }, line: { color: line || fill, width: line ? 1 : 0.75 }, rectRadius: 0.12, shadow: shadow(), objectName: nm("Carte") });
}
function txt(s, text, o) { s.addText(text, Object.assign({ isTextBox: true, margin: 0, valign: "top", objectName: nm("Texte") }, o)); }
function dot(s, x, y, label, d = 0.5, fill = C.accent1) {
  s.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: fill }, line: { color: fill }, objectName: nm("Pastille") });
  txt(s, label, { x, y, w: d, h: d, fontSize: d > 0.45 ? 16 : 12, bold: true, color: C.background1, align: "center", valign: "middle" });
}
function kicker(s, label, dark = false) { txt(s, label.toUpperCase(), { x: 0.6, y: 0.22, w: 9, h: 0.3, fontSize: 12, bold: true, color: dark ? C.accent3 : C.accent1, charSpacing: 1 }); }
function arrow(s, x, y, w = 0.35, h = 0.3, color = C.accent4) {
  s.addShape(pres.shapes.RIGHT_ARROW, { x, y, w, h, fill: { color }, line: { color }, objectName: nm("Flèche") });
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
    objectName: nm("Graphique"),
  }, extra);
}
function stripLabels(s, x, y, w, labels, colors) { // labels above a 4-cell image strip (cells 320 px, gaps 8 px, total 1304)
  const cw = w * 320 / 1304, g = w * 8 / 1304;
  labels.forEach((l, i) => txt(s, l, { x: x + i * (cw + g), y, w: cw, h: 0.35, fontSize: 13, bold: true, color: (colors && colors[i]) || C.text1, align: "center" }));
}
const SEC = ["1 · Pourquoi ce projet", "2 · Le problème", "3 · L'approche", "4 · Démo", "5 · Leçons", "6 · Conclusion"];
let sec = -1;
function section(i) { sec = i; pres.addSection({ title: SEC[i] }); }
function slide(master) { return pres.addSlide({ masterName: master, sectionTitle: SEC[sec] }); }
const fmt = (v) => v.toFixed(3).replace(".", ",");

// ======================= 1. POURQUOI =======================
section(0);
let s = slide("TITRE");
s.addText("Voir la nuit sans données de nuit", { placeholder: "title" });
s.addText("Détecter des piétons en infrarouge avec très peu de labels : images de synthèse, pseudo-étiquetage croisé et fusion robuste à la perte d'un capteur", { placeholder: "body" });
img(s, "ir_panel.jpg", 8.3, 1.9, 4.4, 3.33, "Image infrarouge de nuit avec trois piétons détectés");
txt(s, "Caméra thermique, nuit (LLVIP) : 3 piétons détectés", { x: 8.3, y: 5.35, w: 4.4, h: 0.4, fontSize: 11, color: C.accent4 });
txt(s, "Projet personnel · données publiques · GPU loués", { x: 0.8, y: 6.7, w: 8, h: 0.4, fontSize: 12, color: C.accent4 });
s.addNotes("Script §1. Présentation, puis la motivation.");

s = slide("CONTENU"); kicker(s, SEC[0]);
s.addText("Les images de synthèse : rendre leur valeur mesurable", { placeholder: "title" });
para(s, [["Le thème qui m'a le plus marqué", { bold: true, color: C.accent1 }],
         ["De tout ce que j'ai étudié, les images de synthèse sont le sujet qui me motive le plus : les rendre aussi utiles que des images réelles, pas seulement aussi belles.", {}],
         ["Pourquoi l'infrarouge", { bold: true, color: C.accent1 }],
         ["La nuit, une caméra RGB est presque aveugle ; une caméra thermique voit encore les personnes. Mais les images thermiques annotées sont rares et chères : c'est là qu'une image synthétique aurait le plus de valeur.", {}],
         ["Une question qui a une réponse chiffrée", { bold: true, color: C.accent1 }],
         ["Un détecteur entraîné sur ces images trouve-t-il plus de piétons ?", {}]],
     { x: 0.6, y: 1.65, w: 5.6, h: 5.0, fontSize: 15, paraSpaceAfter: 6 });
img(s, "pl_rgb.jpg", 6.6, 1.75, 3.0, 2.27, "Vue RGB de nuit, têtes floutées");
img(s, "pl_ir.jpg", 9.75, 1.75, 3.0, 2.27, "Même scène en infrarouge");
txt(s, "RGB de nuit", { x: 6.6, y: 4.08, w: 3.0, h: 0.35, fontSize: 13, bold: true, color: C.accent2, align: "center" });
txt(s, "Infrarouge thermique, même instant", { x: 9.75, y: 4.08, w: 3.0, h: 0.35, fontSize: 13, bold: true, color: C.accent1, align: "center" });
card(s, 6.6, 4.75, 6.15, 1.75);
txt(s, "Une image synthétique est-elle aussi utile qu'une image réelle pour entraîner un détecteur ?", { x: 6.85, y: 4.75, w: 5.7, h: 1.75, fontSize: 18, bold: true, italic: true, color: C.text1, valign: "middle" });
s.addNotes("Script §1. Têtes floutées sur les vues RGB.");

// ======================= 2. PROBLÈME =======================
section(1);
s = slide("CONTENU"); kicker(s, SEC[1]);
s.addText("Deux budgets : l'IR annoté est rare, les paires sont gratuites", { placeholder: "title" });
[["12 025", "images IR annotées : la référence, 0,623 mAP50-95", C.text1], ["0 à 100", "images IR annotées : le budget réaliste", C.text1], ["1 000", "paires RGB / IR non annotées, alignées au pixel près", C.accent1]]
  .forEach(([b, t, col], i) => { const x = 0.6 + i * 4.1; card(s, x, 1.65, 3.8, 1.9); stat(s, x + 0.3, 1.8, 3.2, b, t, col, 40); });
img(s, "nominal_row.jpg", 0.6, 3.95, 8.2, 2.19, "Vue RGB, vue IR et vue fusionnée de la même scène, têtes floutées");
txt(s, "RGB · IR · fusion : même scène, têtes floutées", { x: 0.6, y: 6.2, w: 8.2, h: 0.35, fontSize: 11, color: C.accent4 });
card(s, 9.1, 3.95, 3.6, 2.6);
para(s, [["Les deux questions", { bold: true, color: C.accent1 }], ["Avec 0 à 100 labels IR et des paires gratuites, jusqu'où approcher 0,623 ?", {}], ["Si une caméra tombe, la détection survit-elle ?", {}]],
     { x: 9.35, y: 4.15, w: 3.1, h: 2.3, fontSize: 15 });
s.addNotes("Script §2. mAP50-95 : précision des boîtes, de 0 à 1.");

s = slide("CONTENU"); kicker(s, SEC[1]);
s.addText("Les jeux de données et leur rôle", { placeholder: "title" });
const dsH = ["Jeu", "Split", "Réel ou synthétique", "Rôle"];
const ds = [["IR réel train", "entraînement · 12 025", "réel", "entraîner les détecteurs IR (tout ou N images annotées)"],
            ["RGB réel train", "entraînement · 12 025, aligné sur l'IR", "réel", "pré-entraîner ; source du générateur et des pseudo-labels"],
            ["IR synthétique T100 / T1000", "entraînement · 12 025", "synthétique (depuis le RGB)", "entraîner un détecteur à la place de l'IR réel"],
            ["Paires P1000", "entraînement · 1 000", "réel, labels prédits", "entraîner un détecteur sans annotation"],
            ["IR réel test", "test · 3 463, scènes jamais vues", "réel", "seul jeu de test de toutes les détections"],
            ["Moitiés A / B du test", "test coupé en deux · ~1 700 chacune", "A réel ; B réel, RGB ou synthétique", "métriques de synthèse : A = référence, B = jeu comparé"]];
s.addTable([dsH.map((h) => ({ text: h, options: { bold: true, color: C.background1, fill: { color: C.text1 }, fontSize: 14, valign: "middle" } })),
            ...ds.map((r, ri) => r.map((v, ci) => ({ text: v, options: { fontSize: 13, color: C.text1, bold: ci === 0, valign: "middle", fill: { color: ri === 4 ? C.background2 : C.background1 } } })))],
  { x: 0.6, y: 1.6, w: 12.1, colW: [2.7, 3.0, 2.7, 3.7], rowH: 0.55, border: { type: "solid", pt: 0.75, color: "D9DDE8" }, objectName: nm("Tableau jeux") });
card(s, 0.6, 5.65, 12.1, 1.0);
para(s, [["T100 / T1000 = IR synthétique produit par le générateur entraîné sur 100 / 1 000 paires. ", { bold: true }],
         ["Les métriques de synthèse comparent deux jeux d'images (B ↔ A) et n'entraînent rien ; les détections entraînent sur le split d'entraînement et testent toujours sur l'IR réel test.", {}]],
     { x: 0.85, y: 5.65, w: 11.6, h: 1.0, fontSize: 14, valign: "middle", paraSpaceAfter: 0 });
s.addNotes("Glossaire des jeux (script, en-tête). Tous les tableaux suivants y renvoient.");

// ======================= 3. APPROCHE =======================
section(2);
s = slide("SECTION");
s.addText("L'approche, et ce que j'ai construit", { placeholder: "title" });
["Outils et protocole", "Deux supervisions « gratuites » : traduire ou pseudo-étiqueter", "Juger une image synthétique : le choix des métriques", "Fusionner deux caméras, et les éprouver", "Déployer en temps réel"]
  .forEach((t, i) => { dot(s, 0.8, 2.85 + i * 0.75, String(i + 1)); txt(s, t, { x: 1.55, y: 2.85 + i * 0.75, w: 10.5, h: 0.5, fontSize: 20, color: C.background1, valign: "middle" }); });
s.addNotes("Script §3.");

s = slide("CONTENU"); kicker(s, SEC[2]);
s.addText("Le pipeline, de bout en bout", { placeholder: "title" });
const steps = [["Paires RGB / IR", "non annotées, alignées", "LLVIP"], ["Supervision gratuite", "A. traduire le RGB en IR\nB. pseudo-étiqueter l'IR réel", "diffusers · LoRA · COCO"],
               ["Détecteur", "pré-entraînement puis affinage sur N labels IR", "Ultralytics YOLO11s"], ["Fusion RGB + IR", "late et early, dropout de modalité", "WBF · image 4 canaux"],
               ["Déploiement", "FP16, latence de bout en bout", "TensorRT 10 · CUDA"]];
steps.forEach(([h, b, tool], i) => {
  const x = 0.6 + i * 2.48;
  card(s, x, 1.65, 2.2, 2.75);
  dot(s, x + 0.2, 1.85, String(i + 1));
  txt(s, h, { x: x + 0.2, y: 2.5, w: 1.85, h: 0.6, fontSize: 15, bold: true, color: C.text1 });
  txt(s, b, { x: x + 0.2, y: 3.05, w: 1.85, h: 0.85, fontSize: 12, color: C.text2 });
  txt(s, tool, { x: x + 0.2, y: 3.95, w: 1.85, h: 0.35, fontSize: 11, italic: true, color: C.accent1 });
  if (i < steps.length - 1) arrow(s, x + 2.23, 2.85, 0.22, 0.3);
});
txt(s, "Règles qui rendent les chiffres crédibles", { x: 0.6, y: 4.8, w: 8, h: 0.4, fontSize: 18, bold: true, color: C.text1 });
["Métrique stricte : mAP50-95", "Aucune sélection sur le test", "2 seeds par configuration", "Même évaluateur pour tout"].forEach((t, i) => {
  const x = 0.6 + i * 3.08;
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 5.35, w: 2.85, h: 0.7, fill: { color: C.background2 }, line: { color: C.accent4, width: 0.75 }, rectRadius: 0.1, objectName: nm("Règle") });
  txt(s, t, { x, y: 5.35, w: 2.85, h: 0.7, fontSize: 14, color: C.text1, align: "center", valign: "middle" });
});
txt(s, "Le mAP50 vaut déjà 0,96 sur LLVIP : il ne départage plus les méthodes, d'où le mAP50-95, qui exige des boîtes précises.", { x: 0.6, y: 6.25, w: 12.1, h: 0.4, fontSize: 12, color: C.accent4 });
s.addNotes("Script §3.1.");

s = slide("CONTENU"); kicker(s, SEC[2] + " · A. traduire");
s.addText("A. Traduire le RGB en IR : pourquoi pix2pix-turbo + LoRA", { placeholder: "title" });
stripLabels(s, 0.6, 1.55, 12.1, ["RGB (entrée)", "pix2pix classique", "pix2pix-turbo (T100)", "IR réel (cible)"], [C.accent2, C.accent6, C.accent1, C.text1]);
img(s, "gen_classic_vs_turbo.jpg", 0.6, 1.95, 12.1, 2.375, "Même scène : RGB, sortie du pix2pix classique (bruit), sortie de pix2pix-turbo, IR réel");
card(s, 0.6, 4.65, 3.8, 2.0); stat(s, 0.85, 4.75, 3.3, "0,06 → 0,55", "erreur L1 du pix2pix classique : scènes d'entraînement → scènes nouvelles", C.accent6, 32);
card(s, 4.75, 4.65, 7.95, 2.0);
para(s, [["Le pix2pix classique, entraîné de zéro sur 100 paires, apprend les scènes par cœur.", {}],
         ["pix2pix-turbo part d'un modèle de diffusion déjà entraîné sur des millions d'images (SD-Turbo, une seule étape) ; LoRA n'entraîne qu'un petit nombre de poids ajoutés. Il garde ses connaissances générales et généralise avec 100 paires.", { bold: true }]],
     { x: 5.0, y: 4.8, w: 7.5, h: 1.75, fontSize: 14 });
s.addNotes("Script §3.2, option A.");

s = slide("CONTENU"); kicker(s, SEC[2] + " · A. traduire");
s.addText("Ce que produit le générateur", { placeholder: "title" });
stripLabels(s, 0.6, 1.55, 12.1, ["RGB (entrée)", "IR synthétique T100", "IR synthétique T1000", "IR réel"], [C.accent2, C.accent1, C.accent1, C.text1]);
img(s, "gen_turbo_row_people.jpg", 0.6, 1.95, 12.1, 2.375, "Piétons : gris dans l'IR synthétique, chauds dans l'IR réel");
img(s, "gen_turbo_row_car_crop.jpg", 0.6, 4.45, 12.1, 1.485, "Voiture : les phares deviennent des taches chaudes dans l'IR synthétique");
txt(s, "Les piétons restent gris (pas chauds) ; les phares deviennent des taches brûlantes : le générateur copie la luminosité du RGB, pas la température.", { x: 0.6, y: 6.05, w: 12.1, h: 0.6, fontSize: 15, bold: true, color: C.text1 });
s.addNotes("Script §3.2 et L3. Ligne du haut : les piétons restent gris dans l'IR synthétique, alors qu'ils sont blancs (chauds) dans l'IR réel. Ligne du bas : les phares deviennent des taches chaudes. Le générateur reproduit la luminosité du RGB, pas la température.");

s = slide("CONTENU"); kicker(s, SEC[2] + " · B. pseudo-étiqueter");
s.addText("B. Pseudo-étiqueter l'IR réel, sans générateur", { placeholder: "title" });
img(s, "pl_rgb.jpg", 0.6, 1.7, 2.6, 1.97, "Moitié RGB de la paire");
img(s, "pl_ir.jpg", 0.6, 4.05, 2.6, 1.97, "Moitié IR de la paire");
txt(s, "RGB", { x: 0.6, y: 3.7, w: 2.6, h: 0.3, fontSize: 12, bold: true, color: C.accent2, align: "center" });
txt(s, "IR réel, même instant", { x: 0.6, y: 6.05, w: 2.6, h: 0.3, fontSize: 12, bold: true, color: C.accent1, align: "center" });
arrow(s, 3.3, 2.55); arrow(s, 3.3, 4.9);
card(s, 3.75, 2.25, 1.9, 0.95); txt(s, "Détecteur COCO\nsur le RGB", { x: 3.75, y: 2.25, w: 1.9, h: 0.95, fontSize: 13, bold: true, color: C.text1, align: "center", valign: "middle" });
card(s, 3.75, 4.6, 1.9, 0.95); txt(s, "Détecteur COCO\nsur l'IR", { x: 3.75, y: 4.6, w: 1.9, h: 0.95, fontSize: 13, bold: true, color: C.text1, align: "center", valign: "middle" });
arrow(s, 5.75, 3.55, 0.35, 0.35);
card(s, 6.2, 3.2, 1.95, 1.1, C.accent1); txt(s, "Union des boîtes\n→ labels de l'IR réel", { x: 6.2, y: 3.2, w: 1.95, h: 1.1, fontSize: 13, bold: true, color: C.background1, align: "center", valign: "middle" });
s.addShape(pres.shapes.LINE, { x: 5.7, y: 2.72, w: 0, h: 2.35, line: { color: C.accent4, width: 1.5 }, objectName: nm("Ligne") });
s.addChart(pres.charts.BAR, [
  { name: "Précision (boîtes justes)", labels: ["COCO sur RGB", "COCO sur IR", "RGB + IR fusionnés"], values: [0.87, 0.83, 0.83] },
  { name: "Rappel (piétons trouvés)", labels: ["COCO sur RGB", "COCO sur IR", "RGB + IR fusionnés"], values: [0.34, 0.42, 0.50] }],
  chartBase({ x: 8.45, y: 1.6, w: 4.3, h: 3.4, barDir: "col", barGrouping: "clustered", chartColors: [H.dk2, H.accent1], showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0.00",
    valAxisMinVal: 0, valAxisMaxVal: 1, valAxisLabelFormatCode: "0.0", showLegend: true, legendPos: "b", showTitle: true, title: "Qualité des pseudo-labels (1 000 paires)", catAxisLabelFontSize: 11 }));
card(s, 8.45, 5.2, 4.3, 1.45);
para(s, [["Possible car RGB et IR sont alignés au pixel près : une boîte se recopie telle quelle.", {}], ["Aucun label du dataset utilisé.", { bold: true }]], { x: 8.65, y: 5.3, w: 3.9, h: 1.3, fontSize: 13 });
s.addNotes("Script §3.2, option B. Détecteur générique YOLO11s pré-entraîné sur COCO (118 000 images), jamais vu LLVIP. Fiable quand il trace une boîte (87 %), mais rate 2 piétons sur 3 de nuit sur le RGB ; la fusion RGB + IR fait monter le rappel à 50 %.");

s = slide("CONTENU"); kicker(s, SEC[2] + " · métriques");
s.addText("Juger une image synthétique : deux questions, deux familles", { placeholder: "title" });
const fam = [["1", "Le jeu ressemble-t-il, dans son ensemble, à de l'IR réel ?", "Métriques de distribution", "Comparent deux ensembles d'images sans les apparier : chaque image → un vecteur de caractéristiques (réseau pré-entraîné), puis on compare les deux nuages.", "FID · KID · FD-DINOv2 · densité / couverture", "Juge le réalisme et la diversité, pas la fidélité à la scène"],
             ["2", "Chaque image est-elle fidèle au vrai IR de la même scène ?", "Métriques appariées", "Comparent chaque image synthétique à sa vraie jumelle IR (même scène, même instant).", "L1 · SSIM · LPIPS", "Juge le contenu image par image, pas le réalisme global"]];
fam.forEach(([k, q, h, d, ex, lim], i) => {
  const x = 0.6 + i * 6.15;
  card(s, x, 1.6, 5.9, 3.85);
  dot(s, x + 0.25, 1.8, k);
  txt(s, q, { x: x + 0.9, y: 1.78, w: 4.8, h: 0.75, fontSize: 16, bold: true, color: C.text1 });
  txt(s, h, { x: x + 0.25, y: 2.65, w: 5.4, h: 0.4, fontSize: 15, bold: true, color: C.accent1 });
  txt(s, d, { x: x + 0.25, y: 3.05, w: 5.4, h: 1.05, fontSize: 13, color: C.text2 });
  txt(s, ex, { x: x + 0.25, y: 4.15, w: 5.4, h: 0.4, fontSize: 14, bold: true, color: C.text1 });
  txt(s, lim, { x: x + 0.25, y: 4.6, w: 5.4, h: 0.7, fontSize: 13, italic: true, color: C.text2 });
});
card(s, 0.6, 5.7, 12.1, 0.95, C.text1);
txt(s, [{ text: "Distance de Fréchet :  ", options: { bold: true, color: C.accent3 } },
        { text: "FD = ‖μ₁ − μ₂‖² + Tr(Σ₁ + Σ₂ − 2(Σ₁Σ₂)^½)   →   écart des moyennes + écart des dispersions des deux nuages ; 0 = identiques", options: { color: C.background1 } }],
    { x: 0.85, y: 5.7, w: 11.6, h: 0.95, fontSize: 15, valign: "middle" });
s.addNotes("Script §3.3. Une image peut être réaliste mais fausse, ou fidèle mais peu réaliste : il faut les deux familles.");

s = slide("CONTENU"); kicker(s, SEC[2] + " · métriques");
s.addText("Les métriques, une par une", { placeholder: "title" });
const mH = ["Métrique", "Famille", "Ce qu'elle mesure", "Comment la lire"];
const mR = [["FID", "distribution", "distance de Fréchet entre vecteurs Inception (réseau ImageNet)", "0 = identiques ; sans échelle absolue ; biaisée sur petit échantillon"],
            ["KID", "distribution", "même idée par un noyau (MMD), estimateur non biaisé", "plus fiable sur petit échantillon ; affiché ×1000"],
            ["FD-DINOv2", "distribution", "Fréchet sur les vecteurs DINOv2 (auto-supervisé, plus robuste)", "vérifie que la conclusion ne dépend pas de l'extracteur"],
            ["Densité, couverture", "distribution", "les images tombent-elles dans le nuage réel ? le couvrent-elles ? (Naeem et al., ICML 2020)", "0 à 1 ; 1 = parfait ; versions robustes de précision / rappel"],
            ["L1 · SSIM · LPIPS", "appariée", "écart des pixels · similarité de structure · distance perceptive", "L1, LPIPS : 0 = identiques ; SSIM : 1 = identiques"]];
s.addTable([mH.map((h) => ({ text: h, options: { bold: true, color: C.background1, fill: { color: C.text1 }, fontSize: 14, valign: "middle" } })),
            ...mR.map((r) => r.map((v, ci) => ({ text: v, options: { fontSize: 13, color: C.text1, bold: ci === 0, valign: "middle" } })))],
  { x: 0.6, y: 1.6, w: 12.1, colW: [2.0, 1.6, 4.5, 4.0], rowH: 0.72, border: { type: "solid", pt: 0.75, color: "D9DDE8" }, objectName: nm("Tableau métriques") });
txt(s, "Et l'arbitre final : l'utilité = mAP50-95, sur l'IR réel test, d'un détecteur entraîné uniquement sur le jeu jugé.", { x: 0.6, y: 6.15, w: 12.1, h: 0.45, fontSize: 15, bold: true, color: C.accent1 });
s.addNotes("Script §3.3, tableau des métriques.");

s = slide("CONTENU"); kicker(s, SEC[2] + " · métriques");
s.addText("Le contrôle qui a tout changé : mesurer le réel contre le réel", { placeholder: "title" });
s.addChart(pres.charts.BAR, [{ name: "FID", labels: ["IR réel train ↔ IR réel test", "IR réel test B ↔ A (contrôle)", "IR synthétique T1000 ↔ IR réel test A", "RGB réel test B ↔ IR réel test A"], values: [224, 11.6, 229.4, 271.7] }],
  chartBase({ x: 0.6, y: 1.6, w: 7.2, h: 4.9, barDir: "bar", chartColors: [H.accent6, H.accent5, H.accent1, H.accent2], showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0.0",
    valAxisMinVal: 0, valAxisMaxVal: 300, valAxisLabelFormatCode: "0", showLegend: false, showTitle: true, title: "FID (plus bas = plus proche)", catAxisLabelFontSize: 11 }));
card(s, 8.1, 1.6, 4.6, 4.9);
para(s, [["Le piège", { bold: true, color: C.accent6 }],
         ["IR réel contre IR réel : on attend ~0. J'obtiens 224, presque autant que RGB contre IR. Les scènes de test sont d'autres rues : le FID mesurait le décor, pas la modalité.", {}],
         ["Le correctif", { bold: true, color: C.accent5 }],
         ["Tout mesurer dans les mêmes scènes : le test coupé en deux moitiés. Référence = IR réel A ; jeu comparé = sa version B. Le contrôle tombe à 11,6 : c'est l'étalon.", {}],
         ["Lecture", { bold: true, color: C.accent1 }],
         ["Face à 11,6, le synthétique à 229 est presque aussi loin de l'IR réel que le RGB.", { bold: true }]],
     { x: 8.35, y: 1.75, w: 4.15, h: 4.65, fontSize: 13, paraSpaceAfter: 5 });
s.addNotes("Script §3.3. Ce n'est pas une erreur : c'est le contrôle. Comparer d'abord deux jeux d'IR réel donne la valeur « sans écart de modalité ».");

s = slide("CONTENU"); kicker(s, SEC[2] + " · métriques");
s.addText("Image entière → boîtes : mesurer ce que YOLO cherche", { placeholder: "title" });
[["~3 %", "des pixels sont des piétons : sur l'image entière, la métrique juge surtout la route et les arbres"],
 ["FD-YOLO", "distance de Fréchet avec les caractéristiques internes du détecteur IR, lues dans chaque boîte"],
 ["Détectabilité", "mAP du détecteur IR réel appliqué au jeu : montre-t-il les piétons comme l'IR ?"]]
  .forEach(([b, t], i) => { const x = 0.6 + i * 4.1; card(s, x, 1.6, 3.8, 1.75); stat(s, x + 0.25, 1.7, 3.3, b, t, C.accent1, 28); });
const bxH = ["Comparaison (jeu B ↔ IR réel test A)", "KID×1000 image entière", "KID×1000 boîtes", "FD-DINOv2 boîtes", "FD-YOLO boîtes", "Détectabilité", "Utilité (3 000 images → IR réel test)"];
const bx = [["IR réel test B (contrôle)", "124", "10", "160", "77", "0,61", "0,614"], ["IR synthétique T1000", "187", "136", "1 210", "294", "0,16", "0,338"],
            ["RGB réel test B", "275", "162", "841", "852", "0,01", "0,416"], ["Gris inversé (1 − luminance RGB)", "181", "152", "905", "561", "0,09", "0,471"]];
s.addTable([bxH.map((h) => ({ text: h, options: { bold: true, color: C.background1, fill: { color: C.text1 }, fontSize: 11, valign: "middle", align: "center" } })),
            ...bx.map((r) => r.map((v, ci) => ({ text: v, options: { fontSize: 13, color: C.text1, valign: "middle", align: ci === 0 ? "left" : "center", bold: ci === 3 } })))],
  { x: 0.6, y: 3.5, w: 12.1, colW: [3.5, 1.25, 1.25, 1.4, 1.3, 1.3, 2.1], rowH: 0.4, border: { type: "solid", pt: 0.75, color: "D9DDE8" }, objectName: nm("Tableau boîtes") });
s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.6, y: 5.95, w: 2.3, h: 0.5, fill: { color: C.accent5 }, line: { color: C.accent5 }, rectRadius: 0.08, objectName: nm("Badge") });
txt(s, "1 700 + 1 700 images · 3 737 piétons", { x: 0.6, y: 5.95, w: 2.3, h: 0.5, fontSize: 10, bold: true, color: C.background1, align: "center", valign: "middle" });
para(s, [["Dans les boîtes, le contrôle IR / IR passe de 124 à 10 : la mesure ne voit plus le décor. ", { bold: true }],
         ["Seule la FD-DINOv2 dans les boîtes place le RGB (841) devant T1000 (1 210), comme l'utilité. Le détecteur IR, lui, juge le RGB étranger (détectabilité 0,01) alors qu'il entraîne bien.", {}]],
     { x: 3.1, y: 5.85, w: 9.6, h: 0.95, fontSize: 12, paraSpaceAfter: 2 });
s.addNotes("Script §3.3. Calcul complet : moitié B de chaque jeu (1 700 images) contre l'IR réel test, moitié A (1 700 images), 3 737 piétons. Attention (P24) : ici les moitiés A et B sont des scènes différentes, d'où un contrôle global à 124 (KID) au lieu de ~0 ; c'est justement ce qui montre que les boîtes ignorent le décor (10). Les chiffres globaux de la slide précédente (11,6) viennent du découpage mélangé. Utilité = détecteur proxy (3 000 images, 30 époques), même ordre que les entraînements complets (RGB 0,468 > T1000 0,384 > T100 0,328).");

s = slide("CONTENU"); kicker(s, SEC[2] + " · fusion");
s.addText("Fusionner deux caméras : late fusion ou early fusion", { placeholder: "title" });
function fusionDiagram(x, title, sub, early) {
  card(s, x, 1.6, 5.9, 4.0);
  txt(s, title, { x: x + 0.3, y: 1.75, w: 5.3, h: 0.45, fontSize: 18, bold: true, color: C.accent1 });
  txt(s, sub, { x: x + 0.3, y: 2.2, w: 5.3, h: 0.45, fontSize: 13, color: C.text2 });
  const box = (bx, by, bw, bh, t, fill, col) => { s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: bx, y: by, w: bw, h: bh, fill: { color: fill }, line: { color: fill }, rectRadius: 0.08, objectName: nm("Bloc") }); txt(s, t, { x: bx, y: by, w: bw, h: bh, fontSize: 12, bold: true, color: col, align: "center", valign: "middle" }); };
  if (!early) {
    box(x + 0.3, 2.9, 1.1, 0.6, "RGB", C.accent2, C.background1); box(x + 0.3, 4.1, 1.1, 0.6, "IR", C.accent1, C.background1);
    arrow(s, x + 1.5, 3.05, 0.3, 0.3); arrow(s, x + 1.5, 4.25, 0.3, 0.3);
    box(x + 1.9, 2.9, 1.5, 0.6, "Détecteur RGB", C.text1, C.background1); box(x + 1.9, 4.1, 1.5, 0.6, "Détecteur IR", C.text1, C.background1);
    arrow(s, x + 3.5, 3.65, 0.3, 0.3);
    box(x + 3.9, 3.45, 1.7, 0.75, "Fusion des boîtes (WBF)", C.accent3, C.text1);
  } else {
    box(x + 0.3, 2.9, 1.1, 0.6, "RGB", C.accent2, C.background1); box(x + 0.3, 4.1, 1.1, 0.6, "IR", C.accent1, C.background1);
    arrow(s, x + 1.5, 3.65, 0.3, 0.3);
    box(x + 1.9, 3.3, 1.5, 1.05, "Image 4 canaux\nR · G · B · IR", C.accent3, C.text1);
    arrow(s, x + 3.5, 3.65, 0.3, 0.3);
    box(x + 3.9, 3.45, 1.7, 0.75, "Un seul détecteur", C.text1, C.background1);
  }
}
fusionDiagram(0.6, "Late fusion", "deux détecteurs indépendants, puis on fusionne leurs boîtes", false);
fusionDiagram(6.8, "Early fusion", "les deux images empilées, un seul réseau", true);
txt(s, "Modulaire : si une caméra meurt, l'autre détecteur continue seul.", { x: 0.9, y: 4.95, w: 5.3, h: 0.55, fontSize: 13, italic: true, color: C.text1 });
txt(s, "Plus précise, mais le réseau peut devenir dépendant d'un capteur.", { x: 7.1, y: 4.95, w: 5.3, h: 0.55, fontSize: 13, italic: true, color: C.text1 });
txt(s, "WBF (Weighted Boxes Fusion) : les boîtes qui se recouvrent sont moyennées, pondérées par leur confiance.", { x: 0.6, y: 5.9, w: 12.1, h: 0.45, fontSize: 13, color: C.accent4 });
s.addNotes("Script §3.4.");

s = slide("CONTENU"); kicker(s, SEC[2] + " · fusion");
s.addText("Le dropout de modalité : apprendre à perdre un capteur", { placeholder: "title" });
s.addChart(pres.charts.DOUGHNUT, [{ name: "Images d'entraînement", labels: ["RGB + IR", "IR mis à zéro", "RGB mis à zéro"], values: [70, 15, 15] }],
  chartBase({ x: 0.6, y: 1.6, w: 5.0, h: 4.6, chartColors: [H.dk2, H.accent1, H.accent2], holeSize: 55, showPercent: true, showValue: false, showLegend: true, legendPos: "b",
    dataLabelColor: H.lt1, dataLabelFontSize: 14, showTitle: true, title: "Images d'entraînement de l'early fusion" }));
card(s, 6.0, 1.6, 6.7, 4.6);
para(s, [["Le problème", { bold: true, color: C.accent1 }],
         ["La nuit, l'IR est bien plus informatif que le RGB : un réseau à 4 canaux apprend à s'appuyer presque entièrement sur lui. Si l'IR disparaît, il reçoit une entrée jamais vue et s'effondre.", {}],
         ["La solution, uniquement à l'entraînement", { bold: true, color: C.accent1 }],
         ["On éteint volontairement un capteur sur 30 % des images. Le réseau apprend à détecter avec chaque capteur seul, et à lire « canal à zéro = capteur absent ».", {}],
         ["La preuve", { bold: true, color: C.accent1 }],
         ["Le même modèle est entraîné sans dropout (ablation), et comparé sur les mêmes scénarios.", {}]],
     { x: 6.3, y: 1.75, w: 6.2, h: 4.35, fontSize: 14, paraSpaceAfter: 5 });
s.addNotes("Script §3.4, dropout.");

s = slide("CONTENU"); kicker(s, SEC[2] + " · scénarios");
s.addText("Éprouver le système : trois familles de scénarios", { placeholder: "title" });
const vw = 1.35, vh = 1.0;
const fams = [["Capteurs normaux", "niveau de base", [["sc_rgb_nominal.jpg", "RGB nominal"], ["sc_ir_nominal.jpg", "IR nominal"]]],
              ["Capteur dégradé", "le signal existe, mais il est mauvais : l'autre capteur compense-t-il ?", [["sc_rgb_fog.jpg", "RGB brouillard"], ["sc_rgb_dark.jpg", "RGB nuit noire"]]],
              ["Capteur mort", "plus aucun signal : le système a-t-il été conçu pour perdre un capteur ?", [["sc_rgb_dead.jpg", "RGB mort"], ["sc_ir_dead.jpg", "IR mort"]]],
              ["Bonus", "peut-on halluciner le capteur manquant ?", [["sc_ir_reconstructed.jpg", "IR reconstruit depuis le RGB"]]]];
let fx = 0.6;
fams.forEach(([h, sub, ims], i) => {
  const w = ims.length * (vw + 0.15) + 0.25;
  card(s, fx, 1.6, w, 4.15, i === 1 ? C.background2 : C.background2);
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
txt(s, "Un capteur dégradé se compense par l'autre ; un capteur mort ne se gère que si on l'a prévu : architecture (late), entraînement (dropout) ou système (le déclarer absent).",
    { x: 0.85, y: 5.95, w: 11.6, h: 0.75, fontSize: 14, bold: true, color: C.background1, valign: "middle" });
s.addNotes("Script §3.4. Brouillard : image mélangée à un voile clair + bruit. Nuit noire : gamma 2,5, gain 0,35, bruit de capteur. Mort : image entièrement noire.");

// ======================= 4. DÉMO =======================
section(3);
s = slide("CONTENU"); kicker(s, SEC[3]);
s.addText("Démo : l'application, sur un GPU loué", { placeholder: "title" });
img(s, "demo_modes.jpg", 0.6, 1.55, 6.25, 5.0, "Trois lignes : nominal, IR mort déclaré absent, IR reconstruit ; colonnes RGB, IR, fusion");
const demo = [["Scène nominale", "RGB, IR et fusion trouvent les 3 piétons"], ["Brouillard sur le RGB", "le RGB perd des piétons, l'IR et la fusion tiennent"],
              ["Caméra thermique débranchée", "(a) déclarée absente : la fusion retombe sur le RGB\n(b) reconstruite par le générateur : piétons gris, 0 détection"]];
demo.forEach(([h, b], i) => {
  const y = 1.6 + i * 1.45;
  dot(s, 7.2, y, String(i + 1));
  txt(s, h, { x: 7.9, y: y - 0.02, w: 4.8, h: 0.4, fontSize: 16, bold: true, color: C.text1 });
  txt(s, b, { x: 7.9, y: y + 0.4, w: 4.8, h: 0.95, fontSize: 13, color: C.text2 });
});
card(s, 7.2, 6.0, 5.5, 0.6);
txt(s, "Enregistrement d'écran · app Gradio · tunnel SSH vers le GPU", { x: 7.4, y: 6.0, w: 5.1, h: 0.6, fontSize: 12, italic: true, color: C.text1, valign: "middle" });
s.addNotes("Script §4. Pendant la démo : écran partagé, cette slide sert de transition et de secours.");

s = slide("SOMBRE"); kicker(s, SEC[3] + " · dans les coulisses", true);
s.addText("Une seule fonctionnalité : le pipeline 100 % GPU", { placeholder: "title" });
card(s, 0.6, 1.6, 7.3, 4.95, "222846");
txt(s, [
  { text: "# Avant : 98 ms par image (copie répartie sur 128 threads CPU)", options: { color: H.accent4, breakLine: true } },
  { text: "self.host.copy_(torch.from_numpy(frame))", options: { color: H.accent6, breakLine: true } },
  { text: "# Après : 0,45 ms", options: { color: H.accent4, breakLine: true } },
  { text: "np.copyto(self.host_np, frame)", options: { color: H.accent5, breakLine: true } },
  { text: " ", options: { breakLine: true } },
  { text: "# Une seule copie CPU → GPU, puis tout sur GPU", options: { color: H.accent4, breakLine: true } },
  { text: "self.dev.copy_(self.host, non_blocking=True)", options: { color: H.lt1, breakLine: true } },
  { text: "x = F.interpolate(self.dev.permute(2, 0, 1)[None]", options: { color: H.lt1, breakLine: true } },
  { text: "                  .flip(1).float(), size=(512, 640))", options: { color: H.lt1, breakLine: true } },
  { text: "self.ctx.execute_async_v3(stream)  # réseau + NMS", options: { color: H.lt1, breakLine: true } },
  { text: "                                   # dans TensorRT", options: { color: H.accent4 } }],
  { x: 0.85, y: 1.8, w: 6.9, h: 4.6, fontSize: 13, fontFace: "Courier New" });
[["4,04 ms", "Ultralytics + TensorRT, pré/post sur CPU", C.background1], ["2,30 ms", "100 % GPU, NMS dans le moteur", C.accent1], ["435 img/s", "même mAP : 0,612 contre 0,613", C.accent3]]
  .forEach(([b, t, col], i) => { const y = 1.6 + i * 1.65; txt(s, b, { x: 8.3, y, w: 4.4, h: 0.85, fontSize: 40, bold: true, color: col, fontFace: THEME.headFontFace }); txt(s, t, { x: 8.3, y: y + 0.85, w: 4.4, h: 0.5, fontSize: 14, color: C.accent4 }); });
s.addNotes("Script §4, fin. « Glimpse behind the curtain ».");

// ======================= 5. LEÇONS =======================
section(4);
s = slide("SECTION");
s.addText("Ce que les résultats m'ont appris", { placeholder: "title" });
["Une référence oubliée a renversé ma conclusion", "Mieux vaut transférer les labels que traduire les images", "Le générateur échoue parce que la chaleur n'est pas dans son entrée", "Une métrique d'image ne vaut que mesurée sur les piétons", "La robustesse s'entraîne, la latence se gagne hors du réseau"]
  .forEach((t, i) => { dot(s, 0.8, 2.85 + i * 0.75, "L" + (i + 1), 0.55); txt(s, t, { x: 1.6, y: 2.85 + i * 0.75, w: 10.8, h: 0.55, fontSize: 20, color: C.background1, valign: "middle" }); });
s.addNotes("Script §5. Chaque leçon : constat, calcul, raison.");

function lessonFrame(tag, title) { const sl = slide("CONTENU"); kicker(sl, `${SEC[4]} · ${tag}`); sl.addText(title, { placeholder: "title" }); return sl; }
function reasonCard(sl, x, y, w, h, calc, reason) {
  card(sl, x, y, w, h);
  para(sl, [["Le calcul", { bold: true, color: C.accent1 }], [calc, {}], ["La raison", { bold: true, color: C.accent1 }], [reason, { bold: true }]],
       { x: x + 0.25, y: y + 0.15, w: w - 0.5, h: h - 0.3, fontSize: 13, paraSpaceAfter: 5 });
}

s = lessonFrame("L1", "Une référence oubliée a renversé ma conclusion");
s.addChart(pres.charts.LINE, [
  { name: "aucun pré-entraînement (IR réel seul)", labels: ["10", "25", "50", "100"], values: [0.328, 0.423, 0.458, 0.495] },
  { name: "pré-entraîné sur IR synthétique T100", labels: ["10", "25", "50", "100"], values: [0.468, 0.503, 0.516, 0.504] },
  { name: "pré-entraîné sur RGB réel", labels: ["10", "25", "50", "100"], values: [0.500, 0.540, 0.543, 0.526] },
  { name: "pré-entraîné sur RGB réel puis IR synthétique", labels: ["10", "25", "50", "100"], values: [0.496, 0.513, 0.528, 0.517] }],
  chartBase({ x: 0.6, y: 1.55, w: 7.6, h: 5.1, chartColors: [H.accent4, H.accent1, H.accent2, H.accent3], lineSize: 2.5, lineDataSymbolSize: 7, valAxisMinVal: 0.3, valAxisMaxVal: 0.6, valAxisLabelFormatCode: "0.00",
    showLegend: true, legendPos: "b", showTitle: true, title: "Testé sur IR réel test · mAP50-95 · 2 seeds", showCatAxisTitle: true, catAxisTitle: "N images d'IR réel train annotées (affinage, 100 époques)", catAxisTitleFontSize: 11, catAxisTitleColor: H.dk2 }));
reasonCard(s, 8.5, 1.55, 4.2, 5.1, "Pré-entraînement sur 12 025 images du split d'entraînement, puis affinage sur N images IR réelles annotées. À N = 10 : synthétique 0,47, RGB réel 0,50 ; RGB devant à tous les N.",
  "Le générateur part des mêmes images RGB et des mêmes boîtes : il ne peut qu'en perdre. Le gain de +0,14 venait des labels RGB, pas de la traduction.");
s.addNotes("Script L1.");

s = lessonFrame("L2", "Mieux vaut transférer les labels que traduire les images");
s.addChart(pres.charts.BAR, [{ name: "mAP50-95", labels: ["12 025 IR synthétiques T1000 (vraies boîtes)", "1 000 IR réelles, labels COCO sur RGB", "12 025 RGB réelles (vraies boîtes)", "1 000 IR réelles, labels COCO sur RGB + IR"], values: [0.384, 0.424, 0.468, 0.529] }],
  chartBase({ x: 0.6, y: 1.55, w: 7.6, h: 4.5, barDir: "bar", chartColors: [H.accent4, H.accent4, H.accent2, H.accent1], showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0.000",
    valAxisMinVal: 0, valAxisMaxVal: 0.6, valAxisLabelFormatCode: "0.0", showLegend: false, showTitle: true, title: "Entraîné sans aucun label IR à la main → testé sur IR réel test", catAxisLabelFontSize: 11 }));
txt(s, "Repère : meilleur score obtenu avec 100 images IR annotées à la main = 0,526.", { x: 0.6, y: 6.15, w: 7.6, h: 0.45, fontSize: 13, bold: true, color: C.accent1 });
reasonCard(s, 8.5, 1.55, 4.2, 5.1, "Quatre détecteurs entraînés sans annotation IR, tous testés sur l'IR réel test. 1 000 vraies images pseudo-étiquetées : 0,529 (0,523 sur une 2e machine).",
  "Le détecteur doit apprendre l'apparence thermique d'un piéton. Un label manquant transforme un piéton en fond ; une fausse apparence s'apprend même avec de bons labels. L'écart d'apparence coûte plus que le bruit des labels.");
s.addNotes("Script L2. La multimodalité sert deux fois : détecter et étiqueter.");

s = lessonFrame("L2 · nuance", "Ajouter quelques vrais labels peut faire baisser le score");
s.addChart(pres.charts.LINE, [
  { name: "départ : pseudo-labels RGB + IR seuls (0 label)", labels: ["10", "25", "50", "100"], values: [0.529, 0.529, 0.529, 0.529] },
  { name: "pseudo-labels RGB + IR, puis affinage", labels: ["10", "25", "50", "100"], values: [0.475, 0.489, 0.496, 0.517] },
  { name: "RGB réel, puis affinage", labels: ["10", "25", "50", "100"], values: [0.500, 0.540, 0.543, 0.526] },
  { name: "IR réel seul", labels: ["10", "25", "50", "100"], values: [0.328, 0.423, 0.458, 0.495] }],
  chartBase({ x: 0.6, y: 1.55, w: 7.6, h: 5.1, chartColors: [H.accent3, H.accent1, H.accent2, H.accent4], lineSize: 2.5, lineDataSymbolSize: 7, valAxisMinVal: 0.3, valAxisMaxVal: 0.6, valAxisLabelFormatCode: "0.00",
    showLegend: true, legendPos: "b", showTitle: true, title: "Testé sur IR réel test · mAP50-95 · 2 seeds", showCatAxisTitle: true, catAxisTitle: "N images d'IR réel train annotées (affinage, 100 époques)", catAxisTitleFontSize: 11, catAxisTitleColor: H.dk2 }));
card(s, 8.5, 1.55, 4.2, 5.1);
stat(s, 8.75, 1.7, 3.8, "0,529 → 0,475", "après affinage sur 10 vraies images", C.accent6, 32);
para(s, [["100 époques sur quelques images font oublier ce qu'ont appris 1 000 images pseudo-étiquetées (oubli, sur-apprentissage).", {}],
         ["La recette d'affinage, pensée pour un point de départ faible, est à revoir : affinage court, labels mélangés, auto-apprentissage.", { bold: true }]],
     { x: 8.75, y: 3.4, w: 3.75, h: 3.1, fontSize: 13 });
s.addNotes("Script L2, nuance honnête.");

s = lessonFrame("L3", "Le générateur échoue : la chaleur n'est pas dans son entrée");
s.addChart(pres.charts.BAR, [{ name: "mAP50-95", labels: ["IR réel test", "redimensionné 512²", "passé par le VAE", "512² + VAE (comme le générateur)"], values: [0.618, 0.628, 0.618, 0.620] }],
  chartBase({ x: 0.6, y: 1.55, w: 5.4, h: 4.2, barDir: "col", chartColors: [H.dk2, H.accent4, H.accent4, H.accent1], showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0.000",
    valAxisMinVal: 0, valAxisMaxVal: 0.7, valAxisLabelFormatCode: "0.0", showLegend: false, showTitle: true, title: "Détecteur IR appliqué à l'IR réel test transformé", catAxisLabelFontSize: 11 }));
img(s, "mean_rgb.png", 6.4, 1.6, 1.4, 3.25, "Piéton moyen en RGB de nuit : sombre, sans contraste");
img(s, "mean_ir.png", 8.0, 1.6, 1.4, 3.25, "Piéton moyen en IR : tête et torse chauds");
txt(s, "RGB moyen", { x: 6.4, y: 4.9, w: 1.4, h: 0.35, fontSize: 12, bold: true, color: C.accent2, align: "center" });
txt(s, "IR moyen", { x: 8.0, y: 4.9, w: 1.4, h: 0.35, fontSize: 12, bold: true, color: C.accent1, align: "center" });
txt(s, "Moyenne de 4 082 découpes de piétons du test, anonyme par construction", { x: 6.4, y: 5.3, w: 3.0, h: 0.5, fontSize: 10, color: C.accent4 });
reasonCard(s, 9.7, 1.55, 3.0, 4.25, "L'IR réel passé par le pipeline du générateur, sans traduction : 0,620 contre 0,618.",
  "L'architecture ne perd rien. Le générateur doit inventer une température quasi absente du RGB.");
card(s, 0.6, 6.0, 12.1, 0.7, C.text1);
txt(s, "Rendre une donnée synthétique viable : lui apporter une connaissance que sa source n'a pas, pas seulement plus de réalisme.", { x: 0.85, y: 6.0, w: 11.6, h: 0.7, fontSize: 15, bold: true, color: C.background1, valign: "middle" });
s.addNotes("Script L3. Le VAE ne perd que 1,7 % des piétons (les plus petits, sans contraste).");

s = lessonFrame("L3 · piéton par piéton", "Les piétons perdus sont visibles en RGB, mais restent froids");
img(s, "mean_pedestrian_5.png", 0.6, 1.5, 7.4, 3.03, "Piéton moyen sur 4 082 découpes du test : RGB sombre, IR réel et VAE avec tête et torse chauds, synthétique T1000 uniforme ; la carte d'écart est maximale sur la tête et le torse");
[["76 %", "des piétons trouvés sur l'IR réel sont perdus sur l'IR synthétique T1000"], ["89 %", "de ces perdus sont pourtant trouvés par le détecteur RGB sur l'image RGB"], ["2 %", "seulement sont aussi perdus après le seul passage par le VAE"]]
  .forEach(([b, t], i) => { const x = 0.6 + i * 2.5; card(s, x, 4.75, 2.35, 1.9); stat(s, x + 0.18, 4.85, 2.0, b, t, i === 2 ? C.accent5 : C.accent6, 30); });
img(s, "recall_by_lum.png", 8.3, 1.5, 4.4, 3.2, "Rappel selon la luminance RGB du piéton : stable pour l'IR réel, le VAE et le RGB ; pour le synthétique T1000, de 0,08 (piétons sombres) à 0,35 (piétons éclairés)");
card(s, 8.3, 4.75, 4.4, 1.9);
para(s, [["8 302 piétons du test, un par un (IoU ≥ 0,5, confiance ≥ 0,25).", {}],
         ["Perdus = plus sombres en RGB (luminance 0,12 contre 0,18) mais chauds en IR réel : le générateur suit la lumière, pas la chaleur.", { bold: true }]],
     { x: 8.5, y: 4.85, w: 4.0, h: 1.7, fontSize: 12, paraSpaceAfter: 4 });
s.addNotes("Script L3, analyse par piéton. Rappel du détecteur IR réel : IR réel 0,93, VAE 0,92, T1000 0,22. Parmi les piétons trouvés sur l'IR réel et perdus sur T1000, 89 % sont trouvés par le détecteur RGB sur le RGB, et 2 % seulement sont aussi perdus par le VAE : ce n'est ni la taille ni la compression, c'est la température. Contraste local des perdus : 0,042 en IR réel, 0,008 en synthétique. Régression logistique : AUC 0,72, la luminance RGB est le premier facteur. La courbe de droite : rappel du synthétique de 0,08 pour les piétons les plus sombres à 0,35 pour les plus éclairés.");

s = lessonFrame("L4", "Sur l'image entière, les métriques classent mal les sources");
const l4lab = ["IR réel (contrôle)", "IR synthétique T100", "IR synthétique T1000", "RGB réel"];
s.addChart(pres.charts.BAR, [{ name: "KID×1000", labels: l4lab, values: [0.09, 173, 163, 228] }],
  chartBase({ x: 0.6, y: 1.55, w: 4.1, h: 4.1, barDir: "col", chartColors: [H.accent5, H.accent1, H.accent1, H.accent2], showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "General",
    valAxisMinVal: 0, valAxisMaxVal: 260, valAxisLabelFormatCode: "0", showLegend: false, showTitle: true, title: "Distance à l'IR réel : KID×1000 (bas = proche)", catAxisLabelFontSize: 10 }));
s.addChart(pres.charts.BAR, [{ name: "Utilité", labels: l4lab, values: [0.623, 0.328, 0.384, 0.468] }],
  chartBase({ x: 4.85, y: 1.55, w: 4.1, h: 4.1, barDir: "col", chartColors: [H.accent5, H.accent1, H.accent1, H.accent2], showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0.000",
    valAxisMinVal: 0, valAxisMaxVal: 0.7, valAxisLabelFormatCode: "0.0", showLegend: false, showTitle: true, title: "Utilité : entraîné sur ce type → testé sur IR réel", catAxisLabelFontSize: 10 }));
txt(s, "Gauche : chaque jeu (moitié B du test) ↔ IR réel test A, 1 700 images. Droite : détecteur entraîné sur 12 025 images train du même type. FID et FD-DINOv2 donnent le même ordre (229 / 235 / 272 ; 1 198 / 1 209 / 1 262).",
    { x: 0.6, y: 5.75, w: 8.35, h: 0.9, fontSize: 11, color: C.accent4 });
reasonCard(s, 9.2, 1.55, 3.5, 5.1, "Le RGB est le plus loin de l'IR réel (KID 228) et le plus utile (0,468). Densité et couverture : 0 pour tous les jeux non réels.",
  "Ces métriques jugent l'apparence globale, dominée par le fond. Le détecteur a besoin de la forme des piétons : nette en RGB, dégradée en synthétique. Elles classent des générateurs, pas des sources.");
s.addNotes("Script L4. Les métriques classent correctement T1000 devant T100, mais l'ordre s'inverse entre sources de données.");

s = lessonFrame("L4 · ce que voit DINOv2", "L'IR synthétique forme sa propre famille d'images");
img(s, "umap.png", 0.6, 1.55, 5.6, 5.0, "Projection UMAP des vecteurs DINOv2 : l'IR synthétique forme ses propres amas, à l'écart de l'IR réel et du RGB");
card(s, 6.6, 1.55, 6.1, 5.0);
para(s, [["Comment lire cette carte", { bold: true, color: C.accent1 }],
         ["Chaque point est une image, placée selon ses caractéristiques DINOv2 (projection UMAP en 2D). Deux points proches = deux images que le réseau juge semblables.", {}],
         ["Ce qu'elle montre", { bold: true, color: C.accent1 }],
         ["IR réel (orange, bleu) : mêmes amas. RGB (vert) : à part. IR synthétique T100 / T1000 (rouge, violet) : ses propres amas, ni RGB ni IR.", {}],
         ["L’IR synthétique est une troisième modalité : densité et couverture nulles, aucune image ne tombe dans le nuage réel.", { bold: true }]],
     { x: 6.9, y: 1.7, w: 5.5, h: 4.7, fontSize: 14, paraSpaceAfter: 6 });
s.addNotes("Script §3.3 / L4. ref_ir_test = moitié A, ir_real = moitié B.");

s = lessonFrame("L4 · 11 jeux", "Sur les piétons, avec DINOv2, la distance suit l'utilité");
const rho = [["FD-DINOv2 · boîtes", 0.94], ["FD-DINOv2 · image", 0.90], ["KID · boîtes", 0.85], ["FID · image", 0.80], ["KID · image", 0.75], ["FID · boîtes", 0.73],
             ["Détectabilité (détecteur IR)", 0.51], ["FD-YOLO-IR · boîtes", 0.49], ["Corrélation de contraste · boîtes", 0.49], ["L1 apparié · boîtes", 0.28], ["Erreur de contraste · boîtes", 0.21], ["FD-YOLO-IR · image", 0.15]].reverse();
s.addChart(pres.charts.BAR, [{ name: "Spearman ρ", labels: rho.map((r) => r[0]), values: rho.map((r) => r[1]) }],
  chartBase({ x: 0.6, y: 1.5, w: 5.6, h: 5.15, barDir: "bar", chartColors: rho.map((r) => r[1] >= 0.62 ? (r[0] === "FD-DINOv2 · boîtes" ? H.accent1 : H.accent4) : H.accent6),
    showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0.00", valAxisMinVal: 0, valAxisMaxVal: 1.1, valAxisLabelFormatCode: "0.0", showLegend: false,
    showTitle: true, title: "Corrélation de rang métrique ↔ utilité (11 jeux ; significatif si ρ ≥ 0,62)", catAxisLabelFontSize: 10 }));
img(s, "scatter_dinov2_box.png", 6.4, 1.5, 3.3, 3.0, "Nuage de points : FD-DINOv2 dans les boîtes en abscisse, utilité en ordonnée ; les 11 jeux s'alignent, de l'IR réel en haut à gauche au générateur non entraîné en bas à droite");
txt(s, "x : FD-DINOv2 boîtes · y : utilité", { x: 6.4, y: 4.5, w: 3.3, h: 0.3, fontSize: 10, color: C.accent4, align: "center" });
card(s, 6.4, 4.9, 3.3, 1.75);
para(s, [["11 jeux", { bold: true, color: C.accent1 }], ["IR réel, IR + VAE, gris, gris inversé, RGB, 6 générateurs ou checkpoints. Utilité : détecteur entraîné sur 3 000 images du jeu, testé sur IR réel.", {}]],
     { x: 6.55, y: 5.0, w: 3.0, h: 1.6, fontSize: 10, paraSpaceAfter: 2 });
reasonCard(s, 9.9, 1.5, 2.8, 5.15, "FD-DINOv2 dans les boîtes : ρ = 0,94 (Pearson 0,98), stable si on retire un jeu (0,92–0,95). Les mesures du détecteur IR : ρ ≈ 0,5.",
  "Le détecteur IR juge la ressemblance à l'IR : le RGB lui paraît étranger, mais il entraîne bien. DINOv2 décrit la forme des objets, quelle que soit la modalité.");
s.addNotes("Script L4, résultat final. 11 jeux, 12 métriques testées : seuil de Bonferroni 0,004, la FD-DINOv2 dans les boîtes (p < 0,001) le passe. Entre générateurs seuls (6 jeux), presque toutes les distances classent bien (0,83 à 0,94) et la détectabilité parfaitement (1,00) : le détecteur IR sait départager deux IR synthétiques, pas une autre modalité. Limite : le gris inversé est le plus utile des trois jeux RGB (0,471) sans être le plus proche.");

s = lessonFrame("L5", "La robustesse s'entraîne ; un capteur mort ne s'hallucine pas");
const hdr = ["Scénario (test : paires RGB + IR réel test)", "RGB seul", "IR seul", "Late fusion", "Early + dropout", "Early sans dropout"];
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
reasonCard(s, 8.95, 1.55, 3.75, 5.1, "IR mort : 0,007 sans dropout, 0,485 avec. IR reconstruit : 0,276, pire que l'IR déclaré absent.",
  "Sans dropout, le réseau se repose sur l'IR et une image noire est une entrée jamais vue. L'IR reconstruit ressemble à de l'IR mais porte un faux contenu : le modèle lui fait confiance et se trompe.");
card(s, 0.6, 5.75, 8.1, 0.9, C.text1);
txt(s, "Un capteur dégradé se compense ; un capteur mort se prévoit ; un capteur manquant se déclare, il ne s'hallucine pas.", { x: 0.85, y: 5.75, w: 7.6, h: 0.9, fontSize: 14, bold: true, color: C.background1, valign: "middle" });
s.addNotes("Script L5, robustesse.");

s = lessonFrame("L5", "La latence se gagne hors du réseau");
s.addChart(pres.charts.BAR, [
  { name: "Pré-traitement", labels: ["Ultralytics + TensorRT", "100 % GPU"], values: [1.40, 0.28] },
  { name: "Réseau (+ NMS côté GPU)", labels: ["Ultralytics + TensorRT", "100 % GPU"], values: [1.42, 1.46] },
  { name: "Post-traitement", labels: ["Ultralytics + TensorRT", "100 % GPU"], values: [0.94, 0.17] },
  { name: "Copies, synchronisation", labels: ["Ultralytics + TensorRT", "100 % GPU"], values: [0.28, 0.39] }],
  chartBase({ x: 0.6, y: 1.55, w: 7.6, h: 4.3, barDir: "bar", barGrouping: "stacked", chartColors: [H.accent2, H.accent1, H.accent3, H.accent4], showValue: true, dataLabelPosition: "ctr", dataLabelFormatCode: "0.00",
    dataLabelColor: H.dk1, valAxisMinVal: 0, valAxisMaxVal: 4.5, valAxisLabelFormatCode: "0.0", showLegend: true, legendPos: "b", showTitle: true, title: "Millisecondes par image, batch 1, A100, même run" }));
txt(s, "Total : 4,04 ms → 2,30 ms (435 images/s), p95 4,86 → 2,46 ms, même mAP (0,613 / 0,612).", { x: 0.6, y: 6.0, w: 7.6, h: 0.5, fontSize: 14, bold: true, color: C.accent1 });
reasonCard(s, 8.5, 1.55, 4.2, 5.1, "TensorRT divise l'inférence par 4, mais le total seulement par 1,7 : le pré- et post-traitement CPU font 60 % du temps.",
  "Accélérer une seule partie ne réduit le total que d'autant (loi d'Amdahl). Et la copie à 98 ms : coordonner 128 threads coûtait cent fois plus que copier 4 Mo.");
s.addNotes("Script L5, latence.");

// ======================= 6. CONCLUSION =======================
section(5);
s = slide("CONTENU"); kicker(s, SEC[5]);
s.addText("Ce que ce projet a permis de montrer", { placeholder: "title" });
const concl = [["Une méthode qui marche", "pseudo-étiquetage croisé multimodal : 0,529 sans aucune annotation IR, mieux qu'avec 100 images annotées"],
               ["La génération RGB → IR est peu efficace", "le générateur n'apprend pas la chaleur, absente du RGB ; son architecture ne perd rien"],
               ["Donc : le RGB réel bat l'IR synthétique", "pour détecter en IR : 0,468 contre 0,384 sans label IR ; +0,02 à +0,04 après affinage"],
               ["Mesurer l'image sur les piétons", "image entière : le jeu le plus loin de l'IR réel est le plus utile ; boîtes + DINOv2 : ρ = 0,94 avec l'utilité (11 jeux)"],
               ["Côté système", "la robustesse s'entraîne, un capteur mort se déclare, la latence se gagne hors du réseau (2,3 ms)"]];
concl.forEach(([h, b], i) => {
  const y = 1.6 + i * 1.0;
  card(s, 0.6, y, 12.1, 0.85);
  dot(s, 0.8, y + 0.17, String(i + 1));
  txt(s, h, { x: 1.5, y, w: 4.2, h: 0.85, fontSize: 16, bold: true, color: C.text1, valign: "middle" });
  txt(s, b, { x: 5.8, y, w: 6.7, h: 0.85, fontSize: 14, color: C.text2, valign: "middle" });
});
s.addNotes("Script §6.");

s = slide("SOMBRE"); kicker(s, SEC[5], true);
s.addText("Pour les images de synthèse", { placeholder: "title" });
txt(s, "Une image synthétique n'est utile que si elle apporte une information que les données disponibles n'ont pas déjà.", { x: 0.6, y: 1.9, w: 12.1, h: 1.6, fontSize: 30, bold: true, color: C.background1, fontFace: THEME.headFontFace });
txt(s, "Ici, la chaleur manquait.", { x: 0.6, y: 3.55, w: 12.1, h: 0.7, fontSize: 24, italic: true, color: C.accent3, fontFace: THEME.headFontFace });
[["Prochaine étape", "un générateur guidé par la physique ou supervisé sur les piétons"], ["Critère d'adoption", "qu'il batte la référence la plus simple : les pseudo-labels"], ["Et ensuite", "auto-apprentissage itératif, affinage plus doux, INT8"]]
  .forEach(([h, b], i) => {
    const x = 0.6 + i * 4.1;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 4.7, w: 3.8, h: 1.7, fill: { color: "222846" }, line: { color: "222846" }, rectRadius: 0.12, objectName: nm("Carte") });
    txt(s, h, { x: x + 0.25, y: 4.85, w: 3.3, h: 0.45, fontSize: 16, bold: true, color: C.accent1 });
    txt(s, b, { x: x + 0.25, y: 5.3, w: 3.3, h: 1.0, fontSize: 14, color: C.background1 });
  });
s.addNotes("Script §6, phrase de fin. Merci.");

(async () => {
  await pres.writeFile({ fileName: OUT });
  await applyTheme(OUT, THEME);
  console.log("written", OUT);
})();
