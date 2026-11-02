// 執行：node tests.cjs —— 從 index.html 抽出 /*ENGINE-START*/…/*ENGINE-END*/ 測試決策引擎
const fs = require('fs');
const src = fs.readFileSync(__dirname + '/index.html', 'utf8');
const code = src.slice(src.indexOf('/*ENGINE-START*/'), src.indexOf('/*ENGINE-END*/'));
const m = { exports: {} };
new Function('module', code)(m);
const A = m.exports;

let pass = 0, fail = 0;
function ok(cond, name) { if (cond) pass++; else { fail++; console.log('✗ ' + name); } }
function eq(a, b, name) { ok(a === b, `${name}: 期望 ${JSON.stringify(b)}，實際 ${JSON.stringify(a)}`); }

const base = { sex: 'male', height: '170', fio2: '0.60', peep: '10', oxyMode: 'pao2', oxy: '72', vt: '', plateau: '', ph: '', paco2: '', duration: 'lt3', optimized: false };
const E = o => A.evaluate({ ...base, ...o });

// ---- PBW ----
eq(E({}).pbw, 66.0, 'PBW 男 170 cm');
eq(E({ sex: 'female' }).pbw, 61.5, 'PBW 女 170 cm');
eq(E({}).vt6, 396, 'Vt 6 mL/kg');
eq(E({}).vt4 + '/' + E({}).vt8, '264/528', 'Vt 4–8');

// ---- 原版 bug：輸入中途不得報錯中斷其他結果 / 不用 alert ----
let r = E({ height: '' });
ok(r.errors.length > 0 && r.pbw === undefined, '身高空白 → 錯誤訊息、無 PBW');
eq(r.cls.key, 'moderate', '身高空白不影響氧合分級');
r = E({ height: '17' });
ok(r.invalid.includes('height'), '身高 17 → 標示錯誤');

// ---- FiO2 % ----
eq(A.normFiO2('60'), 0.6, 'FiO2 60 → 0.60');
eq(A.normFiO2('0.4'), 0.4, 'FiO2 0.4');
eq(E({ fio2: '60' }).cls.pf, 120, 'FiO2 60% 計算 P/F');
ok(E({ fio2: '0.1' }).invalid.includes('fio2'), 'FiO2 0.1 錯誤');

// ---- 分級 ----
eq(E({}).cls.pf, 120, 'PaO2 72 / 0.6 = 120');
eq(E({}).cls.key, 'moderate', 'P/F 120 moderate');
eq(E({ oxyMode: 'pf', oxy: '300' }).cls.key, 'mild', 'P/F 300 mild（≤300）');
eq(E({ oxyMode: 'pf', oxy: '301' }).cls.key, 'none', 'P/F 301 未達');
eq(E({ oxyMode: 'pf', oxy: '200' }).cls.key, 'moderate', 'P/F 200 moderate');
eq(E({ oxyMode: 'pf', oxy: '100' }).cls.key, 'severe', 'P/F 100 severe');
eq(E({ oxyMode: 'spo2', oxy: '92', fio2: '0.4' }).cls.key, 'moderate', 'S/F 230 moderate');
eq(E({ oxyMode: 'spo2', oxy: '94', fio2: '0.3' }).cls.key, 'mild', 'S/F 313 mild');
eq(E({ oxyMode: 'spo2', oxy: '88', fio2: '0.6' }).cls.key, 'severe', 'S/F 147 severe');
eq(E({ oxyMode: 'spo2', oxy: '99', fio2: '0.4' }).cls.key, 'invalid', 'SpO2 >97 → S/F 不適用');
ok(E({ peep: '3' }).cls.notes.length === 1, 'PEEP <5 → 分級提示');

