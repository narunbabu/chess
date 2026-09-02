import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.hilt.android)
    alias(libs.plugins.ksp)
    alias(libs.plugins.google.services)
    alias(libs.plugins.firebase.crashlytics)
}

// Release signing — reads the upload keystore path + passwords from a gitignored
// keystore.properties (never committed). When absent (e.g. CI without secrets),
// the release build is left unsigned rather than failing the configuration.
val keystorePropsFile = rootProject.file("keystore.properties")
val keystoreProps = Properties().apply {
    if (keystorePropsFile.exists()) keystorePropsFile.inputStream().use { load(it) }
}

val googleServerClientId = providers.gradleProperty("GOOGLE_SERVER_CLIENT_ID")
    .orElse(providers.environmentVariable("GOOGLE_SERVER_CLIENT_ID"))
    .getOrElse("")
val releaseWsKey = providers.gradleProperty("WS_KEY_RELEASE")
    .orElse(providers.environmentVariable("WS_KEY_RELEASE"))
    .getOrElse("")
// `-PDEBUG_TARGET=prod` points the debug build at the live backend so the APK
// can be side-loaded onto a physical phone for testing. See buildTypes.debug.
val debugTargetsProduction =
    providers.gradleProperty("DEBUG_TARGET").orNull.equals("prod", ignoreCase = true)

val firebaseConfigFile = file("google-services.json")
val firebaseConfigText = firebaseConfigFile.takeIf { it.exists() }?.readText().orEmpty()
val hasProductionFirebaseConfig = firebaseConfigFile.exists() &&
    !firebaseConfigText.contains("chess99-placeholder") &&
    !firebaseConfigText.contains("placeholder-api-key-for-compilation") &&
    !Regex(""""project_number"\s*:\s*"0+"""").containsMatchIn(firebaseConfigText)
val hasValidGoogleServerClientId =
    googleServerClientId.endsWith(".apps.googleusercontent.com") &&
        googleServerClientId.length > ".apps.googleusercontent.com".length

fun String.asBuildConfigString(): String =
    "\"${replace("\\", "\\\\").replace("\"", "\\\"")}\""

