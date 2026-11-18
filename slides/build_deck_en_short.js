// Short English deck (10 slides): objective, two labelling methods, scenarios, results, lessons. Built from build_deck_en.js.
// Build (from the project root): PPTX_SKILL=<skill dir> NODE_PATH=slides/node_modules node slides/build_deck_en.js
// Output: slides/BSA_night_IR_EN.pptx. Assets: slides/make_assets.py (same images as the French deck).
const path = require("path");
const pptxgen = require("pptxgenjs");
const { applyTheme } = require(path.join(process.env.PPTX_SKILL, "scripts/apply_theme.js"));

const A = (f) => path.join(__dirname, "assets", f);
const OUT = path.join(__dirname, "BSA_night_IR_EN_short.pptx");

// Night ink dominates; thermal orange = the single sharp accent; cool blue = RGB; amber = highlights on dark.
const THEME = {
  name: "Thermal night", headFontFace: "Cambria", bodyFontFace: "Calibri",
  colors: { dk1: "14182E", lt1: "FFFFFF", dk2: "3A4160", lt2: "EEF1F7",
            accent1: "E8743B", accent2: "4C7BD9", accent3: "F2B33D", accent4: "8A90A6", accent5: "2E9E78", accent6: "C8414F",
            hlink: "4C7BD9", folHlink: "8A90A6" },
};
const H = THEME.colors; // hex: charts only (pptxgenjs needs hex there)

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.333 x 7.5 in
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
pres.title = "Multimodal RGB-Thermal Pedestrian Detection with Few Labelled Data";
pres.author = "Personal project";
const C = pres.SchemeColor;

const FOOT = "Seeing at night without night data · personal project, public LLVIP data";
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
const SEC = ["1 · Objective", "2 · Labelling methods", "3 · Scenarios", "4 · Results", "5 · Lessons"];
let sec = -1;
function section(i) { sec = i; pres.addSection({ title: SEC[i] }); }
function slide(master) { return pres.addSlide({ masterName: master, sectionTitle: SEC[sec] }); }
const fmt = (v) => v.toFixed(3);

function reasonCard(sl, x, y, w, h, calc, reason) {
  card(sl, x, y, w, h);
  para(sl, [["The computation", { bold: true, color: C.accent1 }], [calc, {}], ["The reason", { bold: true, color: C.accent1 }], [reason, { bold: true }]],
       { x: x + 0.25, y: y + 0.15, w: w - 0.5, h: h - 0.3, fontSize: 13, paraSpaceAfter: 5 });
}

// ======================= 1. OBJECTIVE =======================
section(0);
let s = slide("TITLE");
s.addText("Multimodal RGB–Thermal Pedestrian Detection with Few Labelled Data", { placeholder: "title", fontSize: 32 });
s.addText([{ text: "Seeing at night without night data", options: { italic: true, bold: true, fontSize: 20, color: C.accent3, breakLine: true } },
           { text: "Objective: detect pedestrians in thermal infrared with 0 to 100 labelled IR images, and keep detecting when a camera fails", options: { fontSize: 15, color: C.background1 } }],
          { placeholder: "body", paraSpaceBefore: 0, paraSpaceAfter: 8 });
img(s, "ir_panel.jpg", 8.3, 1.9, 4.4, 3.33, "Night infrared image with three detected pedestrians");
txt(s, "Thermal camera, night (LLVIP): 3 pedestrians detected", { x: 8.3, y: 5.35, w: 4.4, h: 0.4, fontSize: 11, color: C.accent4 });
txt(s, "Personal project · public data (LLVIP) · rented GPUs · YOLO11s · mAP50-95 on real IR test", { x: 0.8, y: 6.7, w: 9, h: 0.4, fontSize: 12, color: C.accent4 });
s.addNotes("Objective of the project.");

s = slide("CONTENT"); kicker(s, SEC[0]);
s.addText("Two budgets: labelled IR is rare, pairs are free", { placeholder: "title" });
[["12,025", "labelled IR images: the reference, 0.623 mAP50-95", C.text1], ["0 to 100", "labelled IR images: the realistic budget", C.text1], ["1,000", "unlabelled RGB / IR pairs, pixel-aligned", C.accent1]]
  .forEach(([b, t, col], i) => { const x = 0.6 + i * 4.1; card(s, x, 1.65, 3.8, 1.9); stat(s, x + 0.3, 1.8, 3.2, b, t, col, 40); });
