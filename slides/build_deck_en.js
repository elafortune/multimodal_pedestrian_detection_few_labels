// English deck "Seeing at night without night data" — straight translation of build_deck.js (FR v3), for the video.
// Build (from the project root): PPTX_SKILL=<skill dir> NODE_PATH=slides/node_modules node slides/build_deck_en.js
// Output: slides/BSA_night_IR_EN.pptx. Assets: slides/make_assets.py (same images as the French deck).
const path = require("path");
const pptxgen = require("pptxgenjs");
const { applyTheme } = require(path.join(process.env.PPTX_SKILL, "scripts/apply_theme.js"));

const A = (f) => path.join(__dirname, "assets", f);
const OUT = path.join(__dirname, "BSA_night_IR_EN.pptx");

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
pres.title = "Seeing at night without night data";
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
const SEC = ["1 · Why this project", "2 · The problem", "3 · The approach", "4 · Demo", "5 · Lessons", "6 · Conclusion"];
let sec = -1;
function section(i) { sec = i; pres.addSection({ title: SEC[i] }); }
function slide(master) { return pres.addSlide({ masterName: master, sectionTitle: SEC[sec] }); }
const fmt = (v) => v.toFixed(3);

// ======================= 1. WHY =======================
section(0);
let s = slide("TITLE");
s.addText("Seeing at night without night data", { placeholder: "title" });
s.addText("Detecting pedestrians in infrared with very few labels: synthetic images, cross-modal pseudo-labelling and fusion that survives losing a sensor", { placeholder: "body" });
img(s, "ir_panel.jpg", 8.3, 1.9, 4.4, 3.33, "Night infrared image with three detected pedestrians");
txt(s, "Thermal camera, night (LLVIP): 3 pedestrians detected", { x: 8.3, y: 5.35, w: 4.4, h: 0.4, fontSize: 11, color: C.accent4 });
txt(s, "Personal project · public data · rented GPUs", { x: 0.8, y: 6.7, w: 8, h: 0.4, fontSize: 12, color: C.accent4 });
s.addNotes("Script §1. Introduction, then the motivation.");

s = slide("CONTENT"); kicker(s, SEC[0]);
s.addText("Synthetic images: making their value measurable", { placeholder: "title" });
para(s, [["The topic that struck me most", { bold: true, color: C.accent1 }],
         ["Of everything I have studied, synthetic images are the subject that motivates me most: making them as useful as real images, not just as good-looking.", {}],
         ["Why infrared", { bold: true, color: C.accent1 }],
         ["At night, an RGB camera is almost blind; a thermal camera still sees people. But annotated thermal images are rare and expensive: that is where a synthetic image would be worth the most.", {}],
         ["A question with a numerical answer", { bold: true, color: C.accent1 }],
         ["Does a detector trained on these images find more pedestrians?", {}]],
     { x: 0.6, y: 1.65, w: 5.6, h: 5.0, fontSize: 15, paraSpaceAfter: 6 });
img(s, "pl_rgb.jpg", 6.6, 1.75, 3.0, 2.27, "Night RGB view, heads blurred");
img(s, "pl_ir.jpg", 9.75, 1.75, 3.0, 2.27, "Same scene in infrared");
txt(s, "Night RGB", { x: 6.6, y: 4.08, w: 3.0, h: 0.35, fontSize: 13, bold: true, color: C.accent2, align: "center" });
txt(s, "Thermal infrared, same instant", { x: 9.75, y: 4.08, w: 3.0, h: 0.35, fontSize: 13, bold: true, color: C.accent1, align: "center" });
card(s, 6.6, 4.75, 6.15, 1.75);
txt(s, "Is a synthetic image as useful as a real one for training a detector?", { x: 6.85, y: 4.75, w: 5.7, h: 1.75, fontSize: 18, bold: true, italic: true, color: C.text1, valign: "middle" });
s.addNotes("Script §1. Heads blurred on the RGB views.");

// ======================= 2. PROBLEM =======================
section(1);
s = slide("CONTENT"); kicker(s, SEC[1]);
s.addText("Two budgets: labelled IR is rare, pairs are free", { placeholder: "title" });
[["12,025", "labelled IR images: the reference, 0.623 mAP50-95", C.text1], ["0 to 100", "labelled IR images: the realistic budget", C.text1], ["1,000", "unlabelled RGB / IR pairs, pixel-aligned", C.accent1]]
  .forEach(([b, t, col], i) => { const x = 0.6 + i * 4.1; card(s, x, 1.65, 3.8, 1.9); stat(s, x + 0.3, 1.8, 3.2, b, t, col, 40); });
img(s, "nominal_row.jpg", 0.6, 3.95, 8.2, 2.19, "RGB view, IR view and fused view of the same scene, heads blurred");
txt(s, "RGB · IR · fusion: same scene, heads blurred", { x: 0.6, y: 6.2, w: 8.2, h: 0.35, fontSize: 11, color: C.accent4 });
card(s, 9.1, 3.95, 3.6, 2.6);
para(s, [["The two questions", { bold: true, color: C.accent1 }], ["With 0 to 100 IR labels and free pairs, how close can we get to 0.623?", {}], ["If a camera fails, does detection survive?", {}]],
     { x: 9.35, y: 4.15, w: 3.1, h: 2.3, fontSize: 15 });
s.addNotes("Script §2. mAP50-95: box accuracy, from 0 to 1.");

s = slide("CONTENT"); kicker(s, SEC[1]);
s.addText("The datasets and their role", { placeholder: "title" });
const dsH = ["Set", "Split", "Real or synthetic", "Role"];
const ds = [["Real IR train", "train · 12,025", "real", "train IR detectors (all, or N labelled images)"],
            ["Real RGB train", "train · 12,025, aligned with IR", "real", "pre-train; source for the generator and the pseudo-labels"],
            ["Synthetic IR T100 / T1000", "train · 12,025", "synthetic (from RGB)", "train a detector instead of real IR"],
            ["P1000 pairs", "train · 1,000", "real, predicted labels", "train a detector without annotation"],
            ["Real IR test", "test · 3,463, unseen scenes", "real", "the only test set for every detection result"],
            ["Test halves A / B", "test split in two · ~1,700 each", "A real; B real, RGB or synthetic", "synthesis metrics: A = reference, B = compared set"]];
s.addTable([dsH.map((h) => ({ text: h, options: { bold: true, color: C.background1, fill: { color: C.text1 }, fontSize: 14, valign: "middle" } })),
            ...ds.map((r, ri) => r.map((v, ci) => ({ text: v, options: { fontSize: 13, color: C.text1, bold: ci === 0, valign: "middle", fill: { color: ri === 4 ? C.background2 : C.background1 } } })))],
  { x: 0.6, y: 1.6, w: 12.1, colW: [2.7, 3.0, 2.7, 3.7], rowH: 0.55, border: { type: "solid", pt: 0.75, color: "D9DDE8" }, objectName: nm("Datasets table") });
