package com.example.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Translate
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material.icons.filled.Send
import androidx.compose.material.icons.filled.Wifi
import androidx.compose.material.icons.filled.WifiOff
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.audio.AudioManager
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun VoiceScreen(
    viewModel: AegisViewModel,
    onShowInspector: () -> Unit,
    modifier: Modifier = Modifier
) {
    val situation by viewModel.situation.collectAsState()
    val isConnected by viewModel.isConnected.collectAsState()
    val isOffline by viewModel.isOfflineMode.collectAsState()
    val sessionId by viewModel.sessionId.collectAsState()

    val context = LocalContext.current
    val audioManager = remember { AudioManager(context) }
    val coroutineScope = rememberCoroutineScope()

    var isListening by remember { mutableStateOf(false) }
    var voiceTextResult by remember { mutableStateOf("") }
    var showCameraSim by remember { mutableStateOf(false) }
    var inputQuery by remember { mutableStateOf("") }

    // TTS speaker feedback loop when guidance changes
    LaunchedEffect(situation?.guidance?.text) {
        situation?.guidance?.text?.let { text ->
            if (text.isNotEmpty()) {
                audioManager.speak(text)
            }
        }
    }

    DisposableEffect(Unit) {
        onDispose {
            audioManager.shutdown()
        }
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(Color(0xFF0F172A)) // Dark Slate background
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(bottom = 100.dp) // Leave room for floating navigation bar
        ) {
            // Status Strip
            StatusStrip(
                isConnected = isConnected,
                isOffline = isOffline,
                itxId = situation?.interactionChainId ?: "v1_demo",
                envId = situation?.scoutEnvironmentId ?: "e1_tokyo",
                onToggleOffline = { viewModel.toggleOfflineMode() },
                onTapInspector = onShowInspector
            )

            // Main scrollable safety info
            Column(
                modifier = Modifier
                    .weight(1f)
                    .verticalScroll(rememberScrollState())
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // Crisis Title Card
                situation?.let { sit ->
                    if (sit.event.type != null) {
                        CrisisHeader(
                            title = sit.event.type,
                            location = sit.event.t0 ?: "",
                            severity = sit.event.magnitudeReported?.let { "M$it" } ?: "",
                            description = ""
                        )
                    }
                }

                // Big Guidance Card
                GuidanceCard(
                    guidanceText = situation?.guidance?.text ?: "Preloading crisis survival context. Awaiting instructions...",
                    timestamp = situation?.guidance?.timestamp ?: System.currentTimeMillis(),
                    needsTap = situation?.guidance?.needsTap ?: false,
                    onConfirmTap = { viewModel.sendConfirmTap() }
                )

                // Live Translation and Scout Feeds
                TranslateScoutFeed(
                    lastTranslation = if (isOffline) "Translate Feed Cached offline" else "PA: 「新宿駅は現在エレベーターをご利用いただけます。」 → 'Shinjuku station elevator is currently operational.'",
                    scoutDetails = "Scout: ${situation?.liveDelta?.shelters?.size ?: 0} Step-Free Shelters found in 5km",
                    alertText = situation?.activeAlerts?.firstOrNull()?.let { "${it.source}: ${it.message}" } ?: "Alert: No major active warnings (JMA)"
                )

                // Manual manual query box
                OutlinedTextField(
                    value = inputQuery,
                    onValueChange = { inputQuery = it },
                    placeholder = { Text("Ask AEGIS locally (e.g., nearest shelter)", color = Color(0xFF64748B), fontSize = 14.sp) },
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = Color.White,
                        unfocusedTextColor = Color.White,
                        focusedBorderColor = Color(0xFFFF6E00),
                        unfocusedBorderColor = Color(0xFF334155),
                        focusedContainerColor = Color(0xFF1E293B),
                        unfocusedContainerColor = Color(0xFF1E293B)
                    ),
                    shape = RoundedCornerShape(12.dp),
                    trailingIcon = {
                        IconButton(
                            onClick = {
                                if (inputQuery.isNotEmpty()) {
                                    viewModel.sendVoiceText(inputQuery)
                                    inputQuery = ""
                                }
                            }
                        ) {
                            Icon(Icons.Default.Send, contentDescription = "Send", tint = Color(0xFFFF6E00))
                        }
                    },
                    modifier = Modifier.fillMaxWidth()
                )
            }

            // Bottom Action Controls
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 24.dp, vertical = 12.dp),
                horizontalArrangement = Arrangement.spacedBy(16.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Read Sign Camera Button
                Button(
                    onClick = { showCameraSim = true },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF1E293B)),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier
                        .weight(1f)
                        .height(56.dp)
                        .border(1.dp, Color(0xFF334155), RoundedCornerShape(12.dp)),
                    contentPadding = PaddingValues(0.dp)
                ) {
                    Icon(Icons.Default.CameraAlt, contentDescription = null, tint = Color(0xFFFF6E00))
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Read Sign", color = Color.White, fontWeight = FontWeight.SemiBold)
                }

                // Hold to Speak voice trigger
                val infiniteTransition = rememberInfiniteTransition()
                val pulseScale by infiniteTransition.animateFloat(
                    initialValue = 1f,
                    targetValue = 1.2f,
                    animationSpec = infiniteRepeatable(
                        animation = tween(800, easing = LinearEasing),
                        repeatMode = RepeatMode.Reverse
                    ),
                    label = "Pulse"
                )

                Box(
                    contentAlignment = Alignment.Center,
                    modifier = Modifier
                        .size(80.dp)
                        .pointerInput(Unit) {
                            detectTapGestures(
                                onPress = {
                                    isListening = true
                                    audioManager.startCapture { chunk ->
                                        // Captured PCM chunk (can send via websocket when online)
                                    }
                                    tryAwaitRelease()
                                    isListening = false
                                    audioManager.stopCapture()
                                    // Simulated prompt query
                                    coroutineScope.launch {
                                        delay(300)
                                        viewModel.sendVoiceText("Show me step free shelters")
                                    }
                                }
                            )
                        }
                ) {
                    Box(
                        modifier = Modifier
                            .size(if (isListening) 80.dp else 64.dp)
                            .clip(CircleShape)
                            .background(if (isListening) Color(0xFFEF4444).copy(alpha = 0.3f) else Color.Transparent)
                    )
                    Box(
                        modifier = Modifier
                            .size(64.dp)
                            .clip(CircleShape)
                            .background(if (isListening) Color(0xFFEF4444) else Color(0xFFFF6E00))
                    ) {
                        Icon(
                            imageVector = Icons.Default.Mic,
                            contentDescription = "Hold to Speak",
                            tint = Color.White,
                            modifier = Modifier
                                .size(28.dp)
                                .align(Alignment.Center)
                        )
                    }
                }

                // Scout Manual Refresh trigger
                IconButton(
                    onClick = { viewModel.triggerScout() },
                    modifier = Modifier
                        .size(56.dp)
                        .background(Color(0xFF1E293B), RoundedCornerShape(12.dp))
                        .border(1.dp, Color(0xFF334155), RoundedCornerShape(12.dp))
                ) {
                    Icon(Icons.Default.Refresh, contentDescription = "Scout Refresh", tint = Color(0xFF00FF66))
                }
            }
        }

        // Camera Vision reading simulator overlay
        if (showCameraSim) {
            CameraVisionSimulator(
                onDismiss = { showCameraSim = false },
                onSelectSign = { base64, mime ->
                    viewModel.submitSignReading(base64, mime)
                    showCameraSim = false
                }
            )
        }
    }
}