img(s, "nominal_row.jpg", 0.6, 3.95, 8.2, 2.19, "RGB view, IR view and fused view of the same scene, heads blurred");
txt(s, "RGB · IR · fusion: same scene, heads blurred", { x: 0.6, y: 6.2, w: 8.2, h: 0.3, fontSize: 11, color: C.accent4 });
txt(s, [{ text: "Dataset: LLVIP ", options: { bold: true, color: C.accent1 } },
        { text: "(Jia et al., ICCV Workshops 2021) · 15,488 pixel-aligned visible / thermal pairs, night street scenes · 12,025 train / 3,463 test", options: { color: C.text1 } }],
    { x: 0.6, y: 6.5, w: 12.1, h: 0.35, fontSize: 12 });
card(s, 9.1, 3.95, 3.6, 2.35);
para(s, [["The two questions", { bold: true, color: C.accent1 }], ["With 0 to 100 IR labels and free pairs, how close can we get to 0.623?", {}], ["If a camera fails, does detection survive?", {}]],
     { x: 9.35, y: 4.1, w: 3.1, h: 2.1, fontSize: 15 });
s.addNotes("mAP50-95: box accuracy, from 0 to 1. All detection results are tested on the 3,463 real IR test images (unseen scenes).");

// ======================= 2. LABELLING METHODS =======================
section(1);
s = slide("CONTENT"); kicker(s, SEC[1]);
s.addText("Two ways to get IR training labels for free", { placeholder: "title" });
// A. translate
card(s, 0.6, 1.55, 6.0, 5.1);
txt(s, "A. Translate RGB into IR", { x: 0.85, y: 1.7, w: 5.5, h: 0.45, fontSize: 18, bold: true, color: C.accent1 });
txt(s, "pix2pix-turbo (SD-Turbo + LoRA) trained on 100 / 1,000 pairs → synthetic IR, which keeps the true RGB boxes", { x: 0.85, y: 2.15, w: 5.5, h: 0.6, fontSize: 13, color: C.text2 });
stripLabels(s, 0.85, 2.85, 5.5, ["RGB (input)", "synthetic T100", "synthetic T1000", "real IR"], [C.accent2, C.accent1, C.accent1, C.text1]);
img(s, "gen_turbo_row_people.jpg", 0.85, 3.2, 5.5, 1.08, "Pedestrians: grey in synthetic IR, hot in real IR");
para(s, [["12,025 synthetic IR images, labels = real RGB annotations.", {}],
         ["Pedestrians come out grey, not hot: the generator copies RGB brightness, not temperature.", { bold: true }]],
     { x: 0.85, y: 4.5, w: 5.5, h: 2.0, fontSize: 13, paraSpaceAfter: 6 });
// B. pseudo-label
card(s, 6.75, 1.55, 5.95, 5.1);
txt(s, "B. Pseudo-label the real IR", { x: 7.0, y: 1.7, w: 5.5, h: 0.45, fontSize: 18, bold: true, color: C.accent1 });
txt(s, "A generic COCO detector (never saw LLVIP) runs on RGB and on IR; the union of its boxes (NMS 0.5) labels the real IR image", { x: 7.0, y: 2.15, w: 5.5, h: 0.6, fontSize: 13, color: C.text2 });
s.addChart(pres.charts.BAR, [
  { name: "Precision (correct boxes)", labels: ["COCO on RGB", "COCO on IR", "RGB + IR fused"], values: [0.87, 0.83, 0.83] },
  { name: "Recall (pedestrians found)", labels: ["COCO on RGB", "COCO on IR", "RGB + IR fused"], values: [0.34, 0.42, 0.50] }],
  chartBase({ x: 7.0, y: 2.8, w: 5.5, h: 2.6, barDir: "col", barGrouping: "clustered", chartColors: [H.dk2, H.accent1], showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0.00",
    valAxisMinVal: 0, valAxisMaxVal: 1, valAxisLabelFormatCode: "0.0", showLegend: true, legendPos: "b", showTitle: true, title: "Pseudo-label quality on 1,000 pairs", catAxisLabelFontSize: 11 }));
