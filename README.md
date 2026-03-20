# Kindle HTML to Markdown

KindleのHTMLハイライトをObsidianのMarkdownノートに変換するObsidianプラグイン。

## 機能

- KindleからエクスポートしたHTMLファイルを読み込み、Obsidian用のMarkdownに変換
- 既存ノートとのマージに対応（ハイライトの追記）
- リボンアイコンまたはコマンドパレットから実行可能
- 出力先フォルダの設定が可能

## インストール

1. このリポジトリをObsidian Vaultの `.obsidian/plugins/kindle-html-to-md/` にクローン
2. 依存関係をインストール:
   ```bash
   npm install
   ```
3. ビルド:
   ```bash
   npm run build
   ```
4. Obsidianの設定でプラグインを有効化

## 開発

```bash
npm run dev
```

ファイル変更を監視して自動的にリビルドします。

## 使い方

1. KindleアプリからハイライトをHTML形式でエクスポート
2. Obsidianでリボンアイコン（本のアイコン）をクリック、またはコマンドパレットから「Import Kindle HTML」を実行
3. HTMLファイルを選択
4. 変換されたMarkdownノートがVaultに作成される

## ライセンス

MIT
