import SwiftUI
import MapKit

/// Geospatial home — dark map of the global catalog. With 1000+ spots we only
/// render pins inside the visible region, capped to the nearest N to the center,
/// so MapKit stays smooth.
struct ExploreView: View {
    @Environment(AppState.self) private var app
    @State private var camera: MapCameraPosition = .region(
        MKCoordinateRegion(center: CLLocationCoordinate2D(latitude: 30, longitude: -40),
                           span: MKCoordinateSpan(latitudeDelta: 120, longitudeDelta: 120))
    )
    @State private var region: MKCoordinateRegion? = MKCoordinateRegion(
        center: CLLocationCoordinate2D(latitude: 30, longitude: -40),
        span: MKCoordinateSpan(latitudeDelta: 120, longitudeDelta: 120)
    )
    @State private var selected: Spot?

    private let maxPins = 120

    private var visibleSpots: [Spot] {
        guard let region else { return [] }
        let latMin = region.center.latitude - region.span.latitudeDelta / 2
        let latMax = region.center.latitude + region.span.latitudeDelta / 2
        let lngMin = region.center.longitude - region.span.longitudeDelta / 2
        let lngMax = region.center.longitude + region.span.longitudeDelta / 2
        let inView = app.spots.filter { s in
            guard let lat = s.lat, let lng = s.lng else { return false }
            return lat >= latMin && lat <= latMax && lng >= lngMin && lng <= lngMax
        }
        // Nearest to center first, capped.
        let c = region.center
        return Array(inView.sorted {
            let d0 = pow(($0.lat ?? 0) - c.latitude, 2) + pow(($0.lng ?? 0) - c.longitude, 2)
            let d1 = pow(($1.lat ?? 0) - c.latitude, 2) + pow(($1.lng ?? 0) - c.longitude, 2)
            return d0 < d1
        }.prefix(maxPins))
    }

    var body: some View {
        NavigationStack {
            Map(position: $camera, selection: Binding(
                get: { selected?.id },
                set: { id in selected = app.spots.first { $0.id == id } }
            )) {
                ForEach(visibleSpots) { spot in
                    Annotation(spot.name, coordinate: spot.coordinate!) {
                        SpotPin(quality: (spot.qualityScore ?? -1) * 10,
                                selected: selected?.id == spot.id)
                            .onTapGesture { selected = spot }
                    }
                    .tag(spot.id)
                }
                UserAnnotation()
            }
            .mapStyle(.standard(elevation: .flat, emphasis: .muted, pointsOfInterest: .excludingAll))
            .onMapCameraChange(frequency: .onEnd) { ctx in
                region = ctx.region
            }
            .ignoresSafeArea(edges: .top)
            .overlay(alignment: .top) { banner }
            .sheet(item: $selected) { spot in
                NavigationStack { SpotDetailView(spot: spot) }
                    .presentationDetents([.medium, .large])
                    .presentationBackground(Theme.bg)
            }
        }
    }

    private var banner: some View {
        HStack(spacing: 6) {
            Image(systemName: "globe.americas.fill").font(.caption2)
            Text(region == nil ? "Explore" : "\(app.spots.count) spots · zoom in for detail")
                .font(Theme.body(12))
        }
        .foregroundStyle(Theme.textPrimary)
        .padding(.horizontal, 14).padding(.vertical, 8)
        .background(Theme.bgElevated, in: Capsule())
        .overlay(Capsule().stroke(Theme.hairline, lineWidth: 1))
        .padding(.top, 6)
    }
}

/// Flat, brand-consistent map marker — a small quality-colored dot at rest,
/// expanding into a scored balloon on selection. No glow/blur, matching the
/// rest of the app's flat tile system.
private struct SpotPin: View {
    let quality: Double  // <0 means unknown
    let selected: Bool

    private var color: Color { quality < 0 ? Theme.textTertiary : Theme.qualityColor(quality) }
    private var scoreText: String { quality < 0 ? "–" : "\(Int((quality / 10).rounded()))" }

    var body: some View {
        VStack(spacing: 0) {
            if selected {
                Text(scoreText)
                    .font(Theme.data(12, weight: .bold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 8).padding(.vertical, 5)
                    .background(color, in: Capsule())
                    .overlay(Capsule().stroke(Theme.bgElevated, lineWidth: 1.5))
                PinTail()
                    .fill(color)
                    .frame(width: 9, height: 6)
                    .offset(y: -1)
            } else {
                Circle()
                    .fill(color)
                    .frame(width: 11, height: 11)
                    .overlay(Circle().stroke(Theme.bgElevated, lineWidth: 1.5))
            }
        }
        .shadow(color: Theme.textPrimary.opacity(0.18), radius: selected ? 4 : 2, x: 0, y: 1)
        .animation(.snappy, value: selected)
    }
}

private struct PinTail: Shape {
    func path(in rect: CGRect) -> Path {
        var p = Path()
        p.move(to: CGPoint(x: rect.midX, y: rect.maxY))
        p.addLine(to: CGPoint(x: rect.minX, y: rect.minY))
        p.addLine(to: CGPoint(x: rect.maxX, y: rect.minY))
        p.closeSubpath()
        return p
    }
}
