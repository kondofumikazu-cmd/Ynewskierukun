import SwiftUI

struct ContentView: View {
    var body: some View {
        NavigationStack {
            Form {
                Section {
                    descriptionBlock
                }

                Section {
                    NavigationLink("拡張機能の有効化方法") {
                        InstructionsView()
                    }
                    NavigationLink("プライバシーについて") {
                        PrivacyInfoView()
                    }
                } footer: {
                    Text("Safariで機能拡張を有効にすると、対応ニュースサイトで自動的に反映されます。")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }
            .navigationTitle("Y News きえるくん")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
        }
        #if os(macOS)
        .frame(minWidth: 480, minHeight: 540)
        #endif
    }

    private var descriptionBlock: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("このアプリはSafariで対応ニュースサイトの対象エリアを自動的に非表示にするSafari拡張です。")
            Text("・拡張機能のポップアップからキーワード非表示を設定できます。")
            Text("・記事本文は変更しません。")
            Text("・コメント内容や閲覧履歴は収集しません。")
            Text("・外部サーバーへの送信は行いません。")
        }
        .font(.callout)
        .foregroundStyle(.primary)
    }
}

#Preview {
    ContentView()
}
