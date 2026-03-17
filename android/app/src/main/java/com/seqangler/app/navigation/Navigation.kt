package com.seqangler.app.navigation

import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.seqangler.app.ui.screens.*
import com.seqangler.app.ui.theme.Primary

sealed class Screen(
    val route: String,
    val title: String,
    val selectedIcon: ImageVector,
    val unselectedIcon: ImageVector
) {
    data object Home : Screen("home", "Home", Icons.Filled.Home, Icons.Outlined.Home)
    data object Map : Screen("map", "Map", Icons.Filled.Map, Icons.Outlined.Map)
    data object Species : Screen("species", "Species", Icons.Filled.Pets, Icons.Outlined.Pets)
    data object Catches : Screen("catches", "Catches", Icons.Filled.PhotoCamera, Icons.Outlined.PhotoCamera)
    data object Profile : Screen("profile", "Profile", Icons.Filled.Person, Icons.Outlined.Person)
}

sealed class AuthScreen(val route: String) {
    data object Login : AuthScreen("login")
    data object Register : AuthScreen("register")
}

val bottomNavItems = listOf(
    Screen.Home,
    Screen.Map,
    Screen.Species,
    Screen.Catches,
    Screen.Profile
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SEQAnglerNavigation() {
    val navController = rememberNavController()
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentDestination = navBackStackEntry?.destination
    
    // Check if current route is a main tab route
    val showBottomBar = bottomNavItems.any { it.route == currentDestination?.route }
    
    Scaffold(
        bottomBar = {
            if (showBottomBar) {
                NavigationBar(
                    containerColor = MaterialTheme.colorScheme.surface
                ) {
                    bottomNavItems.forEach { screen ->
                        val selected = currentDestination?.hierarchy?.any { it.route == screen.route } == true
                        
                        NavigationBarItem(
                            icon = {
                                Icon(
                                    imageVector = if (selected) screen.selectedIcon else screen.unselectedIcon,
                                    contentDescription = screen.title
                                )
                            },
                            label = { Text(screen.title) },
                            selected = selected,
                            onClick = {
                                navController.navigate(screen.route) {
                                    popUpTo(navController.graph.findStartDestination().id) {
                                        saveState = true
                                    }
                                    launchSingleTop = true
                                    restoreState = true
                                }
                            },
                            colors = NavigationBarItemDefaults.colors(
                                selectedIconColor = Primary,
                                selectedTextColor = Primary,
                                indicatorColor = Primary.copy(alpha = 0.1f)
                            )
                        )
                    }
                }
            }
        }
    ) { innerPadding ->
        NavHost(
            navController = navController,
            startDestination = Screen.Home.route,
            modifier = Modifier.padding(innerPadding)
        ) {
            // Main tabs
            composable(Screen.Home.route) { HomeScreen(navController) }
            composable(Screen.Map.route) { MapScreen(navController) }
            composable(Screen.Species.route) { SpeciesScreen(navController) }
            composable(Screen.Catches.route) { CatchesScreen(navController) }
            composable(Screen.Profile.route) { ProfileScreen(navController) }
            
            // Auth screens
            composable(AuthScreen.Login.route) { LoginScreen(navController) }
            composable(AuthScreen.Register.route) { RegisterScreen(navController) }
        }
    }
}
