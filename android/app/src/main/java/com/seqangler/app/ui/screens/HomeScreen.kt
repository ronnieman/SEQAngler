package com.seqangler.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavController
import com.seqangler.app.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    navController: NavController,
    viewModel: HomeViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    
    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("🎣", fontSize = 24.sp)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            "SEQ Angler",
                            fontWeight = FontWeight.Bold
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = Primary,
                    titleContentColor = Color.White
                )
            )
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .verticalScroll(rememberScrollState())
                .background(MaterialTheme.colorScheme.background)
        ) {
            // Fishing Score Card
            FishingScoreCard(
                score = uiState.fishingScore,
                summary = uiState.conditionsSummary,
                bestTime = uiState.bestTimeToday
            )
            
            // Current Conditions
            CurrentConditionsCard(
                temperature = uiState.temperature,
                windSpeed = uiState.windSpeed,
                windDirection = uiState.windDirection,
                humidity = uiState.humidity,
                uvIndex = uiState.uvIndex
            )
            
            // 7-Day Forecast
            SevenDayForecastCard(forecast = uiState.forecast)
            
            // 7-Day Tides
            SevenDayTidesCard(tides = uiState.tides)
            
            // Quick Actions
            QuickActionsCard(navController = navController)
            
            Spacer(modifier = Modifier.height(16.dp))
        }
    }
}

@Composable
private fun FishingScoreCard(
    score: Int,
    summary: String,
    bestTime: String
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 4.dp)
    ) {
        Column(
            modifier = Modifier.padding(20.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = "Today's Fishing Score",
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)
            )
            
            Spacer(modifier = Modifier.height(12.dp))
            
            // Score Circle
            Box(
                modifier = Modifier
                    .size(100.dp)
                    .clip(CircleShape)
                    .background(
                        when {
                            score >= 80 -> RatingExcellent
                            score >= 60 -> RatingGood
                            score >= 40 -> RatingFair
                            else -> RatingPoor
                        }
                    ),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "$score",
                    fontSize = 36.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.White
                )
            }
            
            Spacer(modifier = Modifier.height(12.dp))
            
            Text(
                text = when {
                    score >= 80 -> "Excellent Conditions!"
                    score >= 60 -> "Good Conditions"
                    score >= 40 -> "Fair Conditions"
                    else -> "Poor Conditions"
                },
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.SemiBold,
                color = when {
                    score >= 80 -> RatingExcellent
                    score >= 60 -> RatingGood
                    score >= 40 -> RatingFair
                    else -> RatingPoor
                }
            )
            
            Spacer(modifier = Modifier.height(8.dp))
            
            Text(
                text = summary,
                style = MaterialTheme.typography.bodyMedium,
                textAlign = TextAlign.Center,
                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)
            )
            
            if (bestTime.isNotEmpty()) {
                Spacer(modifier = Modifier.height(12.dp))
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier
                        .background(Primary.copy(alpha = 0.1f), RoundedCornerShape(8.dp))
                        .padding(horizontal = 12.dp, vertical = 8.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.AccessTime,
                        contentDescription = null,
                        tint = Primary,
                        modifier = Modifier.size(18.dp)
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = "Best Time: $bestTime",
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.Medium,
                        color = Primary
                    )
                }
            }
        }
    }
}

@Composable
private fun CurrentConditionsCard(
    temperature: Double,
    windSpeed: Double,
    windDirection: String,
    humidity: Int,
    uvIndex: Int
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = "Current Conditions",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold
            )
            
            Spacer(modifier = Modifier.height(12.dp))
            
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly
            ) {
                ConditionItem(icon = "🌡️", value = "${temperature.toInt()}°C", label = "Temp")
                ConditionItem(icon = "💨", value = "${windSpeed.toInt()} km/h", label = windDirection)
                ConditionItem(icon = "💧", value = "$humidity%", label = "Humidity")
                ConditionItem(icon = "☀️", value = "$uvIndex", label = "UV Index")
            }
        }
    }
}

@Composable
private fun ConditionItem(icon: String, value: String, label: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(text = icon, fontSize = 24.sp)
        Spacer(modifier = Modifier.height(4.dp))
        Text(
            text = value,
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold
        )
        Text(
            text = label,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
        )
    }
}

@Composable
private fun SevenDayForecastCard(forecast: List<DayForecast>) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = Icons.Default.CalendarMonth,
                    contentDescription = null,
                    tint = Primary
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "7-Day Forecast",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold
                )
            }
            
            Spacer(modifier = Modifier.height(12.dp))
            
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                forecast.forEachIndexed { index, day ->
                    ForecastDayItem(
                        day = day,
                        isToday = index == 0
                    )
                }
            }
        }
    }
}