para(s, [["Works because RGB and IR are pixel-aligned: a box copies as is. No dataset label used.", { bold: true }]],
     { x: 7.0, y: 5.6, w: 5.5, h: 0.9, fontSize: 13 });
s.addNotes("Method A: translate images, keep RGB labels. Method B: keep real IR images, transfer labels from a generic detector run on both modalities. Fusing the two modalities raises pseudo-label recall from 34% to 50%.");

// ======================= 3. SCENARIOS =======================
section(2);
s = slide("CONTENT"); kicker(s, SEC[2] + " · fusion");
s.addText("Fusing two cameras: late fusion or early fusion", { placeholder: "title" });
function fusionDiagram(x, title, sub, early) {
  card(s, x, 1.55, 5.9, 3.6);
  txt(s, title, { x: x + 0.3, y: 1.7, w: 5.3, h: 0.45, fontSize: 18, bold: true, color: C.accent1 });
  txt(s, sub, { x: x + 0.3, y: 2.15, w: 5.3, h: 0.45, fontSize: 13, color: C.text2 });
  const box = (bx, by, bw, bh, t, fill, col) => { s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: bx, y: by, w: bw, h: bh, fill: { color: fill }, line: { color: fill }, rectRadius: 0.08, objectName: nm("Block") }); txt(s, t, { x: bx, y: by, w: bw, h: bh, fontSize: 12, bold: true, color: col, align: "center", valign: "middle" }); };
  if (!early) {
    box(x + 0.3, 2.8, 1.1, 0.6, "RGB", C.accent2, C.background1); box(x + 0.3, 3.9, 1.1, 0.6, "IR", C.accent1, C.background1);
    arrow(s, x + 1.5, 2.95, 0.3, 0.3); arrow(s, x + 1.5, 4.05, 0.3, 0.3);
    box(x + 1.9, 2.8, 1.5, 0.6, "RGB detector", C.text1, C.background1); box(x + 1.9, 3.9, 1.5, 0.6, "IR detector", C.text1, C.background1);
    arrow(s, x + 3.5, 3.5, 0.3, 0.3);
    box(x + 3.9, 3.3, 1.7, 0.75, "Box fusion (WBF)", C.accent3, C.text1);
  } else {
    box(x + 0.3, 2.8, 1.1, 0.6, "RGB", C.accent2, C.background1); box(x + 0.3, 3.9, 1.1, 0.6, "IR", C.accent1, C.background1);
    arrow(s, x + 1.5, 3.5, 0.3, 0.3);
    box(x + 1.9, 3.15, 1.5, 1.05, "4-channel image\nR · G · B · IR", C.accent3, C.text1);
    arrow(s, x + 3.5, 3.5, 0.3, 0.3);
    box(x + 3.9, 3.3, 1.7, 0.75, "A single detector", C.text1, C.background1);
  }
}
fusionDiagram(0.6, "Late fusion", "two independent detectors, boxes fused by confidence", false);
fusionDiagram(6.8, "Early fusion", "the two images stacked, a single network", true);
txt(s, "Modular: if one camera dies, the other detector carries on alone.", { x: 0.9, y: 4.65, w: 5.3, h: 0.4, fontSize: 13, italic: true, color: C.text1 });
txt(s, "More accurate, but the network can become dependent on IR.", { x: 7.1, y: 4.65, w: 5.3, h: 0.4, fontSize: 13, italic: true, color: C.text1 });
card(s, 0.6, 5.4, 12.1, 1.25, C.text1);
para(s, [["Modality dropout (early fusion, training only): ", { bold: true, color: C.accent3 }],
         ["70% of training images keep RGB + IR, 15% have IR set to zero, 15% have RGB set to zero. The network learns to detect with each sensor alone and to read \"channel at zero = sensor missing\". Ablation: the same model trained without dropout.", { color: C.background1 }]],
     { x: 0.85, y: 5.45, w: 11.6, h: 1.15, fontSize: 14, paraSpaceAfter: 2, valign: "middle" });
s.addNotes("Late fusion = WBF of two detectors. Early fusion = one detector on a 4-channel image, with or without modality dropout.");