// ---- PEEP table ----
eq(A.lookup(A.LOW, 0.6).peep, '10', 'Low 0.6 → 10');
eq(A.lookup(A.LOW, 0.7).peep, '10–14', 'Low 0.7 → 10–14');
eq(A.lookup(A.LOW, 1.0).peep, '18–24', 'Low 1.0 → 18–24');
r = A.lookup(A.LOW, 0.65);
ok(r.between && r.rows.join() === '3,4' && r.peep === '10–14', 'Low 0.65 介於兩列（原版浮點 tie 任意選列）');
r = A.lookup(A.LOW, 0.35);
ok(r.between && r.rows.join() === '0,1', 'Low 0.35 介於 0.3/0.4');
eq(A.lookup(A.LOW, 0.25), null, 'FiO2 <0.30 → null');
eq(A.lookup(A.HIGH, 0.3).peep, '5–14', 'High 0.3 → 5–14');
eq(A.lookup(A.HIGH, 0.6).peep, '20', 'High 0.6 → 20');
eq(A.lookup(A.HIGH, 0.5).peep, '16–20', 'High 0.5 → 16–20');
eq(A.lookup(A.HIGH, 0.9).peep, '22', 'High 0.9 → 22');
eq(A.lookup(A.HIGH, 1.0).peep, '22–24', 'High 1.0 → 22–24');
eq(E({}).preferHigh, true, 'Moderate → higher PEEP table');
eq(E({ oxyMode: 'pf', oxy: '250' }).preferHigh, false, 'Mild → lower table');

// ---- Vt / Pplat ----
let v = E({ vt: '500', plateau: '27' }).vtPlan;
eq(v.vtKg, 7.6, '500 mL = 7.6 mL/kg');
eq(v.targetKg, 6, '7.6 mL/kg → 降回 6');
v = E({ vt: '396', plateau: '32' }).vtPlan;
eq(v.targetKg, 5, '6 mL/kg Pplat 32 → 5');
eq(v.level, 'red', 'Pplat >30 紅');
v = E({ vt: '264', plateau: '33' }).vtPlan;
eq(v.targetKg, 4, '4 mL/kg 不再往下');
v = E({ vt: '330', plateau: '22' }).vtPlan;
eq(v.targetKg, 6, '5 mL/kg Pplat 22 → 升到 6');
v = E({ vt: '700', plateau: '35' }).vtPlan;
eq(v.targetKg, 6, '10.6 mL/kg Pplat 35 → 先降到 6');
v = E({ vt: '396', plateau: '30' }).vtPlan;
eq(v.level, 'green', 'Pplat 30 不算 >30');

// ---- Driving pressure ----
r = E({ vt: '400', plateau: '26', peep: '10' }).mech;
eq(r.dp, 16, 'ΔP 16');
eq(r.crs, 25, 'Crs 400/16 = 25');
eq(r.level, 'yellow', 'ΔP >15 黃');
eq(E({ plateau: '8', peep: '10' }).mech.error !== undefined, true, 'Pplat < PEEP 錯誤');
eq(E({ plateau: '31' }).mech.level, 'red', 'Pplat 31 紅');
eq(E({ plateau: '' }).mech, null, '未輸入 Pplat → null');

// ---- Acid-base ----
eq(E({ ph: '7.10' }).acid.level, 'red', 'pH 7.10');
eq(E({ ph: '7.25' }).acid.level, 'yellow', 'pH 7.25');
eq(E({ ph: '7.35' }).acid.level, 'green', 'pH 7.35');

// ---- Prone ----
eq(E({}).prone.level, 'red', 'P/F 120 → prone');
eq(E({ oxyMode: 'pf', oxy: '150' }).prone.level, 'yellow', 'P/F 150 → 未達 <150');
eq(E({ oxyMode: 'pf', oxy: '250' }).prone.level, 'green', 'P/F 250');
ok(E({ fio2: '0.5', oxy: '60' }).prone.extra.length === 1, 'P/F 120 但 FiO2 0.5 → PROSEVA 提示');
eq(E({ oxyMode: 'spo2', oxy: '88', fio2: '0.6' }).prone.level, 'yellow', 'S/F severe → 請抽 ABG');

