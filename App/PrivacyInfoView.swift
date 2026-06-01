import SwiftUI

struct PrivacyInfoView: View {
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text("プライバシーに関する取り扱い")
                    .font(.headline)

                bullet("個人情報を一切収集しません。")
                bullet("閲覧履歴を取得しません。")
                bullet("コメント本文・記事本文を取得・保存・分析しません。")
                bullet("登録キーワードは端末内の拡張機能ストレージに保存します。")
                bullet("外部サーバーへ送信する通信は行いません。")
                bullet("拡張機能は対応ニュースサイト上の指定エリアの表示制御のみを目的に動作します。")

                Divider().padding(.vertical, 8)

                Text("仕組み")
                    .font(.headline)
                Text("Safariの機能拡張として動作し、指定した画面要素だけを非表示・削除します。キーワード非表示はニュース一覧の見出しだけを端末内で照合し、一致した一覧行を削除します。コメント本文を読み取って判定する処理はありません。")
                    .foregroundStyle(.secondary)
            }
            .padding()
        }
        .navigationTitle("プライバシー")
        #if os(iOS)
        .navigationBarTitleDisplayMode(.inline)
        #endif
    }

    private func bullet(_ text: String) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            Text("•").foregroundStyle(.secondary)
            Text(text)
        }
    }
}

#Preview {
    NavigationStack { PrivacyInfoView() }
}