@Composable
private fun ForecastDayItem(day: DayForecast, isToday: Boolean) {
    Column(
        modifier = Modifier
            .width(72.dp)
            .background(
                if (isToday) Primary.copy(alpha = 0.1f) else Color.Transparent,
                RoundedCornerShape(12.dp)
            )
            .padding(vertical = 12.dp, horizontal = 8.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(
            text = if (isToday) "Today" else day.dayName,
            style = MaterialTheme.typography.labelMedium,
            fontWeight = if (isToday) FontWeight.Bold else FontWeight.Normal
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(text = day.icon, fontSize = 28.sp)
        Spacer(modifier = Modifier.height(4.dp))
        Text(
            text = "${day.tempMax.toInt()}°",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold
        )
        Text(
            text = "${day.tempMin.toInt()}°",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
        )
        Spacer(modifier = Modifier.height(4.dp))
        Box(
            modifier = Modifier
                .size(24.dp)
                .background(
                    when (day.fishingRating) {
                        "Excellent" -> RatingExcellent
                        "Good" -> RatingGood
                        "Fair" -> RatingFair
                        else -> RatingPoor
                    },
                    CircleShape
                ),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = when (day.fishingRating) {
                    "Excellent" -> "🎣"
                    "Good" -> "✓"
                    else -> "~"
                },
                fontSize = 12.sp,
                color = Color.White
            )
        }
    }
}

@Composable
private fun SevenDayTidesCard(tides: List<DayTides>) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = Icons.Default.Waves,
                    contentDescription = null,
                    tint = Color(0xFF0891B2)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "7-Day Tides",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold
                )
            }
            
            Spacer(modifier = Modifier.height(12.dp))
            
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                tides.forEachIndexed { index, day ->
                    TideDayItem(day = day, isToday = index == 0)
                }
            }
        }
    }
}

@Composable
private fun TideDayItem(day: DayTides, isToday: Boolean) {
    Column(
        modifier = Modifier
            .width(85.dp)
            .background(
                if (isToday) Color(0xFF0891B2).copy(alpha = 0.1f) else Color.Transparent,
                RoundedCornerShape(12.dp)
            )
            .padding(vertical = 10.dp, horizontal = 8.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(
            text = if (isToday) "Today" else day.dayName,
            style = MaterialTheme.typography.labelMedium,
            fontWeight = if (isToday) FontWeight.Bold else FontWeight.Normal
        )
        Text(
            text = day.moonPhase,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
        )
        Spacer(modifier = Modifier.height(4.dp))
        day.tides.take(4).forEach { tide ->
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.padding(vertical = 2.dp)
            ) {
                Text(
                    text = if (tide.type == "high") "▲" else "▼",
                    fontSize = 10.sp,
                    color = if (tide.type == "high") Color(0xFF0891B2) else Color.Gray
                )
                Spacer(modifier = Modifier.width(4.dp))
                Text(
                    text = tide.time,
                    style = MaterialTheme.typography.labelSmall,
                    fontWeight = FontWeight.Medium
                )
                Spacer(modifier = Modifier.width(2.dp))
                Text(
                    text = "${tide.height}m",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
                )
            }
        }
    }
}

@Composable
private fun QuickActionsCard(navController: NavController) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = "Quick Actions",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold
            )
            
            Spacer(modifier = Modifier.height(12.dp))
            
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly
            ) {
                QuickActionButton(
                    icon = Icons.Default.Map,
                    label = "Map",
                    onClick = { navController.navigate("map") }
                )
                QuickActionButton(
                    icon = Icons.Default.Pets,
                    label = "Species",
                    onClick = { navController.navigate("species") }
                )
                QuickActionButton(
                    icon = Icons.Default.PhotoCamera,
                    label = "Log Catch",
                    onClick = { navController.navigate("catches") }
                )
            }
        }
    }
}

@Composable
private fun QuickActionButton(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    label: String,
    onClick: () -> Unit
) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier
            .clip(RoundedCornerShape(12.dp))
            .background(Primary.copy(alpha = 0.1f))
            .padding(16.dp)
    ) {
        IconButton(onClick = onClick) {
            Icon(
                imageVector = icon,
                contentDescription = label,
                tint = Primary,
                modifier = Modifier.size(32.dp)
            )
        }
        Text(
            text = label,
            style = MaterialTheme.typography.labelMedium,
            color = Primary
        )
    }
}

// Data classes for UI state
data class DayForecast(
    val dayName: String,
    val icon: String,
    val tempMax: Double,
    val tempMin: Double,
    val fishingRating: String
)

data class TideInfo(
    val time: String,
    val height: Double,
    val type: String
)

data class DayTides(
    val dayName: String,
    val moonPhase: String,
    val tides: List<TideInfo>
)