// ---- ECMO（EOLIA）----
eq(E({ oxyMode: 'pf', oxy: '45', duration: 'gt6', optimized: true }).ecmo.key, 'meet', 'P/F 45 >6h 已最佳化 → 符合');
eq(E({ oxyMode: 'pf', oxy: '45', duration: '3to6', optimized: true }).ecmo.key, 'meet', 'P/F 45 3–6h → 符合 (>3h)');
eq(E({ oxyMode: 'pf', oxy: '45', duration: 'lt3' }).ecmo.key, 'near', 'P/F 45 <3h → 接近');
eq(E({ oxyMode: 'pf', oxy: '70', duration: '3to6' }).ecmo.key, 'near', 'P/F 70 3–6h → 接近（需 >6h）');
eq(E({ oxyMode: 'pf', oxy: '70', duration: 'gt6' }).ecmo.key, 'meet-unopt', 'P/F 70 >6h 未最佳化');
eq(E({ oxyMode: 'pf', oxy: '150', ph: '7.20', paco2: '65', duration: 'gt6', optimized: true }).ecmo.key, 'meet', 'hypercapnic >6h → 符合');
eq(E({ oxyMode: 'pf', oxy: '150', ph: '7.20', paco2: '55', duration: 'gt6' }).ecmo.key, 'no', 'PaCO2 55 不符');
eq(E({ oxyMode: 'pf', oxy: '90' }).ecmo.key, 'severe', 'P/F 90 severe 未達');
eq(E({}).ecmo.key, 'no', '示例 P/F 120 → 未達');

// ---- 示範病例：病例內文數字 ↔ 引擎 ----
const block = (a, b, name) => new Function(src.slice(src.indexOf(a), src.indexOf(b)) + '\nreturn ' + name + ';')();
const CASES = block('/*CASES-START*/', '/*CASES-END*/', 'ACASES');
const QUIZ = block('/*QUIZ-START*/', '/*QUIZ-END*/', 'AQUIZ');
const MAP = block('/*MAP-START*/', '/*MAP-END*/', 'AMAP');
const C = id => CASES.find(c => c.id === id);
const L = (id, k) => A.evaluate(C(id).load[k].v);

eq(CASES.length, 6, '病例 6 例');
CASES.forEach(c => {
    ok(c.steps.length >= 5 && c.trap.length >= 3 && c.src && c.load.length >= 1, c.id + ' 內容完整');
    c.load.forEach((l, k) => {
        const r = A.evaluate(l.v);
        eq(r.errors.length, 0, c.id + ' load ' + k + ' 無輸入錯誤');
        ['sex', 'height', 'fio2', 'peep', 'oxyMode', 'oxy', 'vt', 'plateau', 'ph', 'paco2', 'duration', 'optimized'].forEach(f => ok(f in l.v, c.id + ' load ' + k + ' 含 ' + f));
    });
    // tile 依標籤對照 load[0]（S/F、持續等情境 tile 另外斷言）
    const r = A.evaluate(c.load[0].v);
    c.tiles.forEach(t => {
        if (t[0] === 'PBW') eq(t[1], r.pbw.toFixed(1), c.id + ' tile PBW');
        if (t[0] === 'Vt / PBW') eq(t[1], r.vtPlan.vtKg.toFixed(1), c.id + ' tile Vt/PBW');
        if (t[0] === 'P/F') eq(t[1], String(r.cls.pf), c.id + ' tile P/F');
        if (t[0] === 'ΔP') eq(t[1], String(r.mech.dp), c.id + ' tile ΔP');
        if (t[0] === 'Crs') eq(t[1], String(r.mech.crs), c.id + ' tile Crs');
    });
});

// 1 Vt 設錯體重
r = L('vt', 0);
eq(r.cls.key, 'moderate', '病例 1 moderate');
eq(r.vt6, 314, '病例 1 目標 314 mL');
eq(r.vt8, 419, '病例 1 8 mL/kg = 419');
eq(Math.round(r.pbw * 7), 367, '病例 1 7 mL/kg = 367');
eq(r.vtPlan.targetKg, 6, '病例 1 >8 mL/kg 目標 6');
eq(Math.round(480 / 88 * 10) / 10, 5.5, '病例 1 實際體重 5.5 mL/kg');
eq(Math.round(480 * 18 / 314), 28, '病例 1 補償 RR 28');
eq(r.low.peep, '10', '病例 1 lower 10');
eq(r.high.peep, '20', '病例 1 higher 20');
eq(r.prone.level, 'red', '病例 1 俯臥提示');
r = L('vt', 1);
eq(r.cls.pf, 120, '病例 1 複評 P/F 120');
eq(r.mech.dp, 16, '病例 1 複評 ΔP 16');
eq(r.vtPlan.vtKg, 6, '病例 1 複評 6 mL/kg');
eq(Math.round(r.mech.crs), 20, '病例 1 複評 Crs ≈ 20');
eq(r.acid.level, 'green', '病例 1 複評 pH 7.30 在目標內');

