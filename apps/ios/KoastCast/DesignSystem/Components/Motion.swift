import SwiftUI

// MARK: - Shimmer (loading skeleton)

struct Shimmer: ViewModifier {
    @State private var phase: CGFloat = -1
    func body(content: Content) -> some View {
        content.overlay(
            GeometryReader { geo in
                LinearGradient(
                    colors: [.clear, .white.opacity(0.18), .clear],
                    startPoint: .leading, endPoint: .trailing
                )
                .frame(width: geo.size.width * 0.6)
                .offset(x: phase * geo.size.width * 1.6)
            }
            .mask(content)
            .allowsHitTesting(false)
        )
        .onAppear {
            withAnimation(.easeInOut(duration: 1.1).repeatForever(autoreverses: false)) {
                phase = 1
            }
        }
    }
}

extension View {
    func shimmer() -> some View { modifier(Shimmer()) }

    /// A plain skeleton block.
    func skeleton(_ w: CGFloat? = nil, _ h: CGFloat, radius: CGFloat = 8) -> some View {
        RoundedRectangle(cornerRadius: radius, style: .continuous)
            .fill(Color.white.opacity(0.07))
            .frame(width: w, height: h)
            .shimmer()
    }
}

// MARK: - Count-up number

/// Animates a number from its previous value to the new one.
struct CountUp: View, Animatable {
    var value: Double
    var format: (Double) -> String
    var font: Font
    var color: Color

    var animatableData: Double {
        get { value }
        set { value = newValue }
    }

    var body: some View {
        Text(format(value))
            .font(font)
            .foregroundStyle(color)
            .contentTransition(.numericText())
            .monospacedDigit()
    }
}

// MARK: - Press feedback

struct PressableStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .animation(.spring(response: 0.3, dampingFraction: 0.7), value: configuration.isPressed)
    }
}

extension View {
    func pressable() -> some View { buttonStyle(PressableStyle()) }
}

// MARK: - Haptics

enum Haptics {
    static func tap() {
        #if canImport(UIKit)
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
        #endif
    }
    static func success() {
        #if canImport(UIKit)
        UINotificationFeedbackGenerator().notificationOccurred(.success)
        #endif
    }
}
