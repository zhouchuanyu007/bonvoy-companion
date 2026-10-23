import java.io.File
import java.util.Properties

plugins {
    id("com.android.application")
}

fun readLocalProperties(file: File): Properties = Properties().apply {
    if (file.isFile) {
        file.reader(Charsets.UTF_8).use(::load)
    }
}

fun javaStringLiteral(value: String): String = buildString {
    append('"')
    value.forEach { character ->
        when (character) {
            '\\' -> append("\\\\")
            '"' -> append("\\\"")
            '\n' -> append("\\n")
            '\r' -> append("\\r")
            else -> append(character)
        }
    }
    append('"')
}

val localSecrets = readLocalProperties(rootProject.file("local-env/secrets.properties"))
val keylessBuild =
    System.getenv("BONVOY_KEYLESS_BUILD")
        ?.trim()
        ?.lowercase()
        ?.let { it == "1" || it == "true" || it == "yes" } == true

fun localSecret(name: String): String {
    if (keylessBuild) return ""
    val environmentValue = System.getenv(name)?.trim().orEmpty()
    if (environmentValue.isNotEmpty()) return environmentValue
    return localSecrets.getProperty(name, "").trim()
}

val signingProperties = readLocalProperties(
    rootProject.file("local-env/signing/keystore.properties")
)
val hasLocalSigning = signingProperties.getProperty("storeFile")
    ?.let { rootProject.file(it).isFile } == true

android {
    namespace = "com.bonvoy.companion"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.bonvoy.companion"
        minSdk = 23
        targetSdk = 35
        versionCode = 14
        versionName = "0.13"
        buildConfigField("boolean", "KEYLESS_BUILD", keylessBuild.toString())
        buildConfigField("String", "AMAP_KEY", javaStringLiteral(localSecret("AMAP_KEY")))
        buildConfigField("String", "DEEPSEEK_KEY", javaStringLiteral(localSecret("DEEPSEEK_KEY")))
        buildConfigField("String", "FLYAI_API_KEY", javaStringLiteral(localSecret("FLYAI_API_KEY")))
        buildConfigField(
            "String",
            "FLYAI_SIGN_SECRET",
            javaStringLiteral(localSecret("FLYAI_SIGN_SECRET"))
        )
        buildConfigField(
            "String",
            "MEITUAN_TRAVEL_KEY",
            javaStringLiteral(localSecret("MEITUAN_TRAVEL_KEY"))
        )
    }

    signingConfigs {
        if (hasLocalSigning) {
            create("localRelease") {
                storeFile = rootProject.file(signingProperties.getProperty("storeFile"))
                storePassword = signingProperties.getProperty("storePassword")
                keyAlias = signingProperties.getProperty("keyAlias", "bonvoy-local")
                keyPassword = signingProperties.getProperty("keyPassword")
                enableV1Signing = true
                enableV2Signing = true
                enableV3Signing = true
                enableV4Signing = false
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            if (hasLocalSigning) {
                signingConfig = signingConfigs.getByName("localRelease")
            }
        }
    }

    buildFeatures {
        buildConfig = true
    }

    sourceSets {
        getByName("main") {
            manifest.srcFile("AndroidManifest.xml")
            java.srcDirs("src")
            res.srcDirs("res")
            assets.srcDirs("assets")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    packaging {
        resources {
            excludes += listOf("META-INF/LICENSE*", "META-INF/NOTICE*")
        }
    }

    androidResources {
        noCompress += listOf(
            "html",
            "js",
            "css",
            "json",
            "svg",
            "png",
            "jpg",
            "jpeg",
            "woff2"
        )
    }
}
