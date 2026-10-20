# GROTEC FarmerOS — Android R8 / ProGuard Optimization Rules

# Keep Capacitor Core & Plugins
-keep class com.getcapacitor.** { *; }
-keep interface com.getcapacitor.** { *; }
-keep class * extends com.getcapacitor.Plugin { *; }
-keepclassmembers class * extends com.getcapacitor.Plugin {
    public <methods>;
}
-keep public class * extends com.getcapacitor.BridgeActivity
-keep class * implements com.getcapacitor.PluginMethod { *; }
-dontwarn com.getcapacitor.**

# Keep JavaScript Interface annotations and methods for WebView bridge
-keepattributes *Annotation*
-keepattributes JavascriptInterface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# AndroidX WebKit
-dontwarn androidx.webkit.**
-keep class androidx.webkit.** { *; }

# Cordova compatibility plugins
-dontwarn org.apache.cordova.**
-keep class org.apache.cordova.** { *; }

# Native methods
-keepclasseswithmembernames class * {
    native <methods>;
}

# Preserve line numbers for crash debugging
-keepattributes SourceFile,LineNumberTable
