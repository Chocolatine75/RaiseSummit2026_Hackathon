package com.example.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowForward
import androidx.compose.material.icons.filled.CloudDownload
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Security
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OnboardingScreen(
    viewModel: AegisViewModel,
    modifier: Modifier = Modifier
) {
    var name by remember { mutableStateOf("") }
    var language by remember { mutableStateOf("English") }
    var homeCountry by remember { mutableStateOf("France") }
    var homeCity by remember { mutableStateOf("Paris") }
    var passport by remember { mutableStateOf("") }
    var contact by remember { mutableStateOf("") }
    var bloodType by remember { mutableStateOf("O+") }
    var childAge6 by remember { mutableStateOf(false) }
    var noStairs by remember { mutableStateOf(false) }

    val isGemmaDownloaded by viewModel.isGemmaDownloaded.collectAsState()
    val gemmaProgress by viewModel.gemmaDownloadProgress.collectAsState()
    val isMapDownloaded by viewModel.isMapDownloaded.collectAsState()
    val mapProgress by viewModel.mapDownloadProgress.collectAsState()

    val scrollState = rememberScrollState()

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(Color(0xFF0F172A)) // Deep slate dark
            .systemBarsPadding()
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(scrollState)
                .padding(24.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Header
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.Security,
                    contentDescription = "AEGIS",
                    tint = Color(0xFFFF6E00), // Crisis Warning Orange
                    modifier = Modifier.size(36.dp)
                )
                Text(
                    text = "AEGIS INITIALIZATION",
                    fontSize = 24.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.White,
                    letterSpacing = 1.5.sp
                )
            }

            Text(
                text = "Set up your secure survival profile. Your identity data is stored in the on-device hardware vault and never shared without confirmation.",
                fontSize = 14.sp,
                color = Color(0xFF94A3B8)
            )

            // Step 1: User Profile Context
            Card(
                colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B)),
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text(
                        text = "1. SURVIVAL CONTEXT",
                        fontSize = 16.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = Color(0xFF00FF66) // Neon Green
                    )

                    OutlinedTextField(
                        value = name,
                        onValueChange = { name = it },
                        label = { Text("Your Name", color = Color(0xFF94A3B8)) },
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = Color.White,
                            unfocusedTextColor = Color.White,
                            focusedBorderColor = Color(0xFFFF6E00),
                            unfocusedBorderColor = Color(0xFF475569)
                        ),
                        leadingIcon = { Icon(Icons.Default.Person, contentDescription = null, tint = Color(0xFF94A3B8)) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .testTag("name_input")
                    )

                    OutlinedTextField(
                        value = language,
                        onValueChange = { language = it },
                        label = { Text("Native Language", color = Color(0xFF94A3B8)) },
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = Color.White,
                            unfocusedTextColor = Color.White,
                            focusedBorderColor = Color(0xFFFF6E00),
                            unfocusedBorderColor = Color(0xFF475569)
                        ),
                        modifier = Modifier.fillMaxWidth()
                    )

                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        OutlinedTextField(
                            value = homeCountry,
                            onValueChange = { homeCountry = it },
                            label = { Text("Home Country", color = Color(0xFF94A3B8)) },
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedTextColor = Color.White,
                                unfocusedTextColor = Color.White,
                                focusedBorderColor = Color(0xFFFF6E00),
                                unfocusedBorderColor = Color(0xFF475569)
                            ),
                            modifier = Modifier.weight(1f)
                        )
                        OutlinedTextField(
                            value = homeCity,
                            onValueChange = { homeCity = it },
                            label = { Text("Home City", color = Color(0xFF94A3B8)) },
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedTextColor = Color.White,
                                unfocusedTextColor = Color.White,
                                focusedBorderColor = Color(0xFFFF6E00),
                                unfocusedBorderColor = Color(0xFF475569)
                            ),
                            modifier = Modifier.weight(1f)
                        )
                    }
                }
            }

            // Step 2: Constraints / Travel details
            Card(
                colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B)),
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text(
                        text = "2. ACCESSIBILITY CONSTRAINTS",
                        fontSize = 16.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = Color(0xFF00FF66)
                    )

                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Checkbox(
                            checked = childAge6,
                            onCheckedChange = { childAge6 = it },
                            colors = CheckboxDefaults.colors(
                                checkedColor = Color(0xFFFF6E00),
                                uncheckedColor = Color(0xFF475569)
                            )
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Traveling with child (under age 6)", color = Color.White, fontSize = 14.sp)
                    }

                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Checkbox(
                            checked = noStairs,
                            onCheckedChange = { noStairs = it },
                            colors = CheckboxDefaults.colors(
                                checkedColor = Color(0xFFFF6E00),
                                uncheckedColor = Color(0xFF475569)
                            )
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("No stairs / wheelchair step-free only", color = Color.White, fontSize = 14.sp)
                    }
                }
            }

            // Step 3: Identity Vault
            Card(
                colors = CardDefaults.cardColors(containerColor = Color(0xFF1F2937)),
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .border(1.dp, Color(0xFFDC2626).copy(alpha = 0.5f), RoundedCornerShape(12.dp)) // Red security border
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Icon(Icons.Default.Lock, contentDescription = null, tint = Color(0xFFEF4444))
                        Text(
                            text = "3. SECURE IDENTITY VAULT",
                            fontSize = 16.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = Color(0xFFEF4444)
                        )
                    }

                    OutlinedTextField(
                        value = passport,
                        onValueChange = { passport = it },
                        label = { Text("Passport Number (Optional)", color = Color(0xFF94A3B8)) },
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = Color.White,
                            unfocusedTextColor = Color.White,
                            focusedBorderColor = Color(0xFFEF4444),
                            unfocusedBorderColor = Color(0xFF475569)
                        ),
                        modifier = Modifier.fillMaxWidth()
                    )

                    OutlinedTextField(
                        value = contact,
                        onValueChange = { contact = it },
                        label = { Text("Emergency Contact & Relationship", color = Color(0xFF94A3B8)) },
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = Color.White,
                            unfocusedTextColor = Color.White,
                            focusedBorderColor = Color(0xFFEF4444),
                            unfocusedBorderColor = Color(0xFF475569)
                        ),
                        modifier = Modifier.fillMaxWidth()
                    )

                    OutlinedTextField(
                        value = bloodType,
                        onValueChange = { bloodType = it },
                        label = { Text("Blood Type", color = Color(0xFF94A3B8)) },
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = Color.White,
                            unfocusedTextColor = Color.White,
                            focusedBorderColor = Color(0xFFEF4444),
                            unfocusedBorderColor = Color(0xFF475569)
                        ),
                        modifier = Modifier.fillMaxWidth()
                    )

                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(Color(0xFF374151), RoundedCornerShape(6.dp))
                            .padding(8.dp)
                    ) {
                        Icon(Icons.Default.Info, contentDescription = null, tint = Color(0xFF60A5FA), modifier = Modifier.size(16.dp))
                        Text(
                            text = "This data stays encrypted in device Keystore and is never sent to the network without your approval.",
                            color = Color(0xFF9CA3AF),
                            fontSize = 11.sp
                        )
                    }
                }
            }

            // Step 4: Preloads
            Card(
                colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B)),
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text(
                        text = "4. OFFLINE RESOURCE PRE-LOAD",
                        fontSize = 16.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = Color(0xFF00FF66)
                    )

                    // Gemma Model pre-load
                    Column {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text("Gemma 4 Offline AI Model (~5 GB)", color = Color.White, fontSize = 13.sp)
                            if (isGemmaDownloaded) {
                                Text("READY", color = Color(0xFF00FF66), fontWeight = FontWeight.Bold, fontSize = 13.sp)
                            } else {
                                Button(
                                    onClick = { viewModel.downloadGemma() },
                                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF475569)),
                                    contentPadding = PaddingValues(horizontal = 8.dp, vertical = 2.dp),
                                    modifier = Modifier.height(28.dp)
                                ) {
                                    Icon(Icons.Default.CloudDownload, contentDescription = null, modifier = Modifier.size(14.dp))
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Text("Pre-load", fontSize = 11.sp)
                                }
                            }
                        }
                        if (gemmaProgress > 0f && gemmaProgress < 1f) {
                            LinearProgressIndicator(
                                progress = { gemmaProgress },
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(top = 6.dp)
                                    .clip(RoundedCornerShape(2.dp)),
                                color = Color(0xFFFF6E00),
                                trackColor = Color(0xFF475569)
                            )
                        }
                    }

                    Divider(color = Color(0xFF334155))

                    // Map PMTiles pre-load
                    Column {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text("Offline PMTiles Map Region (Tokyo 50km)", color = Color.White, fontSize = 13.sp)
                            if (isMapDownloaded) {
                                Text("READY", color = Color(0xFF00FF66), fontWeight = FontWeight.Bold, fontSize = 13.sp)
                            } else {
                                Button(
                                    onClick = { viewModel.downloadMap() },
                                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF475569)),
                                    contentPadding = PaddingValues(horizontal = 8.dp, vertical = 2.dp),
                                    modifier = Modifier.height(28.dp)
                                ) {
                                    Icon(Icons.Default.CloudDownload, contentDescription = null, modifier = Modifier.size(14.dp))
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Text("Pre-load", fontSize = 11.sp)
                                }
                            }
                        }
                        if (mapProgress > 0f && mapProgress < 1f) {
                            LinearProgressIndicator(
                                progress = { mapProgress },
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(top = 6.dp)
                                    .clip(RoundedCornerShape(2.dp)),
                                color = Color(0xFFFF6E00),
                                trackColor = Color(0xFF475569)
                            )
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Enter Button
            val isReady = name.isNotEmpty() && isGemmaDownloaded && isMapDownloaded
            Button(
                onClick = {
                    val constraintsList = mutableListOf<String>()
                    if (childAge6) constraintsList.add("child_age_6")
                    if (noStairs) constraintsList.add("no_stairs")
                    viewModel.completeOnboarding(
                        name = name,
                        language = language,
                        country = homeCountry,
                        city = homeCity,
                        passport = passport,
                        contact = contact,
                        bloodType = bloodType,
                        constraints = constraintsList
                    )
                },
                enabled = isReady,
                colors = ButtonDefaults.buttonColors(
                    containerColor = Color(0xFFFF6E00),
                    disabledContainerColor = Color(0xFF475569)
                ),
                shape = RoundedCornerShape(8.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(52.dp)
                    .testTag("submit_button")
            ) {
                Text(
                    text = "INITIALIZE AEGIS SYSTEM",
                    fontWeight = FontWeight.Bold,
                    fontSize = 16.sp,
                    color = if (isReady) Color.White else Color(0xFF94A3B8)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Icon(Icons.Default.ArrowForward, contentDescription = null)
            }

            Spacer(modifier = Modifier.height(32.dp))
        }
    }
}
