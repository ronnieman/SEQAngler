import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  useColorScheme,
  Platform,
  ActivityIndicator,
  ScrollView,
  TextInput,
  Modal,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import axios from 'axios';
import { API_URL, Colors, MapConfig } from '../constants/Config';
import { useAuth } from '../context/AuthContext';

interface Waypoint {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  type: 'start' | 'spot' | 'ramp' | 'custom' | 'end';
  notes?: string;
}

interface Trip {
  id: string;
  name: string;
  trip_date: string;
  waypoints: Waypoint[];
  notes?: string;
  checklist: string[];
  created_at: string;
}

interface FishingSpot {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  fish_types: string[];
  rating: number;
}

interface BoatRamp {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

interface GreenZone {
  id: string;
  name: string;
  zone_type: string;
  description: string;
  restrictions: string[];
  penalties: string;
  center_lat: number;
  center_lng: number;
  coordinates: { latitude: number; longitude: number }[];
  color: string;
}

// Generate trip planner map HTML
const generateTripMapHTML = (
  waypoints: Waypoint[],
  spots: FishingSpot[],
  ramps: BoatRamp[],
  greenZones: GreenZone[],
  userLocation: { latitude: number; longitude: number } | null,
  showSpots: boolean,
  showRamps: boolean,
  showGreenZones: boolean,
  trackingPath: { latitude: number; longitude: number }[],
  showSatellite: boolean
) => {
  // Draw green zones as polygons
  const greenZonesJS = showGreenZones ? greenZones.map(zone => {
    const coords = zone.coordinates.map(c => `[${c.latitude}, ${c.longitude}]`).join(',');
    return `
      L.polygon([${coords}], {
        color: '${zone.color}',
        fillColor: '${zone.color}',
        fillOpacity: 0.3,
        weight: 2
      }).addTo(map).bindPopup('<div style="max-width:250px"><b style="color:${zone.color};font-size:14px">🚫 ${zone.name}</b><br><span style="font-size:12px;color:#dc2626;font-weight:600">${zone.zone_type.toUpperCase()} ZONE</span><br><span style="font-size:11px;color:#666">${zone.restrictions.slice(0, 2).join(", ")}</span><br><span style="font-size:10px;color:#dc2626">⚠️ ${zone.penalties.substring(0, 50)}...</span></div>');
    `;
  }).join('\n') : '';

  // Draw waypoints
  const waypointsJS = waypoints.map((wp, idx) => {
    const color = wp.type === 'start' ? '#22c55e' : wp.type === 'end' ? '#ef4444' : '#f59e0b';
    const icon = wp.type === 'start' ? '🚀' : wp.type === 'end' ? '🏁' : wp.type === 'spot' ? '🐟' : wp.type === 'ramp' ? '⚓' : '📍';
    return `
      L.marker([${wp.latitude}, ${wp.longitude}], {
        icon: L.divIcon({
          className: 'waypoint-marker',
          html: '<div style="background-color: ${color}; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3); font-size: 18px;">${icon}</div>',
          iconSize: [36, 36],
          iconAnchor: [18, 18]
        })
      }).addTo(map).bindPopup('<b style="color:${color}">${idx + 1}. ${wp.name}</b>${wp.notes ? '<br><span style="font-size:12px;color:#666">' + wp.notes + '</span>' : ''}');
    `;
  }).join('\n');

  // Draw route line between waypoints
  const routeJS = waypoints.length > 1 ? `
    L.polyline([${waypoints.map(wp => `[${wp.latitude}, ${wp.longitude}]`).join(',')}], {
      color: '#3b82f6',
      weight: 4,
      opacity: 0.8,
      dashArray: '10, 10'
    }).addTo(map);
  ` : '';

  // Draw GPS tracking path
  const trackingPathJS = trackingPath.length > 1 ? `
    L.polyline([${trackingPath.map(p => `[${p.latitude}, ${p.longitude}]`).join(',')}], {
      color: '#10b981',
      weight: 3,
      opacity: 0.9
    }).addTo(map);
  ` : '';

  // Fishing spots
  const spotsJS = showSpots ? spots.map(spot => `
    L.circleMarker([${spot.latitude}, ${spot.longitude}], {
      radius: 8,
      fillColor: '#0ea5e9',
      color: '#fff',
      weight: 2,
      opacity: 1,
      fillOpacity: 0.8
    }).addTo(map).bindPopup('<b style="color:#0ea5e9">${spot.name}</b><br><span style="font-size:12px">${spot.fish_types.slice(0, 2).join(", ")}</span>');
  `).join('\n') : '';

  // Boat ramps
  const rampsJS = showRamps ? ramps.map(ramp => `
    L.circleMarker([${ramp.latitude}, ${ramp.longitude}], {
      radius: 8,
      fillColor: '#10b981',
      color: '#fff',
      weight: 2,
      opacity: 1,
      fillOpacity: 0.8
    }).addTo(map).bindPopup('<b style="color:#10b981">${ramp.name}</b>');
  `).join('\n') : '';

  // User location
  const userLocationJS = userLocation ? `
    // Pulsing accuracy circle
    L.circle([${userLocation.latitude}, ${userLocation.longitude}], {
      color: '#3b82f6',
      fillColor: '#93c5fd',
      fillOpacity: 0.15,
      radius: 300,
      weight: 1
    }).addTo(map);
    
    // User location marker with pulsing effect
    var userMarker = L.marker([${userLocation.latitude}, ${userLocation.longitude}], {
      icon: L.divIcon({
        className: 'user-marker',
        html: '<div style="position:relative;"><div style="position:absolute;top:-15px;left:-15px;width:30px;height:30px;background:rgba(59,130,246,0.3);border-radius:50%;animation:pulse 2s ease-out infinite;"></div><div style="position:absolute;top:-10px;left:-10px;width:20px;height:20px;background:#3b82f6;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4);"></div></div><style>@keyframes pulse{0%{transform:scale(1);opacity:1}100%{transform:scale(2.5);opacity:0}}</style>',
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      }),
      zIndexOffset: 1000
    }).addTo(map).bindPopup('<div style="text-align:center"><b style="color:#3b82f6;font-size:14px">📍 You Are Here</b><br><span style="font-size:11px;color:#666">Lat: ${userLocation.latitude.toFixed(5)}<br>Lng: ${userLocation.longitude.toFixed(5)}</span></div>');
  ` : '';

  const centerLat = userLocation?.latitude || (waypoints.length > 0 ? waypoints[0].latitude : MapConfig.defaultRegion.latitude);
  const centerLng = userLocation?.longitude || (waypoints.length > 0 ? waypoints[0].longitude : MapConfig.defaultRegion.longitude);

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>
        body { margin: 0; padding: 0; }
        #map { width: 100%; height: 100vh; }
        .waypoint-marker, .user-marker { background: transparent !important; border: none !important; }
        .leaflet-popup-content-wrapper { border-radius: 10px; }
        .leaflet-popup-content { margin: 10px 12px; font-family: -apple-system, BlinkMacSystemFont, sans-serif; }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        var map = L.map('map').setView([${centerLat}, ${centerLng}], 11);
        
        ${showSatellite ? `
        // Esri World Imagery (Satellite)
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
          attribution: '© Esri, Maxar, Earthstar Geographics',
          maxZoom: 19,
        }).addTo(map);
        
        // Add labels on top of satellite
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
          maxZoom: 19,
          opacity: 0.8
        }).addTo(map);
        ` : `
        // Base layer - OpenStreetMap
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap',
          maxZoom: 18,
        }).addTo(map);
        `}

        // OpenSeaMap nautical overlay (crowdsourced)
        L.tileLayer('https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png', {
          attribution: '© <a href="http://www.openseamap.org">OpenSeaMap</a>',
          maxZoom: 18,
          opacity: 1
        }).addTo(map);

        ${greenZonesJS}
        ${spotsJS}
        ${rampsJS}
        ${waypointsJS}
        ${routeJS}
        ${trackingPathJS}
        ${userLocationJS}
      </script>
    </body>
    </html>
  `;
};

export default function TripPlannerScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { isAuthenticated, token } = useAuth();

  const [spots, setSpots] = useState<FishingSpot[]>([]);
  const [ramps, setRamps] = useState<BoatRamp[]>([]);
  const [greenZones, setGreenZones] = useState<GreenZone[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Trip state
  const [tripName, setTripName] = useState('My Fishing Trip');
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [trackingPath, setTrackingPath] = useState<{ latitude: number; longitude: number }[]>([]);
  const [isTracking, setIsTracking] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [trips, setTrips] = useState<Trip[]>([]);
  
  // Filters
  const [showSpots, setShowSpots] = useState(true);
  const [showRamps, setShowRamps] = useState(true);
  const [showGreenZones, setShowGreenZones] = useState(true);
  const [showSatellite, setShowSatellite] = useState(false);

  const locationSubscription = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    fetchData();
    requestLocationPermission();
    if (isAuthenticated && token) {
      fetchTrips();
    }
    return () => {
      stopTracking();
    };
  }, []);

  const fetchData = async () => {
    try {
      const [spotsRes, rampsRes, zonesRes] = await Promise.all([
        axios.get(`${API_URL}/spots`),
        axios.get(`${API_URL}/boat-ramps`),
        axios.get(`${API_URL}/green-zones`),
      ]);
      setSpots(spotsRes.data);
      setRamps(rampsRes.data);
      setGreenZones(zonesRes.data);
    } catch (error) {
      console.log('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTrips = async () => {
    try {
      const response = await axios.get(`${API_URL}/trips`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTrips(response.data);
    } catch (error) {
      console.log('Error fetching trips:', error);
    }
  };

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({});
        setUserLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
      }
    } catch (error) {
      console.log('Location permission error:', error);
    }
  };

  const startTracking = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Location permission is needed for GPS tracking');
        return;
      }

      setIsTracking(true);
      setTrackingPath([]);

      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 5000,
          distanceInterval: 10,
        },
        (location) => {
          const newPoint = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          };
          setUserLocation(newPoint);
          setTrackingPath((prev) => [...prev, newPoint]);
        }
      );
    } catch (error) {
      console.log('Tracking error:', error);
      setIsTracking(false);
    }
  };

  const stopTracking = () => {
    if (locationSubscription.current) {
      locationSubscription.current.remove();
      locationSubscription.current = null;
    }
    setIsTracking(false);
  };

  const addWaypoint = (type: 'spot' | 'ramp' | 'current') => {
    if (type === 'current' && userLocation) {
      const newWaypoint: Waypoint = {
        id: Date.now().toString(),
        name: `Waypoint ${waypoints.length + 1}`,
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        type: waypoints.length === 0 ? 'start' : 'custom',
      };
      setWaypoints([...waypoints, newWaypoint]);
    }
    setShowAddModal(false);
  };

  const addSpotAsWaypoint = (spot: FishingSpot) => {
    const newWaypoint: Waypoint = {
      id: Date.now().toString(),
      name: spot.name,
      latitude: spot.latitude,
      longitude: spot.longitude,
      type: 'spot',
      notes: spot.fish_types.slice(0, 3).join(', '),
    };
    setWaypoints([...waypoints, newWaypoint]);
    setShowAddModal(false);
  };

  const addRampAsWaypoint = (ramp: BoatRamp) => {
    const newWaypoint: Waypoint = {
      id: Date.now().toString(),
      name: ramp.name,
      latitude: ramp.latitude,
      longitude: ramp.longitude,
      type: 'ramp',
    };
    setWaypoints([...waypoints, newWaypoint]);
    setShowAddModal(false);
  };

  const removeWaypoint = (id: string) => {
    setWaypoints(waypoints.filter((wp) => wp.id !== id));
  };

  const saveTrip = async () => {
    if (!isAuthenticated) {
      Alert.alert('Sign In Required', 'Please sign in to save your trip');
      router.push('/login');
      return;
    }

    if (waypoints.length === 0) {
      Alert.alert('No Waypoints', 'Add at least one waypoint to save the trip');
      return;
    }

    try {
      await axios.post(
        `${API_URL}/trips`,
        {
          name: tripName,
          trip_date: new Date().toISOString(),
          waypoints: waypoints,
          notes: '',
          checklist: [],
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      Alert.alert('Success', 'Trip saved successfully!');
      fetchTrips();
    } catch (error) {
      Alert.alert('Error', 'Failed to save trip');
    }
  };

  const clearTrip = () => {
    setWaypoints([]);
    setTrackingPath([]);
    setTripName('My Fishing Trip');
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading trip planner...</Text>
      </View>
    );
  }

  const mapHTML = generateTripMapHTML(waypoints, spots, ramps, greenZones, userLocation, showSpots, showRamps, showGreenZones, trackingPath, showSatellite);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>Plan Your Trip</Text>
        <Pressable onPress={saveTrip} style={styles.saveButton}>
          <Ionicons name="save" size={22} color="#fff" />
        </Pressable>
      </View>

      {/* Green Zones Warning */}
      {showGreenZones && greenZones.length > 0 && (
        <View style={[styles.warningBar, { backgroundColor: '#fef2f2' }]}>
          <Ionicons name="warning" size={18} color="#dc2626" />
          <Text style={styles.warningText}>
            {greenZones.filter(z => z.zone_type === 'green').length} QLD DPI Green Zones shown - NO FISHING
          </Text>
        </View>
      )}

      {/* Controls */}
      <View style={[styles.controls, { backgroundColor: colors.card }]}>
        {/* GPS Tracking Toggle */}
        <Pressable
          style={[styles.trackingButton, { backgroundColor: isTracking ? '#ef4444' : colors.accent }]}
          onPress={isTracking ? stopTracking : startTracking}
        >
          <Ionicons name={isTracking ? 'stop' : 'navigate'} size={18} color="#fff" />
          <Text style={styles.trackingButtonText}>{isTracking ? 'Stop' : 'Track GPS'}</Text>
        </Pressable>

        {/* Add Waypoint */}
        <Pressable
          style={[styles.addButton, { backgroundColor: colors.primary }]}
          onPress={() => setShowAddModal(true)}
        >
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.addButtonText}>Add Stop</Text>
        </Pressable>

        {/* Clear */}
        <Pressable
          style={[styles.clearButton, { backgroundColor: colors.background }]}
          onPress={clearTrip}
        >
          <Ionicons name="trash" size={18} color={colors.danger} />
        </Pressable>
      </View>

      {/* Filter Pills */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
        <Pressable
          style={[styles.filterPill, { backgroundColor: showSatellite ? '#059669' : colors.card }]}
          onPress={() => setShowSatellite(!showSatellite)}
        >
          <Text style={styles.filterEmoji}>🛰️</Text>
          <Text style={[styles.filterText, { color: showSatellite ? '#fff' : colors.text }]}>Satellite</Text>
        </Pressable>
        <Pressable
          style={[styles.filterPill, { backgroundColor: showGreenZones ? '#dc2626' : colors.card }]}
          onPress={() => setShowGreenZones(!showGreenZones)}
        >
          <Text style={styles.filterEmoji}>🚫</Text>
          <Text style={[styles.filterText, { color: showGreenZones ? '#fff' : colors.text }]}>Green Zones</Text>
        </Pressable>
        <Pressable
          style={[styles.filterPill, { backgroundColor: showSpots ? colors.primary : colors.card }]}
          onPress={() => setShowSpots(!showSpots)}
        >
          <Text style={styles.filterEmoji}>🐟</Text>
          <Text style={[styles.filterText, { color: showSpots ? '#fff' : colors.text }]}>Spots</Text>
        </Pressable>
        <Pressable
          style={[styles.filterPill, { backgroundColor: showRamps ? colors.accent : colors.card }]}
          onPress={() => setShowRamps(!showRamps)}
        >
          <Text style={styles.filterEmoji}>⚓</Text>
          <Text style={[styles.filterText, { color: showRamps ? '#fff' : colors.text }]}>Ramps</Text>
        </Pressable>
      </ScrollView>

      {/* Map */}
      <View style={styles.mapContainer}>
        {Platform.OS === 'web' ? (
          <iframe
            srcDoc={mapHTML}
            style={{ width: '100%', height: '100%', border: 'none' }}
            title="Trip Planner Map"
          />
        ) : (
          <View style={[styles.nativeMapFallback, { backgroundColor: '#e0f2fe' }]}>
            <Ionicons name="map" size={48} color={colors.primary} />
            <Text style={[styles.nativeMapText, { color: colors.primary }]}>Trip Planner Map</Text>
          </View>
        )}
      </View>

      {/* Waypoints List */}
      {waypoints.length > 0 && (
        <View style={[styles.waypointsList, { backgroundColor: colors.card }]}>
          <Text style={[styles.waypointsTitle, { color: colors.text }]}>
            Route ({waypoints.length} stops)
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {waypoints.map((wp, idx) => (
              <View key={wp.id} style={[styles.waypointChip, { backgroundColor: colors.background }]}>
                <Text style={styles.waypointNumber}>{idx + 1}</Text>
                <Text style={[styles.waypointName, { color: colors.text }]} numberOfLines={1}>
                  {wp.name}
                </Text>
                <Pressable onPress={() => removeWaypoint(wp.id)}>
                  <Ionicons name="close-circle" size={18} color={colors.danger} />
                </Pressable>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Tracking Info */}
      {isTracking && (
        <View style={[styles.trackingInfo, { backgroundColor: colors.accent }]}>
          <Ionicons name="radio" size={18} color="#fff" />
          <Text style={styles.trackingInfoText}>
            GPS Tracking Active • {trackingPath.length} points recorded
          </Text>
        </View>
      )}

      {/* Add Waypoint Modal */}
      <Modal visible={showAddModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Add Stop</Text>
              <Pressable onPress={() => setShowAddModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>

            {/* Current Location */}
            {userLocation && (
              <Pressable
                style={[styles.modalOption, { backgroundColor: colors.background }]}
                onPress={() => addWaypoint('current')}
              >
                <View style={[styles.modalOptionIcon, { backgroundColor: '#3b82f6' }]}>
                  <Ionicons name="locate" size={20} color="#fff" />
                </View>
                <View>
                  <Text style={[styles.modalOptionTitle, { color: colors.text }]}>Current Location</Text>
                  <Text style={[styles.modalOptionDesc, { color: colors.textSecondary }]}>
                    Add your current GPS position
                  </Text>
                </View>
              </Pressable>
            )}

            {/* Fishing Spots */}
            <Text style={[styles.modalSectionTitle, { color: colors.text }]}>Fishing Spots</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {spots.slice(0, 8).map((spot) => (
                <Pressable
                  key={spot.id}
                  style={[styles.spotChip, { backgroundColor: colors.background }]}
                  onPress={() => addSpotAsWaypoint(spot)}
                >
                  <Text style={styles.spotEmoji}>🐟</Text>
                  <Text style={[styles.spotName, { color: colors.text }]} numberOfLines={1}>
                    {spot.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            {/* Boat Ramps */}
            <Text style={[styles.modalSectionTitle, { color: colors.text }]}>Boat Ramps</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {ramps.slice(0, 8).map((ramp) => (
                <Pressable
                  key={ramp.id}
                  style={[styles.spotChip, { backgroundColor: colors.background }]}
                  onPress={() => addRampAsWaypoint(ramp)}
                >
                  <Text style={styles.spotEmoji}>⚓</Text>
                  <Text style={[styles.spotName, { color: colors.text }]} numberOfLines={1}>
                    {ramp.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerContent: { justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 16, fontSize: 16 },
  
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  saveButton: { padding: 4 },
  
  warningBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 8,
  },
  warningText: { fontSize: 12, color: '#dc2626', fontWeight: '600' },
  
  controls: {
    flexDirection: 'row',
    padding: 10,
    gap: 10,
    alignItems: 'center',
  },
  trackingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 20,
    gap: 6,
  },
  trackingButtonText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  addButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 20,
    gap: 6,
  },
  addButtonText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  clearButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  filterScroll: { flexGrow: 0, paddingHorizontal: 10, marginBottom: 8 },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    marginRight: 8,
    gap: 4,
  },
  filterEmoji: { fontSize: 14 },
  filterText: { fontSize: 12, fontWeight: '600' },
  
  mapContainer: { flex: 1 },
  nativeMapFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nativeMapText: { fontSize: 20, fontWeight: 'bold', marginTop: 12 },
  
  waypointsList: {
    padding: 12,
  },
  waypointsTitle: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  waypointChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginRight: 8,
    gap: 8,
  },
  waypointNumber: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#3b82f6',
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
    lineHeight: 22,
  },
  waypointName: { fontSize: 13, maxWidth: 100 },
  
  trackingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 8,
  },
  trackingInfoText: { color: '#fff', fontSize: 13, fontWeight: '500' },
  
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: { fontSize: 20, fontWeight: 'bold' },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    marginBottom: 12,
    gap: 12,
  },
  modalOptionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOptionTitle: { fontSize: 16, fontWeight: '600' },
  modalOptionDesc: { fontSize: 13, marginTop: 2 },
  modalSectionTitle: { fontSize: 14, fontWeight: '600', marginTop: 12, marginBottom: 10 },
  spotChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 20,
    marginRight: 8,
    gap: 6,
  },
  spotEmoji: { fontSize: 16 },
  spotName: { fontSize: 13, maxWidth: 120 },
});