s = slide("CONTENT"); kicker(s, SEC[2] + " · sensor scenarios");
s.addText("Stress-testing the system: three families of scenarios", { placeholder: "title" });
const vw = 1.35, vh = 1.0;
const fams = [["Normal sensors", "baseline", [["sc_rgb_nominal.jpg", "Nominal RGB"], ["sc_ir_nominal.jpg", "Nominal IR"]]],
              ["Degraded sensor", "the signal exists, but it is poor: does the other sensor compensate?", [["sc_rgb_fog.jpg", "RGB fog"], ["sc_rgb_dark.jpg", "RGB pitch dark"]]],
              ["Dead sensor", "no signal at all: was the system designed to lose a sensor?", [["sc_rgb_dead.jpg", "RGB dead"], ["sc_ir_dead.jpg", "IR dead"]]],
              ["Bonus", "can we hallucinate the missing sensor?", [["sc_ir_reconstructed.jpg", "IR reconstructed from RGB"]]]];
let fx = 0.6;
fams.forEach(([h, sub, ims], i) => {
  const w = ims.length * (vw + 0.15) + 0.25;
  card(s, fx, 1.6, w, 4.15, C.background2);
  txt(s, h, { x: fx + 0.15, y: 1.72, w: w - 0.3, h: 0.4, fontSize: 16, bold: true, color: i === 2 ? C.accent6 : C.accent1 });
  txt(s, sub, { x: fx + 0.15, y: 2.12, w: w - 0.3, h: 0.95, fontSize: 12, color: C.text2 });
  ims.forEach(([f, l], j) => {
    const ix = fx + 0.15 + j * (vw + 0.15);
    img(s, f, ix, 3.3, vw, vh, l);
    if (f.includes("dead")) txt(s, "no signal", { x: ix, y: 3.3, w: vw, h: vh, fontSize: 12, bold: true, color: C.accent6, align: "center", valign: "middle" });
    txt(s, l, { x: ix, y: 4.4, w: vw, h: 0.75, fontSize: 12, bold: true, color: C.text1, align: "center" });
  });
  fx += w + 0.2;
});
card(s, 0.6, 5.95, 12.1, 0.75, C.text1);
txt(s, "Each scenario is applied to the 3,463 real RGB + IR test pairs; every detector is scored with the same evaluator (mAP50-95).",
    { x: 0.85, y: 5.95, w: 11.6, h: 0.75, fontSize: 14, bold: true, color: C.background1, valign: "middle" });
s.addNotes("Fog: image blended with a light veil + noise. Pitch dark: gamma 2.5, gain 0.35, sensor noise. Dead: fully black image. Reconstructed: IR generated from the RGB by the generator.");

// ======================= 4. RESULTS =======================
section(3);
s = slide("CONTENT"); kicker(s, SEC[3] + " · synthetic image quality");
s.addText("Synthetic IR looks closer to IR than RGB does, yet trains worse", { placeholder: "title" });
const l4lab = ["real IR (control)", "synthetic IR T100", "synthetic IR T1000", "real RGB"];
s.addChart(pres.charts.BAR, [{ name: "KID×1000", labels: l4lab, values: [0.09, 173, 163, 228] }],
  chartBase({ x: 0.6, y: 1.55, w: 4.1, h: 4.1, barDir: "col", chartColors: [H.accent5, H.accent1, H.accent1, H.accent2], showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "General",
    valAxisMinVal: 0, valAxisMaxVal: 260, valAxisLabelFormatCode: "0", showLegend: false, showTitle: true, title: "Distance to real IR: KID×1000 (low = close)", catAxisLabelFontSize: 10 }));
s.addChart(pres.charts.BAR, [{ name: "Usefulness", labels: l4lab, values: [0.623, 0.328, 0.384, 0.468] }],
  chartBase({ x: 4.85, y: 1.55, w: 4.1, h: 4.1, barDir: "col", chartColors: [H.accent5, H.accent1, H.accent1, H.accent2], showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0.000",
    valAxisMinVal: 0, valAxisMaxVal: 0.7, valAxisLabelFormatCode: "0.0", showLegend: false, showTitle: true, title: "Usefulness: trained on this type → tested on real IR", catAxisLabelFontSize: 10 }));
