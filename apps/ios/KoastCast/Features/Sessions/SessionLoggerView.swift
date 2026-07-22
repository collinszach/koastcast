import SwiftUI

struct SessionLoggerView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AppState.self) private var app
    var onSave: (LoggedSession) -> Void

    @State private var spotName = ""
    @State private var date = Date()
    @State private var waveHeight: Double = 3
    @State private var quality = 6
    @State private var crowd = 3
    @State private var board = ""
    @State private var notes = ""

    var body: some View {
        NavigationStack {
            Form {
                Section("Spot") {
                    Picker("Spot", selection: $spotName) {
                        Text("Select…").tag("")
                        ForEach(app.spots) { Text($0.name).tag($0.name) }
                    }
                    DatePicker("Date", selection: $date, displayedComponents: [.date, .hourAndMinute])
                }
                Section("Conditions") {
                    Stepper("Wave height: \(Int(waveHeight)) ft", value: $waveHeight, in: 1...30)
                    Stepper("Quality: \(quality)/10", value: $quality, in: 1...10)
                    Stepper("Crowd: \(crowd)/5", value: $crowd, in: 1...5)
                }
                Section("Gear & notes") {
                    TextField("Board used", text: $board)
                    TextField("Notes", text: $notes, axis: .vertical).lineLimit(3...6)
                }
            }
            .scrollContentBackground(.hidden)
            .background(Theme.bg)
            .navigationTitle("Log session")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        onSave(LoggedSession(
                            spotName: spotName.isEmpty ? "Unknown" : spotName,
                            date: date, waveHeightFt: waveHeight,
                            qualityRating: quality, crowdRating: crowd,
                            boardUsed: board.isEmpty ? nil : board,
                            notes: notes.isEmpty ? nil : notes
                        ))
                        dismiss()
                    }
                }
            }
        }
        .preferredColorScheme(.light)
    }
}
