# ニュースきえるくん

Safari で対応ニュースサイトを開いたときだけ、指定した画面エリアを自動的に非表示にする、軽量な Safari 機能拡張です。本アプリは個人開発によるものであり、Yahoo! JAPAN、LINEヤフー株式会社、その他いかなる第三者企業の公式アプリでも、提携・関連サービスでもありません。

iOS / iPadOS / macOS に対応しています。記事本文はそのまま表示されます。

---

## 特徴

- **対象は対応ニュースサイトのみ。** 他のサイトには一切影響しません。
- **機能拡張を有効にするだけで固定対象を非表示にします。**
- **キーワード非表示に対応。** 拡張機能のポップアップで登録したキーワードが見出しに含まれるニュース一覧カード全体を非表示にします。
- **URLに対象モジュール名が含まれる通信だけブロックします。** CSSセレクタだけでは通信URLを特定できないため、URLに手がかりがある場合のみ読み込みを止めます。
- **外部サーバーへの送信はゼロ。** 登録キーワードは端末内に保存します。
- **コメント本文・記事本文・閲覧履歴の取得や送信を行いません。**
- **指定セレクタに一致する要素だけを非表示・削除します。** 記事本文には触れません。

## 非表示対象

| CSSセレクタ | 内容 |
| --- | --- |
| `#contentsWrap #uamods-topics` | 指定エリアを隠す |
| `#contents #yjnSub` | 指定エリアを隠す |
| その他 `content.css` / `content.js` の固定セレクタ | 指定エリアを隠す |
| `#newsFeed` / `.newsFeed_list` 配下の記事カード | キーワード一致時にニュース一覧カード全体を隠す |
| `#uamods-recommend` / `#uamods-also_read` 配下の記事カード | キーワード一致時に関連記事・おすすめカード全体を隠す |

## 動作の仕組み

1. Safari で対応ニュースサイトを開くと、機能拡張のコンテンツスクリプト (`content.js`, `content.css`) が `document_start` でロードされる。
2. CSS が指定セレクタに一致する要素を即時に `display:none` にする。
3. JS が同じセレクタに一致する要素を DOM から削除する。
4. ポップアップで登録したキーワードを `browser.storage.local` に保存し、ニュース一覧・関連記事・おすすめ欄のカード内テキストを端末内で照合して、一致したカードに `data-keyword-hidden="true"` を付けてCSSで非表示にする。
5. `declarativeNetRequest` の `network_rules.json` が、対象モジュール名を含むサブリソース通信をブロックする。
6. キーワード登録時だけ、対象の一覧コンテナ内に限定した MutationObserver で後から追加されたカードを再処理する。

## ビルド方法

### 事前準備

- Xcode 15 以降
- macOS 13 以降
- Apple Developer Team ID
- [XcodeGen](https://github.com/yonaskolb/XcodeGen) (`brew install xcodegen`)

### 手順

```bash
cd "/path/to/y block news app 2"
xcodegen generate
open YahooNewsCommentHider.xcodeproj
```

Xcode で:

- **iOS / iPadOS で動かす場合**: スキーム `YahooNewsCommentHider (iOS)` を選択して実機 or シミュレータで実行。
- **macOS で動かす場合**: スキーム `YahooNewsCommentHider (macOS)` を選択して実行。

### ルール生成と検証

固定非表示セレクタ、Content Blocker、Declarative Net Request、コンテンツスクリプト用設定は `Shared/rules.json` を元に生成します。

```bash
python3 Tools/generate_rules.py
python3 Tools/generate_rules.py --check
python3 Tools/check_versions.py
python3 -m unittest discover -s Tests -p 'test_*.py'
node Tests/keyword_utils.test.js
node Tests/comment_recovery_budget.test.js
node Tests/content_dom.test.js
```

### 署名

- Bundle ID は本リポジトリの既定では `com.deafumi.NewsYKieruKun` / `.Extension` / `.ContentBlocker` です。Apple Developer 側で別の ID を使う場合は `project.yml` を修正してください。

## Safari で機能拡張を有効にする方法

### iPhone / iPad

1. 「設定」アプリを開く
2. 「Safari」を開く
3. 「機能拡張」を開く
4. 「ニュースきえるくん」をオンにする
5. 対応ニュースサイトでの使用を「許可」に設定する

### Mac

1. Safari を開く
2. メニューバー「Safari」>「設定…」を開く
3. 「機能拡張」タブを開く
4. 「ニュースきえるくん」のチェックを有効にする
5. 対応ニュースサイトでの使用を「許可」にする

## プライバシー

[PRIVACY.md](PRIVACY.md) を参照してください。要点:

- 個人情報を収集しません。
- 閲覧履歴を取得しません。
- コメント本文・記事本文を取得・保存・分析しません。
- 登録キーワードは端末内に保存します。
- 外部サーバーへの送信を行いません。
- 機能拡張は対応ニュースサイト上の指定エリアの表示制御のみを目的に動作します。

## ライセンス / 注記

- 本拡張機能は対応ニュースサイトの表示を制御するためだけに存在します。
- 本アプリは独立したSafari機能拡張です。
- 商標は各権利者に帰属します。
- HTML構造の変更により対象エリアが隠れない場合があります。その際は CSS / JS のセレクタ更新が必要です。
- URLブロックはURL内に対象モジュール名が含まれる通信だけに効きます。初期HTMLに含まれる要素や、別名のAPIで配信される内容までは通信停止できません。

## 手動テスト手順

1. アプリを起動して種類別トグルが表示されないことを確認する。
2. Safari で対応ニュースサイトを開く。
3. 固定セレクタに一致する要素が表示されず、DOMから削除されることを確認する。
4. 拡張機能のポップアップでキーワードを登録し、ニュース一覧カード全体が非表示になり、該当部分が詰められることを確認する。
5. 記事本文が通常通り表示されることを確認する。
6. `https://www.google.com` 等の他サイトを開き、レイアウトに変化がないことを確認する。
