package com.example.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Dns
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AgentInspectorScreen(
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier
) {
    val scrollState = rememberScrollState()

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(Color(0xFF020617)) // Near pitch-black slate
            .systemBarsPadding()
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(24.dp)
        ) {
            // Header Row
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Icon(Icons.Default.Dns, contentDescription = null, tint = Color(0xFF00FF66))
                    Text(
                        text = "AGENT INSPECTOR CONSOLE",
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.White,
                        letterSpacing = 1.sp
                    )
                }

                IconButton(onClick = onDismiss) {
                    Icon(Icons.Default.Close, contentDescription = "Close", tint = Color(0xFF64748B))
                }
            }

            Text(
                text = "Inspect the live search verification traces of background scout cycles. Verifiable justifications guarantee safety.",
                fontSize = 12.sp,
                color = Color(0xFF64748B),
                modifier = Modifier.padding(bottom = 16.dp)
            )

            // Scrollable Console Cards
            Column(
                modifier = Modifier
                    .weight(1f)
                    .verticalScroll(scrollState),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // Agent 1: CountryAgent
                ConsoleLogCard(
                    agentName = "CountryAgent",
                    status = "VERIFIED",
                    timestamp = "42s ago",
                    task = "Find French Embassy emergency helpline and Tokyo evacuation protocols.",
                    logs = listOf(
                        "> Searched: 'French embassy Tokyo emergency contact 2026'",
                        "> Found: ambafrance-jp.org/emergency",
                        "> Extracted: +81 80 9539 3970",
                        "> Verified: Cross-referenced with Ministry of Foreign Affairs official portals. Matches registered diplomatic register."
                    )
                )

                // Agent 2: ShelterAgent
                ConsoleLogCard(
                    agentName = "ShelterAgent",
                    status = "SYNCED",
                    timestamp = "42s ago",
                    task = "Locate 10 closest shelters in 5km radius matching constraints: [no_stairs].",
                    logs = listOf(
                        "> Searched: 'Shinjuku ward evacuation spots step free 2026'",
                        "> Queried: OpenStreetMap API & Tokyo municipal government PDF databases.",
                        "> Found: Shinjuku Chuo Park Spot (step-free: YES, capacity: 1200)",
                        "> Filtered: Yoyogi Shelter Spot (step-free: NO) -> Mapped but marked as secondary warning option.",
                        "> Mapped: 4 step-free safe sectors synchronized with device Room database."
                    )
                )

                // Agent 3: AlertAgent
                ConsoleLogCard(
                    agentName = "AlertAgent",
                    status = "MONITORING",
                    timestamp = "12s ago",
                    task = "Monitor JMA (Japan Meteorological Agency) real-time feed for active tsunami, magnitude 7+ quake alerts.",
                    logs = listOf(
                        "> Connected: Meteorological RSS stream & JMA WebSocket portal.",
                        "> Polled: Magnitude 7.1 earthquake detected, epicentral depth 10km (Nishi-Shinjuku region).",
                        "> Alert: Tsunamis NOT threat inside inland Tokyo area. Safety guidance card generated.",
                        "> Broadcast: Active alert status injected to global context payload."
                    )
                )

                // Agent 4: Orchestrator
                ConsoleLogCard(
                    agentName = "OrchestratorAgent",
                    status = "ACTIVE",
                    timestamp = "6s ago",
                    task = "Coordinate multi-agent state payload updates. Construct situation state JSON.",
                    logs = listOf(
                        "> Checked: Network signal state (LTE / WebSocket active).",
                        "> Synthesized: Bundled Country, Shelter, Alert payloads into current unified SituationObject state.",
                        "> WebSocket: Dispatched state overwrite stream to android client session 'demo'.",
                        "> State check: Database single-source-of-truth synced."
                    )
                )
            }
        }
    }
}

@Composable
fun ConsoleLogCard(
    agentName: String,
    status: String,
    timestamp: String,
    task: String,
    logs: List<String>
) {
    Card(
        colors = CardDefaults.cardColors(containerColor = Color(0xFF0F172A)),
        shape = RoundedCornerShape(8.dp),
        modifier = Modifier
            .fillMaxWidth()
            .border(1.dp, Color(0xFF1E293B), RoundedCornerShape(8.dp))
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            // Header
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text(
                        text = agentName,
                        color = Color.White,
                        fontWeight = FontWeight.Bold,
                        fontSize = 14.sp,
                        fontFamily = FontFamily.Monospace
                    )
                    Box(
                        modifier = Modifier
                            .background(Color(0xFF052E16), RoundedCornerShape(4.dp))
                            .border(1.dp, Color(0xFF00FF66).copy(alpha = 0.5f), RoundedCornerShape(4.dp))
                            .padding(horizontal = 6.dp, vertical = 2.dp)
                    ) {
                        Text(
                            text = status,
                            color = Color(0xFF00FF66),
                            fontSize = 9.sp,
                            fontWeight = FontWeight.Bold,
                            fontFamily = FontFamily.Monospace
                        )
                    }
                }
                Text(
                    text = timestamp,
                    color = Color(0xFF64748B),
                    fontSize = 11.sp,
                    fontFamily = FontFamily.Monospace
                )
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Task
            Text(
                text = "TASK: $task",
                color = Color(0xFFFF6E00),
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold,
                fontFamily = FontFamily.Monospace
            )

            Spacer(modifier = Modifier.height(10.dp))

            // Console output
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color.Black, RoundedCornerShape(6.dp))
                    .padding(10.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                logs.forEach { log ->
                    Text(
                        text = log,
                        color = Color(0xFF34D399), // Monospace Terminal Green
                        fontSize = 11.sp,
                        fontFamily = FontFamily.Monospace,
                        lineHeight = 15.sp
                    )
                }
            }
        }
    }
}
