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

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
