import SwiftUI
import Charts

/// 72-hour tide curve with a "now" line.
struct TideChartView: View {
    let hours: [ForecastHour]

    private var points: [ForecastHour] {
        hours.filter { $0.tideHeightM != nil }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Tide")
                .font(Theme.display(15, weight: .bold))
                .foregroundStyle(Theme.textPrimary)

            Chart {
                ForEach(points) { h in
                    AreaMark(
                        x: .value("Time", h.forecastTime),
                        y: .value("Tide (m)", h.tideHeightM ?? 0)
                    )
                    .foregroundStyle(
                        LinearGradient(colors: [Theme.accent.opacity(0.35), Theme.accent.opacity(0.02)],
                                       startPoint: .top, endPoint: .bottom)
                    )
                    .interpolationMethod(.catmullRom)
                }
                ForEach(points) { h in
                    LineMark(
                        x: .value("Time", h.forecastTime),
                        y: .value("Tide (m)", h.tideHeightM ?? 0)
                    )
                    .foregroundStyle(Theme.accent)
                    .interpolationMethod(.catmullRom)
                }
                RuleMark(x: .value("Now", Date()))
                    .foregroundStyle(Theme.textTertiary.opacity(0.6))
                    .lineStyle(StrokeStyle(lineWidth: 1, dash: [4, 4]))
            }
            .chartYAxis {
                AxisMarks(position: .leading) { _ in
                    AxisGridLine().foregroundStyle(Theme.hairline)
                    AxisValueLabel().foregroundStyle(Theme.textTertiary)
                }
            }
            .chartXAxis {
                AxisMarks(values: .stride(by: .day)) { _ in
                    AxisValueLabel(format: .dateTime.weekday(.abbreviated))
                        .foregroundStyle(Theme.textTertiary)
                }
            }
            .frame(height: 130)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .glassCard()
    }
}
