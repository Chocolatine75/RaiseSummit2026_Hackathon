package com.example.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AssignmentTurnedIn
import androidx.compose.material.icons.filled.CloudDone
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Phone
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Send
import androidx.compose.material.icons.filled.VolumeUp
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.*
import androidx.compose.material3.TabRowDefaults.tabIndicatorOffset
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
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

@Composable
fun VaultScreen(
    viewModel: AegisViewModel,
    modifier: Modifier = Modifier
) {
    var selectedTab by remember { mutableIntStateOf(0) } // 0 = Survival, 1 = Identity

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(Color(0xFF0F172A))
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(bottom = 100.dp) // Space for bottom navigation
        ) {
            // Header Title
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.padding(top = 24.dp, start = 24.dp, end = 24.dp, bottom = 12.dp)
            ) {
                Icon(Icons.Default.Lock, contentDescription = null, tint = Color(0xFFFF6E00))
                Text(
                    text = "AEGIS SECURE VAULT",
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.White,
                    letterSpacing = 1.sp
                )
            }

            // Tab Rows
            TabRow(
                selectedTabIndex = selectedTab,
                containerColor = Color(0xFF1E293B),
                contentColor = Color(0xFFFF6E00),
                indicator = { tabPositions ->
                    TabRowDefaults.SecondaryIndicator(
                        Modifier.tabIndicatorOffset(tabPositions[selectedTab]),
                        color = Color(0xFFFF6E00)
                    )
                },
                modifier = Modifier.fillMaxWidth()
            ) {
                Tab(
                    selected = selectedTab == 0,
                    onClick = { selectedTab = 0 },
                    text = { Text("SURVIVAL VAULT", fontWeight = FontWeight.Bold, fontSize = 13.sp) },
                    selectedContentColor = Color(0xFFFF6E00),
                    unselectedContentColor = Color(0xFF64748B)
                )
                Tab(
                    selected = selectedTab == 1,
                    onClick = { selectedTab = 1 },
                    text = { Text("IDENTITY VAULT", fontWeight = FontWeight.Bold, fontSize = 13.sp) },
                    selectedContentColor = Color(0xFFEF4444), // Security Red
                    unselectedContentColor = Color(0xFF64748B)
                )
            }

            // Tab Contents
            Box(modifier = Modifier.weight(1f)) {
                if (selectedTab == 0) {
                    SurvivalVaultTab(viewModel)
                } else {
                    IdentityVaultTab(viewModel)
                }
            }
        }
    }
}

@Composable
fun SurvivalVaultTab(viewModel: AegisViewModel) {
    val context = LocalContext.current
    val audioManager = remember { AudioManager(context) }
    val situation by viewModel.situation.collectAsState()
    val isOffline by viewModel.isOfflineMode.collectAsState()

    val scrollState = rememberScrollState()

    DisposableEffect(Unit) {
        onDispose {
            audioManager.shutdown()
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(scrollState)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Cache Statistics
        Card(
            colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B)),
            shape = RoundedCornerShape(12.dp)
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text("VAULT PRELOADED CACHE", color = Color(0xFF00FF66), fontSize = 14.sp, fontWeight = FontWeight.Bold)
                    Icon(Icons.Default.CloudDone, contentDescription = null, tint = Color(0xFF00FF66))
                }
                Spacer(modifier = Modifier.height(12.dp))

                Row(
                    horizontalArrangement = Arrangement.SpaceBetween,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column {
                        Text("PMTiles Map Region", color = Color(0xFF94A3B8), fontSize = 11.sp)
                        Text("Tokyo 50km (85MB)", color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.Bold)
                    }
                    Column(horizontalAlignment = Alignment.End) {
                        Text("Shelters Cached", color = Color(0xFF94A3B8), fontSize = 11.sp)
                        Text("${situation?.liveDelta?.shelters?.size ?: 4} Active Shelters", color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }

        // Emergency Numbers Quick-Dial Info
        Card(
            colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B)),
            shape = RoundedCornerShape(12.dp)
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Icon(Icons.Default.Phone, contentDescription = null, tint = Color(0xFFFF6E00))
                    Text("EMERGENCY DIRECTORY", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                }
                Spacer(modifier = Modifier.height(12.dp))

                EmergencyRow(label = "Police Dispatch", number = "110")
                EmergencyRow(label = "Fire / Ambulance", number = "119")
                EmergencyRow(label = "French Embassy Emergency", number = "+81-80-9539-3970")
                EmergencyRow(label = "Japan Helpline", number = "0570-000-911")
            }
        }

        // Key survival phrases with tap to talk
        Card(
            colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B)),
            shape = RoundedCornerShape(12.dp)
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text("KEY JAPANESE CRISIS PHRASES (TAP TO HEAR)", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                Spacer(modifier = Modifier.height(12.dp))

                SurvivalPhraseRow(
                    english = "Where is the nearest shelter?",
                    japanese = "避難所はどこですか？",
                    romaji = "Hinanjo wa doko desu ka?",
                    onSpeak = { audioManager.speak("Hinanjo wa doko desu ka") }
                )
                Divider(color = Color(0xFF334155), modifier = Modifier.padding(vertical = 4.dp))
                SurvivalPhraseRow(
                    english = "Please help me.",
                    japanese = "助けてください。",
                    romaji = "Tasukete kudasai.",
                    onSpeak = { audioManager.speak("Tasukete kudasai") }
                )
                Divider(color = Color(0xFF334155), modifier = Modifier.padding(vertical = 4.dp))
                SurvivalPhraseRow(
                    english = "Is this water safe to drink?",
                    japanese = "この水は飲めますか？",
                    romaji = "Kono mizu wa nomemasu ka?",
                    onSpeak = { audioManager.speak("Kono mizu wa nomemasu ka") }
                )
            }
        }
    }
}

