import Foundation
import Capacitor
import Vision
import UIKit

@objc(VisionPlugin)
public class VisionPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "VisionPlugin"
    public let jsName = "VisionPlugin"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "analyze", returnType: CAPPluginReturnPromise)
    ]

    @objc func analyze(_ call: CAPPluginCall) {
        guard let imageDataUrl = call.getString("imageDataUrl") else {
            call.reject("imageDataUrl is required")
            return
        }

        DispatchQueue.global(qos: .userInitiated).async {
            guard let image = self.imageFromDataUrl(imageDataUrl) else {
                call.resolve(["labels": [], "text": []])
                return
            }

            guard let cgImage = image.cgImage else {
                call.resolve(["labels": [], "text": []])
                return
            }

            var collectedLabels: [String] = []
            var collectedText:   [String] = []
            let group = DispatchGroup()

            // ── VNClassifyImageRequest ──────────────────────────────────────

            group.enter()
            let classifyRequest = VNClassifyImageRequest { request, error in
                defer { group.leave() }
                guard error == nil,
                      let results = request.results as? [VNClassificationObservation]
                else { return }
                collectedLabels = results
                    .filter { $0.confidence >= 0.3 }
                    .map { $0.identifier }
            }

            // ── VNRecognizeTextRequest ──────────────────────────────────────

            group.enter()
            let textRequest = VNRecognizeTextRequest { request, error in
                defer { group.leave() }
                guard error == nil,
                      let results = request.results as? [VNRecognizedTextObservation]
                else { return }
                collectedText = results.compactMap { $0.topCandidates(1).first?.string }
            }
            textRequest.recognitionLevel = .accurate
            textRequest.usesLanguageCorrection = true

            let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
            do {
                try handler.perform([classifyRequest, textRequest])
            } catch {
                // fall through — results arrays are empty, which is fine
            }

            group.wait()

            call.resolve([
                "labels": collectedLabels,
                "text":   collectedText
            ])
        }
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    private func imageFromDataUrl(_ dataUrl: String) -> UIImage? {
        // Accept "data:image/jpeg;base64,..." or "data:image/png;base64,..."
        guard let commaIndex = dataUrl.firstIndex(of: ",") else {
            return nil
        }
        let base64 = String(dataUrl[dataUrl.index(after: commaIndex)...])
        guard let data = Data(base64Encoded: base64, options: .ignoreUnknownCharacters) else {
            return nil
        }
        return UIImage(data: data)
    }
}