card(s, 0.6, 5.65, 12.1, 1.0);
para(s, [["T100 / T1000 = synthetic IR from the generator trained on 100 / 1,000 pairs. ", { bold: true }],
         ["Synthesis metrics compare two image sets (B ↔ A) and train nothing; detection results train on the train split and always test on real IR test.", {}]],
     { x: 0.85, y: 5.65, w: 11.6, h: 1.0, fontSize: 14, valign: "middle", paraSpaceAfter: 0 });
s.addNotes("Dataset glossary. Every later table refers to it.");

// ======================= 3. APPROACH =======================
section(2);
s = slide("SECTION");
s.addText("The approach, and what I built", { placeholder: "title" });
["Tools and protocol", "Two kinds of \"free\" supervision: translate or pseudo-label", "Judging a synthetic image: choosing the metrics", "Fusing two cameras, and stress-testing them", "Deploying in real time"]
  .forEach((t, i) => { dot(s, 0.8, 2.85 + i * 0.75, String(i + 1)); txt(s, t, { x: 1.55, y: 2.85 + i * 0.75, w: 10.5, h: 0.5, fontSize: 20, color: C.background1, valign: "middle" }); });
s.addNotes("Script §3.");

s = slide("CONTENT"); kicker(s, SEC[2]);
s.addText("The pipeline, end to end", { placeholder: "title" });
const steps = [["RGB / IR pairs", "unlabelled, aligned", "LLVIP"], ["Free supervision", "A. translate RGB into IR\nB. pseudo-label real IR", "diffusers · LoRA · COCO"],
               ["Detector", "pre-training, then fine-tuning on N IR labels", "Ultralytics YOLO11s"], ["RGB + IR fusion", "late and early, modality dropout", "WBF · 4-channel image"],
               ["Deployment", "FP16, end-to-end latency", "TensorRT 10 · CUDA"]];
steps.forEach(([h, b, tool], i) => {
  const x = 0.6 + i * 2.48;
  card(s, x, 1.65, 2.2, 2.75);
  dot(s, x + 0.2, 1.85, String(i + 1));
  txt(s, h, { x: x + 0.2, y: 2.5, w: 1.85, h: 0.6, fontSize: 15, bold: true, color: C.text1 });
  txt(s, b, { x: x + 0.2, y: 3.05, w: 1.85, h: 0.85, fontSize: 12, color: C.text2 });
  txt(s, tool, { x: x + 0.2, y: 3.95, w: 1.85, h: 0.35, fontSize: 11, italic: true, color: C.accent1 });
  if (i < steps.length - 1) arrow(s, x + 2.23, 2.85, 0.22, 0.3);
});
txt(s, "Rules that make the numbers credible", { x: 0.6, y: 4.8, w: 8, h: 0.4, fontSize: 18, bold: true, color: C.text1 });
["Strict metric: mAP50-95", "No selection on the test set", "2 seeds per configuration", "Same evaluator for everything"].forEach((t, i) => {
  const x = 0.6 + i * 3.08;
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 5.35, w: 2.85, h: 0.7, fill: { color: C.background2 }, line: { color: C.accent4, width: 0.75 }, rectRadius: 0.1, objectName: nm("Rule") });
  txt(s, t, { x, y: 5.35, w: 2.85, h: 0.7, fontSize: 14, color: C.text1, align: "center", valign: "middle" });
});
txt(s, "mAP50 is already 0.96 on LLVIP: it no longer separates methods, hence mAP50-95, which demands precise boxes.", { x: 0.6, y: 6.25, w: 12.1, h: 0.4, fontSize: 12, color: C.accent4 });
s.addNotes("Script §3.1.");

s = slide("CONTENT"); kicker(s, SEC[2] + " · A. translate");
s.addText("A. Translating RGB into IR: why pix2pix-turbo + LoRA", { placeholder: "title" });
stripLabels(s, 0.6, 1.55, 12.1, ["RGB (input)", "classic pix2pix", "pix2pix-turbo (T100)", "real IR (target)"], [C.accent2, C.accent6, C.accent1, C.text1]);
img(s, "gen_classic_vs_turbo.jpg", 0.6, 1.95, 12.1, 2.375, "Same scene: RGB, classic pix2pix output (noise), pix2pix-turbo output, real IR");
card(s, 0.6, 4.65, 3.8, 2.0); stat(s, 0.85, 4.75, 3.3, "0.06 → 0.55", "classic pix2pix L1 error: training scenes → new scenes", C.accent6, 32);
card(s, 4.75, 4.65, 7.95, 2.0);
para(s, [["Classic pix2pix, trained from scratch on 100 pairs, memorises the scenes.", {}],
         ["pix2pix-turbo starts from a diffusion model already trained on millions of images (SD-Turbo, a single step); LoRA trains only a small number of added weights. It keeps its general knowledge and generalises from 100 pairs.", { bold: true }]],
     { x: 5.0, y: 4.8, w: 7.5, h: 1.75, fontSize: 14 });
s.addNotes("Script §3.2, option A.");

s = slide("CONTENT"); kicker(s, SEC[2] + " · A. translate");
s.addText("What the generator produces", { placeholder: "title" });
stripLabels(s, 0.6, 1.55, 12.1, ["RGB (input)", "synthetic IR T100", "synthetic IR T1000", "real IR"], [C.accent2, C.accent1, C.accent1, C.text1]);
img(s, "gen_turbo_row_people.jpg", 0.6, 1.95, 12.1, 2.375, "Pedestrians: grey in synthetic IR, hot in real IR");
img(s, "gen_turbo_row_car_crop.jpg", 0.6, 4.45, 12.1, 1.485, "Car: the headlights become hot spots in synthetic IR");
txt(s, "Pedestrians stay grey (not hot); headlights become burning spots: the generator copies RGB brightness, not temperature.", { x: 0.6, y: 6.05, w: 12.1, h: 0.6, fontSize: 15, bold: true, color: C.text1 });
s.addNotes("Script §3.2 and L3. Top row: pedestrians stay grey in synthetic IR, while they are white (hot) in real IR. Bottom row: headlights become hot spots. The generator reproduces RGB brightness, not temperature.");

