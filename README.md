# 星光夾物所

行動裝置優先、桌機也能玩的 3D 網頁夾娃娃機最小可玩版本。所有遊戲狀態與物理運算都在瀏覽器本機完成，沒有後端、登入、付費或廣告。

## 已完成玩法

- 30 秒一局，可重複挑戰
- 待機時可先觀察目標，按下「投入代幣」才開始倒數並解鎖夾爪
- 虛擬搖桿控制夾爪平面移動
- 拖曳 3D 畫面調整機台觀看角度
- 一鍵完成下降、閉合、升起、回到取物口與放開
- 使用 Rapier 模擬禮物落下、碰撞與旋轉
- 禮物落在發光取物口時判定成功
- 手機直向／橫向響應式介面
- 桌機支援 WASD、方向鍵與空白鍵

## 啟動

需要 Node.js 20.19+ 或 22.12+。

```bash
npm install
npm run dev
```

瀏覽器開啟終端顯示的本機網址即可遊玩。

## 驗證

```bash
npm test
npm run build
```

## 專案結構

```text
src/
├── game/
│   ├── ClawMachineGame.ts  # Three.js 場景、Rapier 物理與夾爪流程
│   ├── round.ts            # 可測試的回合狀態機
│   └── round.test.ts       # 狀態機單元測試
├── main.ts                 # 觸控、鍵盤與 HUD 連接
└── style.css               # 行動優先介面
```

## 技術選擇

- [Vite](https://vite.dev/guide/)：本機開發與正式版建置
- [Three.js](https://threejs.org/manual/#en/creating-a-scene)：3D 場景、材質、燈光與動畫迴圈
- [Rapier JavaScript](https://rapier.rs/docs/user_guides/javascript/getting_started_js/)：禮物剛體、重力與碰撞
- [Vitest](https://vitest.dev/guide/)：回合流程測試

畫面與模型都是程式即時生成，沒有複製其他網站的素材或原始碼。