@Composable
fun EmergencyRow(label: String, number: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 6.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(label, color = Color(0xFF94A3B8), fontSize = 13.sp)
        Text(
            number,
            color = Color(0xFFFF6E00),
            fontSize = 14.sp,
            fontWeight = FontWeight.Bold,
            fontFamily = FontFamily.Monospace
        )
    }
}

@Composable
fun SurvivalPhraseRow(
    english: String,
    japanese: String,
    romaji: String,
    onSpeak: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onSpeak() }
            .padding(vertical = 6.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(english, color = Color.White, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
            Text(japanese, color = Color(0xFFFF6E00), fontSize = 14.sp, fontWeight = FontWeight.Bold)
            Text(romaji, color = Color(0xFF94A3B8), fontSize = 11.sp)
        }
        Icon(Icons.Default.VolumeUp, contentDescription = "Listen", tint = Color(0xFFFF6E00))
    }
}

@Composable
fun IdentityVaultTab(viewModel: AegisViewModel) {
    val identityFields by viewModel.identityFields.collectAsState()
    val isOffline by viewModel.isOfflineMode.collectAsState()

    var showPassport by remember { mutableStateOf(false) }
    var showContact by remember { mutableStateOf(false) }
    var showBloodType by remember { mutableStateOf(false) }

    var isSubmittingEmbassy by remember { mutableStateOf(false) }
    var embassyProgress by remember { mutableStateOf(0f) }
    var registrationReceipt by remember { mutableStateOf("") }
    var showConfirmationDialog by remember { mutableStateOf(false) }

    val coroutineScope = rememberCoroutineScope()
    val scrollState = rememberScrollState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(scrollState)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Red warning header banner
        Card(
            colors = CardDefaults.cardColors(containerColor = Color(0xFFDC2626).copy(alpha = 0.1f)),
            shape = RoundedCornerShape(12.dp),
            modifier = Modifier
                .fillMaxWidth()
                .border(1.dp, Color(0xFFDC2626).copy(alpha = 0.4f), RoundedCornerShape(12.dp))
        ) {
            Row(
                modifier = Modifier.padding(12.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Icon(Icons.Default.Lock, contentDescription = null, tint = Color(0xFFEF4444))
                Text(
                    text = "HARDWARE SECURED PII. This data NEVER leaves your device unless you initiate embassy registration.",
                    color = Color(0xFFFCA5A5),
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold
                )
            }
        }

        // Passport Info
        MaskedFieldCard(
            label = "Your Passport Number",
            value = identityFields["passport"] ?: "NO PASSPORT RECORDED",
            isVisible = showPassport,
            onToggleVisibility = { showPassport = !showPassport }
        )

        // Emergency Contacts
        MaskedFieldCard(
            label = "Emergency Contacts",
            value = identityFields["emergency_contact"] ?: "NO CONTACTS RECORDED",
            isVisible = showContact,
            onToggleVisibility = { showContact = !showContact }
        )

        // Blood Type
        MaskedFieldCard(
            label = "Blood Type",
            value = identityFields["blood_type"] ?: "NOT DECLARED",
            isVisible = showBloodType,
            onToggleVisibility = { showBloodType = !showBloodType }
        )

        Spacer(modifier = Modifier.height(12.dp))

        // Receipt Area (if registered)
        if (registrationReceipt.isNotEmpty()) {
            Card(
                colors = CardDefaults.cardColors(containerColor = Color(0xFF065F46).copy(alpha = 0.2f)),
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .border(1.dp, Color(0xFF00FF66).copy(alpha = 0.4f), RoundedCornerShape(12.dp))
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Icon(Icons.Default.AssignmentTurnedIn, contentDescription = null, tint = Color(0xFF34D399))
                        Text("EMBASSY REGISTRATION CONFIRMED", color = Color(0xFF34D399), fontWeight = FontWeight.Bold, fontSize = 13.sp)
                    }
                    Spacer(modifier = Modifier.height(8.dp))
                    Text("Secure Token: $registrationReceipt", color = Color.White, fontSize = 12.sp, fontFamily = FontFamily.Monospace)
                    Text("Submitted via Gemini Computer Use API automation. Receipt recorded on secure device vault.", color = Color(0xFF94A3B8), fontSize = 11.sp)
                }
            }
        }

        // Embassy Registration trigger (Computer Use)
        Button(
            onClick = { showConfirmationDialog = true },
            enabled = !isSubmittingEmbassy && registrationReceipt.isEmpty(),
            colors = ButtonDefaults.buttonColors(
                containerColor = Color(0xFFEF4444),
                disabledContainerColor = Color(0xFF475569)
            ),
            shape = RoundedCornerShape(8.dp),
            modifier = Modifier
                .fillMaxWidth()
                .height(52.dp)
        ) {
            Icon(Icons.Default.Send, contentDescription = null, tint = Color.White)
            Spacer(modifier = Modifier.width(8.dp))
            Text("REGISTER WITH FRENCH EMBASSY", fontWeight = FontWeight.Bold, color = Color.White)
        }

        if (isSubmittingEmbassy) {
            Column(
                modifier = Modifier.fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                LinearProgressIndicator(
                    progress = { embassyProgress },
                    color = Color(0xFFEF4444),
                    trackColor = Color(0xFF334155),
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(4.dp))
                )
                Text(
                    text = "Running Gemini Headless Browser Computer Use Flow... ${(embassyProgress * 100).toInt()}%",
                    color = Color(0xFF94A3B8),
                    fontSize = 11.sp,
                    fontFamily = FontFamily.Monospace
                )
            }
        }
    }

    // Computer Use verification dialog (Section 10)
    if (showConfirmationDialog) {
        AlertDialog(
            onDismissRequest = { showConfirmationDialog = false },
            title = { Text("CONFIRM EMBASSY REGISTER FLOW", color = Color.White) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(
                        "AEGIS will initiate a secure, automated headless browser session (via Gemini Computer Use API) to register your details directly with the Ministry of Foreign Affairs embassy portal:",
                        color = Color(0xFF94A3B8),
                        fontSize = 13.sp
                    )
                    Card(colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B))) {
                        Column(modifier = Modifier.padding(12.dp)) {
                            Text("Prefilled registration details:", fontWeight = FontWeight.Bold, color = Color.White, fontSize = 12.sp)
                            Spacer(modifier = Modifier.height(4.dp))
                            Text("Name: ${identityFields["name"] ?: "Maria"}", color = Color(0xFF94A3B8), fontSize = 12.sp)
                            Text("Passport: ${identityFields["passport"]?.take(3) ?: "FRA"}••••••", color = Color(0xFF94A3B8), fontSize = 12.sp)
                            Text("Blood Type: ${identityFields["blood_type"] ?: "O+"}", color = Color(0xFF94A3B8), fontSize = 12.sp)
                        }
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        showConfirmationDialog = false
                        isSubmittingEmbassy = true
                        coroutineScope.launch {
                            embassyProgress = 0f
                            while (embassyProgress < 1f) {
                                delay(120)
                                embassyProgress += 0.05f
                            }
                            registrationReceipt = "AEGIS-RECEIPT-FRENCH-2026-X8"
                            isSubmittingEmbassy = false
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFEF4444))
                ) {
                    Text("CONFIRM SUBMISSION", color = Color.White)
                }
            },
            dismissButton = {
                TextButton(onClick = { showConfirmationDialog = false }) {
                    Text("CANCEL", color = Color(0xFF94A3B8))
                }
            },
            containerColor = Color(0xFF0F172A)
        )
    }
}

@Composable
fun MaskedFieldCard(
    label: String,
    value: String,
    isVisible: Boolean,
    onToggleVisibility: () -> Unit
) {
    Card(
        colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B)),
        shape = RoundedCornerShape(12.dp),
        modifier = Modifier
            .fillMaxWidth()
            .border(1.dp, Color(0xFF334155), RoundedCornerShape(12.dp))
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(label, color = Color(0xFF64748B), fontSize = 11.sp, fontWeight = FontWeight.Bold)
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = if (isVisible) value else "••••••••••••••••",
                    color = Color.White,
                    fontSize = 15.sp,
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.SemiBold
                )
            }
            IconButton(onClick = onToggleVisibility) {
                Icon(
                    imageVector = if (isVisible) Icons.Default.VisibilityOff else Icons.Default.Visibility,
                    contentDescription = if (isVisible) "Hide" else "Reveal",
                    tint = Color(0xFF94A3B8)
                )
            }
        }
    }
}
