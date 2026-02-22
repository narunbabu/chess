import SwiftUI
import AuthenticationServices

struct LoginView: View {
    @EnvironmentObject var appState: AppState
    @StateObject private var viewModel = AuthViewModel()
    @State private var email = ""
    @State private var password = ""
    @State private var showPassword = false

    var body: some View {
        VStack(spacing: 24) {
            Spacer()

            // Logo
            Text("Chess99")
                .font(.system(size: 40, weight: .bold))
                .foregroundColor(.green)

            Text("Welcome back")
                .font(.subheadline)
                .foregroundColor(.secondary)

            Spacer().frame(height: 20)

            // Email field
            TextField("Email", text: $email)
                .textFieldStyle(.roundedBorder)
                .keyboardType(.emailAddress)
                .autocapitalization(.none)
                .autocorrectionDisabled()

            // Password field
            HStack {
                if showPassword {
                    TextField("Password", text: $password)
                } else {
                    SecureField("Password", text: $password)
                }
                Button(action: { showPassword.toggle() }) {
                    Image(systemName: showPassword ? "eye.slash" : "eye")
                        .foregroundColor(.secondary)
                }
            }
            .textFieldStyle(.roundedBorder)

            // Error message
            if let error = viewModel.error {
                Text(error)
                    .font(.caption)
                    .foregroundColor(.red)
                    .multilineTextAlignment(.center)
            }

            // Login button
            Button(action: performLogin) {
                if viewModel.isLoading {
                    ProgressView()
                        .frame(maxWidth: .infinity)
                        .frame(height: 44)
                } else {
                    Text("Sign In")
                        .frame(maxWidth: .infinity)
                        .frame(height: 44)
                }
            }
            .buttonStyle(.borderedProminent)
            .tint(.green)
            .disabled(viewModel.isLoading || email.isEmpty || password.isEmpty)

            // Sign in with Apple
            SignInWithAppleButton(.signIn) { request in
                request.requestedScopes = [.fullName, .email]
            } onCompletion: { result in
                handleAppleSignIn(result)
            }
            .signInWithAppleButtonStyle(.black)
            .frame(height: 44)
            .cornerRadius(8)

            Spacer()

            // Register link
            NavigationLink(destination: RegisterView()) {
                Text("Don't have an account? **Sign Up**")
                    .font(.subheadline)
            }
        }
        .padding(.horizontal, 24)
    }

    private func performLogin() {
        Task {
            if let result = await viewModel.login(email: email, password: password) {
                appState.currentUser = result.user
                appState.isAuthenticated = true
            }
        }
    }

    private func handleAppleSignIn(_ result: Result<ASAuthorization, Error>) {
        switch result {
        case .success(let authorization):
            Task {
                if let result = await viewModel.appleSignIn(authorization: authorization) {
                    appState.currentUser = result.user
                    appState.isAuthenticated = true
                }
            }
        case .failure(let error):
            viewModel.error = error.localizedDescription
        }
    }
}
