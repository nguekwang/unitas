# Unitas

Chromium (Electron) 上で、ブラウザ・エディタ・PDF/MD/HTMLビューアを1つのタブ付きウィンドウにまとめたアプリ。

## 起動

```bash
npm install
npm start                 # 空のタブで起動
npm start -- ./note.md    # ファイルを指定して起動
```

## タブの振り分け

| 入力 | 開き方 |
|---|---|
| `http(s)://…` / `example.com` | ブラウザ（Chromium） |
| 検索語 | Google検索 |
| `.pdf` | Chromium内蔵PDFビューア |
| `.html` `.htm` | そのままHTML表示 |
| 画像 | そのまま表示 |
| `.md` | Monacoエディタ＋右側ライブプレビュー（分割） |
| その他のテキスト | Monacoエディタ |

## ショートカット

| キー | 動作 |
|---|---|
| Ctrl/Cmd+T / W | タブを開く / 閉じる |
| Ctrl/Cmd+Tab | タブ切替 |
| Ctrl/Cmd+L | アドレスバー |
| Ctrl/Cmd+O | ファイルを開く |
| Ctrl/Cmd+E | 表示中のファイル（PDF以外のHTML等）をエディタで開く |
| Ctrl/Cmd+S | 保存（エディタ） |
| Ctrl/Cmd+P | MDプレビュー切替（エディタ） |
| Ctrl/Cmd+R | 再読み込み |

## 構成

- `main.js` … タブ管理（`WebContentsView`）、種別判定、ショートカット、ファイルIO
- `shell.html` / `shell-preload.js` … タブバー＋アドレスバーのUI
- `editor.html` / `editor-preload.js` … Monaco＋MDプレビュー（marked＋DOMPurify）
- `start.html` … 新規タブ

## 既知の制限（最小版）

- タブの並べ替え・ブックマーク・履歴UI・拡張機能は未対応
- 外部でファイルが変更されても自動リロードしない
- 未保存のままタブを閉じても確認しない
- Electronは拡張機能の対応が限定的（uBlock等は別途対応が必要）
