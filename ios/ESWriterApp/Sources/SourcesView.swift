import SwiftUI

struct SourcesView: View {
    var body: some View {
        NavigationStack {
            List {
                Section {
                    CardRow {
                        VStack(alignment: .leading, spacing: 8) {
                            AppTypography.sectionTitle("No sources selected")
                            AppTypography.body("Add documents and pin evidence chunks to begin drafting.")
                            StatusBadge(type: .needsEvidence)
                        }
                    }
                    .listRowInsets(EdgeInsets(top: 8, leading: 16, bottom: 8, trailing: 16))
                    .listRowBackground(Color.clear)
                }
            }
            .listStyle(.insetGrouped)
            .background(Color(uiColor: .systemGroupedBackground))
            .navigationTitle("Sources")
            .navigationBarTitleDisplayMode(.large)
        }
    }
}
