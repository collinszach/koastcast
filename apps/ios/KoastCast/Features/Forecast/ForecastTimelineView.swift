import SwiftUI
import Charts

/// 7-day quality + wave-height timeline. The bar fill encodes quality color;
/// a faint Trust band underneath shows confidence fading with lead time —
/// the signature "uncertainty made visible" treatment, in chart form.
struct ForecastTimelineView: View {
    let hours: [ForecastHour]

    private var sampled: [ForecastHour] {
        // Every 3h to keep the chart readable.
        stride(from: 0, to: hours.count, by: 3).map { hours[$0] }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("7-day forecast")
                .font(Theme.display(15, weight: .bold))
                .foregroundStyle(.white)

            Chart {
                ForEach(sampled) { h in
                    BarMark(
                        x: .value("Time", h.forecastTime),
                        y: .value("Face (ft)", (h.waveHeightFaceM ?? h.waveHeightM ?? 0) * 3.28084)
                    )
                    .foregroundStyle(Theme.qualityColor((h.qualityScore ?? 0) * 10))
                    .cornerRadius(2)
                }
                ForEach(sampled) { h in
                    LineMark(
                        x: .value("Time", h.forecastTime),
                        y: .value("Trust", (h.trustScore ?? 0) / 100 * trustAxisScale)
                    )
                    .foregroundStyle(Theme.accent.opacity(0.55))
                    .interpolationMethod(.catmullRom)
                }
            }
            .chartYAxis {
                AxisMarks(position: .leading) { _ in
                    AxisGridLine().foregroundStyle(Theme.hairline)
                    AxisValueLabel().foregroundStyle(Theme.textTertiary)
                }
            }
            .chartXAxis {
                AxisMarks(values: .stride(by: .day)) { _ in
                    AxisGridLine().foregroundStyle(Theme.hairline)
                    AxisValueLabel(format: .dateTime.weekday(.abbreviated))
                        .foregroundStyle(Theme.textTertiary)
                }
            }
            .frame(height: 180)

            HStack(spacing: 14) {
                legendDot(Theme.qualityColor(85), "Wave height")
                legendDot(Theme.accent.opacity(0.6), "Trust")
                Spacer()
            }
            .font(Theme.body(10))
            .foregroundStyle(Theme.textTertiary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .glassCard()
    }

    private var trustAxisScale: Double {
        let maxFace = sampled.map { ($0.waveHeightFaceM ?? $0.waveHeightM ?? 0) * 3.28084 }.max() ?? 6
        return max(maxFace, 2)
    }

    private func legendDot(_ color: Color, _ label: String) -> some View {
        HStack(spacing: 5) {
            Circle().fill(color).frame(width: 8, height: 8)
            Text(label)
        }
    }
}
