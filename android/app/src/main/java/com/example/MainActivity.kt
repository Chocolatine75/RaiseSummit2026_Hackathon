package com.example

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Map
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.example.ui.*
import com.example.ui.theme.MyApplicationTheme

class MainActivity : ComponentActivity() {

    private val requestPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { _ ->
        // Handle runtime results if necessary
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        // Prompt for essential crisis-related hardware permissions
        requestPermissionLauncher.launch(
            arrayOf(
                android.Manifest.permission.RECORD_AUDIO,
                android.Manifest.permission.ACCESS_FINE_LOCATION,
                android.Manifest.permission.ACCESS_COARSE_LOCATION
            )
        )

        setContent {
            MyApplicationTheme {
                val viewModel: AegisViewModel = viewModel()
                val isOnboarded by viewModel.isOnboarded.collectAsState()
                val activeRoute by viewModel.activeRoute.collectAsState()

                var currentScreen by remember { mutableStateOf("voice") }
                var showInspector by remember { mutableStateOf(false) }

                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(Color(0xFF0F172A))
                ) {
                    if (!isOnboarded) {
                        OnboardingScreen(
                            viewModel = viewModel,
                            modifier = Modifier.fillMaxSize()
                        )
                    } else {
                        Scaffold(
                            bottomBar = {
                                NavigationBar(
                                    containerColor = Color(0xFF1E293B),
                                    contentColor = Color(0xFFFF6E00),
                                    tonalElevation = 8.dp,
                                    modifier = Modifier.windowInsetsPadding(WindowInsets.navigationBars)
                                ) {
                                    NavigationBarItem(
                                        selected = currentScreen == "voice",
                                        onClick = { currentScreen = "voice" },
                                        icon = { Icon(Icons.Default.Mic, contentDescription = "Voice Screen") },
                                        label = { Text("VOICE") },
                                        colors = NavigationBarItemDefaults.colors(
                                            selectedIconColor = Color(0xFFFF6E00),
                                            selectedTextColor = Color(0xFFFF6E00),
                                            unselectedIconColor = Color(0xFF64748B),
                                            unselectedTextColor = Color(0xFF64748B),
                                            indicatorColor = Color(0xFF0F172A)
                                        )
                                    )
                                    NavigationBarItem(
                                        selected = currentScreen == "map",
                                        onClick = { currentScreen = "map" },
                                        icon = { Icon(Icons.Default.Map, contentDescription = "Survival Map") },
                                        label = { Text("MAP") },
                                        colors = NavigationBarItemDefaults.colors(
                                            selectedIconColor = Color(0xFFFF6E00),
                                            selectedTextColor = Color(0xFFFF6E00),
                                            unselectedIconColor = Color(0xFF64748B),
                                            unselectedTextColor = Color(0xFF64748B),
                                            indicatorColor = Color(0xFF0F172A)
                                        )
                                    )
                                    NavigationBarItem(
                                        selected = currentScreen == "vault",
                                        onClick = { currentScreen = "vault" },
                                        icon = { Icon(Icons.Default.Lock, contentDescription = "Secure Vault") },
                                        label = { Text("VAULT") },
                                        colors = NavigationBarItemDefaults.colors(
                                            selectedIconColor = Color(0xFFEF4444),
                                            selectedTextColor = Color(0xFFEF4444),
                                            unselectedIconColor = Color(0xFF64748B),
                                            unselectedTextColor = Color(0xFF64748B),
                                            indicatorColor = Color(0xFF0F172A)
                                        )
                                    )
                                }
                            },
                            modifier = Modifier.fillMaxSize()
                        ) { innerPadding ->
                            Box(
                                modifier = Modifier
                                    .fillMaxSize()
                                    .padding(innerPadding)
                            ) {
                                when (currentScreen) {
                                    "voice" -> VoiceScreen(
                                        viewModel = viewModel,
                                        onShowInspector = { showInspector = true }
                                    )
                                    "map" -> MapScreen(viewModel = viewModel)
                                    "vault" -> VaultScreen(viewModel = viewModel)
                                }
                            }
                        }
                    }

                    // Floating Inspector Slide Up Sheet
                    if (showInspector) {
                        AgentInspectorScreen(
                            onDismiss = { showInspector = false }
                        )
                    }
                }
            }
        }
    }
}