txt(s, "Left: each set (test half B) ↔ real IR test half A, 1,700 images, same scenes (control = real IR B ↔ A). Right: detector trained on 12,025 train images of that type. FID and FD-DINOv2 give the same order.",
    { x: 0.6, y: 5.75, w: 8.35, h: 0.9, fontSize: 11, color: C.accent4 });
reasonCard(s, 9.2, 1.55, 3.5, 5.1, "RGB is the farthest from real IR (KID 228) and the most useful (0.468). Density and coverage: 0 for every non-real set.",
  "Whole-image metrics judge overall appearance, dominated by the background (pedestrians are ~3% of pixels). The detector needs pedestrian shape: sharp in RGB, degraded in synthetic.");
s.addNotes("Synthesis metrics compare two image sets; usefulness = mAP of a detector trained only on that set, tested on real IR.");

s = slide("CONTENT"); kicker(s, SEC[3] + " · synthetic image quality");
s.addText("On pedestrians, DINOv2 distance tracks usefulness", { placeholder: "title" });
const BEST = "FD-DINOv2 · boxes";
const rho = [[BEST, 0.94], ["FD-DINOv2 · image", 0.90], ["KID · boxes", 0.85], ["FID · image", 0.80], ["KID · image", 0.75], ["FID · boxes", 0.73],
             ["Detectability (IR detector)", 0.51], ["FD-YOLO-IR · boxes", 0.49], ["Contrast correlation · boxes", 0.49], ["Paired L1 · boxes", 0.28], ["Contrast error · boxes", 0.21], ["FD-YOLO-IR · image", 0.15]].reverse();
s.addChart(pres.charts.BAR, [{ name: "Spearman ρ", labels: rho.map((r) => r[0]), values: rho.map((r) => r[1]) }],
  chartBase({ x: 0.6, y: 1.5, w: 5.6, h: 5.15, barDir: "bar", chartColors: rho.map((r) => r[1] >= 0.62 ? (r[0] === BEST ? H.accent1 : H.accent4) : H.accent6),
    showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0.00", valAxisMinVal: 0, valAxisMaxVal: 1.1, valAxisLabelFormatCode: "0.0", showLegend: false,
    showTitle: true, title: "Rank correlation metric ↔ usefulness (11 sets; significant if ρ ≥ 0.62)", catAxisLabelFontSize: 10 }));
img(s, "scatter_dinov2_box.png", 6.4, 1.5, 3.3, 3.0, "Scatter plot: FD-DINOv2 on boxes on x, usefulness on y; the 11 sets line up");
txt(s, "x: FD-DINOv2 boxes · y: usefulness", { x: 6.4, y: 4.5, w: 3.3, h: 0.3, fontSize: 10, color: C.accent4, align: "center" });
card(s, 6.4, 4.9, 3.3, 1.75);
para(s, [["11 sets", { bold: true, color: C.accent1 }], ["Real IR, IR + VAE, grey, inverted grey, RGB, 6 generators or checkpoints. Usefulness: detector trained on 3,000 images of the set, tested on real IR.", {}]],
     { x: 6.55, y: 5.0, w: 3.0, h: 1.6, fontSize: 10, paraSpaceAfter: 2 });
reasonCard(s, 9.9, 1.5, 2.8, 5.15, "FD-DINOv2 on pedestrian crops: ρ = 0.94 (Pearson 0.98), stable when one set is removed. The IR detector's own features: ρ ≈ 0.5.",
  "The IR detector judges resemblance to IR: RGB looks alien to it, yet trains well. DINOv2 describes object shape, whatever the modality.");
s.addNotes("11 sets, 12 metrics; FD-DINOv2 on boxes passes the Bonferroni threshold (p < 0.004).");