s = slide("CONTENT"); kicker(s, SEC[2] + " · B. pseudo-label");
s.addText("B. Pseudo-labelling real IR, without a generator", { placeholder: "title" });
img(s, "pl_rgb.jpg", 0.6, 1.7, 2.6, 1.97, "RGB half of the pair");
img(s, "pl_ir.jpg", 0.6, 4.05, 2.6, 1.97, "IR half of the pair");
txt(s, "RGB", { x: 0.6, y: 3.7, w: 2.6, h: 0.3, fontSize: 12, bold: true, color: C.accent2, align: "center" });
txt(s, "Real IR, same instant", { x: 0.6, y: 6.05, w: 2.6, h: 0.3, fontSize: 12, bold: true, color: C.accent1, align: "center" });
arrow(s, 3.3, 2.55); arrow(s, 3.3, 4.9);
card(s, 3.75, 2.25, 1.9, 0.95); txt(s, "COCO detector\non RGB", { x: 3.75, y: 2.25, w: 1.9, h: 0.95, fontSize: 13, bold: true, color: C.text1, align: "center", valign: "middle" });
card(s, 3.75, 4.6, 1.9, 0.95); txt(s, "COCO detector\non IR", { x: 3.75, y: 4.6, w: 1.9, h: 0.95, fontSize: 13, bold: true, color: C.text1, align: "center", valign: "middle" });
arrow(s, 5.75, 3.55, 0.35, 0.35);
card(s, 6.2, 3.2, 1.95, 1.1, C.accent1); txt(s, "Union of boxes\n→ labels for real IR", { x: 6.2, y: 3.2, w: 1.95, h: 1.1, fontSize: 13, bold: true, color: C.background1, align: "center", valign: "middle" });
s.addShape(pres.shapes.LINE, { x: 5.7, y: 2.72, w: 0, h: 2.35, line: { color: C.accent4, width: 1.5 }, objectName: nm("Line") });
s.addChart(pres.charts.BAR, [
  { name: "Precision (correct boxes)", labels: ["COCO on RGB", "COCO on IR", "RGB + IR fused"], values: [0.87, 0.83, 0.83] },
  { name: "Recall (pedestrians found)", labels: ["COCO on RGB", "COCO on IR", "RGB + IR fused"], values: [0.34, 0.42, 0.50] }],
  chartBase({ x: 8.45, y: 1.6, w: 4.3, h: 3.4, barDir: "col", barGrouping: "clustered", chartColors: [H.dk2, H.accent1], showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0.00",
    valAxisMinVal: 0, valAxisMaxVal: 1, valAxisLabelFormatCode: "0.0", showLegend: true, legendPos: "b", showTitle: true, title: "Pseudo-label quality (1,000 pairs)", catAxisLabelFontSize: 11 }));
card(s, 8.45, 5.2, 4.3, 1.45);
para(s, [["Possible because RGB and IR are pixel-aligned: a box can be copied as is.", {}], ["No dataset label used.", { bold: true }]], { x: 8.65, y: 5.3, w: 3.9, h: 1.3, fontSize: 13 });
s.addNotes("Script §3.2, option B. Generic YOLO11s pre-trained on COCO (118,000 images), never saw LLVIP. Reliable when it draws a box (87%), but misses 2 pedestrians out of 3 at night on RGB; RGB + IR fusion raises recall to 50%.");

s = slide("CONTENT"); kicker(s, SEC[2] + " · metrics");
s.addText("Judging a synthetic image: two questions, two families", { placeholder: "title" });
const fam = [["1", "Does the set, as a whole, look like real IR?", "Distribution metrics", "Compare two image sets without pairing them: each image → a feature vector (pre-trained network), then the two clouds are compared.", "FID · KID · FD-DINOv2 · density / coverage", "Judges realism and diversity, not faithfulness to the scene"],
             ["2", "Is each image faithful to the real IR of the same scene?", "Paired metrics", "Compare each synthetic image with its real IR twin (same scene, same instant).", "L1 · SSIM · LPIPS", "Judges content image by image, not overall realism"]];
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
txt(s, [{ text: "Fréchet distance:  ", options: { bold: true, color: C.accent3 } },
        { text: "FD = ‖μ₁ − μ₂‖² + Tr(Σ₁ + Σ₂ − 2(Σ₁Σ₂)^½)   →   gap between the means + gap between the spreads of the two clouds; 0 = identical", options: { color: C.background1 } }],
    { x: 0.85, y: 5.7, w: 11.6, h: 0.95, fontSize: 15, valign: "middle" });
s.addNotes("Script §3.3. An image can be realistic but wrong, or faithful but unrealistic: you need both families.");

s = slide("CONTENT"); kicker(s, SEC[2] + " · metrics");
s.addText("The metrics, one by one", { placeholder: "title" });
const mH = ["Metric", "Family", "What it measures", "How to read it"];
const mR = [["FID", "distribution", "Fréchet distance between Inception vectors (ImageNet network)", "0 = identical; no absolute scale; biased on small samples"],
            ["KID", "distribution", "same idea with a kernel (MMD), unbiased estimator", "more reliable on small samples; shown ×1000"],
            ["FD-DINOv2", "distribution", "Fréchet on DINOv2 vectors (self-supervised, more robust)", "checks the conclusion does not depend on the extractor"],
            ["Density, coverage", "distribution", "do the images fall inside the real cloud? do they cover it? (Naeem et al., ICML 2020)", "0 to 1; 1 = perfect; robust versions of precision / recall"],
            ["L1 · SSIM · LPIPS", "paired", "pixel gap · structural similarity · perceptual distance", "L1, LPIPS: 0 = identical; SSIM: 1 = identical"]];
s.addTable([mH.map((h) => ({ text: h, options: { bold: true, color: C.background1, fill: { color: C.text1 }, fontSize: 14, valign: "middle" } })),
            ...mR.map((r) => r.map((v, ci) => ({ text: v, options: { fontSize: 13, color: C.text1, bold: ci === 0, valign: "middle" } })))],
  { x: 0.6, y: 1.6, w: 12.1, colW: [2.0, 1.6, 4.5, 4.0], rowH: 0.72, border: { type: "solid", pt: 0.75, color: "D9DDE8" }, objectName: nm("Metrics table") });
txt(s, "And the final referee: usefulness = mAP50-95, on real IR test, of a detector trained only on the set being judged.", { x: 0.6, y: 6.15, w: 12.1, h: 0.45, fontSize: 15, bold: true, color: C.accent1 });
s.addNotes("Script §3.3, metrics table.");

s = slide("CONTENT"); kicker(s, SEC[2] + " · metrics");
s.addText("The control that changed everything: measure real against real", { placeholder: "title" });
s.addChart(pres.charts.BAR, [{ name: "FID", labels: ["real IR train ↔ real IR test", "real IR test B ↔ A (control)", "synthetic IR T1000 ↔ real IR test A", "real RGB test B ↔ real IR test A"], values: [224, 11.6, 229.4, 271.7] }],
  chartBase({ x: 0.6, y: 1.6, w: 7.2, h: 4.9, barDir: "bar", chartColors: [H.accent6, H.accent5, H.accent1, H.accent2], showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0.0",
    valAxisMinVal: 0, valAxisMaxVal: 300, valAxisLabelFormatCode: "0", showLegend: false, showTitle: true, title: "FID (lower = closer)", catAxisLabelFontSize: 11 }));
card(s, 8.1, 1.6, 4.6, 4.9);
para(s, [["The trap", { bold: true, color: C.accent6 }],
         ["Real IR against real IR: we expect ~0. I got 224, almost as much as RGB against IR. The test scenes are other streets: FID was measuring the scenery, not the modality.", {}],
         ["The fix", { bold: true, color: C.accent5 }],
         ["Measure everything within the same scenes: the test set split in two halves. Reference = real IR A; compared set = its B version. The control drops to 11.6: that is the yardstick.", {}],
         ["Reading", { bold: true, color: C.accent1 }],
         ["Against 11.6, synthetic at 229 is almost as far from real IR as RGB.", { bold: true }]],
     { x: 8.35, y: 1.75, w: 4.15, h: 4.65, fontSize: 13, paraSpaceAfter: 5 });
s.addNotes("Script §3.3. This is not a mistake: it is the control. First comparing two real IR sets gives the 'no modality gap' value.");

