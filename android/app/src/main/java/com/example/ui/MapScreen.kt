package com.example.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Accessible
import androidx.compose.material.icons.filled.CompassCalibration
import androidx.compose.material.icons.filled.LocalHospital
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.Shelter

// Define some offline map pin models
data class MapPin(
    val id: String,
    val name: String,
    val type: String, // "SHELTER", "HOSPITAL", "EMBASSY"
    val address: String,
    val capacity: Int,
    val stepFree: Boolean,
    val distance: String,
    val relativeX: Float, // Map space coordinates -100 to 100
    val relativeY: Float
)

@Composable
fun MapScreen(
    viewModel: AegisViewModel,
    modifier: Modifier = Modifier
) {
    val situation by viewModel.situation.collectAsState()
    val isOffline by viewModel.isOfflineMode.collectAsState()

    // Gestures state
    var scale by remember { mutableStateOf(1.2f) }
    var offset by remember { mutableStateOf(Offset(0f, 0f)) }

    var selectedPin by remember { mutableStateOf<MapPin?>(null) }
    var showActiveRoute by remember { mutableStateOf(false) }

    // Hardcoded Pins that stay functional offline (mirrors Maria's survival scenario context)
    val offlinePins = remember {
        listOf(
            MapPin(
                id = "sh1",
                name = "Shinjuku Chuo Park Evacuation Spot",
                type = "SHELTER",
                address = "2-1 Nishi-Shinjuku, Tokyo",
                capacity = 1200,
                stepFree = true,
                distance = "450m",
                relativeX = -30f,
                relativeY = -20f
            ),
            MapPin(
                id = "sh2",
                name = "Yoyogi Shelter Hall",
                type = "SHELTER",
                address = "1-1 Yoyogikamizonocho, Tokyo",
                capacity = 850,
                stepFree = false,
                distance = "1.2km",
                relativeX = 10f,
                relativeY = 60f
            ),
            MapPin(
                id = "h1",
                name = "Tokyo Metropolitan Medical Center",
                type = "HOSPITAL",
                address = "2-26-1 Nishi-Shinjuku, Tokyo",
                capacity = 450,
                stepFree = true,
                distance = "800m",
                relativeX = 40f,
                relativeY = -40f
            ),
            MapPin(
                id = "em1",
                name = "French Embassy in Tokyo",
                type = "EMBASSY",
                address = "4-11-44 Minami-Azabu, Tokyo",
                capacity = 0,
                stepFree = true,
                distance = "3.4km",
                relativeX = -60f,
                relativeY = 50f
            )
        )
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(Color(0xFF0F172A)) // Brutalist Slate Dark
    ) {
        // Map Grid Canvas
        Canvas(
            modifier = Modifier
                .fillMaxSize()
                .pointerInput(Unit) {
                    detectTransformGestures { _, pan, zoom, _ ->
                        scale = (scale * zoom).coerceIn(0.5f, 3.5f)
                        offset += pan
                    }
                }
                .graphicsLayer {
                    scaleX = scale
                    scaleY = scale
                    translationX = offset.x
                    translationY = offset.y
                }
        ) {
            val width = size.width
            val height = size.height
            val centerX = width / 2
            val centerY = height / 2

            // Draw grid lines
            val gridSpacing = 80f
            for (i in -20..20) {
                // Vertical lines
                drawLine(
                    color = Color(0xFF1E293B),
                    start = Offset(centerX + i * gridSpacing, 0f),
                    end = Offset(centerX + i * gridSpacing, height),
                    strokeWidth = 1f
                )
                // Horizontal lines
                drawLine(
                    color = Color(0xFF1E293B),
                    start = Offset(0f, centerY + i * gridSpacing),
                    end = Offset(width, centerY + i * gridSpacing),
                    strokeWidth = 1f
                )
            }

            // Draw stylized offline safety street outlines
            val strokeWidth = 8f
            // Main Street 1 (Vertical)
            drawLine(
                color = Color(0xFF1E293B).copy(alpha = 0.8f),
                start = Offset(centerX - 100f, 0f),
                end = Offset(centerX - 100f, height),
                strokeWidth = strokeWidth
            )
            // Main Street 2 (Horizontal)
            drawLine(
                color = Color(0xFF1E293B).copy(alpha = 0.8f),
                start = Offset(0f, centerY + 50f),
                end = Offset(width, centerY + 50f),
                strokeWidth = strokeWidth
            )

            // Draw emergency exit tunnels / surface elevator routes
            drawLine(
                color = Color(0xFF334155),
                start = Offset(centerX, centerY),
                end = Offset(centerX - 240f, centerY - 160f),
                strokeWidth = 4f,
                pathEffect = androidx.compose.ui.graphics.PathEffect.dashPathEffect(floatArrayOf(10f, 10f), 0f)
            )

            // Draw offline routing straight line path if a pin is selected & route is toggled
            selectedPin?.let { pin ->
                if (showActiveRoute) {
                    val mapX = centerX + (pin.relativeX / 100f) * (width / 2)
                    val mapY = centerY + (pin.relativeY / 100f) * (height / 2)

                    // Glow line effect
                    drawLine(
                        color = Color(0xFFFF6E00).copy(alpha = 0.3f),
                        start = Offset(centerX, centerY),
                        end = Offset(mapX, mapY),
                        strokeWidth = 12f
                    )
                    drawLine(
                        color = Color(0xFFFF6E00), // Glowing orange emergency path
                        start = Offset(centerX, centerY),
                        end = Offset(mapX, mapY),
                        strokeWidth = 4f,
                        pathEffect = androidx.compose.ui.graphics.PathEffect.dashPathEffect(floatArrayOf(15f, 10f), 0f)
                    )
                }
            }

            // Draw User current position beacon (pulsating beacon in center)
            drawCircle(
                color = Color(0xFF38BDF8).copy(alpha = 0.2f),
                radius = 50f,
                center = Offset(centerX, centerY)
            )
            drawCircle(
                color = Color(0xFF0284C7),
                radius = 12f,
                center = Offset(centerX, centerY)
            )
            drawCircle(
                color = Color.White,
                radius = 5f,
                center = Offset(centerX, centerY)
            )

            // Draw Pins
            offlinePins.forEach { pin ->
                val mapX = centerX + (pin.relativeX / 100f) * (width / 2)
                val mapY = centerY + (pin.relativeY / 100f) * (height / 2)

                // Different colors based on pin type
                val color = when (pin.type) {
                    "SHELTER" -> if (pin.stepFree) Color(0xFF00FF66) else Color(0xFF84CC16)
                    "HOSPITAL" -> Color(0xFF00A3FF)
                    "EMBASSY" -> Color(0xFFD97706)
                    else -> Color.Gray
                }

                // Shadow circle
                drawCircle(
                    color = Color.Black.copy(alpha = 0.4f),
                    radius = 20f,
                    center = Offset(mapX, mapY + 2f)
                )

                // Main Pin Circle
                drawCircle(
                    color = color,
                    radius = 16f,
                    center = Offset(mapX, mapY)
                )

                // White inner dot
                drawCircle(
                    color = Color.White,
                    radius = 6f,
                    center = Offset(mapX, mapY)
                )
            }
        }

        // Tap HUD - Click handling helper overlay
        Box(
            modifier = Modifier
                .fillMaxSize()
                .pointerInput(Unit) {
                    detectTapGestures { pressOffset ->
                        // Calculate tap coordinates relative to the graphics layer offset & scale
                        val width = size.width
                        val height = size.height
                        val centerX = width / 2
                        val centerY = height / 2

                        // Map tap position to un-transformed coordinates
                        val adjustedTapX = (pressOffset.x - offset.x) / scale
                        val adjustedTapY = (pressOffset.y - offset.y) / scale

                        // Check which pin is closest to the tap
                        var foundPin: MapPin? = null
                        var minDistance = 80f // tap tolerance threshold

                        offlinePins.forEach { pin ->
                            val pinX = centerX + (pin.relativeX / 100f) * (width / 2)
                            val pinY = centerY + (pin.relativeY / 100f) * (height / 2)
                            val dist = Math.hypot((adjustedTapX - pinX).toDouble(), (adjustedTapY - pinY).toDouble()).toFloat()
                            if (dist < minDistance) {
                                minDistance = dist
                                foundPin = pin
                            }
                        }

                        if (foundPin != null) {
                            selectedPin = foundPin
                            showActiveRoute = false // Reset route toggle on new pin select
                        } else {
                            // Only dismiss if we tapped outside the bottom card area
                            if (pressOffset.y < height - 260f) {
                                selectedPin = null
                            }
                        }
                    }
                }
        )

        // Floating Mode Indicator HUD
        Row(
            modifier = Modifier
                .align(Alignment.TopCenter)
                .padding(16.dp)
                .background(Color(0xFF1E293B).copy(alpha = 0.9f), RoundedCornerShape(20.dp))
                .border(1.dp, Color(0xFFFF6E00).copy(alpha = 0.5f), RoundedCornerShape(20.dp))
                .padding(horizontal = 14.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Icon(Icons.Default.CompassCalibration, contentDescription = null, tint = Color(0xFFFF6E00), modifier = Modifier.size(16.dp))
            Text(
                text = if (isOffline) "OFFLINE MAP ENGINE ACTIVE — PMTiles loaded" else "ONLINE MAP LAYOVER ACTIVE",
                color = Color.White,
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold
            )
        }

        // Bottom Detail Slide Up Panel
        AnimatedVisibility(
            visible = selectedPin != null,
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .padding(start = 16.dp, end = 16.dp, bottom = 100.dp) // Float above navigation bar
        ) {
            selectedPin?.let { pin ->
                Card(
                    colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B)),
                    shape = RoundedCornerShape(16.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .border(1.dp, Color(0xFF334155), RoundedCornerShape(16.dp))
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            // Title & Type Indicator
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                val (icon, tint) = when (pin.type) {
                                    "SHELTER" -> Pair(Icons.Default.LocationOn, Color(0xFF00FF66))
                                    "HOSPITAL" -> Pair(Icons.Default.LocalHospital, Color(0xFF00A3FF))
                                    "EMBASSY" -> Pair(Icons.Default.Star, Color(0xFFFFB900))
                                    else -> Pair(Icons.Default.LocationOn, Color.Gray)
                                }
                                Icon(icon, contentDescription = null, tint = tint)
                                Column {
                                    Text(pin.name, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                                    Text(pin.address, color = Color(0xFF94A3B8), fontSize = 12.sp)
                                }
                            }

                            // Distance Badge
                            Text(
                                text = pin.distance,
                                color = Color(0xFFFF6E00),
                                fontWeight = FontWeight.Bold,
                                fontSize = 14.sp
                            )
                        }

                        Spacer(modifier = Modifier.height(12.dp))

                        Row(
                            horizontalArrangement = Arrangement.spacedBy(16.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            // Capacity Badge
                            if (pin.capacity > 0) {
                                Box(
                                    modifier = Modifier
                                        .background(Color(0xFF334155), RoundedCornerShape(6.dp))
                                        .padding(horizontal = 8.dp, vertical = 4.dp)
                                ) {
                                    Text("Est. Capacity: ${pin.capacity}", color = Color.White, fontSize = 11.sp)
                                }
                            }

                            // Step-Free Badge
                            if (pin.stepFree) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                                    modifier = Modifier
                                        .background(Color(0xFF065F46), RoundedCornerShape(6.dp))
                                        .padding(horizontal = 8.dp, vertical = 4.dp)
                                ) {
                                    Icon(Icons.Default.Accessible, contentDescription = null, tint = Color(0xFF34D399), modifier = Modifier.size(12.dp))
                                    Text("Step-free Access", color = Color(0xFF34D399), fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
                                }
                            }
                        }

                        Spacer(modifier = Modifier.height(14.dp))

                        // Actions
                        Button(
                            onClick = { showActiveRoute = !showActiveRoute },
                            colors = ButtonDefaults.buttonColors(
                                containerColor = if (showActiveRoute) Color(0xFF475569) else Color(0xFFFF6E00)
                            ),
                            shape = RoundedCornerShape(8.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text(
                                text = if (showActiveRoute) "HIDE ROUTE" else "PLOT OFFLINE DIRECT ROUTE",
                                fontWeight = FontWeight.Bold,
                                fontSize = 13.sp,
                                color = Color.White
                            )
                        }
                    }
                }
            }
        }
    }
}
