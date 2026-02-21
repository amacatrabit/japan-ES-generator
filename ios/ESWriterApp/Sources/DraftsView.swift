import SwiftUI

struct DraftsView: View {
    var body: some View {
        NavigationStack {
            List {
                Section {
                    CardRow {
                        VStack(alignment: .leading, spacing: 8) {
                            AppTypography.sectionTitle("No drafts yet")
                            AppTypography.body("Generated claims with evidence will appear here for strict export.")
                            StatusBadge(type: .exportable)
                        }
                    }
                    .listRowInsets(EdgeInsets(top: 8, leading: 16, bottom: 8, trailing: 16))
                    .listRowBackground(Color.clear)
                }
            }
            .listStyle(.insetGrouped)
            .navigationTitle("Drafts")
            .navigationBarTitleDisplayMode(.large)
        }
    }
}
