# Unitas — Claude Code 引き継ぎメモ

## ゴール
Arch Linux 上で動く、Chromium(Electron) ベースの「全部入りタブアプリ」。
ブラウザ / エディタ / PDF・MD・HTML ビューアを1ウィンドウに統合し、さらに
**Claude Agent SDK で VS Code 拡張版 Claude Code と同等の UI/UX** を組み込む。IaC も扱えるようにする。

## 現状（最小版・未実行）
- `main.js` … `WebContentsView` でタブ管理。入力を URL/PDF/HTML/画像/MD・テキストに振り分け
- `shell.html` + `shell-preload.js` … タブバー・アドレスバー
- `editor.html` + `editor-preload.js` … Monaco (AMD, v0.52.2) + marked + DOMPurify。MD は左右分割ライブプレビュー
- `start.html` … 新規タブ
- ⚠ **一度も起動していない**。作成環境が npm に接続できず `npm install` 未実施。構文チェック(`node --check`)のみ通過済み

## 最初にやること
1. `npm install && npm start` で起動確認。特に以下を実機で検証:
   - Monaco の AMD ローダが `file://` で読めるか（ワーカーは data: URL 経由）
   - `WebContentsView` 内で Chromium 内蔵 PDF ビューアが出るか
   - ショートカット（`before-input-event`）が各ビュー内でも効くか
2. 壊れていたら直す。`README.md` に仕様あり

## 次のタスク

### 1. PKGBUILD（Arch）
- システムの `electron` パッケージに依存させる（Electron本体を同梱しない）
  - `depends=('electron')`、`makedepends=('npm')`
  - アプリ本体を `/usr/lib/unitas/` に置き、`npm install --omit=dev` した `node_modules` ごと入れる
  - `/usr/bin/unitas` ランチャー: `exec electron /usr/lib/unitas "$@"`
  - `/usr/share/applications/unitas.desktop` とアイコン
- `makepkg -si` と `namcap` で確認。`devDependencies` の `electron` は package.json から外す（システム版を使うため）

### 2. Claude Code 統合（Agent SDK）
- main プロセスで `@anthropic-ai/claude-agent-sdk` の `query()` を使い、ストリームを IPC でレンダラへ流す
- UI は VS Code 版 Claude Code に寄せる: 右サイドバーのチャット、ツール呼び出し表示、
  ファイル編集は **Monaco の diff エディタ** で承認/却下、`@ファイル` メンション、現在開いているファイル/選択範囲をコンテキストに渡す、権限プロンプト
- 認証: `claude setup-token` で発行したトークンを環境変数 `CLAUDE_CODE_OAUTH_TOKEN` として SDK に渡す。
  保存は Electron `safeStorage`（Linux では libsecret/kwallet）。平文で設定ファイルに置かない
  - 注意: サブスクのOAuthトークンは個人利用向け。他人に配布するなら API キー(`ANTHROPIC_API_KEY`)方式にする（要・最新の利用規約確認）
- エージェントの `cwd` は開いているプロジェクトフォルダ。ファイルIOは main 側で許可パスを制限する（現状 `file:read/write` は任意パスなので要絞り込み）

### 3. IaC 対応
- Monaco: Terraform/OpenTofu(HCL)、YAML(Ansible/K8s)、Pulumi(TS/Python) のシンタックス・スキーマ補完
- 統合ターミナル（xterm.js + node-pty）で `tofu plan` / `ansible-playbook --check` を実行
- AI フロー: Claude が IaC を生成/修正 → **plan/diff を必ず UI に表示** → ユーザー承認後にのみ apply。apply 系コマンドは自動承認しない
- 要確認（ユーザーに聞く）: IaC の対象は「クラウド/サーバ」か「Arch 環境自体の構成管理」か

## 方針メモ
- 最小構成を保つ。まず起動 → PKGBUILD → Claude チャット（読み取り専用）→ 編集承認 → IaC の順
- ユーザー: Yoshi（日本語で会話、Arch Linux 使用、モバイルでも完結できるワークフローを好む）
