# ARDS Ventilator Setting Tool

一個以成人 ARDS 肺保護性通氣策略為核心的互動式床邊工具，可依病人的性別、身高、P/F ratio 與 FiO₂，快速計算 Predicted Body Weight（PBW）、建議 tidal volume、ARDS 嚴重度、ARDSNet PEEP/FiO₂ 對照、俯臥治療提示，以及 VV-ECMO 轉介警示。

本工具主要依據：

- 2023 Global Definition of ARDS
- ESICM 2023 ARDS Guidelines
- ATS 2024 ARDS Clinical Practice Guideline Update
- ARDSNet Lung-Protective Ventilation Protocol
- EOLIA trial / severe ARDS VV-ECMO referral criteria

---

## 功能

### 1. Predicted Body Weight（PBW）

依病人生理性別與身高計算 PBW。

男性：

```text
PBW = 50 + 0.91 × (height in cm − 152.4)
```

女性：

```text
PBW = 45.5 + 0.91 × (height in cm − 152.4)
```

呼吸器 tidal volume 應依 **PBW，而不是實際體重** 計算。

---

## 2. Lung-Protective Tidal Volume

預設建議：

```text
Vt = 6 mL/kg PBW
```

同時顯示：

```text
4–8 mL/kg PBW
```

供臨床依下列因素調整：

- Plateau pressure
- Respiratory-system compliance
- Patient-ventilator synchrony
- Acid-base status
- Hypercapnia
- Hemodynamics

一般以：

```text
Plateau pressure <30 cmH₂O
```

為肺保護通氣的重要目標。

---

## 3. ARDS Severity

依 P/F ratio 顯示氧合嚴重度：

| P/F Ratio | Severity |
|---|---|
| >300 | 未達 ARDS 氧合門檻 |
| 201–300 | Mild ARDS |
| 101–200 | Moderate ARDS |
| ≤100 | Severe ARDS |

注意：ARDS 診斷不能只依 P/F ratio。

仍需符合完整 ARDS 定義，包括：

- 急性發作或惡化
- 符合時序條件
- 雙側肺部 opacity
- 肺水腫不能完全由心因性肺水腫或 fluid overload 解釋
- 符合氧合異常標準

---

## 4. ARDSNet PEEP / FiO₂ Table

工具依目前輸入的 FiO₂ 顯示 ARDSNet lower-PEEP / higher-FiO₂ strategy 的參考 PEEP。

| FiO₂ | PEEP cmH₂O |
|---:|---:|
| 0.30 | 5 |
| 0.40 | 5–8 |
| 0.50 | 8–10 |
| 0.60 | 10 |
| 0.70 | 10–14 |
| 0.80 | 14 |
| 0.90 | 14–18 |
| 1.00 | 18–24 |

常用氧合目標：

```text
PaO₂ 55–80 mmHg
```

或：

```text
SpO₂ 88–95%
```

PEEP 不應只依表格機械式調整，仍須同時評估：

- Lung compliance
- Driving pressure
- Blood pressure
- Cardiac output
- RV function
- Auto-PEEP
- Lung overdistension

對 moderate-to-severe ARDS，ATS 2024 支持在適當病人使用較高 PEEP strategy，但不建議 prolonged recruitment maneuver 作為常規策略。

---

## 5. Prone Positioning

若：

```text
P/F <150
```

且已完成適當的 lung-protective ventilation 與 PEEP 最佳化，工具會提示考慮早期 prone positioning。

建議 prolonged prone session：

```text
≥16 hours/session
```

尤其適用於 moderate-to-severe ARDS。

---

## 6. Plateau Pressure

如輸入 Plateau pressure，可協助監測肺保護通氣。

主要目標：

```text
Pplat <30 cmH₂O
```

若 Pplat ≥30 cmH₂O，應重新檢查：

- Tidal volume
- PEEP
- Auto-PEEP
- Lung compliance
- Chest wall mechanics
- Patient-ventilator dyssynchrony
- Abdominal pressure

必要時考慮進一步降低 Vt。

---

## 7. Driving Pressure

若輸入：

- Plateau pressure
- Total PEEP

工具自動計算：

```text
Driving Pressure = Plateau Pressure − Total PEEP
```

即：

```text
ΔP = Pplat − PEEP
```

約：

```text
ΔP >15 cmH₂O
```

可視為較高肺應力及不良預後的風險訊號。

但應注意：

> Driving pressure 15 cmH₂O 並不是 ATS 或 ESICM 規定的獨立絕對治療 target。