s = slide("CONTENT"); kicker(s, SEC[3] + " · detection");
s.addText("Detection: transferring labels beats translating images", { placeholder: "title" });
s.addChart(pres.charts.BAR, [{ name: "mAP50-95", labels: [
    "Method A · 12,025 generated (fake) IR T1000, true RGB boxes",
    "1,000 real IR, pseudo-labels from RGB only",
    "12,025 real RGB, true boxes (no IR at all)",
    "Method B · 1,000 real IR, pseudo-labels from RGB + IR"], values: [0.384, 0.424, 0.468, 0.529] }],
  chartBase({ x: 0.6, y: 1.55, w: 7.6, h: 4.45, barDir: "bar", chartColors: [H.accent4, H.accent4, H.accent2, H.accent1], showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0.000",
    valAxisMinVal: 0, valAxisMaxVal: 0.6, valAxisLabelFormatCode: "0.0", showLegend: false, showTitle: true, title: "Training set of each YOLO11s · zero hand-labelled IR image", catAxisLabelFontSize: 10 }));
para(s, [["All scores: tested on the 3,463 real IR test images (mAP50-95, 2 seeds). ", { bold: true, color: C.accent1 }],
         ["References with hand-labelled real IR: 12,025 images = 0.623; best with 100 images = 0.526.", { color: C.text1 }]],
     { x: 0.6, y: 6.05, w: 7.6, h: 0.6, fontSize: 12, paraSpaceAfter: 0 });
card(s, 8.5, 1.55, 4.2, 5.1);
txt(s, "With 10 hand-labelled real IR images", { x: 8.75, y: 1.65, w: 3.8, h: 0.4, fontSize: 14, bold: true, color: C.accent1 });
txt(s, "pre-training (or not), then fine-tuning on 10 real IR · tested on real IR test", { x: 8.75, y: 2.05, w: 3.8, h: 0.45, fontSize: 11, color: C.accent4 });
[["0.328", "no pre-training: the 10 real IR images only", C.accent4], ["0.468", "pre-trained on 12,025 generated (fake) IR T100", C.accent1], ["0.500", "pre-trained on 12,025 real RGB", C.accent2]]
  .forEach(([b, t, col], i) => { txt(s, b, { x: 8.75, y: 2.6 + i * 0.75, w: 1.4, h: 0.65, fontSize: 26, bold: true, color: col, fontFace: THEME.headFontFace, valign: "middle" }); txt(s, t, { x: 10.2, y: 2.6 + i * 0.75, w: 2.35, h: 0.65, fontSize: 12, color: C.text2, valign: "middle" }); });
para(s, [["Fake IR pre-training helps (+0.14), but real RGB with the same boxes helps more, at every N (10 to 100): the gain came from the RGB labels, not from the translation.", { bold: true }]],
     { x: 8.75, y: 4.95, w: 3.75, h: 1.6, fontSize: 12 });
s.addNotes("Bar chart: four YOLO11s trained without any hand-labelled IR image. Method A trains on generated (fake) IR; the two pseudo-label bars train on REAL IR images whose labels come from a COCO detector run on RGB (or RGB + IR); the RGB bar trains on real RGB with the dataset boxes. All tested on real IR test. 2 seeds per configuration. Method B (pseudo-labelling with RGB + IR fused) without any IR label beats every method with 100 labels.");

s = slide("CONTENT"); kicker(s, SEC[3] + " · robustness");
s.addText("Robustness: fusion with dropout survives a failing sensor", { placeholder: "title" });
const hdr = ["Scenario (test: real RGB + IR test pairs)", "RGB only", "IR only", "Late fusion", "Early + dropout", "Early, no dropout"];
const rows = [["Nominal", .516, .610, .620, .642, .610], ["RGB fog", .124, .610, .613, .641, .633], ["RGB pitch dark", .068, .610, .610, .617, .563],
              ["RGB dead", 0, .610, .619, .614, .550], ["IR dead", .516, 0, .514, .485, .007], ["IR reconstructed from RGB", .516, .177, .507, .276, .118]];
s.addTable([hdr.map((h) => ({ text: h, options: { bold: true, color: C.background1, fill: { color: C.text1 }, fontSize: 12, align: "center", valign: "middle" } })),
            ...rows.map((r, ri) => r.map((v, ci) => {
              const o = { fontSize: 13, align: ci === 0 ? "left" : "center", valign: "middle", color: C.text1, fill: { color: ci === 4 ? C.background2 : C.background1 }, bold: ci === 4 };
              if ((ri === 4 && ci === 5) || (ri === 5 && ci === 4)) { o.color = C.accent6; o.bold = true; }
              return { text: typeof v === "number" ? fmt(v) : v, options: o };
            }))],
  { x: 0.6, y: 1.55, w: 8.1, colW: [2.6, 1.0, 1.0, 1.1, 1.2, 1.2], rowH: 0.5, border: { type: "solid", pt: 0.75, color: "D9DDE8" }, objectName: nm("Robustness matrix") });
