import SwiftUI

struct RootTabView: View {
    var body: some View {
        TabView {
            SourcesView()
                .tabItem {
                    Label("Sources", systemImage: "doc.text.magnifyingglass")
                }

            ProfileView()
                .tabItem {
                    Label("Profile", systemImage: "person.crop.circle")
                }

            CompanyView()
                .tabItem {
                    Label("Company", systemImage: "building.2")
                }

            DraftsView()
                .tabItem {
                    Label("Drafts", systemImage: "square.and.pencil")
                }
        }
        .tint(.accentColor)
    }
}
