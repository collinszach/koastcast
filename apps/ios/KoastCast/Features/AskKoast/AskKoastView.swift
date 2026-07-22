import SwiftUI

struct ChatMessage: Identifiable {
    let id = UUID()
    let role: Role
    let text: String
    enum Role { case user, koast }
}

struct AskKoastView: View {
    @Environment(AppState.self) private var app
    @State private var messages: [ChatMessage] = [
        ChatMessage(role: .koast, text: "Ask me anything about conditions — I read your spots, swell, wind, tide and the Trust Score behind every call.")
    ]
    @State private var input = ""
    @State private var thinking = false

    private let suggestions = [
        "Where's it offshore this weekend?",
        "Is my home break worth a dawn patrol?",
        "Which spot is most reliable right now?",
    ]

    var body: some View {
        NavigationStack {
            ZStack {
                Theme.oceanGradient.ignoresSafeArea()
                VStack(spacing: 0) {
                    ScrollViewReader { proxy in
                        ScrollView {
                            VStack(spacing: 12) {
                                ForEach(messages) { bubble($0) }
                                if thinking { typing }
                            }
                            .padding(16)
                        }
                        .onChange(of: messages.count) { _, _ in
                            withAnimation { proxy.scrollTo(messages.last?.id, anchor: .bottom) }
                        }
                    }
                    if messages.count <= 1 {
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 8) {
                                ForEach(suggestions, id: \.self) { s in
                                    Button { send(s) } label: {
                                        Text(s).font(Theme.body(12))
                                            .foregroundStyle(Theme.accent)
                                            .padding(.horizontal, 12).padding(.vertical, 8)
                                            .background(Theme.accentSoft, in: Capsule())
                                    }
                                }
                            }
                            .padding(.horizontal, 16)
                        }
                        .padding(.bottom, 8)
                    }
                    inputBar
                }
            }
            .navigationTitle("Ask Koast")
            .navigationBarTitleDisplayMode(.inline)
        }
    }

    private func bubble(_ m: ChatMessage) -> some View {
        HStack {
            if m.role == .user { Spacer(minLength: 40) }
            Text(m.text)
                .font(Theme.body(15))
                .foregroundStyle(m.role == .user ? Theme.bg : Theme.textPrimary)
                .padding(.horizontal, 14).padding(.vertical, 10)
                .background(
                    m.role == .user ? AnyShapeStyle(Theme.accent) : AnyShapeStyle(Theme.bgElevated),
                    in: RoundedRectangle(cornerRadius: 16, style: .continuous)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .stroke(m.role == .user ? Color.clear : Theme.hairline, lineWidth: 1)
                )
            if m.role == .koast { Spacer(minLength: 40) }
        }
        .id(m.id)
    }

    private var typing: some View {
        HStack {
            Text("Koast is reading the models…")
                .font(Theme.body(13)).foregroundStyle(Theme.textTertiary)
            Spacer()
        }
    }

    private var inputBar: some View {
        HStack(spacing: 10) {
            TextField("Ask about conditions…", text: $input)
                .textFieldStyle(.plain)
                .padding(.horizontal, 14).padding(.vertical, 11)
                .background(Theme.bgElevated, in: Capsule())
                .overlay(Capsule().stroke(Theme.hairline, lineWidth: 1))
                .foregroundStyle(Theme.textPrimary)
                .onSubmit { send(input) }
            Button { send(input) } label: {
                Image(systemName: "arrow.up.circle.fill")
                    .font(.title)
                    .foregroundStyle(Theme.accent)
            }
            .disabled(input.trimmingCharacters(in: .whitespaces).isEmpty)
        }
        .padding(.horizontal, 16).padding(.vertical, 10)
        .background(Theme.bg)
    }

    private func send(_ text: String) {
        let trimmed = text.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return }
        messages.append(ChatMessage(role: .user, text: trimmed))
        input = ""
        thinking = true
        Task {
            // v1: local Trust-aware heuristic answer. Wire to /nlq (SSE) + Claude next.
            try? await Task.sleep(for: .milliseconds(700))
            let answer = AskKoastResponder.answer(for: trimmed, spots: app.spots)
            thinking = false
            messages.append(ChatMessage(role: .koast, text: answer))
        }
    }
}

/// Local responder placeholder — same answer shape the Claude-backed `/nlq` will return.
enum AskKoastResponder {
    static func answer(for query: String, spots: [Spot]) -> String {
        let ranked = spots.sorted { ($0.qualityScore ?? 0) > ($1.qualityScore ?? 0) }
        guard let best = ranked.first else {
            return "I can't reach the forecast server right now — try again shortly."
        }
        let face = Units.waveHeight(best.waveHeightM, imperial: true)
        return "Right now \(best.name) is your standout at \(face), quality \(String(format: "%.1f", best.qualityScore ?? 0))/10. "
             + "Once your API key is set I'll reason across all your spots, the swell window, and each forecast's Trust Score to plan your session."
    }
}
