# Beetfolio — API連携 / バックエンド設計

現状は依存なしの静的SPA（データは localStorage）。本ドキュメントは「実データのAPI自動同期」へ進むための設計指針。
UI側は [store.js](store.js) の **セレクタ＋CRUD のインターフェイスを変えない**ことを前提に、その内部実装をローカル→APIへ差し替える方針。

## 1. 移行ステップ
1. **プロバイダ抽象化**（小）: `store.js` の読み書きを `Provider` 経由にする。
   - `LocalProvider`（現状: localStorage）
   - `ApiProvider`（今後: バックエンドAPI）
   - UI（app.js）は `Store.totalValue()` 等のセレクタだけを呼ぶので無改修。
2. **Next.js + TypeScript + Tailwind 移植**（中）: 現在のページ構成・配色トークン・チャートをコンポーネント化。
   - `app/(dashboard)/page.tsx` などに分割、`store.js` の型を `types.ts` に昇格。
3. **DB導入**（中）: Postgres（Supabase 等）+ Prisma。スキーマは現構造を踏襲（下記）。
4. **取引所/証券/銀行 連携**（大）: 各プロバイダの読み取りAPI / アグリゲーション基盤を接続。

## 2. データモデル（現状の構造をそのまま昇格）
```
Account     { id, name, type: crypto|securities|bank, color, logo, providerId? }
Holding     { id, accountId, class: crypto|stock|fund|cash, symbol, name, quantity, price, costBasis }
Transaction { id, date, accountId, side: buy|sell|deposit|withdraw, symbol, quantity, price, note }
PriceSnapshot { symbol, price, asOf }         // 価格更新の履歴
NetWorthSnapshot { date, value }              // 推移チャートを実データ化
Connection  { id, accountId, provider, status, lastSyncAt }  // 暗号化キーはここに紐付け（値は別管理）
```
- 現在 `netWorthSeries()` は擬似生成 → 将来は `NetWorthSnapshot` を日次保存して実推移に。

## 3. API エンドポイント（案・REST）
```
GET    /api/portfolio            総資産・配分・KPI（集計済み）
GET    /api/accounts             口座一覧 + 残高
GET    /api/holdings             保有一覧
GET    /api/transactions         取引履歴（?side= フィルタ）
POST   /api/transactions         取引記録（保有に反映）
POST   /api/connections          口座接続（プロバイダ + 暗号化キー登録）
POST   /api/sync/:accountId      残高・約定・価格の取り込み
GET    /api/prices?symbols=...   現在値の取得
```

## 4. 外部連携の方針
| 種別 | 連携先（例） | 取得物 |
|---|---|---|
| 暗号資産 | bitFlyer / Coincheck / Binance / GMO の **読み取り専用API** | 残高・約定・建玉 |
| 株式・投信 | 証券口座 or 株価API（J-Quants / Yahoo Finance系） | 評価額・基準価額 |
| 銀行・現金 | 口座アグリゲーション（Moneytree LINK 等）or 手動 | 残高 |
| 価格 | CoinGecko / 取引所ticker / 株価API | リアルタイム価格 |

## 5. セキュリティ（最重要）
- APIキー/シークレットは**サーバ側でのみ保管・暗号化（KMS / envの鍵でAES-GCM）**。クライアントに渡さない。
- 取引所キーは**読み取り専用・出金不可**を必須に。出金/送金機能は実装しない。
- 同期はサーバのジョブ（cron / queue）で実行し、結果（残高・評価額）のみをクライアントへ返す。
- 認証はメール+パスキー or OAuth。ユーザーごとにデータを分離（RLS）。
- ※現状のSPAの「口座を接続」モーダルは**スキャフォルド**。キーは保存せず口座枠のみ作成する。

## 6. 現状から触る場所
- `store.js`: `LocalProvider` を切り出し、`ApiProvider` を追加（fetch でAPI呼び出し）。環境変数で切替。
- `app.js`: 変更不要（セレクタ/CRUDのI/Fが同じなら）。
- 接続UI: `openConnectForm()` の保存処理を `POST /api/connections` に置き換え。