@Composable
fun StatusStrip(
    isConnected: Boolean,
    isOffline: Boolean,
    itxId: String,
    envId: String,
    onToggleOffline: () -> Unit,
    onTapInspector: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(if (isOffline) Color(0xFF3F3F46) else Color(0xFF1E293B)) // gray-dark offline
            .clickable { onTapInspector() }
            .padding(horizontal = 16.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Icon(
                imageVector = if (isOffline) Icons.Default.WifiOff else Icons.Default.Wifi,
                contentDescription = null,
                tint = if (isOffline) Color(0xFFEF4444) else Color(0xFF00FF66),
                modifier = Modifier.size(16.dp)
            )
            Text(
                text = if (isOffline) "OFFLINE — gemma fallback" else "ONLINE — live translation",
                color = Color.White,
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                fontFamily = FontFamily.Monospace
            )
        }

        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                text = "itx: ${itxId.take(8)}  env: ${envId.take(8)}",
                color = Color(0xFF94A3B8),
                fontSize = 11.sp,
                fontFamily = FontFamily.Monospace
            )

            // Simulated Airplane mode toggle switch
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(12.dp))
                    .background(if (isOffline) Color(0xFFFF6E00) else Color(0xFF334155))
                    .clickable { onToggleOffline() }
                    .padding(horizontal = 8.dp, vertical = 2.dp)
            ) {
                Text(
                    text = if (isOffline) "ONLINE" else "OFFLINE",
                    color = Color.White,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold
                )
            }
        }
    }
}

@Composable
fun CrisisHeader(
    title: String,
    location: String,
    severity: String,
    description: String
) {
    Card(
        colors = CardDefaults.cardColors(containerColor = Color(0xFFEF4444).copy(alpha = 0.15f)),
        shape = RoundedCornerShape(12.dp),
        modifier = Modifier
            .fillMaxWidth()
            .border(1.dp, Color(0xFFEF4444).copy(alpha = 0.4f), RoundedCornerShape(12.dp))
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Icon(Icons.Default.Warning, contentDescription = null, tint = Color(0xFFEF4444), modifier = Modifier.size(18.dp))
                Text(
                    text = title.uppercase(),
                    color = Color(0xFFFCA5A5),
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 1.sp
                )
            }
            Spacer(modifier = Modifier.height(4.dp))
            Text("Location: $location", color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
            Text(description, color = Color(0xFFFECACA), fontSize = 12.sp)
        }
    }
}

