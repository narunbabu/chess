import SwiftUI

struct RegisterView: View {
    @EnvironmentObject var appState: AppState
    @StateObject private var viewModel = AuthViewModel()
    @State private var name = ""
    @State private var email = ""
    @State private var password = ""
    @State private var confirmPassword = ""
    @State private var showPassword = false

    private var isFormValid: Bool {
        !name.isEmpty && !email.isEmpty && password.count >= 8 && password == confirmPassword
    }

    var body: some View {
        VStack(spacing: 20) {
            Spacer()

            Text("Chess99")
                .font(.system(size: 36, weight: .bold))
                .foregroundColor(.green)

            Text("Create your account")
                .font(.subheadline)
                .foregroundColor(.secondary)

            Spacer().frame(height: 12)

            TextField("Name", text: $name)
                .textFieldStyle(.roundedBorder)

            TextField("Email", text: $email)
                .textFieldStyle(.roundedBorder)
                .keyboardType(.emailAddress)
                .autocapitalization(.none)
                .autocorrectionDisabled()

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

            SecureField("Confirm Password", text: $confirmPassword)
                .textFieldStyle(.roundedBorder)

            if password != confirmPassword && !confirmPassword.isEmpty {
                Text("Passwords do not match")
                    .font(.caption)
                    .foregroundColor(.red)
            }

            if let error = viewModel.error {
                Text(error)
                    .font(.caption)
                    .foregroundColor(.red)
                    .multilineTextAlignment(.center)
            }

            Button(action: performRegister) {
                if viewModel.isLoading {
                    ProgressView()
                        .frame(maxWidth: .infinity)
                        .frame(height: 44)
                } else {
                    Text("Create Account")
                        .frame(maxWidth: .infinity)
                        .frame(height: 44)
                }
            }
            .buttonStyle(.borderedProminent)
            .tint(.green)
            .disabled(viewModel.isLoading || !isFormValid)

            Spacer()
        }
        .padding(.horizontal, 24)
        .navigationTitle("Sign Up")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func performRegister() {
        Task {
            if let result = await viewModel.register(
                name: name,
                email: email,
                password: password,
                passwordConfirmation: confirmPassword
            ) {
                appState.currentUser = result.user
                appState.isAuthenticated = true
            }
        }
    }
}
