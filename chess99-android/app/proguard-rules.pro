# Chess99 ProGuard Rules

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

# Pusher
-keep class com.pusher.** { *; }
-dontwarn com.pusher.**

# OkHttp
-dontwarn okhttp3.**
-dontwarn okio.**
