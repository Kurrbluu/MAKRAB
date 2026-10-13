import AppKit
import AVFoundation
import CoreVideo
import WebKit

// Compile: xcrun swiftc scripts/export-tutorial.swift -o /private/tmp/pindahkan-export-tutorial
// Run: /private/tmp/pindahkan-export-tutorial --output exports/Pindahkan-Aku-Plsss-Tutorial.mp4
// Requires the local Vite preview, unless --url points to another copy of this tutorial.

struct ExportFailure: LocalizedError {
    let message: String
    var errorDescription: String? { message }
}

@MainActor
final class TutorialExporter: NSObject, WKNavigationDelegate, WKScriptMessageHandler {
    var window: NSWindow!
    var web: WKWebView!
    var started = false
    var pageError: String?
    let args = Array(CommandLine.arguments.dropFirst())
    let width = 1920
    let height = 1080
    let fps: Int32 = 30

    func option(_ name: String, default fallback: String) -> String {
        guard let index = args.firstIndex(of: name), index + 1 < args.count else { return fallback }
        return args[index + 1]
    }

    func log(_ message: String) {
        print(message)
        fflush(stdout)
    }

    func run() {
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .nonPersistent()
        config.userContentController.add(self, name: "exportError")
        config.userContentController.addUserScript(WKUserScript(source: "window.addEventListener('error',event=>window.webkit.messageHandlers.exportError.postMessage(event.message));window.addEventListener('unhandledrejection',event=>window.webkit.messageHandlers.exportError.postMessage(String(event.reason)));", injectionTime: .atDocumentStart, forMainFrameOnly: true))
        // A Retina viewport produces full-resolution frames without recording the desktop.
        let scale = NSScreen.main?.backingScaleFactor ?? 2
        let logical = NSSize(width: Double(width) / scale, height: Double(height) / scale)
        window = NSWindow(contentRect: NSRect(origin: .zero, size: logical), styleMask: [.borderless], backing: .buffered, defer: false)
        web = WKWebView(frame: NSRect(origin: .zero, size: logical), configuration: config)
        window.contentView = web
        window.orderBack(nil)
        web.navigationDelegate = self
        let address = option("--url", default: "http://127.0.0.1:5173/tutorial-demo/index.html?scene=intro&v=mp4-export-1")
        web.load(URLRequest(url: URL(string: address)!))
        log("Loading tutorial renderer: \(width) x \(height), \(fps) fps.")
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        pageError = String(describing: message.body)
        log("Renderer error: \(pageError!)")
    }

    func js(_ source: String) async throws -> Any? {
        try await withCheckedThrowingContinuation { continuation in
            web.evaluateJavaScript(source) { value, error in
                if let error { continuation.resume(throwing: error) }
                else { continuation.resume(returning: value) }
            }
        }
    }

    func waitFor(_ condition: String) async throws {
        for _ in 0..<300 {
            if let pageError { throw ExportFailure(message: pageError) }
            if (try await js(condition)) as? Bool == true { return }
            try await Task.sleep(nanoseconds: 100_000_000)
        }
        throw ExportFailure(message: "The tutorial assets did not finish loading.")
    }

    func snapshot() async throws -> NSImage {
        let config = WKSnapshotConfiguration()
        config.rect = web.bounds
        config.snapshotWidth = NSNumber(value: web.bounds.width)
        config.afterScreenUpdates = true
        return try await withCheckedThrowingContinuation { continuation in
            web.takeSnapshot(with: config) { image, error in
                if let error { continuation.resume(throwing: error) }
                else if let image { continuation.resume(returning: image) }
                else { continuation.resume(throwing: ExportFailure(message: "Could not render a video frame.")) }
            }
        }
    }

