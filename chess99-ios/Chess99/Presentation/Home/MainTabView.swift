import SwiftUI

struct MainTabView: View {
    @EnvironmentObject var appState: AppState
    @State private var selectedTab = 0

    var body: some View {
        TabView(selection: $selectedTab) {
            NavigationStack {
                PlayTabView()
                    .toolbar {
                        ToolbarItem(placement: .navigationBarTrailing) {
                            Button(action: {
                                Task {
                                    appState.logout()
                                }
                            }) {
                                Image(systemName: "rectangle.portrait.and.arrow.right")
                            }
                        }
                    }
                    .navigationTitle("Chess99")
            }
            .tabItem {
                Label("Play", systemImage: "gamecontroller.fill")
            }
            .tag(0)

            NavigationStack {
                PlaceholderView(title: "Game Lobby", subtitle: "Find opponents online")
                    .navigationTitle("Lobby")
            }
            .tabItem {
                Label("Lobby", systemImage: "person.2.fill")
            }
            .tag(1)

            NavigationStack {
                PlaceholderView(title: "Learn Chess", subtitle: "Tutorials and puzzles")
                    .navigationTitle("Learn")
            }
            .tabItem {
                Label("Learn", systemImage: "graduationcap.fill")
            }
            .tag(2)

            NavigationStack {
                PlaceholderView(title: "Profile", subtitle: "Your stats and ratings")
                    .navigationTitle("Profile")
            }
            .tabItem {
                Label("Profile", systemImage: "person.circle.fill")
            }
            .tag(3)
        }
        .tint(.green)
    }
}

struct PlayTabView: View {
    @State private var showPlayComputer = false

    var body: some View {
        VStack(spacing: 24) {
            Spacer()

            Text("Ready to Play?")
                .font(.title)
                .fontWeight(.bold)

            // Play vs Computer
            NavigationLink(destination: PlayComputerView()) {
                HStack(spacing: 16) {
                    Image(systemName: "desktopcomputer")
                        .font(.system(size: 36))
                        .foregroundColor(.green)
                        .frame(width: 56)

                    VStack(alignment: .leading, spacing: 4) {
                        Text("Play vs Computer")
                            .font(.headline)
                        Text("Challenge Stockfish AI (Levels 1-16)")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                    }

                    Spacer()

                    Image(systemName: "chevron.right")
                        .foregroundColor(.secondary)
                }
                .padding()
                .background(Color(.systemBackground))
                .cornerRadius(12)
                .shadow(color: .black.opacity(0.1), radius: 4, y: 2)
            }
            .buttonStyle(.plain)
            .foregroundColor(.primary)

            // Play Online
            Button(action: { /* Phase 3: Navigate to Lobby */ }) {
                HStack(spacing: 16) {
                    Image(systemName: "wifi")
                        .font(.system(size: 36))
                        .foregroundColor(.orange)
                        .frame(width: 56)

                    VStack(alignment: .leading, spacing: 4) {
                        Text("Play Online")
                            .font(.headline)
                        Text("Challenge other players in real-time")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                    }

                    Spacer()

                    Image(systemName: "chevron.right")
                        .foregroundColor(.secondary)
                }
                .padding()
                .background(Color(.systemBackground))
                .cornerRadius(12)
                .shadow(color: .black.opacity(0.1), radius: 4, y: 2)
            }
            .buttonStyle(.plain)

            Spacer()
        }
        .padding(.horizontal, 24)
    }
}

struct PlaceholderView: View {
    let title: String
    let subtitle: String

    var body: some View {
        VStack(spacing: 8) {
            Text(title)
                .font(.title2)
                .fontWeight(.semibold)
            Text(subtitle)
                .foregroundColor(.secondary)
            Text("Coming Soon")
                .font(.caption)
                .foregroundColor(.secondary)
                .padding(.top, 8)
        }
    }
}
