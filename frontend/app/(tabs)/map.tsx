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
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
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
  depth?: number;
  bottom_type?: string;
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

interface ChannelMarker {
  id: string;
  name: string;
  marker_type: string;
  latitude: number;
  longitude: number;
  description: string;
  light_characteristics: string;
  color: string;
  shape: string;
}

interface MoonPhase {
  phase: string;
  illumination: number;
  phase_icon: string;
  days_until_full: number;
  days_until_new: number;
  fishing_rating: string;
  fishing_tip: string;
}

interface TidalFlow {
  current_speed: number;
  current_direction: string;
  flow_state: string;
  water_temp: number;
  visibility: string;
}

interface Solunar {
  major_one_start: string;
  major_one_end: string;
  major_two_start: string;
  major_two_end: string;
  minor_one_start: string;
  minor_one_end: string;
  minor_two_start: string;
  minor_two_end: string;
  rating: string;
  best_time: string;
}

interface Tides {
  high_tide_time: string;
  high_tide_height: number;
  low_tide_time: string;
  low_tide_height: number;
  next_high: string;
  next_low: string;
}

interface DepthContour {
  depth: number;
  coordinates: number[][];
}

// Generate map HTML with all features
const generateMapHTML = (
  spots: FishingSpot[],
  ramps: BoatRamp[],
  markers: ChannelMarker[],
  depthContours: DepthContour[],
  userLocation: { latitude: number; longitude: number } | null,
  showSpots: boolean,
  showRamps: boolean,
  showMarkers: boolean,
  showDepth: boolean,
  showSeaMap: boolean,
  showSatellite: boolean
) => {
  const spotsMarkersJS = showSpots ? spots.map(spot => `
    L.marker([${spot.latitude}, ${spot.longitude}], {
      icon: L.divIcon({
        className: 'custom-marker',
        html: '<div style="background-color: #0ea5e9; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3); font-size: 16px;">🐟</div>',
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      })
    }).addTo(map).bindPopup('<div style="min-width:150px"><b style="color:#0ea5e9;font-size:14px">${spot.name}</b><br><span style="color:#666;font-size:12px">${spot.fish_types.slice(0, 3).join(", ")}</span><br><span style="font-size:12px">⭐ ${spot.rating.toFixed(1)} | ${spot.depth || 'N/A'}m depth</span></div>');
  `).join('\n') : '';

  const rampsMarkersJS = showRamps ? ramps.map(ramp => `
    L.marker([${ramp.latitude}, ${ramp.longitude}], {
      icon: L.divIcon({
        className: 'custom-marker',
        html: '<div style="background-color: #10b981; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3); font-size: 16px;">⚓</div>',
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      })
    }).addTo(map).bindPopup('<div style="min-width:140px"><b style="color:#10b981;font-size:14px">${ramp.name}</b><br><span style="font-size:12px">🅿️ ${ramp.parking_spaces} spaces</span><br><span style="font-size:12px">${ramp.fee ? '💰 Fee required' : '✅ Free'}</span></div>');
  `).join('\n') : '';

  const getMarkerColor = (type: string, color: string) => {
    if (type === 'port') return '#dc2626';
    if (type === 'starboard') return '#22c55e';
    if (type.includes('cardinal')) return '#eab308';
    if (type === 'special') return '#f59e0b';
    if (type === 'isolated_danger') return '#dc2626';
    return '#6b7280';
  };

  const getMarkerSymbol = (type: string) => {
    if (type === 'port') return '◼';
    if (type === 'starboard') return '▲';
    if (type.includes('cardinal_north')) return '▲▲';
    if (type.includes('cardinal_south')) return '▼▼';
    if (type.includes('cardinal_east')) return '▶▶';
    if (type.includes('cardinal_west')) return '◀◀';
    if (type === 'special') return '⚠';
    if (type === 'isolated_danger') return '⚠';
    return '●';
  };

  const channelMarkersJS = showMarkers ? markers.map(m => `
    L.marker([${m.latitude}, ${m.longitude}], {
      icon: L.divIcon({
        className: 'channel-marker',
        html: '<div style="background-color: ${getMarkerColor(m.marker_type, m.color)}; width: 24px; height: 24px; border-radius: ${m.shape === 'can' ? '4px' : '50%'}; display: flex; align-items: center; justify-content: center; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3); color: white; font-size: 10px; font-weight: bold;">${getMarkerSymbol(m.marker_type)}</div>',
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      })
    }).addTo(map).bindPopup('<div style="min-width:160px"><b style="color:${getMarkerColor(m.marker_type, m.color)};font-size:13px">${m.name}</b><br><span style="font-size:11px;color:#666">${m.description}</span><br><span style="font-size:10px">💡 ${m.light_characteristics}</span></div>');
  `).join('\n') : '';

  const depthContoursJS = showDepth ? depthContours.map(contour => `
    L.polyline([${contour.coordinates.map(c => `[${c[0]}, ${c[1]}]`).join(',')}], {
      color: '${contour.depth <= 5 ? '#93c5fd' : contour.depth <= 10 ? '#60a5fa' : contour.depth <= 20 ? '#3b82f6' : contour.depth <= 30 ? '#2563eb' : '#1d4ed8'}',
      weight: 2,
      opacity: 0.7,
      dashArray: '5, 5'
    }).addTo(map).bindPopup('Depth: ${contour.depth}m');
  `).join('\n') : '';

  const depthLabelsJS = showDepth ? depthContours.map(contour => {
    const midIdx = Math.floor(contour.coordinates.length / 2);
    const midPoint = contour.coordinates[midIdx];
    return `
    L.marker([${midPoint[0]}, ${midPoint[1]}], {
      icon: L.divIcon({
        className: 'depth-label',
        html: '<div style="background: rgba(59,130,246,0.9); color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; white-space: nowrap;">${contour.depth}m</div>',
        iconSize: [40, 20],
        iconAnchor: [20, 10]
      })
    }).addTo(map);
  `;
  }).join('\n') : '';

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
    
    // Open popup by default
    userMarker.openPopup();
  ` : '';

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
        .custom-marker, .channel-marker, .depth-label, .user-marker { background: transparent !important; border: none !important; }
        .leaflet-popup-content-wrapper { border-radius: 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
        .leaflet-popup-content { margin: 12px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        var map = L.map('map', {
          zoomControl: true
        }).setView([${userLocation ? userLocation.latitude : MapConfig.defaultRegion.latitude}, ${userLocation ? userLocation.longitude : MapConfig.defaultRegion.longitude}], ${userLocation ? 12 : 10});
        
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
        var osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap',
          maxZoom: 18,
        }).addTo(map);
        `}

        // OpenSeaMap nautical overlay (crowdsourced)
        ${showSeaMap ? `
        var seamarkLayer = L.tileLayer('https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png', {
          attribution: '© <a href="http://www.openseamap.org">OpenSeaMap</a> contributors',
          maxZoom: 18,
          opacity: 1
        }).addTo(map);
        ` : ''}

        ${depthContoursJS}
        ${depthLabelsJS}
        ${spotsMarkersJS}
        ${rampsMarkersJS}
        ${channelMarkersJS}
        ${userLocationJS}
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
  const [channelMarkers, setChannelMarkers] = useState<ChannelMarker[]>([]);
  const [depthContours, setDepthContours] = useState<DepthContour[]>([]);
  const [moonPhase, setMoonPhase] = useState<MoonPhase | null>(null);
  const [tidalFlow, setTidalFlow] = useState<TidalFlow | null>(null);
  const [solunar, setSolunar] = useState<Solunar | null>(null);
  const [tides, setTides] = useState<Tides | null>(null);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [gpsLoading, setGpsLoading] = useState(false);

  // Filter states
  const [showSpots, setShowSpots] = useState(true);
  const [showRamps, setShowRamps] = useState(true);
  const [showMarkers, setShowMarkers] = useState(true);
  const [showDepth, setShowDepth] = useState(true);
  const [showSeaMap, setShowSeaMap] = useState(true);
  const [showSatellite, setShowSatellite] = useState(false);
  const [viewMode, setViewMode] = useState<'map' | 'info'>('map');

  useEffect(() => {
    fetchAllData();
    requestLocationPermission();
  }, []);

  const fetchAllData = async () => {
    try {
      const [spotsRes, rampsRes, markersRes, depthRes, moonRes, flowRes, solunarRes, tidesRes] = await Promise.all([
        axios.get(`${API_URL}/spots/depths`),
        axios.get(`${API_URL}/boat-ramps`),
        axios.get(`${API_URL}/channel-markers`),
        axios.get(`${API_URL}/bathymetry/contours`),
        axios.get(`${API_URL}/moon-phase`),
        axios.get(`${API_URL}/tidal-flow`),
        axios.get(`${API_URL}/solunar`),
        axios.get(`${API_URL}/tides`),
      ]);
      setSpots(spotsRes.data);
      setRamps(rampsRes.data);
      setChannelMarkers(markersRes.data);
      setDepthContours(depthRes.data.contours || []);
      setMoonPhase(moonRes.data);
      setTidalFlow(flowRes.data);
      setSolunar(solunarRes.data);
      setTides(tidesRes.data);
    } catch (error) {
      console.log('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        getCurrentLocation();
      }
    } catch (error) {
      console.log('Location permission error:', error);
    }
  };

  const getCurrentLocation = async () => {
    setGpsLoading(true);
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setUserLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
    } catch (error) {
      console.log('Location error:', error);
    } finally {
      setGpsLoading(false);
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

  const mapHTML = generateMapHTML(spots, ramps, channelMarkers, depthContours, userLocation, showSpots, showRamps, showMarkers, showDepth, showSeaMap, showSatellite);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top Info Bar - Moon, Tides, Current */}
      <View style={[styles.infoBar, { backgroundColor: colors.card }]}>
        <View style={styles.infoItem}>
          <Text style={styles.infoIcon}>{moonPhase?.phase_icon || '🌙'}</Text>
          <View>
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Moon</Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>{moonPhase?.phase || 'Loading'}</Text>
          </View>
        </View>
        <View style={[styles.infoDivider, { backgroundColor: colors.border }]} />
        <View style={styles.infoItem}>
          <Text style={styles.infoIcon}>🌊</Text>
          <View>
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Flow</Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>{tidalFlow?.flow_state || 'N/A'} {tidalFlow?.current_speed}kn</Text>
          </View>
        </View>
        <View style={[styles.infoDivider, { backgroundColor: colors.border }]} />
        <View style={styles.infoItem}>
          <Text style={styles.infoIcon}>📍</Text>
          <View>
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Depth</Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>{tidalFlow?.water_temp || 'N/A'}°C</Text>
          </View>
        </View>
      </View>

      {/* View Toggle & Filters */}
      <View style={[styles.controlsContainer, { backgroundColor: colors.card }]}>
        <View style={styles.viewToggle}>
          <Pressable
            style={[styles.viewToggleBtn, viewMode === 'map' && { backgroundColor: colors.primary }]}
            onPress={() => setViewMode('map')}
          >
            <Ionicons name="map" size={16} color={viewMode === 'map' ? '#fff' : colors.text} />
            <Text style={[styles.viewToggleText, { color: viewMode === 'map' ? '#fff' : colors.text }]}>Map</Text>
          </Pressable>
          <Pressable
            style={[styles.viewToggleBtn, viewMode === 'info' && { backgroundColor: colors.primary }]}
            onPress={() => setViewMode('info')}
          >
            <Ionicons name="analytics" size={16} color={viewMode === 'info' ? '#fff' : colors.text} />
            <Text style={[styles.viewToggleText, { color: viewMode === 'info' ? '#fff' : colors.text }]}>Conditions</Text>
          </Pressable>
        </View>

        {/* GPS Button - My Location */}
        <Pressable
          style={[styles.gpsButton, { backgroundColor: userLocation ? '#22c55e' : colors.card, borderWidth: 2, borderColor: userLocation ? '#16a34a' : colors.border }]}
          onPress={getCurrentLocation}
        >
          {gpsLoading ? (
            <ActivityIndicator size="small" color={userLocation ? '#fff' : colors.primary} />
          ) : (
            <>
              <Ionicons name={userLocation ? "navigate" : "locate-outline"} size={18} color={userLocation ? '#fff' : colors.primary} />
              <Text style={[styles.gpsButtonText, { color: userLocation ? '#fff' : colors.primary }]}>
                {userLocation ? 'Located' : 'My Location'}
              </Text>
            </>
          )}
        </Pressable>
      </View>

      {viewMode === 'map' ? (
        <>
          {/* Filter Pills */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterScrollContent}>
            <Pressable
              style={[styles.filterPill, { backgroundColor: showSatellite ? '#7c3aed' : colors.card }]}
              onPress={() => setShowSatellite(!showSatellite)}
            >
              <Text style={styles.filterEmoji}>🛰️</Text>
              <Text style={[styles.filterPillText, { color: showSatellite ? '#fff' : colors.text }]}>Satellite</Text>
            </Pressable>
            <Pressable
              style={[styles.filterPill, { backgroundColor: showSeaMap ? '#0891b2' : colors.card }]}
              onPress={() => setShowSeaMap(!showSeaMap)}
            >
              <Text style={styles.filterEmoji}>⛵</Text>
              <Text style={[styles.filterPillText, { color: showSeaMap ? '#fff' : colors.text }]}>SeaMap</Text>
            </Pressable>
            <Pressable
              style={[styles.filterPill, { backgroundColor: showSpots ? colors.primary : colors.card }]}
              onPress={() => setShowSpots(!showSpots)}
            >
              <Text style={styles.filterEmoji}>🐟</Text>
              <Text style={[styles.filterPillText, { color: showSpots ? '#fff' : colors.text }]}>Spots</Text>
            </Pressable>
            <Pressable
              style={[styles.filterPill, { backgroundColor: showRamps ? '#10b981' : colors.card }]}
              onPress={() => setShowRamps(!showRamps)}
            >
              <Text style={styles.filterEmoji}>⚓</Text>
              <Text style={[styles.filterPillText, { color: showRamps ? '#fff' : colors.text }]}>Ramps</Text>
            </Pressable>
            <Pressable
              style={[styles.filterPill, { backgroundColor: showMarkers ? '#f59e0b' : colors.card }]}
              onPress={() => setShowMarkers(!showMarkers)}
            >
              <Text style={styles.filterEmoji}>🚩</Text>
              <Text style={[styles.filterPillText, { color: showMarkers ? '#fff' : colors.text }]}>Channel</Text>
            </Pressable>
            <Pressable
              style={[styles.filterPill, { backgroundColor: showDepth ? '#3b82f6' : colors.card }]}
              onPress={() => setShowDepth(!showDepth)}
            >
              <Text style={styles.filterEmoji}>📏</Text>
              <Text style={[styles.filterPillText, { color: showDepth ? '#fff' : colors.text }]}>Depth</Text>
            </Pressable>
          </ScrollView>

          {/* Interactive Map */}
          <View style={styles.mapContainer}>
            {Platform.OS === 'web' ? (
              <iframe
                srcDoc={mapHTML}
                style={{ width: '100%', height: '100%', border: 'none' }}
                title="SEQ Fishing Map"
              />
            ) : (
              <View style={[styles.nativeMapFallback, { backgroundColor: '#e0f2fe' }]}>
                <Ionicons name="map" size={48} color={colors.primary} />
                <Text style={[styles.nativeMapText, { color: colors.primary }]}>Interactive Map</Text>
                <Text style={[styles.nativeMapSubtext, { color: colors.textSecondary }]}>
                  {spots.length} Spots • {ramps.length} Ramps • {channelMarkers.length} Markers
                </Text>
              </View>
            )}
          </View>
        </>
      ) : (
        /* Conditions Info View */
        <ScrollView style={styles.infoScrollView}>
          {/* Moon Phase Card */}
          <View style={[styles.infoCard, { backgroundColor: colors.card }]}>
            <View style={styles.infoCardHeader}>
              <Text style={styles.infoCardIcon}>{moonPhase?.phase_icon || '🌙'}</Text>
              <Text style={[styles.infoCardTitle, { color: colors.text }]}>Moon Phase</Text>
              <View style={[styles.ratingBadge, { backgroundColor: moonPhase?.fishing_rating === 'Very Good' ? '#dcfce7' : '#fef3c7' }]}>
                <Text style={[styles.ratingBadgeText, { color: moonPhase?.fishing_rating === 'Very Good' ? '#15803d' : '#b45309' }]}>
                  {moonPhase?.fishing_rating}
                </Text>
              </View>
            </View>
            <Text style={[styles.infoCardValue, { color: colors.text }]}>{moonPhase?.phase}</Text>
            <Text style={[styles.infoCardDetail, { color: colors.textSecondary }]}>
              {moonPhase?.illumination}% illumination • {moonPhase?.days_until_new} days to new moon
            </Text>
            <Text style={[styles.infoCardTip, { color: colors.primary }]}>{moonPhase?.fishing_tip}</Text>
          </View>

          {/* Bite Times Card */}
          <View style={[styles.infoCard, { backgroundColor: colors.card }]}>
            <View style={styles.infoCardHeader}>
              <Text style={styles.infoCardIcon}>🎣</Text>
              <Text style={[styles.infoCardTitle, { color: colors.text }]}>Best Bite Times</Text>
              <View style={[styles.ratingBadge, { backgroundColor: '#dcfce7' }]}>
                <Text style={[styles.ratingBadgeText, { color: '#15803d' }]}>{solunar?.rating}</Text>
              </View>
            </View>
            <Text style={[styles.infoCardValue, { color: colors.text }]}>{solunar?.best_time}</Text>
            <View style={styles.biteTimesGrid}>
              <View style={styles.biteTimeItem}>
                <Text style={[styles.biteTimeLabel, { color: colors.textSecondary }]}>Major 1</Text>
                <Text style={[styles.biteTimeValue, { color: colors.text }]}>{solunar?.major_one_start} - {solunar?.major_one_end}</Text>
              </View>
              <View style={styles.biteTimeItem}>
                <Text style={[styles.biteTimeLabel, { color: colors.textSecondary }]}>Major 2</Text>
                <Text style={[styles.biteTimeValue, { color: colors.text }]}>{solunar?.major_two_start} - {solunar?.major_two_end}</Text>
              </View>
              <View style={styles.biteTimeItem}>
                <Text style={[styles.biteTimeLabel, { color: colors.textSecondary }]}>Minor 1</Text>
                <Text style={[styles.biteTimeValue, { color: colors.text }]}>{solunar?.minor_one_start} - {solunar?.minor_one_end}</Text>
              </View>
              <View style={styles.biteTimeItem}>
                <Text style={[styles.biteTimeLabel, { color: colors.textSecondary }]}>Minor 2</Text>
                <Text style={[styles.biteTimeValue, { color: colors.text }]}>{solunar?.minor_two_start} - {solunar?.minor_two_end}</Text>
              </View>
            </View>
          </View>

          {/* Tides Card */}
          <View style={[styles.infoCard, { backgroundColor: colors.card }]}>
            <View style={styles.infoCardHeader}>
              <Text style={styles.infoCardIcon}>🌊</Text>
              <Text style={[styles.infoCardTitle, { color: colors.text }]}>Tides</Text>
            </View>
            <View style={styles.tidesGrid}>
              <View style={[styles.tideItem, { backgroundColor: '#dbeafe' }]}>
                <Ionicons name="arrow-up" size={20} color="#2563eb" />
                <Text style={[styles.tideLabel, { color: '#1e40af' }]}>High Tide</Text>
                <Text style={[styles.tideTime, { color: '#1e3a8a' }]}>{tides?.high_tide_time}</Text>
                <Text style={[styles.tideHeight, { color: '#2563eb' }]}>{tides?.high_tide_height}m</Text>
              </View>
              <View style={[styles.tideItem, { backgroundColor: '#fef3c7' }]}>
                <Ionicons name="arrow-down" size={20} color="#d97706" />
                <Text style={[styles.tideLabel, { color: '#92400e' }]}>Low Tide</Text>
                <Text style={[styles.tideTime, { color: '#78350f' }]}>{tides?.low_tide_time}</Text>
                <Text style={[styles.tideHeight, { color: '#d97706' }]}>{tides?.low_tide_height}m</Text>
              </View>
            </View>
          </View>

          {/* Current Flow Card */}
          <View style={[styles.infoCard, { backgroundColor: colors.card }]}>
            <View style={styles.infoCardHeader}>
              <Text style={styles.infoCardIcon}>💨</Text>
              <Text style={[styles.infoCardTitle, { color: colors.text }]}>Current & Conditions</Text>
            </View>
            <View style={styles.currentGrid}>
              <View style={styles.currentItem}>
                <Text style={[styles.currentLabel, { color: colors.textSecondary }]}>Flow State</Text>
                <Text style={[styles.currentValue, { color: colors.text }]}>{tidalFlow?.flow_state}</Text>
              </View>
              <View style={styles.currentItem}>
                <Text style={[styles.currentLabel, { color: colors.textSecondary }]}>Current</Text>
                <Text style={[styles.currentValue, { color: colors.text }]}>{tidalFlow?.current_speed} kn {tidalFlow?.current_direction}</Text>
              </View>
              <View style={styles.currentItem}>
                <Text style={[styles.currentLabel, { color: colors.textSecondary }]}>Water Temp</Text>
                <Text style={[styles.currentValue, { color: colors.text }]}>{tidalFlow?.water_temp}°C</Text>
              </View>
              <View style={styles.currentItem}>
                <Text style={[styles.currentLabel, { color: colors.textSecondary }]}>Visibility</Text>
                <Text style={[styles.currentValue, { color: colors.text }]}>{tidalFlow?.visibility}</Text>
              </View>
            </View>
          </View>

          {/* GPS Location Card */}
          {userLocation && (
            <View style={[styles.infoCard, { backgroundColor: colors.card }]}>
              <View style={styles.infoCardHeader}>
                <Text style={styles.infoCardIcon}>📍</Text>
                <Text style={[styles.infoCardTitle, { color: colors.text }]}>Your Location</Text>
              </View>
              <Text style={[styles.coordsText, { color: colors.text }]}>
                Lat: {userLocation.latitude.toFixed(6)}
              </Text>
              <Text style={[styles.coordsText, { color: colors.text }]}>
                Lng: {userLocation.longitude.toFixed(6)}
              </Text>
            </View>
          )}

          <View style={{ height: 20 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerContent: { justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 16, fontSize: 16 },
  
  // Info Bar
  infoBar: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  infoItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoIcon: { fontSize: 20 },
  infoLabel: { fontSize: 10, textTransform: 'uppercase' },
  infoValue: { fontSize: 12, fontWeight: '600' },
  infoDivider: { width: 1, height: 30 },
  
  // Controls
  controlsContainer: {
    flexDirection: 'row',
    padding: 10,
    alignItems: 'center',
    gap: 10,
  },
  viewToggle: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#e5e7eb',
    borderRadius: 8,
    padding: 3,
  },
  viewToggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 6,
    gap: 4,
  },
  viewToggleText: { fontSize: 13, fontWeight: '600' },
  gpsButton: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  gpsButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  
  // Filters
  filterScroll: { flexGrow: 0 },
  filterScrollContent: { paddingHorizontal: 10, gap: 8 },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    gap: 4,
  },
  filterEmoji: { fontSize: 14 },
  filterPillText: { fontSize: 12, fontWeight: '600' },
  
  // Map
  mapContainer: { flex: 1 },
  nativeMapFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  nativeMapText: { fontSize: 22, fontWeight: 'bold', marginTop: 12 },
  nativeMapSubtext: { fontSize: 14, marginTop: 4 },
  
  // Info View
  infoScrollView: { flex: 1 },
  infoCard: {
    margin: 10,
    marginBottom: 0,
    padding: 16,
    borderRadius: 12,
  },
  infoCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  infoCardIcon: { fontSize: 22 },
  infoCardTitle: { flex: 1, fontSize: 16, fontWeight: '600' },
  infoCardValue: { fontSize: 20, fontWeight: 'bold', marginBottom: 4 },
  infoCardDetail: { fontSize: 13, marginBottom: 8 },
  infoCardTip: { fontSize: 13, fontStyle: 'italic' },
  ratingBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  ratingBadgeText: { fontSize: 12, fontWeight: '600' },
  
  // Bite Times
  biteTimesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
    gap: 10,
  },
  biteTimeItem: {
    width: '47%',
    backgroundColor: '#f3f4f6',
    padding: 10,
    borderRadius: 8,
  },
  biteTimeLabel: { fontSize: 11, marginBottom: 2 },
  biteTimeValue: { fontSize: 14, fontWeight: '600' },
  
  // Tides
  tidesGrid: { flexDirection: 'row', gap: 12 },
  tideItem: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
  },
  tideLabel: { fontSize: 12, marginTop: 4 },
  tideTime: { fontSize: 18, fontWeight: 'bold', marginTop: 2 },
  tideHeight: { fontSize: 14, marginTop: 2 },
  
  // Current
  currentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  currentItem: { width: '47%' },
  currentLabel: { fontSize: 11, marginBottom: 2 },
  currentValue: { fontSize: 15, fontWeight: '600' },
  
  // Coords
  coordsText: { fontSize: 14, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
});
