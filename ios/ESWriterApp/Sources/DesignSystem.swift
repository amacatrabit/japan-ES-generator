import SwiftUI

enum AppTypography {
    static func sectionTitle(_ text: String) -> some View {
        Text(text)
            .font(.title3.weight(.semibold))
            .foregroundStyle(.primary)
    }

    static func body(_ text: String) -> some View {
        Text(text)
            .font(.body)
            .foregroundStyle(.secondary)
    }
}

struct CardRow<Content: View>: View {
    let content: Content

    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    var body: some View {
        content
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(Color(uiColor: .secondarySystemGroupedBackground))
            )
    }
}

enum StatusBadgeType {
    case exportable
    case needsEvidence
    case strict

    var icon: String {
        switch self {
        case .exportable: return "checkmark.circle.fill"
        case .needsEvidence: return "exclamationmark.triangle.fill"
        case .strict: return "lock.fill"
        }
    }

    var title: String {
        switch self {
        case .exportable: return "✅ Exportable"
        case .needsEvidence: return "⚠️ Needs Evidence"
        case .strict: return "🔒 Strict"
        }
    }

    var tint: Color {
        switch self {
        case .exportable: return .green
        case .needsEvidence: return .orange
        case .strict: return .gray
        }
    }
}

struct StatusBadge: View {
    let type: StatusBadgeType

    var body: some View {
        Label(type.title, systemImage: type.icon)
            .font(.caption.weight(.semibold))
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(type.tint.opacity(0.15), in: Capsule())
            .foregroundStyle(type.tint)
    }
}
