# App Store 掲載文・審査向け資料

## App Store 掲載タイトル(30文字以内)

```
Y News きえるくん
```

## App Store サブタイトル(30文字以内)

```
Safariの表示を整える軽量拡張
```

## App Store 説明文

```
Safari で対応ニュースサイトを閲覧するときに、指定した画面エリアをすっきり非表示にする軽量な Safari 機能拡張です。本アプリは個人開発によるSafari機能拡張であり、いかなる第三者企業の公式アプリでも、提携・関連サービスでもありません。

【できること】
・指定エリアを自動で非表示
・登録キーワードに一致するニュース一覧行を非表示・削除
・機能拡張を有効にするだけで動作
・一部の対象モジュール通信を宣言ルールでブロック

【しないこと】
・記事本文・見出し・画像の改変はしません。
・ニュースサイトのデータを外部送信・保存・分析しません。
・コメント本文を読み取りません。
・閲覧履歴・URL・個人情報を取得しません。
・外部サーバーへ送信する通信は行いません。

【動作対象】
・Safari で対応ニュースサイトを開いたときのみ動作します。
・他のサイトには一切影響しません。

【仕組み】
本機能拡張は指定セレクタに一致する要素を非表示・削除します。登録キーワードは端末内に保存し、ニュース一覧の見出しだけを端末内で照合して、一致した一覧行を非表示・削除します。URLに対象モジュール名が含まれる一部通信は宣言ルールでブロックします。広告ブロッカーではありません。

iPhone / iPad の場合は、設定 > Safari > 機能拡張 から本拡張機能をオンにし、対象ニュースサイトでの使用を「許可」してください。
Mac の場合は、Safari > 設定 > 機能拡張 から本拡張機能をオンにし、対象ニュースサイトでの使用を「許可」してください。
```

## キーワード(100文字以内・カンマ区切り)

```
Safari,機能拡張,ニュース,非表示,キーワード,見出し,記事,広告ブロック,Yahoo ニュース,表示調整,軽量,ブラウザ,読みやすい,280 blocker,yahoo news,yahoo
```

## リリースノート案

### iOS 1.1.2

```
Safari拡張の安定性を改善しました。ページ移動後の非表示処理とキーワード一致処理を安定化し、パフォーマンスとメモリ使用量を改善しました。軽微な不具合を修正しました。
```

### macOS 1.1.2

```
Safari拡張の安定性を改善しました。ページ移動後の非表示処理とキーワード一致処理を安定化し、パフォーマンスとメモリ使用量を改善しました。軽微な不具合を修正しました。
```

### App Review向けメモ

```
This update improves Safari extension stability on supported news pages. It improves hiding behavior after page navigation and dynamic page updates, improves keyword matching reliability, reduces DOM scanning and observers for better performance and memory usage, and fixes minor issues.

All keyword matching is processed locally on the device. The app does not collect, transmit, or store browsing content or user keywords on any external server.
```

## サポートURL / プライバシーポリシーURL

- サポートURL: GitHub Pagesで公開した `docs/support.html` のURL
- プライバシーポリシーURL: GitHub Pagesで公開した `docs/privacy.html` のURL

## 販売形式 / 価格設定

- **販売形式**: 買い切りの有料アプリ
- **価格**: 日本のApp Storeで120円
- **設定場所**: App Store Connect > 対象アプリ > Monetization > Pricing and Availability > Price Schedule

App Store Connectで価格を設定する前に、Account HolderがPaid Apps Agreementを承認しておく必要があります。価格設定では、Base Country or Regionを日本にし、Priceで120円を選択してください。120円が通常の候補に表示されない場合は、See Additional Pricesから追加価格を確認してください。

## App Privacy(プライバシー)申告

App Store Connect の「アプリのプライバシー」では、以下を選択します。

- **データの収集**: いいえ(データを収集しません)

これにより、データタイプ・利用目的・第三者提供等の追加申告は不要になります。

## App Review に向けた短い説明(英語)

```
This app is a lightweight Safari Web Extension that hides fixed page areas on a supported news site inside Safari.

All features are available in the app after download. There are no additional unlock screens.

The extension hides and removes only the elements that match its fixed CSS selectors. It can also hide and remove news-list rows whose headlines match user-saved keywords; matching is performed locally on device. declarativeNetRequest blocks subresource requests whose URLs include known target module names. The article body is left untouched.

The extension does NOT:
- read or store comment text or article text
- collect browsing history or URLs
- communicate with any external server

The extension runs only on its declared supported site. The extension does not use native messaging.
```

## App Review に向けた短い説明(日本語)

```
本アプリは、Safariで対応ニュースサイトを閲覧するときに、指定した画面エリアを非表示にする軽量な Safari 機能拡張です。

本アプリはダウンロード後にすべての機能を利用できます。追加の解除画面はありません。

機能拡張は指定セレクタに一致する要素を非表示・削除します。登録キーワードに見出しが一致するニュース一覧行も非表示・削除します。キーワードは端末内に保存し、見出し照合も端末内だけで行います。URLに対象モジュール名が含まれる一部通信はdeclarativeNetRequestでブロックします。記事本文には触れません。アプリ内の種類別トグルはありません。

機能拡張はコメント本文・記事本文を読み取らず、保存・送信も一切行いません。外部サーバーとの通信は行いません。動作範囲は宣言済みの対応サイトのみに限定されています。

手動テストでは、アプリ起動、Safari機能拡張の有効化、固定エリア非表示、キーワード非表示、他サイトに影響しないことを確認しています。
```

## 表現上の注意

- 「スクレイピング」「第三者サービスのデータ取得」「コメント収集」といった表現は使わない。
- 公開メタデータでは第三者ブランド名を使わず、「Safariで対応ニュースサイトを閲覧するときに指定エリアを非表示にする軽量な Safari 機能拡張」という説明で統一。

## 再提出時の注意

- App Store Connect の対象バージョンに未提出の有料コンテンツ商品を紐づけない。
- 既に作成済みの商品がある場合は、このアプリバージョンから外すか、必要なスクリーンショットとメタデータを入れて商品自体を審査提出する。
- App Review 返信では「このビルドはダウンロード後にすべての機能を利用でき、追加の解除画面はありません」と説明する。
