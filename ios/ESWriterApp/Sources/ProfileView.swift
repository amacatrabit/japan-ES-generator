import SwiftUI

struct ProfileView: View {
    var body: some View {
        NavigationStack {
            List {
                Section {
                    CardRow {
                        VStack(alignment: .leading, spacing: 8) {
                            AppTypography.sectionTitle("Profile is empty")
                            AppTypography.body("Set your background and episode summaries for reusable claims.")
                            StatusBadge(type: .strict)
                        }
                    }
                    .listRowInsets(EdgeInsets(top: 8, leading: 16, bottom: 8, trailing: 16))
                    .listRowBackground(Color.clear)
                }
            }
            .listStyle(.insetGrouped)
            .navigationTitle("Profile")
            .navigationBarTitleDisplayMode(.large)
        }
    }
}
