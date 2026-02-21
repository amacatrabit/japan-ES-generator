import SwiftUI

struct CompanyView: View {
    var body: some View {
        NavigationStack {
            List {
                Section {
                    CardRow {
                        VStack(alignment: .leading, spacing: 8) {
                            AppTypography.sectionTitle("No company context")
                            AppTypography.body("Capture role expectations and business context for motivation answers.")
                            StatusBadge(type: .needsEvidence)
                        }
                    }
                    .listRowInsets(EdgeInsets(top: 8, leading: 16, bottom: 8, trailing: 16))
                    .listRowBackground(Color.clear)
                }
            }
            .listStyle(.insetGrouped)
            .navigationTitle("Company")
            .navigationBarTitleDisplayMode(.large)
        }
    }
}