// 2 沒有 ABG
eq(Math.round(91 / 0.5), 182, '病例 2 HFNC S/F');
eq((182 / 30).toFixed(2), '6.07', '病例 2 起始 ROX');
eq((88 / 0.8 / 38).toFixed(2), '2.89', '病例 2 6 h ROX');
r = L('sf', 0);
eq(r.cls.key, 'invalid', '病例 2 SpO2 99 不適用');
eq(r.cls.sf, 165, '病例 2 S/F 165');
eq(r.pbw, 70.6, '病例 2 PBW');
r = L('sf', 1);
eq(r.cls.sf, 235, '病例 2 S/F 235');
eq(r.cls.key, 'moderate', '病例 2 S/F 235 落在 moderate');
eq(r.vtPlan.vtKg, 6, '病例 2 Vt 6.0');
eq(r.mech.dp, 14, '病例 2 ΔP 14');
eq(r.mech.crs, 30, '病例 2 Crs 30');
eq(r.prone.level, 'yellow', '病例 2 S/F 提示抽 ABG');
r = A.evaluate({ ...C('sf').load[1].v, oxyMode: 'pao2', oxy: '66' });
eq(r.cls.pf, 165, '病例 2 P/F 165');
eq(r.prone.level, 'yellow', '病例 2 P/F 165 未達俯臥');

// 3 Severe 與俯臥
r = L('prone', 0);
eq(r.cls.key, 'severe', '病例 3 severe');
eq(r.low.peep, '14', '病例 3 lower 14');
eq(r.high.peep, '20–22', '病例 3 higher 20–22');
eq(r.prone.level, 'red', '病例 3 俯臥');
eq(r.ecmo.key, 'severe', '病例 3 未達 EOLIA');
r = L('prone', 1);
eq(r.mech.dp, 16, '病例 3 PEEP 18 ΔP 16');
eq(r.mech.crs, 25, '病例 3 PEEP 18 Crs 25');
eq(r.mech.level, 'red', '病例 3 PEEP 18 Pplat 34');
r = A.evaluate({ ...C('prone').load[0].v, fio2: '0.6', oxy: '81' });
eq(r.cls.pf, 135, '病例 3 回仰臥 P/F 135');
eq(r.prone.level, 'red', '病例 3 回仰臥仍 <150');

// 4 EOLIA
r = L('eolia', 0);
eq(r.pbw, 57, '病例 4 PBW');
eq(r.ecmo.key, 'near', '病例 4 4 小時接近');
eq(r.mech.level, 'green', '病例 4 Pplat 30');
eq(L('eolia', 1).ecmo.key, 'meet', '病例 4 8 小時符合');

// 5 高碳酸
r = L('hyper', 0);
eq(r.vtPlan.targetKg, 4, '病例 5 工具建議 Vt 4');
eq(r.vtPlan.targetMl, 257, '病例 5 257 mL');
eq(r.acid.level, 'yellow', '病例 5 pH 7.20');
eq(r.ecmo.key, 'meet', '病例 5 符合第 3 條');
eq(r.prone.level, 'yellow', '病例 5 P/F 150 未達');
eq(320 * 35, 11200, '病例 5 MV');
eq((11200 * 72 / (r.pbw * 100 * 37.5)).toFixed(1), '3.3', '病例 5 VR');

// 6 不是 ARDS
r = L('mimic', 0);
eq(r.cls.key, 'moderate', '病例 6 工具顯示 moderate');
eq(r.prone.level, 'red', '病例 6 工具提示俯臥');
r = L('mimic', 1);
eq(r.cls.pf, 350, '病例 6 利尿後 P/F 350');
eq(r.cls.key, 'none', '病例 6 利尿後不到門檻');