s = slide("CONTENT"); kicker(s, SEC[2] + " · metrics");
s.addText("Whole image → boxes: measure what YOLO looks for", { placeholder: "title" });
[["~3 %", "of the pixels are pedestrians: on the whole image, the metric mostly judges the road and the trees"],
 ["FD-YOLO", "Fréchet distance with the internal features of the IR detector, read inside each box"],
 ["Detectability", "mAP of the real-IR detector applied to the set: does it show pedestrians the way IR does?"]]
  .forEach(([b, t], i) => { const x = 0.6 + i * 4.1; card(s, x, 1.6, 3.8, 1.75); stat(s, x + 0.25, 1.7, 3.3, b, t, C.accent1, 28); });
const bxH = ["Comparison (set B ↔ real IR test A)", "KID×1000 whole image", "KID×1000 boxes", "FD-DINOv2 boxes", "FD-YOLO boxes", "Detectability", "Usefulness (3,000 images → real IR test)"];
const bx = [["Real IR test B (control)", "124", "10", "160", "77", "0.61", "0.614"], ["Synthetic IR T1000", "187", "136", "1,210", "294", "0.16", "0.338"],
            ["Real RGB test B", "275", "162", "841", "852", "0.01", "0.416"], ["Inverted grey (1 − RGB luminance)", "181", "152", "905", "561", "0.09", "0.471"]];
s.addTable([bxH.map((h) => ({ text: h, options: { bold: true, color: C.background1, fill: { color: C.text1 }, fontSize: 11, valign: "middle", align: "center" } })),
            ...bx.map((r) => r.map((v, ci) => ({ text: v, options: { fontSize: 13, color: C.text1, valign: "middle", align: ci === 0 ? "left" : "center", bold: ci === 3 } })))],
  { x: 0.6, y: 3.5, w: 12.1, colW: [3.5, 1.25, 1.25, 1.4, 1.3, 1.3, 2.1], rowH: 0.4, border: { type: "solid", pt: 0.75, color: "D9DDE8" }, objectName: nm("Boxes table") });
s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.6, y: 5.95, w: 2.3, h: 0.5, fill: { color: C.accent5 }, line: { color: C.accent5 }, rectRadius: 0.08, objectName: nm("Badge") });
txt(s, "1,700 + 1,700 images · 3,737 pedestrians", { x: 0.6, y: 5.95, w: 2.3, h: 0.5, fontSize: 10, bold: true, color: C.background1, align: "center", valign: "middle" });
para(s, [["Inside the boxes, the IR / IR control drops from 124 to 10: the metric no longer sees the scenery. ", { bold: true }],
         ["Only FD-DINOv2 on boxes ranks RGB (841) ahead of T1000 (1,210), as usefulness does. The IR detector, by contrast, finds RGB alien (detectability 0.01) although it trains well.", {}]],
     { x: 3.1, y: 5.85, w: 9.6, h: 0.95, fontSize: 12, paraSpaceAfter: 2 });
s.addNotes("Script §3.3. Full run: half B of each set (1,700 images) against real IR test half A (1,700 images), 3,737 pedestrians. Note: here halves A and B are different scenes, hence a whole-image control at 124 (KID) instead of ~0; that is exactly what shows that boxes ignore the scenery (10). The whole-image numbers of the previous slide (11.6) come from the shuffled split. Usefulness = proxy detector (3,000 images, 30 epochs), same order as the full trainings (RGB 0.468 > T1000 0.384 > T100 0.328).");

s = slide("CONTENT"); kicker(s, SEC[2] + " · fusion");
s.addText("Fusing two cameras: late fusion or early fusion", { placeholder: "title" });
function fusionDiagram(x, title, sub, early) {
  card(s, x, 1.6, 5.9, 4.0);
  txt(s, title, { x: x + 0.3, y: 1.75, w: 5.3, h: 0.45, fontSize: 18, bold: true, color: C.accent1 });
  txt(s, sub, { x: x + 0.3, y: 2.2, w: 5.3, h: 0.45, fontSize: 13, color: C.text2 });
  const box = (bx, by, bw, bh, t, fill, col) => { s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: bx, y: by, w: bw, h: bh, fill: { color: fill }, line: { color: fill }, rectRadius: 0.08, objectName: nm("Block") }); txt(s, t, { x: bx, y: by, w: bw, h: bh, fontSize: 12, bold: true, color: col, align: "center", valign: "middle" }); };
  if (!early) {
    box(x + 0.3, 2.9, 1.1, 0.6, "RGB", C.accent2, C.background1); box(x + 0.3, 4.1, 1.1, 0.6, "IR", C.accent1, C.background1);
    arrow(s, x + 1.5, 3.05, 0.3, 0.3); arrow(s, x + 1.5, 4.25, 0.3, 0.3);
    box(x + 1.9, 2.9, 1.5, 0.6, "RGB detector", C.text1, C.background1); box(x + 1.9, 4.1, 1.5, 0.6, "IR detector", C.text1, C.background1);
    arrow(s, x + 3.5, 3.65, 0.3, 0.3);
    box(x + 3.9, 3.45, 1.7, 0.75, "Box fusion (WBF)", C.accent3, C.text1);
  } else {
    box(x + 0.3, 2.9, 1.1, 0.6, "RGB", C.accent2, C.background1); box(x + 0.3, 4.1, 1.1, 0.6, "IR", C.accent1, C.background1);
    arrow(s, x + 1.5, 3.65, 0.3, 0.3);
    box(x + 1.9, 3.3, 1.5, 1.05, "4-channel image\nR · G · B · IR", C.accent3, C.text1);
    arrow(s, x + 3.5, 3.65, 0.3, 0.3);
    box(x + 3.9, 3.45, 1.7, 0.75, "A single detector", C.text1, C.background1);
  }
}
fusionDiagram(0.6, "Late fusion", "two independent detectors, then their boxes are fused", false);
fusionDiagram(6.8, "Early fusion", "the two images stacked, a single network", true);
txt(s, "Modular: if one camera dies, the other detector carries on alone.", { x: 0.9, y: 4.95, w: 5.3, h: 0.55, fontSize: 13, italic: true, color: C.text1 });
txt(s, "More accurate, but the network can become dependent on one sensor.", { x: 7.1, y: 4.95, w: 5.3, h: 0.55, fontSize: 13, italic: true, color: C.text1 });
txt(s, "WBF (Weighted Boxes Fusion): overlapping boxes are averaged, weighted by their confidence.", { x: 0.6, y: 5.9, w: 12.1, h: 0.45, fontSize: 13, color: C.accent4 });
s.addNotes("Script §3.4.");

s = slide("CONTENT"); kicker(s, SEC[2] + " · fusion");
s.addText("Modality dropout: learning to lose a sensor", { placeholder: "title" });
s.addChart(pres.charts.DOUGHNUT, [{ name: "Training images", labels: ["RGB + IR", "IR set to zero", "RGB set to zero"], values: [70, 15, 15] }],
  chartBase({ x: 0.6, y: 1.6, w: 5.0, h: 4.6, chartColors: [H.dk2, H.accent1, H.accent2], holeSize: 55, showPercent: true, showValue: false, showLegend: true, legendPos: "b",
    dataLabelColor: H.lt1, dataLabelFontSize: 14, showTitle: true, title: "Early-fusion training images" }));
