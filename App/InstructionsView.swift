import SwiftUI

struct InstructionsView: View {
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                #if os(iOS)
                instructionGroup(
                    title: "iPhone / iPad の場合",
                    steps: [
                        "「設定」アプリを開く",
                        "「Safari」を開く",
                        "「機能拡張」を開く",
                        "本拡張機能をオンにする",
                        "対象ニュースサイトでの使用を「許可」に設定する",
                    ]
                )
                #else
                instructionGroup(
                    title: "Mac の場合",
                    steps: [
                        "Safari を開く",
                        "メニューから「Safari」>「設定…」を開く",
                        "「機能拡張」タブを開く",
                        "本拡張機能のチェックを有効にする",
                        "対象ニュースサイトでの使用を「許可」にする",
                    ]
                )
                #endif

                Divider()

                VStack(alignment: .leading, spacing: 8) {
                    Text("動作対象")
                        .font(.headline)
                    Text("Safariで対応ニュースサイトを開いたときのみ動作します。他のサイトには影響しません。")
                        .foregroundStyle(.secondary)
                    Text("キーワード非表示はSafariの拡張機能ボタンから設定できます。")
                        .foregroundStyle(.secondary)
                }
            }
            .padding()
        }
        .navigationTitle("拡張機能の有効化")
        #if os(iOS)
        .navigationBarTitleDisplayMode(.inline)
        #endif
    }

    private func instructionGroup(title: String, steps: [String]) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title)
                .font(.headline)
            ForEach(Array(steps.enumerated()), id: \.offset) { index, step in
                HStack(alignment: .firstTextBaseline, spacing: 12) {
                    Text("\(index + 1).")
                        .monospacedDigit()
                        .foregroundStyle(.secondary)
                    Text(step)
                }
            }
        }
    }
}

#Preview {
    NavigationStack { InstructionsView() }
}
