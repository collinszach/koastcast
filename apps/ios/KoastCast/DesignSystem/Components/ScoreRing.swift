import SwiftUI

/// Animated Peak Score™ ring (0-100) with center value + label.
struct ScoreRing: View {
    let score: Double
    var label: String = ""
    var emoji: String = ""
    var size: CGFloat = 132
    var isPersonalized: Bool = false

    @State private var animatedProgress: Double = 0
    @State private var shown: Int = 0

    private var color: Color { Theme.qualityColor(score) }

    var body: some View {
        VStack(spacing: 10) {
            ZStack {
                Circle()
                    .stroke(Theme.hairline, lineWidth: 11)
                Circle()
                    .trim(from: 0, to: animatedProgress)
                    .stroke(color, style: StrokeStyle(lineWidth: 11, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                VStack(spacing: 0) {
                    Text("\(shown)")
                        .font(Theme.display(40))
                        .foregroundStyle(Theme.textPrimary)
                        .contentTransition(.numericText())
                        .monospacedDigit()
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
            animateCount(to: Int(score.rounded()))
        }
        .onChange(of: score) { _, newValue in
            withAnimation(.easeOut(duration: 0.6)) {
                animatedProgress = min(1, max(0, newValue / 100))
            }
            animateCount(to: Int(newValue.rounded()))
        }
    }

    /// Roll the displayed number up to the target over ~0.8s.
    private func animateCount(to target: Int) {
        let steps = 22
        let start = shown
        for i in 0...steps {
            DispatchQueue.main.asyncAfter(deadline: .now() + Double(i) / Double(steps) * 0.8) {
                withAnimation(.easeOut(duration: 0.12)) {
                    shown = start + Int(Double(target - start) * Double(i) / Double(steps))
                }
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