@Composable
fun GuidanceCard(
    guidanceText: String,
    timestamp: Long,
    needsTap: Boolean,
    onConfirmTap: () -> Unit
) {
    Card(
        colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B)),
        shape = RoundedCornerShape(16.dp),
        modifier = Modifier
            .fillMaxWidth()
            .border(2.dp, Color(0xFFFF6E00).copy(alpha = 0.7f), RoundedCornerShape(16.dp))
    ) {
        Column(
            modifier = Modifier.padding(20.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = "ACTIVE GUIDANCE",
                color = Color(0xFFFF6E00),
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 2.sp
            )

            Spacer(modifier = Modifier.height(12.dp))

            Text(
                text = "\"$guidanceText\"",
                color = Color.White,
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center,
                lineHeight = 26.sp
            )

            Spacer(modifier = Modifier.height(16.dp))

            Text(
                text = "Last updated 3m ago • Vault cached",
                color = Color(0xFF64748B),
                fontSize = 11.sp
            )

            if (needsTap) {
                Spacer(modifier = Modifier.height(16.dp))
                Button(
                    onClick = onConfirmTap,
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF00FF66)),
                    shape = RoundedCornerShape(8.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Icon(Icons.Default.Check, contentDescription = null, tint = Color(0xFF0F172A))
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("I CONFIRM / I AM SAFE", color = Color(0xFF0F172A), fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

@Composable
fun TranslateScoutFeed(
    lastTranslation: String,
    scoutDetails: String,
    alertText: String
) {
    Card(
        colors = CardDefaults.cardColors(containerColor = Color(0xFF0F172A)),
        shape = RoundedCornerShape(12.dp),
        modifier = Modifier
            .fillMaxWidth()
            .border(1.dp, Color(0xFF334155), RoundedCornerShape(12.dp))
    ) {
        Column(
            modifier = Modifier.padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Icon(Icons.Default.Translate, contentDescription = null, tint = Color(0xFF38BDF8), modifier = Modifier.size(16.dp))
                Text(lastTranslation, color = Color(0xFF94A3B8), fontSize = 12.sp)
            }
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Box(
                    modifier = Modifier
                        .size(8.dp)
                        .clip(CircleShape)
                        .background(Color(0xFF00FF66))
                )
                Text(scoutDetails, color = Color(0xFF94A3B8), fontSize = 12.sp)
            }
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Box(
                    modifier = Modifier
                        .size(8.dp)
                        .clip(CircleShape)
                        .background(Color(0xFFFFB900))
                )
                Text(alertText, color = Color(0xFF94A3B8), fontSize = 12.sp)
            }
        }
    }
}

@Composable
fun CameraVisionSimulator(
    onDismiss: () -> Unit,
    onSelectSign: (base64: String, mime: String) -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("MOCK CAMERA: READ SIGN", color = Color.White) },
        text = {
            Column(
                verticalArrangement = Arrangement.spacedBy(12.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(
                    "Select a localized Japanese emergency sign to simulate scanning with AEGIS Vision:",
                    color = Color(0xFF94A3B8),
                    fontSize = 13.sp
                )

                // Sign 1
                Card(
                    colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B)),
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { onSelectSign("mock_base64_entrance", "image/jpeg") }
                ) {
                    Column(modifier = Modifier.padding(12.dp)) {
                        Text("新宿駅入口", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = Color.White)
                        Text("Shinjuku Station Entrance", fontSize = 12.sp, color = Color(0xFFFF6E00))
                    }
                }

                // Sign 2
                Card(
                    colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B)),
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { onSelectSign("mock_base64_shelter", "image/jpeg") }
                ) {
                    Column(modifier = Modifier.padding(12.dp)) {
                        Text("避難所避難場所", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = Color.White)
                        Text("Evacuation Shelter", fontSize = 12.sp, color = Color(0xFFFF6E00))
                    }
                }

                // Sign 3
                Card(
                    colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B)),
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { onSelectSign("mock_base64_stairs", "image/jpeg") }
                ) {
                    Column(modifier = Modifier.padding(12.dp)) {
                        Text("階段使用禁止", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = Color.White)
                        Text("Do Not Use Stairs (Use elevators instead)", fontSize = 12.sp, color = Color(0xFFFF6E00))
                    }
                }
            }
        },
        confirmButton = {},
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel", color = Color(0xFF94A3B8))
            }
        },
        containerColor = Color(0xFF0F172A)
    )
}