    func append(_ image: NSImage, to adaptor: AVAssetWriterInputPixelBufferAdaptor, at time: CMTime) throws {
        try autoreleasepool {
            guard let pool = adaptor.pixelBufferPool else { throw ExportFailure(message: "The video buffer pool is unavailable.") }
            var pixel: CVPixelBuffer?
            guard CVPixelBufferPoolCreatePixelBuffer(kCFAllocatorDefault, pool, &pixel) == kCVReturnSuccess, let pixel else {
                throw ExportFailure(message: "Could not allocate a video frame.")
            }
            CVPixelBufferLockBaseAddress(pixel, [])
            defer { CVPixelBufferUnlockBaseAddress(pixel, []) }
            guard let color = CGColorSpace(name: CGColorSpace.sRGB),
                  let context = CGContext(data: CVPixelBufferGetBaseAddress(pixel), width: width, height: height, bitsPerComponent: 8, bytesPerRow: CVPixelBufferGetBytesPerRow(pixel), space: color, bitmapInfo: CGImageAlphaInfo.premultipliedFirst.rawValue | CGBitmapInfo.byteOrder32Little.rawValue),
                  let picture = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
                throw ExportFailure(message: "Could not convert a rendered video frame.")
            }
            context.interpolationQuality = .high
            context.draw(picture, in: CGRect(x: 0, y: 0, width: width, height: height))
            if !adaptor.append(pixel, withPresentationTime: time) {
                throw ExportFailure(message: "The video encoder rejected a frame.")
            }
        }
    }

    func export() async throws {
        try await waitFor("Boolean(window.TUTORIAL)&&artworkNames.every(name=>loadedArtwork.has(name))&&document.fonts.status==='loaded'")
        let setup = #"""
        (()=>{
          const api=window.TUTORIAL;
          api.pause();api.config.narration.enabled=false;
          const audio=document.querySelector('#narrationAudio');audio.pause();audio.removeAttribute('src');audio.load();
          const style=document.createElement('style');
          style.textContent='#controls,#launch,#endScreen,#filmProgress,#debug{display:none!important}body{cursor:none!important}*,*::before,*::after{transition:none!important}';
          document.head.appendChild(style);api.seek(0);
          return api.total;
        })()
        """#
        guard let milliseconds = try await js(setup) as? Double else { throw ExportFailure(message: "Missing tutorial duration.") }
        let sourceStart = Double(option("--start", default: "0")) ?? 0
        let requested = Double(option("--duration", default: String(milliseconds / 1000))) ?? milliseconds / 1000
        let seconds = min(requested, milliseconds / 1000 - sourceStart)
        guard sourceStart >= 0 && seconds > 0 else { throw ExportFailure(message: "Invalid export time range.") }
        let duration = CMTime(seconds: seconds, preferredTimescale: 48000)
        let count = Int(ceil(seconds * Double(fps)))
        let output = URL(fileURLWithPath: option("--output", default: "exports/Pindahkan-Aku-Plsss-Tutorial.mp4"))
        guard !FileManager.default.fileExists(atPath: output.path) else { throw ExportFailure(message: "The output already exists: \(output.path)") }
        try FileManager.default.createDirectory(at: output.deletingLastPathComponent(), withIntermediateDirectories: true)
        let silent = URL(fileURLWithPath: NSTemporaryDirectory()).appendingPathComponent("pindahkan-render-\(UUID().uuidString).mp4")
        let writer = try AVAssetWriter(outputURL: silent, fileType: .mp4)
        let settings: [String: Any] = [
            AVVideoCodecKey: AVVideoCodecType.h264,
            AVVideoWidthKey: width, AVVideoHeightKey: height,
            AVVideoCompressionPropertiesKey: [
                AVVideoAverageBitRateKey: 3_000_000,
                AVVideoExpectedSourceFrameRateKey: fps,
                AVVideoMaxKeyFrameIntervalKey: 60,
                AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel
            ],
            AVVideoColorPropertiesKey: [
                AVVideoColorPrimariesKey: AVVideoColorPrimaries_ITU_R_709_2,
                AVVideoTransferFunctionKey: AVVideoTransferFunction_ITU_R_709_2,
                AVVideoYCbCrMatrixKey: AVVideoYCbCrMatrix_ITU_R_709_2
            ]
        ]
        let input = AVAssetWriterInput(mediaType: .video, outputSettings: settings)
        input.expectsMediaDataInRealTime = false
        let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input, sourcePixelBufferAttributes: [
            kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
            kCVPixelBufferWidthKey as String: width,
            kCVPixelBufferHeightKey as String: height,
            kCVPixelBufferCGImageCompatibilityKey as String: true,
            kCVPixelBufferCGBitmapContextCompatibilityKey as String: true
        ])
        guard writer.canAdd(input) else { throw ExportFailure(message: "H.264 export is unavailable.") }
        writer.add(input)
        guard writer.startWriting() else { throw writer.error ?? ExportFailure(message: "Could not start video encoding.") }
        writer.startSession(atSourceTime: .zero)
        log("Rendering \(count) exact timeline frames for \(String(format: "%.3f", seconds)) seconds.")
        let began = Date()
        for index in 0..<count {
            if let pageError { throw ExportFailure(message: pageError) }
            while !input.isReadyForMoreMediaData {
                if writer.status == .failed { throw writer.error ?? ExportFailure(message: "Video encoding failed.") }
                try await Task.sleep(nanoseconds: 2_000_000)
            }
            let position = (sourceStart + Double(index) / Double(fps)) * 1000
            _ = try await js("window.TUTORIAL.seek(\(position))")
            let image = try await snapshot()
            if index == 0 {
                let picture = image.cgImage(forProposedRect: nil, context: nil, hints: nil)!
                log("Native snapshot: \(picture.width) x \(picture.height) pixels.")
            }
            try append(image, to: adaptor, at: CMTime(value: Int64(index), timescale: fps))
            if index % 150 == 0 || index + 1 == count {
                let elapsed = Date().timeIntervalSince(began)
                log(String(format: "RENDER %.1f%% · frame %d/%d · %.1f seconds elapsed", Double(index + 1) / Double(count) * 100, index + 1, count, elapsed))
            }
        }
        writer.endSession(atSourceTime: duration)
        input.markAsFinished()
        await withCheckedContinuation { continuation in writer.finishWriting { continuation.resume() } }
        guard writer.status == .completed else { throw writer.error ?? ExportFailure(message: "Video encoding did not finish.") }
        log("Video frames complete. Attaching the original synchronized voiceover.")
        let composition = AVMutableComposition()
        let videoAsset = AVURLAsset(url: silent)
        let voiceURL = URL(fileURLWithPath: option("--audio", default: "tutorial-demo/assets/tutorial-narration.m4a"))
        let voiceAsset = AVURLAsset(url: voiceURL)
        guard let videoSource = try await videoAsset.loadTracks(withMediaType: .video).first,
              let voiceSource = try await voiceAsset.loadTracks(withMediaType: .audio).first,
              let videoTrack = composition.addMutableTrack(withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid),
              let audioTrack = composition.addMutableTrack(withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid) else {
            throw ExportFailure(message: "Missing video or voiceover track.")
        }
        try videoTrack.insertTimeRange(CMTimeRange(start: .zero, duration: duration), of: videoSource, at: .zero)
        try audioTrack.insertTimeRange(CMTimeRange(start: CMTime(seconds: sourceStart, preferredTimescale: 48000), duration: duration), of: voiceSource, at: .zero)
        guard let mux = AVAssetExportSession(asset: composition, presetName: AVAssetExportPresetPassthrough) else {
            throw ExportFailure(message: "Could not attach the voiceover.")
        }
        mux.outputURL = output
        mux.outputFileType = .mp4
        mux.shouldOptimizeForNetworkUse = true
        mux.timeRange = CMTimeRange(start: .zero, duration: duration)
        await withCheckedContinuation { continuation in mux.exportAsynchronously { continuation.resume() } }
        guard mux.status == .completed else { throw mux.error ?? ExportFailure(message: "MP4 export failed.") }
        let finished = AVURLAsset(url: output)
        let actual = try await finished.load(.duration).seconds
        let videoTracks = try await finished.loadTracks(withMediaType: .video)
        let audioTracks = try await finished.loadTracks(withMediaType: .audio)
        guard abs(actual - seconds) < 0.05 && videoTracks.count == 1 && audioTracks.count == 1 else {
            throw ExportFailure(message: "The exported tracks or duration are incorrect.")
        }
        let bytes = (try FileManager.default.attributesOfItem(atPath: output.path)[.size] as? NSNumber)?.int64Value ?? 0
        log(String(format: "DONE: %@ · %.3f seconds · %.1f MB · video + voiceover", output.path, actual, Double(bytes) / 1_000_000))
        try FileManager.default.removeItem(at: silent)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        guard !started else { return }
        started = true
        Task { @MainActor in
            do {
                try await export()
                NSApplication.shared.terminate(nil)
            } catch {
                log("EXPORT FAILED: \(error.localizedDescription)")
                exit(1)
            }
        }
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        log("EXPORT FAILED: \(error.localizedDescription)")
        exit(1)
    }
}

let application = NSApplication.shared
application.setActivationPolicy(.accessory)
let exporter = MainActor.assumeIsolated { TutorialExporter() }
MainActor.assumeIsolated { exporter.run() }
application.run()