card(s, 6.0, 1.6, 6.7, 4.6);
para(s, [["The problem", { bold: true, color: C.accent1 }],
         ["At night, IR is far more informative than RGB: a 4-channel network learns to rely almost entirely on it. If IR disappears, it gets an input it has never seen and collapses.", {}],
         ["The fix, at training time only", { bold: true, color: C.accent1 }],
         ["One sensor is deliberately switched off on 30% of the images. The network learns to detect with each sensor alone, and to read \"channel at zero = sensor missing\".", {}],
         ["The proof", { bold: true, color: C.accent1 }],
         ["The same model is trained without dropout (ablation), and compared on the same scenarios.", {}]],
     { x: 6.3, y: 1.75, w: 6.2, h: 4.35, fontSize: 14, paraSpaceAfter: 5 });
s.addNotes("Script §3.4, dropout.");

s = slide("CONTENT"); kicker(s, SEC[2] + " · scenarios");
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
txt(s, "A degraded sensor is compensated by the other; a dead sensor is only handled if planned for: architecture (late), training (dropout) or system (declare it missing).",
    { x: 0.85, y: 5.95, w: 11.6, h: 0.75, fontSize: 14, bold: true, color: C.background1, valign: "middle" });
s.addNotes("Script §3.4. Fog: image blended with a light veil + noise. Pitch dark: gamma 2.5, gain 0.35, sensor noise. Dead: fully black image.");

// ======================= 4. DEMO =======================
section(3);
s = slide("CONTENT"); kicker(s, SEC[3]);
s.addText("Demo: the application, on a rented GPU", { placeholder: "title" });
img(s, "demo_modes.jpg", 0.6, 1.55, 6.25, 5.0, "Three rows: nominal, IR dead declared missing, IR reconstructed; columns RGB, IR, fusion");
const demo = [["Nominal scene", "RGB, IR and fusion find all 3 pedestrians"], ["Fog on the RGB", "RGB loses pedestrians, IR and fusion hold"],
              ["Thermal camera unplugged", "(a) declared missing: fusion falls back on RGB\n(b) reconstructed by the generator: grey pedestrians, 0 detections"]];
demo.forEach(([h, b], i) => {
  const y = 1.6 + i * 1.45;
  dot(s, 7.2, y, String(i + 1));
  txt(s, h, { x: 7.9, y: y - 0.02, w: 4.8, h: 0.4, fontSize: 16, bold: true, color: C.text1 });
  txt(s, b, { x: 7.9, y: y + 0.4, w: 4.8, h: 0.95, fontSize: 13, color: C.text2 });
});
card(s, 7.2, 6.0, 5.5, 0.6);
txt(s, "Screen recording · Gradio app · SSH tunnel to the GPU", { x: 7.4, y: 6.0, w: 5.1, h: 0.6, fontSize: 12, italic: true, color: C.text1, valign: "middle" });
s.addNotes("Script §4. During the demo: shared screen; this slide is the transition and the fallback.");

s = slide("DARK"); kicker(s, SEC[3] + " · behind the curtain", true);
s.addText("One feature: the 100% GPU pipeline", { placeholder: "title" });
card(s, 0.6, 1.6, 7.3, 4.95, "222846");
txt(s, [
  { text: "# Before: 98 ms per image (copy spread over 128 CPU threads)", options: { color: H.accent4, breakLine: true } },
  { text: "self.host.copy_(torch.from_numpy(frame))", options: { color: H.accent6, breakLine: true } },
  { text: "# After: 0.45 ms", options: { color: H.accent4, breakLine: true } },
  { text: "np.copyto(self.host_np, frame)", options: { color: H.accent5, breakLine: true } },
  { text: " ", options: { breakLine: true } },
  { text: "# A single CPU → GPU copy, then everything on GPU", options: { color: H.accent4, breakLine: true } },
  { text: "self.dev.copy_(self.host, non_blocking=True)", options: { color: H.lt1, breakLine: true } },
  { text: "x = F.interpolate(self.dev.permute(2, 0, 1)[None]", options: { color: H.lt1, breakLine: true } },
  { text: "                  .flip(1).float(), size=(512, 640))", options: { color: H.lt1, breakLine: true } },
  { text: "self.ctx.execute_async_v3(stream)  # network + NMS", options: { color: H.lt1, breakLine: true } },
  { text: "                                   # inside TensorRT", options: { color: H.accent4 } }],
  { x: 0.85, y: 1.8, w: 6.9, h: 4.6, fontSize: 13, fontFace: "Courier New" });
[["4.04 ms", "Ultralytics + TensorRT, pre/post on CPU", C.background1], ["2.30 ms", "100% GPU, NMS inside the engine", C.accent1], ["435 img/s", "same mAP: 0.612 vs 0.613", C.accent3]]
  .forEach(([b, t, col], i) => { const y = 1.6 + i * 1.65; txt(s, b, { x: 8.3, y, w: 4.4, h: 0.85, fontSize: 40, bold: true, color: col, fontFace: THEME.headFontFace }); txt(s, t, { x: 8.3, y: y + 0.85, w: 4.4, h: 0.5, fontSize: 14, color: C.accent4 }); });
s.addNotes("Script §4, end. 'Glimpse behind the curtain'.");

// ======================= 5. LESSONS =======================
section(4);
s = slide("SECTION");
s.addText("What the results taught me", { placeholder: "title" });
["A forgotten baseline overturned my conclusion", "Better to transfer labels than to translate images", "The generator fails because heat is not in its input", "An image metric is only worth it measured on the pedestrians", "Robustness is trained; latency is won outside the network"]
  .forEach((t, i) => { dot(s, 0.8, 2.85 + i * 0.75, "L" + (i + 1), 0.55); txt(s, t, { x: 1.6, y: 2.85 + i * 0.75, w: 10.8, h: 0.55, fontSize: 20, color: C.background1, valign: "middle" }); });
s.addNotes("Script §5. Each lesson: finding, computation, reason.");

function lessonFrame(tag, title) { const sl = slide("CONTENT"); kicker(sl, `${SEC[4]} · ${tag}`); sl.addText(title, { placeholder: "title" }); return sl; }
function reasonCard(sl, x, y, w, h, calc, reason) {
  card(sl, x, y, w, h);
  para(sl, [["The computation", { bold: true, color: C.accent1 }], [calc, {}], ["The reason", { bold: true, color: C.accent1 }], [reason, { bold: true }]],
       { x: x + 0.25, y: y + 0.15, w: w - 0.5, h: h - 0.3, fontSize: 13, paraSpaceAfter: 5 });
}

