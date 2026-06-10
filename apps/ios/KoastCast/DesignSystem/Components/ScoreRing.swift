import SwiftUI

/// Animated Peak Score™ ring (0-100) with center value + label.
struct ScoreRing: View {
    let score: Double
    var label: String = ""
    var emoji: String = ""
    var size: CGFloat = 132
    var isPersonalized: Bool = false

    @State private var animatedProgress: Double = 0

    private var color: Color { Theme.qualityColor(score) }

    var body: some View {
        VStack(spacing: 10) {
            ZStack {
                Circle()
                    .stroke(Color.white.opacity(0.06), lineWidth: 11)
                Circle()
                    .trim(from: 0, to: animatedProgress)
                    .stroke(color, style: StrokeStyle(lineWidth: 11, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                    .shadow(color: color.opacity(0.5), radius: 8)
                VStack(spacing: 0) {
                    Text("\(Int(score.rounded()))")
                        .font(Theme.display(40))
                        .foregroundStyle(.white)
                    if !emoji.isEmpty {
                        Text(emoji).font(.system(size: 16))
                    }
                }
            }
            .frame(width: size, height: size)

            if !label.isEmpty {
                VStack(spacing: 2) {
                    Text(label)
                        .font(Theme.display(14, weight: .black))
                        .tracking(1.5)
                        .foregroundStyle(color)
                    Text(isPersonalized ? "Your Peak Score" : "Conditions")
                        .font(Theme.body(11))
                        .foregroundStyle(Theme.textTertiary)
                }
            }
        }
        .onAppear {
            withAnimation(.easeOut(duration: 0.9)) {
                animatedProgress = min(1, max(0, score / 100))
            }
        }
        .onChange(of: score) { _, newValue in
            withAnimation(.easeOut(duration: 0.6)) {
                animatedProgress = min(1, max(0, newValue / 100))
            }
        }
    }
}

#Preview {
    ZStack {
        Theme.bg.ignoresSafeArea()
        ScoreRing(score: 82, label: "FIRING", emoji: "🔥", isPersonalized: true)
    }
}