// ---- 考題 ----
eq(QUIZ.length, 20, '20 題');
eq(QUIZ.filter(q => q.l === 'basic').length, 10, '基礎 10');
eq(QUIZ.filter(q => q.l === 'adv').length, 10, '高階 10');
[0, 1, 2, 3].forEach(k => eq(QUIZ.filter(q => q.a === k).length, 5, '答案 ' + 'ABCD'[k] + ' 5 題'));
QUIZ.forEach((q, i) => {
    eq(q.o.length, 4, '第 ' + (i + 1) + ' 題 4 選項');
    eq(new Set(q.o).size, 4, '第 ' + (i + 1) + ' 題選項不重複');
    ok(q.x && q.src, '第 ' + (i + 1) + ' 題有解析與依據');
});
const longest = QUIZ.filter(q => q.o.every((o, k) => k === q.a || o.length < q.o[q.a].length)).length;
ok(longest <= 8, '正解是最長選項不超過 8 題，實際 ' + longest);

const qb = { sex: 'male', height: '170', fio2: '0.9', peep: '12', oxyMode: 'pf', oxy: '', vt: '', plateau: '', ph: '', paco2: '', duration: 'lt3', optimized: true };
const QE = o => A.evaluate({ ...qb, ...o });
eq(Math.round(A.pbw('male', 180) * 6), 451, 'Q1 451 mL');
eq(Math.round(A.pbw('male', 180) * 8), 601, 'Q1 600 ≈ 8 mL/kg');
eq(QE({ oxyMode: 'pao2', oxy: '70', fio2: '0.8', peep: '10' }).cls.key, 'severe', 'Q2 severe');
eq(QE({ oxyMode: 'spo2', oxy: '99', fio2: '0.5' }).cls.key, 'invalid', 'Q3 S/F 不適用');
r = QE({ vt: '360', plateau: '28', peep: '12' }).mech;
ok(r.dp === 16 && r.crs === 22.5, 'Q4 ΔP 16、Crs 22.5');
eq(QE({ vt: String(Math.round(A.pbw('male', 170) * 6)), plateau: '33' }).vtPlan.targetKg, 5, 'Q5 降 1 mL/kg');
ok(QE({ ph: '7.24' }).acid.text.includes('RR'), 'Q6 提高 RR');
eq(A.lookup(A.HIGH, 0.4).peep, '14–16', 'Q7');
eq(QE({ oxyMode: 'pf', oxy: '149' }).prone.level, 'red', 'Q9 P/F <150');
eq(Math.round(93 / 0.5), 186, 'Q11 S/F');
r = QE({ vt: '360', plateau: '28', peep: '14' }).mech;
ok(r.dp === 14 && r.crs === 25.7, 'Q14 PEEP 14 ΔP 14、Crs 25.7');
eq(QE({ oxy: '70', duration: '3to6' }).ecmo.key, 'near', 'Q15 A 未達');
eq(QE({ oxy: '95', duration: 'gt6' }).ecmo.key, 'severe', 'Q15 B 未達');
eq(QE({ oxy: '150', ph: '7.22', paco2: '52', duration: 'gt6' }).ecmo.key, 'no', 'Q15 C 未達');
eq(QE({ oxy: '46', duration: '3to6' }).ecmo.key, 'meet', 'Q15 D 符合');
eq(QE({ oxy: '150', ph: '7.21', paco2: '70', duration: 'gt6' }).ecmo.key, 'meet', 'Q19 符合第 3 條');

// ---- 心智圖：葉節點的 PEEP 表與引擎一致 ----
ok(MAP.dx.length === 5 && MAP.tx.length === 6, '心智圖分支數');
ok(MAP.dx.concat(MAP.tx).every(b => b.t && b.s && b.l.length >= 4), '每分支至少 4 葉');
const leaf = (t, k) => MAP.tx.find(b => b.t === t).l.find(x => x[0] === k)[1];
eq(leaf('PEEP', 'Lower table'), [0.4, 0.6, 0.8, 1.0].map(f => f.toFixed(1).replace(/\.0$/, '.0').replace(/^1\.0$/, '1.0') + '/' + A.lookup(A.LOW, f).peep).join('、'), '心智圖 lower table');
eq(leaf('PEEP', 'Higher table'), [0.4, 0.6, 0.8, 1.0].map(f => f.toFixed(1) + '/' + A.lookup(A.HIGH, f).peep).join('、'), '心智圖 higher table');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