s = lessonFrame("L1", "A forgotten baseline overturned my conclusion");
s.addChart(pres.charts.LINE, [
  { name: "no pre-training (real IR only)", labels: ["10", "25", "50", "100"], values: [0.328, 0.423, 0.458, 0.495] },
  { name: "pre-trained on synthetic IR T100", labels: ["10", "25", "50", "100"], values: [0.468, 0.503, 0.516, 0.504] },
  { name: "pre-trained on real RGB", labels: ["10", "25", "50", "100"], values: [0.500, 0.540, 0.543, 0.526] },
  { name: "pre-trained on real RGB, then synthetic IR", labels: ["10", "25", "50", "100"], values: [0.496, 0.513, 0.528, 0.517] }],
  chartBase({ x: 0.6, y: 1.55, w: 7.6, h: 5.1, chartColors: [H.accent4, H.accent1, H.accent2, H.accent3], lineSize: 2.5, lineDataSymbolSize: 7, valAxisMinVal: 0.3, valAxisMaxVal: 0.6, valAxisLabelFormatCode: "0.00",
    showLegend: true, legendPos: "b", showTitle: true, title: "Tested on real IR test · mAP50-95 · 2 seeds", showCatAxisTitle: true, catAxisTitle: "N labelled real IR train images (fine-tuning, 100 epochs)", catAxisTitleFontSize: 11, catAxisTitleColor: H.dk2 }));
reasonCard(s, 8.5, 1.55, 4.2, 5.1, "Pre-training on the 12,025 train-split images, then fine-tuning on N labelled real IR images. At N = 10: synthetic 0.47, real RGB 0.50; RGB ahead at every N.",
  "The generator starts from the same RGB images and the same boxes: it can only lose information. The +0.14 gain came from the RGB labels, not from the translation.");
s.addNotes("Script L1.");

s = lessonFrame("L2", "Better to transfer labels than to translate images");
s.addChart(pres.charts.BAR, [{ name: "mAP50-95", labels: ["12,025 synthetic IR T1000 (true boxes)", "1,000 real IR, COCO labels from RGB", "12,025 real RGB (true boxes)", "1,000 real IR, COCO labels from RGB + IR"], values: [0.384, 0.424, 0.468, 0.529] }],
  chartBase({ x: 0.6, y: 1.55, w: 7.6, h: 4.5, barDir: "bar", chartColors: [H.accent4, H.accent4, H.accent2, H.accent1], showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0.000",
    valAxisMinVal: 0, valAxisMaxVal: 0.6, valAxisLabelFormatCode: "0.0", showLegend: false, showTitle: true, title: "Trained without a single hand-made IR label → tested on real IR test", catAxisLabelFontSize: 11 }));
txt(s, "Reference: best score obtained with 100 hand-labelled IR images = 0.526.", { x: 0.6, y: 6.15, w: 7.6, h: 0.45, fontSize: 13, bold: true, color: C.accent1 });
reasonCard(s, 8.5, 1.55, 4.2, 5.1, "Four detectors trained without IR annotation, all tested on real IR test. 1,000 real pseudo-labelled images: 0.529 (0.523 on a second machine).",
  "The detector must learn what a pedestrian looks like in thermal. A missing label turns a pedestrian into background; a wrong appearance is learned even with good labels. The appearance gap costs more than the label noise.");
s.addNotes("Script L2. Multimodality helps twice: to detect and to label.");

s = lessonFrame("L2 · nuance", "Adding a few real labels can lower the score");
s.addChart(pres.charts.LINE, [
  { name: "start: RGB + IR pseudo-labels only (0 labels)", labels: ["10", "25", "50", "100"], values: [0.529, 0.529, 0.529, 0.529] },
  { name: "RGB + IR pseudo-labels, then fine-tuning", labels: ["10", "25", "50", "100"], values: [0.475, 0.489, 0.496, 0.517] },
  { name: "real RGB, then fine-tuning", labels: ["10", "25", "50", "100"], values: [0.500, 0.540, 0.543, 0.526] },
  { name: "real IR only", labels: ["10", "25", "50", "100"], values: [0.328, 0.423, 0.458, 0.495] }],
  chartBase({ x: 0.6, y: 1.55, w: 7.6, h: 5.1, chartColors: [H.accent3, H.accent1, H.accent2, H.accent4], lineSize: 2.5, lineDataSymbolSize: 7, valAxisMinVal: 0.3, valAxisMaxVal: 0.6, valAxisLabelFormatCode: "0.00",
    showLegend: true, legendPos: "b", showTitle: true, title: "Tested on real IR test · mAP50-95 · 2 seeds", showCatAxisTitle: true, catAxisTitle: "N labelled real IR train images (fine-tuning, 100 epochs)", catAxisTitleFontSize: 11, catAxisTitleColor: H.dk2 }));
card(s, 8.5, 1.55, 4.2, 5.1);
stat(s, 8.75, 1.7, 3.8, "0.529 → 0.475", "after fine-tuning on 10 real images", C.accent6, 32);
para(s, [["100 epochs on a few images make the model forget what 1,000 pseudo-labelled images taught it (forgetting, overfitting).", {}],
         ["The fine-tuning recipe, designed for a weak starting point, needs rethinking: short fine-tuning, mixed labels, self-training.", { bold: true }]],
     { x: 8.75, y: 3.4, w: 3.75, h: 3.1, fontSize: 13 });
s.addNotes("Script L2, honest nuance.");

s = lessonFrame("L3", "The generator fails: heat is not in its input");
s.addChart(pres.charts.BAR, [{ name: "mAP50-95", labels: ["real IR test", "resized to 512²", "through the VAE", "512² + VAE (like the generator)"], values: [0.618, 0.628, 0.618, 0.620] }],
  chartBase({ x: 0.6, y: 1.55, w: 5.4, h: 4.2, barDir: "col", chartColors: [H.dk2, H.accent4, H.accent4, H.accent1], showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0.000",
    valAxisMinVal: 0, valAxisMaxVal: 0.7, valAxisLabelFormatCode: "0.0", showLegend: false, showTitle: true, title: "IR detector applied to transformed real IR test", catAxisLabelFontSize: 11 }));
img(s, "mean_rgb.png", 6.4, 1.6, 1.4, 3.25, "Average pedestrian in night RGB: dark, no contrast");
img(s, "mean_ir.png", 8.0, 1.6, 1.4, 3.25, "Average pedestrian in IR: warm head and torso");
txt(s, "Average RGB", { x: 6.4, y: 4.9, w: 1.4, h: 0.35, fontSize: 12, bold: true, color: C.accent2, align: "center" });
txt(s, "Average IR", { x: 8.0, y: 4.9, w: 1.4, h: 0.35, fontSize: 12, bold: true, color: C.accent1, align: "center" });
txt(s, "Average of 4,082 test pedestrian crops, anonymous by construction", { x: 6.4, y: 5.3, w: 3.0, h: 0.5, fontSize: 10, color: C.accent4 });
reasonCard(s, 9.7, 1.55, 3.0, 4.25, "Real IR pushed through the generator's pipeline, without translation: 0.620 vs 0.618.",
  "The architecture loses nothing. The generator has to invent a temperature that is almost absent from RGB.");
card(s, 0.6, 6.0, 12.1, 0.7, C.text1);
txt(s, "Making synthetic data viable: give it knowledge its source lacks, not just more realism.", { x: 0.85, y: 6.0, w: 11.6, h: 0.7, fontSize: 15, bold: true, color: C.background1, valign: "middle" });
s.addNotes("Script L3. The VAE loses only 1.7% of pedestrians (the smallest, with no contrast).");

