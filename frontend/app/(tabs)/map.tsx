import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  useColorScheme,
  Platform,
  ActivityIndicator,
  ScrollView,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { API_URL, Colors, MapConfig } from '../../constants/Config';

interface FishingSpot {
  id: string;
  name: string;
  description: string;
  latitude: number;
  longitude: number;
  fish_types: string[];
  best_time: string;
  difficulty: string;
  facilities: string[];
  rating: number;
}

interface BoatRamp {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  facilities: string[];
  parking_spaces: number;
  fee: boolean;
}

// Leaflet map HTML for WebView
const generateMapHTML = (spots: FishingSpot[], ramps: BoatRamp[], showSpots: boolean, showRamps: boolean) => {
  const spotsMarkers = showSpots ? spots.map(spot => `
    L.marker([${spot.latitude}, ${spot.longitude}], {
      icon: L.divIcon({
        className: 'custom-marker',
        html: '<div style="background-color: #0ea5e9; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3);"><span style="color: white; font-size: 14px;">🐟</span></div>',
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      })
    }).addTo(map).bindPopup('<b>${spot.name}</b><br>${spot.fish_types.slice(0, 3).join(", ")}<br>⭐ ${spot.rating.toFixed(1)}');
  `).join('\n') : '';

  const rampsMarkers = showRamps ? ramps.map(ramp => `
    L.marker([${ramp.latitude}, ${ramp.longitude}], {
      icon: L.divIcon({
        className: 'custom-marker',
        html: '<div style="background-color: #10b981; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3);"><span style="color: white; font-size: 14px;">⚓</span></div>',
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      })
    }).addTo(map).bindPopup('<b>${ramp.name}</b><br>Parking: ${ramp.parking_spaces} spaces<br>${ramp.fee ? "Fee required" : "Free"}');
  `).join('\n') : '';

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
        .custom-marker { background: transparent !important; border: none !important; }
        .leaflet-popup-content-wrapper { border-radius: 8px; }
        .leaflet-popup-content { margin: 10px 12px; font-family: -apple-system, BlinkMacSystemFont, sans-serif; }
        .leaflet-popup-content b { color: #0ea5e9; }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        var map = L.map('map').setView([${MapConfig.defaultRegion.latitude}, ${MapConfig.defaultRegion.longitude}], 10);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors',
          maxZoom: 18,
        }).addTo(map);

        ${spotsMarkers}
        ${rampsMarkers}
      </script>
    </body>
    </html>
  `;
};

export default function MapScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const [spots, setSpots] = useState<FishingSpot[]>([]);
  const [ramps, setRamps] = useState<BoatRamp[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSpots, setShowSpots] = useState(true);
  const [showRamps, setShowRamps] = useState(true);
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');

  useEffect(() => {
    fetchMapData();
  }, []);

  const fetchMapData = async () => {
    try {
      const [spotsRes, rampsRes] = await Promise.all([
        axios.get(`${API_URL}/spots`),
        axios.get(`${API_URL}/boat-ramps`),
      ]);
      setSpots(spotsRes.data);
      setRamps(rampsRes.data);
    } catch (error) {
      console.log('Error fetching map data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading map data...
        </Text>
      </View>
    );
  }

  const mapHTML = generateMapHTML(spots, ramps, showSpots, showRamps);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* View Toggle & Filters */}
      <View style={[styles.controlsContainer, { backgroundColor: colors.card }]}>
        {/* View Mode Toggle */}
        <View style={styles.viewToggle}>
          <Pressable
            style={[
              styles.viewToggleBtn,
              viewMode === 'map' && { backgroundColor: colors.primary },
            ]}
            onPress={() => setViewMode('map')}
          >
            <Ionicons 
              name="map" 
              size={18} 
              color={viewMode === 'map' ? '#ffffff' : colors.text} 
            />
            <Text style={[
              styles.viewToggleText,
              { color: viewMode === 'map' ? '#ffffff' : colors.text }
            ]}>Map</Text>
          </Pressable>
          <Pressable
            style={[
              styles.viewToggleBtn,
              viewMode === 'list' && { backgroundColor: colors.primary },
            ]}
            onPress={() => setViewMode('list')}
          >
            <Ionicons 
              name="list" 
              size={18} 
              color={viewMode === 'list' ? '#ffffff' : colors.text} 
            />
            <Text style={[
              styles.viewToggleText,
              { color: viewMode === 'list' ? '#ffffff' : colors.text }
            ]}>List</Text>
          </Pressable>
        </View>

        {/* Filter Buttons */}
        <View style={styles.filterRow}>
          <Pressable
            style={[
              styles.filterButton,
              { backgroundColor: showSpots ? colors.primary : colors.background },
            ]}
            onPress={() => setShowSpots(!showSpots)}
          >
            <Ionicons
              name="fish"
              size={16}
              color={showSpots ? '#ffffff' : colors.text}
            />
            <Text style={[styles.filterText, { color: showSpots ? '#ffffff' : colors.text }]}>
              Spots ({spots.length})
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.filterButton,
              { backgroundColor: showRamps ? colors.accent : colors.background },
            ]}
            onPress={() => setShowRamps(!showRamps)}
          >
            <Ionicons
              name="boat"
              size={16}
              color={showRamps ? '#ffffff' : colors.text}
            />
            <Text style={[styles.filterText, { color: showRamps ? '#ffffff' : colors.text }]}>
              Ramps ({ramps.length})
            </Text>
          </Pressable>
        </View>
      </View>

      {viewMode === 'map' ? (
        /* Interactive Map using iframe for web */
        <View style={styles.mapContainer}>
          {Platform.OS === 'web' ? (
            <iframe
              srcDoc={mapHTML}
              style={{ width: '100%', height: '100%', border: 'none' }}
              title="Fishing Map"
            />
          ) : (
            /* For native, show a simplified map view */
            <View style={[styles.nativeMapContainer, { backgroundColor: '#e0f2fe' }]}>
              <Ionicons name="map" size={48} color={colors.primary} />
              <Text style={[styles.nativeMapText, { color: colors.primary }]}>
                Interactive Map
              </Text>
              <Text style={[styles.nativeMapSubtext, { color: colors.textSecondary }]}>
                {spots.length} Fishing Spots • {ramps.length} Boat Ramps
              </Text>
              <Text style={[styles.nativeMapHint, { color: colors.textSecondary }]}>
                Tap on a location below to view details
              </Text>
            </View>
          )}
        </View>
      ) : (
        /* List View */
        <ScrollView style={styles.listScrollView}>
          {/* Fishing Spots Section */}
          {showSpots && (
            <View style={[styles.listSection, { backgroundColor: colors.card }]}>
              <View style={styles.sectionHeader}>
                <Ionicons name="fish" size={20} color={colors.primary} />
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  Fishing Spots
                </Text>
              </View>
              {spots.map((spot) => (
                <Pressable
                  key={spot.id}
                  style={[styles.listItem, { borderBottomColor: colors.border }]}
                  onPress={() => router.push(`/spot/${spot.id}`)}
                >
                  <View style={styles.listItemContent}>
                    <View style={[styles.marker, { backgroundColor: colors.primary }]}>
                      <Text style={styles.markerEmoji}>🐟</Text>
                    </View>
                    <View style={styles.listItemInfo}>
                      <Text style={[styles.listItemName, { color: colors.text }]}>
                        {spot.name}
                      </Text>
                      <Text style={[styles.listItemDesc, { color: colors.textSecondary }]}>
                        {spot.fish_types.slice(0, 3).join(', ')}
                      </Text>
                      <View style={styles.listItemMeta}>
                        <View style={styles.ratingBadge}>
                          <Ionicons name="star" size={12} color="#f59e0b" />
                          <Text style={styles.ratingText}>{spot.rating.toFixed(1)}</Text>
                        </View>
                        <Text style={[styles.difficultyText, { color: colors.textSecondary }]}>
                          {spot.difficulty}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                </Pressable>
              ))}
            </View>
          )}

          {/* Boat Ramps Section */}
          {showRamps && (
            <View style={[styles.listSection, { backgroundColor: colors.card }]}>
              <View style={styles.sectionHeader}>
                <Ionicons name="boat" size={20} color={colors.accent} />
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  Boat Ramps
                </Text>
              </View>
              {ramps.map((ramp) => (
                <Pressable
                  key={ramp.id}
                  style={[styles.listItem, { borderBottomColor: colors.border }]}
                  onPress={() => {
                    // Could navigate to ramp detail if implemented
                  }}
                >
                  <View style={styles.listItemContent}>
                    <View style={[styles.marker, { backgroundColor: colors.accent }]}>
                      <Text style={styles.markerEmoji}>⚓</Text>
                    </View>
                    <View style={styles.listItemInfo}>
                      <Text style={[styles.listItemName, { color: colors.text }]}>
                        {ramp.name}
                      </Text>
                      <Text style={[styles.listItemDesc, { color: colors.textSecondary }]}>
                        {ramp.parking_spaces} parking spaces
                      </Text>
                      <View style={styles.listItemMeta}>
                        <View style={[
                          styles.feeBadge,
                          { backgroundColor: ramp.fee ? '#fef3c7' : '#dcfce7' }
                        ]}>
                          <Text style={[
                            styles.feeText,
                            { color: ramp.fee ? '#b45309' : '#15803d' }
                          ]}>
                            {ramp.fee ? 'Fee required' : 'Free'}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>
                </Pressable>
              ))}
            </View>
          )}

          <View style={{ height: 20 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  controlsContainer: {
    padding: 12,
    gap: 10,
  },
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: '#e5e7eb',
    borderRadius: 8,
    padding: 4,
  },
  viewToggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 6,
    gap: 6,
  },
  viewToggleText: {
    fontSize: 14,
    fontWeight: '600',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 10,
  },
  filterButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    gap: 6,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '600',
  },
  mapContainer: {
    flex: 1,
  },
  nativeMapContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  nativeMapText: {
    fontSize: 22,
    fontWeight: 'bold',
    marginTop: 12,
  },
  nativeMapSubtext: {
    fontSize: 14,
    marginTop: 4,
  },
  nativeMapHint: {
    fontSize: 12,
    marginTop: 16,
    fontStyle: 'italic',
  },
  listScrollView: {
    flex: 1,
  },
  listSection: {
    margin: 12,
    marginBottom: 0,
    borderRadius: 12,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 12,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  listItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  marker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  markerEmoji: {
    fontSize: 18,
  },
  listItemInfo: {
    flex: 1,
  },
  listItemName: {
    fontSize: 16,
    fontWeight: '500',
  },
  listItemDesc: {
    fontSize: 13,
    marginTop: 2,
  },
  listItemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 8,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    gap: 4,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#b45309',
  },
  difficultyText: {
    fontSize: 12,
    textTransform: 'capitalize',
  },
  feeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  feeText: {
    fontSize: 12,
    fontWeight: '500',
  },
});
