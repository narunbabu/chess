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

android {
    namespace = "com.chess99"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.chess99.app"
        minSdk = 26
        targetSdk = 35
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
            buildConfigField("String", "API_BASE_URL", "\"http://10.0.2.2:8000/api/v1/\"")
            buildConfigField("String", "WS_HOST", "\"10.0.2.2\"")
            buildConfigField("int", "WS_PORT", "8080")
            buildConfigField("String", "WS_KEY", "\"anrdh24nppf3obfupvqw\"")
            buildConfigField("boolean", "WS_USE_TLS", "false")
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
            val releaseWsKey = (project.findProperty("WS_KEY_RELEASE") as String?)
                ?: System.getenv("WS_KEY_RELEASE")
                ?: ""
            buildConfigField("String", "WS_KEY", "\"$releaseWsKey\"")
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