s = lessonFrame("L3 · pedestrian by pedestrian", "Lost pedestrians are visible in RGB, but stay cold");
img(s, "mean_pedestrian_5.png", 0.6, 1.5, 7.4, 3.03, "Average pedestrian over 4,082 test crops: dark RGB, real IR and VAE with warm head and torso, uniform synthetic T1000; the error map peaks on head and torso");
[["76%", "of the pedestrians found on real IR are lost on synthetic IR T1000"], ["89%", "of those lost are still found by the RGB detector on the RGB image"], ["2%", "only are also lost after the VAE pass alone"]]
  .forEach(([b, t], i) => { const x = 0.6 + i * 2.5; card(s, x, 4.75, 2.35, 1.9); stat(s, x + 0.18, 4.85, 2.0, b, t, i === 2 ? C.accent5 : C.accent6, 30); });
img(s, "recall_by_lum.png", 8.3, 1.5, 4.4, 3.2, "Recall vs the pedestrian's RGB luminance: flat for real IR, VAE and RGB; for synthetic T1000, from 0.08 (dark pedestrians) to 0.35 (lit pedestrians)");
card(s, 8.3, 4.75, 4.4, 1.9);
para(s, [["8,302 test pedestrians, one by one (IoU ≥ 0.5, confidence ≥ 0.25).", {}],
         ["Lost = darker in RGB (luminance 0.12 vs 0.18) but warm in real IR: the generator follows light, not heat.", { bold: true }]],
     { x: 8.5, y: 4.85, w: 4.0, h: 1.7, fontSize: 12, paraSpaceAfter: 4 });
s.addNotes("Script L3, per-pedestrian analysis. Real-IR detector recall: real IR 0.93, VAE 0.92, T1000 0.22. Of the pedestrians found on real IR and lost on T1000, 89% are found by the RGB detector on RGB, and only 2% are also lost by the VAE: it is neither size nor compression, it is temperature. Local contrast of the lost ones: 0.042 in real IR, 0.008 in synthetic. Logistic regression: AUC 0.72, RGB luminance is the first factor. Right-hand curve: synthetic recall from 0.08 for the darkest pedestrians to 0.35 for the best lit.");

s = lessonFrame("L4", "On the whole image, metrics rank data sources wrongly");
const l4lab = ["real IR (control)", "synthetic IR T100", "synthetic IR T1000", "real RGB"];
s.addChart(pres.charts.BAR, [{ name: "KID×1000", labels: l4lab, values: [0.09, 173, 163, 228] }],
  chartBase({ x: 0.6, y: 1.55, w: 4.1, h: 4.1, barDir: "col", chartColors: [H.accent5, H.accent1, H.accent1, H.accent2], showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "General",
    valAxisMinVal: 0, valAxisMaxVal: 260, valAxisLabelFormatCode: "0", showLegend: false, showTitle: true, title: "Distance to real IR: KID×1000 (low = close)", catAxisLabelFontSize: 10 }));
s.addChart(pres.charts.BAR, [{ name: "Usefulness", labels: l4lab, values: [0.623, 0.328, 0.384, 0.468] }],
  chartBase({ x: 4.85, y: 1.55, w: 4.1, h: 4.1, barDir: "col", chartColors: [H.accent5, H.accent1, H.accent1, H.accent2], showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0.000",
    valAxisMinVal: 0, valAxisMaxVal: 0.7, valAxisLabelFormatCode: "0.0", showLegend: false, showTitle: true, title: "Usefulness: trained on this type → tested on real IR", catAxisLabelFontSize: 10 }));
txt(s, "Left: each set (test half B) ↔ real IR test A, 1,700 images. Right: detector trained on 12,025 train images of the same type. FID and FD-DINOv2 give the same order (229 / 235 / 272; 1,198 / 1,209 / 1,262).",
    { x: 0.6, y: 5.75, w: 8.35, h: 0.9, fontSize: 11, color: C.accent4 });
reasonCard(s, 9.2, 1.55, 3.5, 5.1, "RGB is the farthest from real IR (KID 228) and the most useful (0.468). Density and coverage: 0 for every non-real set.",
  "These metrics judge overall appearance, dominated by the background. The detector needs pedestrian shape: sharp in RGB, degraded in synthetic. They rank generators, not sources.");
s.addNotes("Script L4. The metrics correctly rank T1000 ahead of T100, but the order flips between data sources.");

s = lessonFrame("L4 · what DINOv2 sees", "Synthetic IR forms its own family of images");
img(s, "umap.png", 0.6, 1.55, 5.6, 5.0, "UMAP projection of DINOv2 vectors: synthetic IR forms its own clusters, away from real IR and RGB");
card(s, 6.6, 1.55, 6.1, 5.0);
para(s, [["How to read this map", { bold: true, color: C.accent1 }],
         ["Each point is an image, placed by its DINOv2 features (UMAP projection to 2D). Two close points = two images the network considers similar.", {}],
         ["What it shows", { bold: true, color: C.accent1 }],
         ["Real IR (orange, blue): same clusters. RGB (green): apart. Synthetic IR T100 / T1000 (red, purple): its own clusters, neither RGB nor IR.", {}],
         ["Synthetic IR is a third modality: zero density and coverage, no image falls inside the real cloud.", { bold: true }]],
     { x: 6.9, y: 1.7, w: 5.5, h: 4.7, fontSize: 14, paraSpaceAfter: 6 });
s.addNotes("Script §3.3 / L4. ref_ir_test = half A, ir_real = half B.");

s = lessonFrame("L4 · 11 sets", "On pedestrians, with DINOv2, distance tracks usefulness");
const BEST = "FD-DINOv2 · boxes";
const rho = [[BEST, 0.94], ["FD-DINOv2 · image", 0.90], ["KID · boxes", 0.85], ["FID · image", 0.80], ["KID · image", 0.75], ["FID · boxes", 0.73],
             ["Detectability (IR detector)", 0.51], ["FD-YOLO-IR · boxes", 0.49], ["Contrast correlation · boxes", 0.49], ["Paired L1 · boxes", 0.28], ["Contrast error · boxes", 0.21], ["FD-YOLO-IR · image", 0.15]].reverse();
s.addChart(pres.charts.BAR, [{ name: "Spearman ρ", labels: rho.map((r) => r[0]), values: rho.map((r) => r[1]) }],
  chartBase({ x: 0.6, y: 1.5, w: 5.6, h: 5.15, barDir: "bar", chartColors: rho.map((r) => r[1] >= 0.62 ? (r[0] === BEST ? H.accent1 : H.accent4) : H.accent6),
    showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0.00", valAxisMinVal: 0, valAxisMaxVal: 1.1, valAxisLabelFormatCode: "0.0", showLegend: false,
    showTitle: true, title: "Rank correlation metric ↔ usefulness (11 sets; significant if ρ ≥ 0.62)", catAxisLabelFontSize: 10 }));