android {
    namespace = "com.chess99"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.chess99.app"
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "1.0.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"

        // S2: Stockfish 11 is packaged as a fake libstockfish.so per ABI under
        // jniLibs/ (see StockfishBridge.kt) — restrict packaging to the ABIs we
        // actually ship binaries for.
        ndk {
            abiFilters += listOf("arm64-v8a", "armeabi-v7a", "x86_64")
        }

        // API configuration (overridden per build type).
        // Production API + Reverb WebSockets are served from api.chess99.com —
        // chess99.com itself only serves the SPA (its /api/* returns index.html).
        buildConfigField("String", "API_BASE_URL", "\"https://api.chess99.com/api/v1/\"")
        buildConfigField("String", "WS_HOST", "\"api.chess99.com\"")
        buildConfigField("int", "WS_PORT", "443")
        buildConfigField("String", "WS_KEY", "\"\"")
        buildConfigField("boolean", "WS_USE_TLS", "true")
        buildConfigField(
            "String",
            "GOOGLE_SERVER_CLIENT_ID",
            googleServerClientId.asBuildConfigString(),
        )
        // Google Sign-In runs through Credential Manager, which takes the web
        // OAuth client ID as an explicit parameter (see GoogleSignInHelper) and
        // never reads google-services.json. The rest of what it needs lives in the
        // Google Cloud console, not in this repo: an *Android* OAuth client in the
        // same project as the web client, carrying this app's package
        // (com.chess99.app) and the signing certificate's SHA-1 — one client per
        // fingerprint, since a GCP Android client holds exactly one pair (debug,
        // upload, and later Play App Signing each need their own).
        //
        // So this flag deliberately does NOT depend on hasProductionFirebaseConfig.
        // Firebase gates FCM / Crashlytics / Analytics (see verifyReleaseConfiguration),
        // which are separate features; coupling the two only hid the sign-in button
        // on builds that were perfectly capable of signing in.
        buildConfigField(
            "boolean",
            "GOOGLE_SIGN_IN_ENABLED",
            hasValidGoogleServerClientId.toString(),
        )
    }

    signingConfigs {
        create("release") {
            if (keystorePropsFile.exists()) {
                storeFile = file(keystoreProps.getProperty("storeFile"))
                storePassword = keystoreProps.getProperty("storePassword")
                keyAlias = keystoreProps.getProperty("keyAlias")
                keyPassword = keystoreProps.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        debug {
            isMinifyEnabled = false
            // Debug normally targets a Laravel server on the dev machine, reached
            // through the emulator's 10.0.2.2 loopback. That address is unreachable
            // from a physical phone, so a debug APK handed to a tester can't log in
            // or play online. Build with `-PDEBUG_TARGET=prod` to produce a
            // device-testable APK that talks to the live backend instead.
            //
            // The Reverb app key is a public client-side identifier (it ships in the
            // web JS bundle — see chess-frontend/.env.production) and is the same in
            // both environments, so no secret is introduced here. The release build's
            // key still comes from WS_KEY_RELEASE and is untouched.
            if (debugTargetsProduction) {
                buildConfigField("String", "API_BASE_URL", "\"https://api.chess99.com/api/v1/\"")
                buildConfigField("String", "WS_HOST", "\"api.chess99.com\"")
                buildConfigField("int", "WS_PORT", "443")
                buildConfigField("String", "WS_KEY", "\"anrdh24nppf3obfupvqw\"")
                buildConfigField("boolean", "WS_USE_TLS", "true")
            } else {
                buildConfigField("String", "API_BASE_URL", "\"http://10.0.2.2:8000/api/v1/\"")
                buildConfigField("String", "WS_HOST", "\"10.0.2.2\"")
                buildConfigField("int", "WS_PORT", "8080")
                buildConfigField("String", "WS_KEY", "\"anrdh24nppf3obfupvqw\"")
                buildConfigField("boolean", "WS_USE_TLS", "false")
            }
        }
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            // Sign with the upload key when keystore.properties is present.
            signingConfig = if (keystorePropsFile.exists()) {
                signingConfigs.getByName("release")
            } else {
                signingConfig
            }
            // SECURITY (L5): the production Reverb key must NOT be hardcoded. It is
            // injected at build time from a gradle property (-PWS_KEY_RELEASE=…,
            // or in ~/.gradle/gradle.properties / local.properties) or the
            // WS_KEY_RELEASE env var. Without it the release WS_KEY stays empty
            // and prod WebSockets will (visibly) fail rather than ship a secret.
            buildConfigField("String", "WS_KEY", releaseWsKey.asBuildConfigString())
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    // S2: force legacy jniLibs packaging so libstockfish.so is extracted to
    // applicationInfo.nativeLibraryDir at install time (a real exec-able file
    // path) instead of being mapped page-aligned straight out of the APK —
    // StockfishBridge execs it directly, so it must exist as a real file.
    packaging {
        jniLibs {
            useLegacyPackaging = true
        }
    }

    // The two "a newer version is available" checks accounted for 66 of lint's 72
    // warnings, which buried the 6 findings that are actually about this app's
    // code. They are demoted to informational (still reported, still visible with
    // `lint --info` and in the HTML report) so a genuinely new warning stands out.
    //
    // This is a deliberate deferral, not a dismissal — the rationale, the full
    // current-vs-available table, and the ordered upgrade sequence are in
    //   docs/updates/2026_08_21_android_dependency_upgrade_decision.md
    // Lift this block when the deferred bucket is taken (trigger: the first
    // release build shipping to the Play internal track).
    //
    // Nothing else about lint changes here: abortOnError keeps its default (true)
    // and every other check keeps its own severity.
    lint {
        informational += setOf("GradleDependency", "AndroidGradlePluginVersion")
    }
}

val verifyReleaseConfiguration by tasks.registering {
    group = "verification"
    description = "Fails release builds that still contain placeholder production configuration."

    doLast {
        val issues = mutableListOf<String>()
        if (!firebaseConfigFile.exists()) {
            issues += "Missing app/google-services.json. Download the Android config from the production Firebase project."
        } else {
            if (!hasProductionFirebaseConfig) {
                issues += "app/google-services.json is still the placeholder config. FCM, Crashlytics, and Analytics would be inert."
            }
            if (!Regex(""""package_name"\s*:\s*"com\.chess99\.app"""").containsMatchIn(firebaseConfigText)) {
                issues += "app/google-services.json does not contain the production package com.chess99.app."
            }
            // NOTE: this task used to also require google-services.json to carry a
            // non-empty "oauth_client" array and to contain GOOGLE_SERVER_CLIENT_ID,
            // on the assumption that Google Sign-In was registered through Firebase.
            // It is not — see the GOOGLE_SIGN_IN_ENABLED comment above. Those two
            // checks failed builds that could sign in fine, so they are gone; the
            // Firebase checks that remain are strictly about FCM/Crashlytics/Analytics.
        }
        if (!hasValidGoogleServerClientId) {
            issues += "GOOGLE_SERVER_CLIENT_ID is missing or invalid. Set it as a Gradle property or environment variable."
        }
        if (releaseWsKey.isBlank()) {
            issues += "WS_KEY_RELEASE is missing. Set it as a Gradle property or environment variable."
        }
        check(issues.isEmpty()) {
            "Release configuration is incomplete:\n- ${issues.joinToString("\n- ")}"
        }
    }
}

afterEvaluate {
    tasks.named("preReleaseBuild").configure {
        dependsOn(verifyReleaseConfiguration)
    }
}

dependencies {
    // AndroidX Core
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.androidx.activity.compose)

    // Compose
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.ui)
    implementation(libs.androidx.ui.graphics)
    implementation(libs.androidx.ui.tooling.preview)
    implementation(libs.androidx.material3)
    implementation(libs.androidx.material.icons.extended)
    implementation(libs.androidx.navigation.compose)

    // Hilt DI
    implementation(libs.hilt.android)
    ksp(libs.hilt.compiler)
    implementation(libs.hilt.navigation.compose)

    // Network
    implementation(libs.retrofit)
    implementation(libs.retrofit.converter.gson)
    implementation(libs.okhttp)
    implementation(libs.okhttp.logging)

    // Local Database
    implementation(libs.room.runtime)
    implementation(libs.room.ktx)
    ksp(libs.room.compiler)

    // Image Loading
    implementation(libs.coil.compose)

    // DataStore & Security
    implementation(libs.datastore.preferences)
    implementation(libs.security.crypto)

    // Firebase
    implementation(platform(libs.firebase.bom))
    implementation(libs.firebase.messaging)
    implementation(libs.firebase.analytics)
    implementation(libs.firebase.crashlytics)

    // Google Sign-In
    implementation(libs.google.identity)
    implementation(libs.credentials)
    implementation(libs.credentials.play.services)

    // Facebook Sign-In
    implementation(libs.facebook.login)

    // WebSocket (Pusher - Reverb compatible)
    implementation(libs.pusher.java.client)

    // NOTE: no in-app purchases in v1 — Razorpay SDK removed for Play policy
    // compliance (digital goods require Play Billing; planned for v1.1).

    // Coroutines
    implementation(libs.kotlinx.coroutines.core)
    implementation(libs.kotlinx.coroutines.android)
    implementation(libs.kotlinx.serialization.json)

    // Logging
    implementation(libs.timber)

    // Testing
    testImplementation(libs.junit)
    testImplementation(libs.mockk)
    testImplementation(libs.kotlinx.coroutines.test)
    testImplementation(libs.turbine)
    androidTestImplementation(libs.androidx.junit)
    androidTestImplementation(libs.androidx.espresso.core)
    androidTestImplementation(platform(libs.androidx.compose.bom))
    androidTestImplementation(libs.androidx.ui.test.junit4)
    debugImplementation(libs.androidx.ui.tooling)
    debugImplementation(libs.androidx.ui.test.manifest)
}
