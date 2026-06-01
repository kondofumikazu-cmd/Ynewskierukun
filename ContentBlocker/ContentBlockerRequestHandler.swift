import Foundation
import SafariServices

final class ContentBlockerRequestHandler: NSObject, NSExtensionRequestHandling {

    func beginRequest(with context: NSExtensionContext) {
        guard
            let url = Bundle.main.url(forResource: "blockerList", withExtension: "json"),
            let attachment = NSItemProvider(contentsOf: url)
        else {
            let error = NSError(
                domain: "YNewsKieruKunContentBlocker",
                code: 1,
                userInfo: [NSLocalizedDescriptionKey: "blockerList.json was not found."]
            )
            context.cancelRequest(withError: error)
            return
        }

        let item = NSExtensionItem()
        item.attachments = [attachment]
        context.completeRequest(returningItems: [item], completionHandler: nil)
    }
}