img(s, "scatter_dinov2_box.png", 6.4, 1.5, 3.3, 3.0, "Scatter plot: FD-DINOv2 on boxes on x, usefulness on y; the 11 sets line up, from real IR top left to the untrained generator bottom right");
txt(s, "x: FD-DINOv2 boxes · y: usefulness", { x: 6.4, y: 4.5, w: 3.3, h: 0.3, fontSize: 10, color: C.accent4, align: "center" });
card(s, 6.4, 4.9, 3.3, 1.75);
para(s, [["11 sets", { bold: true, color: C.accent1 }], ["Real IR, IR + VAE, grey, inverted grey, RGB, 6 generators or checkpoints. Usefulness: detector trained on 3,000 images of the set, tested on real IR.", {}]],
     { x: 6.55, y: 5.0, w: 3.0, h: 1.6, fontSize: 10, paraSpaceAfter: 2 });
reasonCard(s, 9.9, 1.5, 2.8, 5.15, "FD-DINOv2 on boxes: ρ = 0.94 (Pearson 0.98), stable when one set is removed (0.92–0.95). The IR detector's own measures: ρ ≈ 0.5.",
  "The IR detector judges resemblance to IR: RGB looks alien to it, yet trains well. DINOv2 describes object shape, whatever the modality.");
s.addNotes("Script L4, final result. 11 sets, 12 metrics tested: Bonferroni threshold 0.004, FD-DINOv2 on boxes (p < 0.001) passes it. Between generators only (6 sets), almost every distance ranks well (0.83 to 0.94) and detectability perfectly (1.00): the IR detector can separate two synthetic IRs, not another modality. Limit: inverted grey is the most useful of the three RGB-derived sets (0.471) without being the closest.");

s = lessonFrame("L5", "Robustness is trained; a dead sensor is not hallucinated");
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
reasonCard(s, 8.95, 1.55, 3.75, 5.1, "IR dead: 0.007 without dropout, 0.485 with it. IR reconstructed: 0.276, worse than IR declared missing.",
  "Without dropout, the network leans on IR and a black image is an unseen input. Reconstructed IR looks like IR but carries false content: the model trusts it and gets it wrong.");
card(s, 0.6, 5.75, 8.1, 0.9, C.text1);
txt(s, "A degraded sensor is compensated; a dead sensor is planned for; a missing sensor is declared, not hallucinated.", { x: 0.85, y: 5.75, w: 7.6, h: 0.9, fontSize: 14, bold: true, color: C.background1, valign: "middle" });
s.addNotes("Script L5, robustness.");

s = lessonFrame("L5", "Latency is won outside the network");
s.addChart(pres.charts.BAR, [
  { name: "Pre-processing", labels: ["Ultralytics + TensorRT", "100% GPU"], values: [1.40, 0.28] },
  { name: "Network (+ NMS on GPU)", labels: ["Ultralytics + TensorRT", "100% GPU"], values: [1.42, 1.46] },
  { name: "Post-processing", labels: ["Ultralytics + TensorRT", "100% GPU"], values: [0.94, 0.17] },
  { name: "Copies, synchronisation", labels: ["Ultralytics + TensorRT", "100% GPU"], values: [0.28, 0.39] }],
  chartBase({ x: 0.6, y: 1.55, w: 7.6, h: 4.3, barDir: "bar", barGrouping: "stacked", chartColors: [H.accent2, H.accent1, H.accent3, H.accent4], showValue: true, dataLabelPosition: "ctr", dataLabelFormatCode: "0.00",
    dataLabelColor: H.dk1, valAxisMinVal: 0, valAxisMaxVal: 4.5, valAxisLabelFormatCode: "0.0", showLegend: true, legendPos: "b", showTitle: true, title: "Milliseconds per image, batch 1, A100, same run" }));
txt(s, "Total: 4.04 ms → 2.30 ms (435 images/s), p95 4.86 → 2.46 ms, same mAP (0.613 / 0.612).", { x: 0.6, y: 6.0, w: 7.6, h: 0.5, fontSize: 14, bold: true, color: C.accent1 });
reasonCard(s, 8.5, 1.55, 4.2, 5.1, "TensorRT divides inference by 4, but the total only by 1.7: CPU pre- and post-processing take 60% of the time.",
  "Speeding up one part only shrinks the total by that part (Amdahl's law). And the 98 ms copy: coordinating 128 threads cost a hundred times more than copying 4 MB.");
s.addNotes("Script L5, latency.");

// ======================= 6. CONCLUSION =======================
section(5);
s = slide("CONTENT"); kicker(s, SEC[5]);
s.addText("What this project showed", { placeholder: "title" });
const concl = [["A method that works", "cross-modal multimodal pseudo-labelling: 0.529 without a single IR annotation, better than with 100 labelled images"],
               ["RGB → IR generation is inefficient", "the generator does not learn heat, which is absent from RGB; its architecture loses nothing"],
               ["So: real RGB beats synthetic IR", "for detecting in IR: 0.468 vs 0.384 without IR labels; +0.02 to +0.04 after fine-tuning"],
               ["Measure images on the pedestrians", "whole image: the set farthest from real IR is the most useful; boxes + DINOv2: ρ = 0.94 with usefulness (11 sets)"],
               ["On the system side", "robustness is trained, a dead sensor is declared, latency is won outside the network (2.3 ms)"]];
concl.forEach(([h, b], i) => {
  const y = 1.6 + i * 1.0;
  card(s, 0.6, y, 12.1, 0.85);
  dot(s, 0.8, y + 0.17, String(i + 1));
  txt(s, h, { x: 1.5, y, w: 4.2, h: 0.85, fontSize: 16, bold: true, color: C.text1, valign: "middle" });
  txt(s, b, { x: 5.8, y, w: 6.7, h: 0.85, fontSize: 14, color: C.text2, valign: "middle" });
});
s.addNotes("Script §6.");

s = slide("DARK"); kicker(s, SEC[5], true);
s.addText("For synthetic images", { placeholder: "title" });
txt(s, "A synthetic image is only useful if it brings information the available data does not already have.", { x: 0.6, y: 1.9, w: 12.1, h: 1.6, fontSize: 30, bold: true, color: C.background1, fontFace: THEME.headFontFace });
txt(s, "Here, the missing piece was heat.", { x: 0.6, y: 3.55, w: 12.1, h: 0.7, fontSize: 24, italic: true, color: C.accent3, fontFace: THEME.headFontFace });
[["Next step", "a generator guided by physics or supervised on pedestrians"], ["Adoption criterion", "it must beat the simplest baseline: the pseudo-labels"], ["And then", "iterative self-training, gentler fine-tuning, INT8"]]
  .forEach(([h, b], i) => {
    const x = 0.6 + i * 4.1;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 4.7, w: 3.8, h: 1.7, fill: { color: "222846" }, line: { color: "222846" }, rectRadius: 0.12, objectName: nm("Card") });
    txt(s, h, { x: x + 0.25, y: 4.85, w: 3.3, h: 0.45, fontSize: 16, bold: true, color: C.accent1 });
    txt(s, b, { x: x + 0.25, y: 5.3, w: 3.3, h: 1.0, fontSize: 14, color: C.background1 });
  });
s.addNotes("Script §6, closing line. Thank you.");

(async () => {
  await pres.writeFile({ fileName: OUT });
  await applyTheme(OUT, THEME);
  console.log("written", OUT);
})();
