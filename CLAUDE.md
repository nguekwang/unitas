# Unitas — Claude Code 引き継ぎメモ

## ゴール
Arch Linux 上で動く、Chromium(Electron) ベースの「全部入りタブアプリ」。
ブラウザ / エディタ / PDF・MD・HTML ビューアを1ウィンドウに統合し、さらに
**Claude Agent SDK で VS Code 拡張版 Claude Code と同等の UI/UX** を組み込む。IaC も扱えるようにする。

## 現状（段階1完了: 起動確認済み）
- `main.js` … `WebContentsView` でタブ管理。入力を URL/PDF/HTML/画像/MD・テキストに振り分け
- `shell.html` + `shell-preload.js` … タブバー・アドレスバー
- `editor.html` + `editor-preload.js` … Monaco (AMD, v0.52.2) + marked + DOMPurify。MD は左右分割ライブプレビュー
- `start.html` … 新規タブ
- Electron 45 + Xvfb で起動確認済み: Monaco(ワーカー含む)、内蔵PDFビューア、MD分割、全ショートカット（PDFビューア内フォーカス時も）
- 注意点（ハマりどころ）:
  - marked / DOMPurify は Monaco の `loader.js` より**前**に読む（後だと AMD モジュールとして登録されグローバルが無くなる）
  - `file:read/write` は呼び出し元 editor タブ自身のファイルに限定（パス引数なし）。editor タブは `will-navigate` を禁止
  - 許可フォルダ（プロジェクトフォルダ）は段階3で Claude 用に導入予定

## 次のタスク

### 1. PKGBUILD（Arch）— 作成済み・Arch 実機での makepkg/namcap 未確認
- `PKGBUILD` はリポジトリ直下。ローカルのチェックアウトから `$startdir` 経由でビルドする
- Monaco は `min/` だけ使うので `dev/ esm/ min-maps/` は削除（103MB → 17MB）
- 引数処理は Arch の electron ランチャーがフラグをアプリパスより前に入れても動くようにした（`process.defaultApp`）
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
- エージェントの `cwd` は開いているプロジェクトフォルダ。ファイルIOは main 側で許可パスを制限する

### 3. IaC 対応
- Monaco: Terraform/OpenTofu(HCL)、YAML(Ansible/K8s)、Pulumi(TS/Python) のシンタックス・スキーマ補完
- 統合ターミナル（xterm.js + node-pty）で `tofu plan` / `ansible-playbook --check` を実行
- AI フロー: Claude が IaC を生成/修正 → **plan/diff を必ず UI に表示** → ユーザー承認後にのみ apply。apply 系コマンドは自動承認しない
- 要確認（ユーザーに聞く）: IaC の対象は「クラウド/サーバ」か「Arch 環境自体の構成管理」か

## 方針メモ
- 最小構成を保つ。まず起動 → PKGBUILD → Claude チャット（読み取り専用）→ 編集承認 → IaC の順
- ユーザー: Yoshi（日本語で会話、Arch Linux 使用、モバイルでも完結できるワークフローを好む）