txt(s, "mAP50-95 · detectors trained on the train split · same evaluator for every cell", { x: 0.6, y: 5.2, w: 8.1, h: 0.4, fontSize: 11, color: C.accent4 });
reasonCard(s, 8.95, 1.55, 3.75, 5.1, "Fog / dark RGB: IR and fusion hold (0.61–0.64). IR dead: early fusion 0.007 without dropout, 0.485 with it. IR reconstructed: 0.276, worse than IR declared missing.",
  "Without dropout, the network leans on IR and a black image is an unseen input. Reconstructed IR looks like IR but carries false content: the model trusts it and gets it wrong.");
card(s, 0.6, 5.75, 8.1, 0.9, C.text1);
txt(s, "Deployed: TensorRT FP16, 100% GPU pipeline, 2.30 ms per image (435 img/s) vs 4.04 ms with CPU pre/post-processing, same mAP.", { x: 0.85, y: 5.75, w: 7.6, h: 0.9, fontSize: 13, bold: true, color: C.background1, valign: "middle" });
s.addNotes("Degraded sensor: compensated by the other. Dead sensor: handled only if planned for (late fusion, or dropout).");

// ======================= 5. LESSONS =======================
section(4);
s = slide("DARK"); kicker(s, SEC[4], true);
s.addText("Lessons learned", { placeholder: "title" });
const les = [["Compare to the strongest naive baseline", "real RGB with the same boxes beats synthetic IR at every N: the gain came from the labels"],
             ["Transfer labels rather than translate images", "pseudo-labelled real IR (RGB + IR fused): 0.529 with zero IR labels"],
             ["The generator lacks information, not capacity", "76% of pedestrians lost on generated IR T1000, 89% of them visible in RGB: it follows light, not heat"],
             ["Measure images where the detector looks", "whole-image metrics mislead between sources; on pedestrian crops, FD-DINOv2 tracks usefulness (ρ = 0.94)"],
             ["A dead sensor is declared, not hallucinated", "modality dropout: IR dead 0.007 → 0.485; reconstructed IR 0.276"]];
les.forEach(([h, b], i) => {
  const y = 1.55 + i * 0.86;
  dot(s, 0.6, y + 0.1, "L" + (i + 1), 0.55);
  txt(s, h, { x: 1.35, y, w: 4.6, h: 0.75, fontSize: 16, bold: true, color: C.background1, valign: "middle" });
  txt(s, b, { x: 6.1, y, w: i === 2 ? 4.05 : 6.6, h: 0.75, fontSize: 13, color: C.accent4, valign: "middle" });
});
// L3 vignette: VAE ceiling test (real IR through the generator's compression, no translation)
s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 10.3, y: 3.12, w: 2.4, h: 1.0, fill: { color: "222846" }, line: { color: H.accent3, width: 1 }, rectRadius: 0.1, objectName: nm("VAE ceiling") });
txt(s, [{ text: "Real IR → 512² + VAE", options: { bold: true, color: C.background1, fontSize: 11, breakLine: true } },
        { text: "no translation · IR detector", options: { color: C.accent4, fontSize: 9, breakLine: true } },
        { text: "0.620 vs 0.618", options: { bold: true, color: C.accent3, fontSize: 17 } }],
    { x: 10.4, y: 3.15, w: 2.2, h: 0.94, align: "center", valign: "middle", fontFace: THEME.bodyFontFace });
txt(s, "A synthetic image is only useful if it brings information the available data does not already have. Here, the missing piece was heat.",
    { x: 0.6, y: 6.0, w: 12.1, h: 0.8, fontSize: 18, italic: true, bold: true, color: C.accent3, fontFace: THEME.headFontFace, valign: "middle" });
s.addNotes("Five lessons and the closing line.");

(async () => {
  await pres.writeFile({ fileName: OUT });
  await applyTheme(OUT, THEME);
  console.log("written", OUT);
})();
