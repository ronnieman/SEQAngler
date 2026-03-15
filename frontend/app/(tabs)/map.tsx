import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useColorScheme,
  Platform,
  ActivityIndicator,
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

export default function MapScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const [spots, setSpots] = useState<FishingSpot[]>([]);
  const [ramps, setRamps] = useState<BoatRamp[]>([]);
  const [selectedSpot, setSelectedSpot] = useState<FishingSpot | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSpots, setShowSpots] = useState(true);
  const [showRamps, setShowRamps] = useState(true);

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
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading map data...
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Map Placeholder */}
      <View style={[styles.mapPlaceholder, { backgroundColor: '#e0f2fe' }]}>
        <Ionicons name="map" size={64} color={colors.primary} />
        <Text style={[styles.mapPlaceholderText, { color: colors.primary }]}>
          Interactive Map
        </Text>
        <Text style={[styles.mapPlaceholderSubtext, { color: colors.textSecondary }]}>
          South East Queensland
        </Text>
        <Text style={[styles.mapCoords, { color: colors.textSecondary }]}>
          Lat: {MapConfig.defaultRegion.latitude.toFixed(4)}
          {' | '}
          Lng: {MapConfig.defaultRegion.longitude.toFixed(4)}
        </Text>
      </View>

      {/* Filter Buttons */}
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[
            styles.filterButton,
            { backgroundColor: showSpots ? colors.primary : colors.card },
          ]}
          onPress={() => setShowSpots(!showSpots)}
        >
          <Ionicons
            name="fish"
            size={18}
            color={showSpots ? '#ffffff' : colors.text}
          />
          <Text
            style={[
              styles.filterText,
              { color: showSpots ? '#ffffff' : colors.text },
            ]}
          >
            Spots ({spots.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.filterButton,
            { backgroundColor: showRamps ? colors.accent : colors.card },
          ]}
          onPress={() => setShowRamps(!showRamps)}
        >
          <Ionicons
            name="boat"
            size={18}
            color={showRamps ? '#ffffff' : colors.text}
          />
          <Text
            style={[
              styles.filterText,
              { color: showRamps ? '#ffffff' : colors.text },
            ]}
          >
            Ramps ({ramps.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Spots List */}
      <View style={[styles.listContainer, { backgroundColor: colors.card }]}>
        <Text style={[styles.listTitle, { color: colors.text }]}>
          Fishing Spots
        </Text>
        {spots.slice(0, 5).map((spot) => (
          <TouchableOpacity
            key={spot.id}
            style={[styles.listItem, { borderBottomColor: colors.border }]}
            onPress={() => router.push(`/spot/${spot.id}`)}
          >
            <View style={styles.listItemContent}>
              <View style={[styles.marker, { backgroundColor: colors.primary }]}>
                <Ionicons name="fish" size={14} color="#ffffff" />
              </View>
              <View style={styles.listItemInfo}>
                <Text style={[styles.listItemName, { color: colors.text }]}>
                  {spot.name}
                </Text>
                <Text style={[styles.listItemDesc, { color: colors.textSecondary }]}>
                  {spot.fish_types.slice(0, 3).join(', ')}
                </Text>
              </View>
            </View>
            <View style={styles.ratingContainer}>
              <Ionicons name="star" size={14} color="#f59e0b" />
              <Text style={[styles.ratingText, { color: colors.text }]}>
                {spot.rating.toFixed(1)}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
  },
  mapPlaceholder: {
    height: 250,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapPlaceholderText: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 12,
  },
  mapPlaceholderSubtext: {
    fontSize: 14,
    marginTop: 4,
  },
  mapCoords: {
    fontSize: 12,
    marginTop: 8,
  },
  filterContainer: {
    flexDirection: 'row',
    padding: 12,
    gap: 12,
  },
  filterButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    gap: 6,
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
  },
  listContainer: {
    flex: 1,
    margin: 12,
    borderRadius: 12,
    padding: 16,
  },
  listTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  listItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  marker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
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
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
