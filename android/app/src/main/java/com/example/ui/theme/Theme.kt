package com.example.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val AegisColorScheme = darkColorScheme(
    primary = AegisPrimary,
    secondary = AegisSecondary,
    tertiary = AegisTertiary,
    background = DarkBackground,
    surface = DarkSurface,
    onBackground = DarkOnBackground,
    onSurface = DarkOnSurface,
    error = Color(0xFFEF4444)
)

@Composable
fun MyApplicationTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    dynamicColor: Boolean = false, // Disable dynamic colors to enforce the specialized AEGIS branding
    content: @Composable () -> Unit
) {
    MaterialTheme(
        colorScheme = AegisColorScheme,
        typography = Typography,
        content = content
    )
}