它比較適合作為肺力學最佳化的重要監測參數。

---

## 8. VV-ECMO Referral Alert

對 refractory severe ARDS，工具會依 P/F ratio 提示是否應及早與 ECMO center 討論。

常用 EOLIA / ESICM severe hypoxemia criteria：

### Criterion 1

```text
P/F <50
持續 >3 hours
```

### Criterion 2

```text
P/F <80
持續 >6 hours
```

### Criterion 3

嚴重 hypercapnic respiratory failure：

```text
pH <7.25
PaCO₂ ≥60 mmHg
持續 >6 hours
```

並已嘗試適當的：

- Lung-protective ventilation
- RR optimization
- PEEP optimization
- Prone positioning
- Neuromuscular blockade when appropriate
- Treatment of reversible cause

對有可能需要 VV-ECMO 的病人，重點是：

```text
Early referral, not late rescue
```

尤其應避免在長期高壓、高 FiO₂ ventilator exposure 後才聯絡 ECMO center。

---

# v2.0 更新（2026-10-25）

- 輸入中途不再跳出 `alert()`：錯誤改為頁面內提示並標紅欄位，其他結果照常計算
- 氧合來源可選 PaO₂（自動算 P/F）、直接輸入 P/F，或 SpO₂（S/F；2024 Global definition：mild 235–315、moderate 148–235、severe ≤148，SpO₂ >97% 不適用）
- FiO₂ 可輸入 0.60 或 60
- PEEP/FiO₂：同時列出 lower 與 higher PEEP table 並標示對應列；FiO₂ 介於兩列時列出上下兩列（原版浮點數取最近值會任意選列）；moderate–severe 依 ATS 2024 以 higher table 為主
- 輸入目前 Vt → mL/kg PBW 與 ARDSNet Pplat 調整（>30 降 1 mL/kg 至最低 4；<25 且 <6 升回 6）
- Driving pressure + Crs（Vt/ΔP）
- pH → RR 調整建議（目標 7.30–7.45）
- VV-ECMO 依 EOLIA 完整條件：P/F、pH/PaCO₂、持續時間、是否已最佳化
- 俯臥提示加入 PROSEVA FiO₂ ≥0.6 條件
- 示例病例標示「示例」，可一鍵重設或清空；手機版版面修正；參考文獻

---

# v2.1 更新（2026-11-02）

- 分頁：決策工具、示範病例（`#cases`）、考題（`#quiz`）、心智圖（`#map`）；決策引擎未更動
- 示範病例 6 例：Vt 設錯體重、沒有 ABG、severe 與俯臥、難治低血氧、高碳酸酸血症、不是 ARDS。每例可把數字帶回決策工具
- 考題 20 題：基礎 10、高階 10，答案 A–D 各 5 題，順序固定，不儲存作答
- 內容在 `index.html` 的 `/*CASES-START*/`、`/*QUIZ-START*/`、`/*MAP-START*/`，數字由 `tests.cjs` 對照引擎

---

# 使用方式

純 HTML / CSS / JavaScript，單一 `index.html`，直接開啟即可，或使用 GitHub Pages：

https://yht5582-source.github.io/ARDS-ventilatior/

決策邏輯集中在 `index.html` 的 `/*ENGINE-START*/ … /*ENGINE-END*/`，測試：

```text
node tests.cjs
```

---

# 專案結構

```text
ARDS-ventilatior/
├── index.html   # 介面 + 決策引擎
├── tests.cjs    # 引擎測試
├── README.md
└── .nojekyll
```

---

# 參考文獻

- Matthay MA, et al. A New Global Definition of ARDS. Am J Respir Crit Care Med 2024;209:37–47.
- Grasselli G, et al. ESICM guidelines on acute respiratory distress syndrome. Intensive Care Med 2023;49:727–759.
- Qadir N, et al. An Update on Management of Adult Patients with ARDS: An Official ATS Clinical Practice Guideline. Am J Respir Crit Care Med 2024;209:24–36.
- ARDSNet. N Engl J Med 2000;342:1301–8；ALVEOLI. N Engl J Med 2004;351:327–36.
- Guérin C, et al. PROSEVA. N Engl J Med 2013;368:2159–68.
- Combes A, et al. EOLIA. N Engl J Med 2018;378:1965–75.
- 示範病例與考題另引用之試驗，見網頁頁尾。

---

本工具僅供臨床決策輔助，不取代臨床判斷。
