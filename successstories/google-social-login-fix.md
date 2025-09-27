# Resolving Google Social Login Issues in a Laravel/React Application

This document summarizes the multi-step debugging process undertaken to fix a non-functioning Google Social Login feature. The process involved fixing errors at multiple layers of the application stack, from backend routing and database schema to cloud configuration.

### Problem 1: "Session store not set" Error

*   **Symptom:** The initial attempt to authenticate via Google resulted in a server error because the social login routes were incorrectly placed in Laravel's stateless `routes/api.php` file.
*   **Solution:** The authentication routes (`{provider}/redirect` and `{provider}/callback`) were moved from `routes/api.php` to `routes/web.php` to ensure they had access to the necessary session state provided by the `web` middleware group.

### Problem 2: Silent Login Failure & Database Constraint Violation

*   **Symptom:** After fixing the routing, the login process would redirect to Google and back, but then fail, redirecting to the frontend with a generic `?error=social_login_failed` message.
*   **Debugging:** The `catch` block in `SocialAuthController.php` was modified to log the specific exception message.
*   **Root Cause:** The log revealed a `SQLSTATE[23000]: Integrity constraint violation: 19 NOT NULL constraint failed: users.password`. The application was trying to create a new user via social login without a password, but the `users` table schema required the `password` field to be non-null.

### Problem 3: Database Schema Update

*   **Symptom:** The database rejected new user creation from social logins.
*   **Solution:** A new database migration was created and executed to modify the `users` table, making the `password` column `nullable`. This allows users to be created without a password, which is the correct behavior for social-only accounts.

### Problem 4: Google `Error 400: redirect_uri_mismatch`

*   **Symptom:** After the database issue was fixed, Google itself started blocking the authentication request with a `redirect_uri_mismatch` error.
*   **Root Cause:** The `redirect_uri` being sent by the Laravel application did not exactly match the "Authorized redirect URIs" configured in the Google Cloud Console for the OAuth 2.0 Client ID.
*   **Solution:** The user was instructed to ensure the URL in the `GOOGLE_REDIRECT_URL` variable in the `.env` file was identical to the one in the Google Cloud Console. Running `php artisan config:clear` was also recommended to ensure the application loaded the latest configuration.

### Key Takeaways

- Social authentication in Laravel must use routes within the `web` middleware group to leverage session state.
- Generic `catch` blocks can hide critical errors; adding logging is essential for effective debugging.
- Applications supporting social logins must have a `nullable` password column in their `users` table.
- Google's `redirect_uri_mismatch` error is almost always caused by a subtle string difference between the application's configuration and the Google Cloud Console settings.
