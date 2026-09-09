# Chess99 ProGuard Rules
# NOTE: these rules are release-only (isMinifyEnabled). Test features that use
# reflection/Gson against a RELEASE build, not just debug — R8 stripping has
# already bitten tactical-puzzle loading (Gson TypeToken) once.

# Retrofit
-keepattributes Signature, InnerClasses, EnclosingMethod
-keepattributes RuntimeVisibleAnnotations, RuntimeVisibleParameterAnnotations
-keepclassmembers,allowshrinking,allowobfuscation interface * {
    @retrofit2.http.* <methods>;
}
-dontwarn org.codehaus.mojo.animal_sniffer.IgnoreJRERequirement
-dontwarn javax.annotation.**
-dontwarn kotlin.Unit
-dontwarn retrofit2.KotlinExtensions
-dontwarn retrofit2.KotlinExtensions$*

# Gson DTOs
-keep class com.chess99.data.dto.** { *; }

# Gson — keep generic signatures + SerializedName fields, and (critical) retain
# the generic type argument of anonymous TypeToken subclasses under R8, else
# `object : TypeToken<List<T>>() {}` throws "TypeToken must be created with a
# type argument" at runtime (e.g. tactical-puzzle asset loading). See Gson README.
-keepattributes Signature
-keepattributes *Annotation*
-keepclassmembers,allowobfuscation class * {
    @com.google.gson.annotations.SerializedName <fields>;
}
-keep,allowobfuscation,allowshrinking class com.google.gson.reflect.TypeToken
-keep,allowobfuscation,allowshrinking class * extends com.google.gson.reflect.TypeToken
# Model classes deserialized from bundled JSON assets (kept generically so their
# fields survive minification for reflective Gson binding).
-keep class com.chess99.presentation.learn.tactical.** { *; }

# Latest offline computer-game review is persisted as Gson JSON. Keep the
# reflected field and enum names stable in release builds so restart/review
# remains compatible with records written by an earlier app process.
-keep class com.chess99.presentation.history.LocalGameReviewRecord { *; }
-keep class com.chess99.presentation.game.GameMoveRecord { *; }
-keep class com.chess99.presentation.game.GameResultState { *; }
-keep class com.chess99.presentation.game.GameMode { *; }
-keep class com.chess99.presentation.game.ResultStatus { *; }
-keep class com.chess99.presentation.game.EndReason { *; }
-keep class com.chess99.presentation.game.Winner { *; }
-keep class com.chess99.engine.Color { *; }

# Pusher
-keep class com.pusher.** { *; }
-dontwarn com.pusher.**
# pusher-java-client pulls in slf4j-api 1.x; no slf4j binding is bundled, so
# slf4j falls back to its NOP logger at runtime — safe to silence R8 here.
-dontwarn org.slf4j.impl.StaticLoggerBinder

# OkHttp
-dontwarn okhttp3.**
-dontwarn okio.**

# Crashlytics — keep source file + line numbers so obfuscated crash reports are
# still readable (the Crashlytics Gradle plugin uploads the mapping file too).
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
-keep public class * extends java.lang.Exception

# Facebook Login SDK
-keep class com.facebook.** { *; }
-dontwarn com.facebook.**
