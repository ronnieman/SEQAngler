import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  useColorScheme,
  ActivityIndicator,
  Linking,
  Platform,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { API_URL, Colors } from '../../constants/Config';

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

export default function SpotDetailScreen() {
  const { id } = useLocalSearchParams();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const [spot, setSpot] = useState<FishingSpot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSpot();
  }, [id]);

  const fetchSpot = async () => {
    try {
      const response = await axios.get(`${API_URL}/spots/${id}`);
      setSpot(response.data);
    } catch (error) {
      console.log('Error fetching spot:', error);
    } finally {
      setLoading(false);
    }
  };

  const openMaps = () => {
    if (!spot) return;
    const scheme = Platform.select({ ios: 'maps:0,0?q=', android: 'geo:0,0?q=' });
    const latLng = `${spot.latitude},${spot.longitude}`;
    const label = spot.name;
    const url = Platform.select({
      ios: `${scheme}${label}@${latLng}`,
      android: `${scheme}${latLng}(${label})`,
    });
    if (url) {
      Linking.openURL(url);
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty.toLowerCase()) {
      case 'beginner':
        return '#22c55e';
      case 'intermediate':
        return '#f59e0b';
      case 'advanced':
        return '#ef4444';
      default:
        return colors.textSecondary;
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!spot) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.textSecondary }]}>
          Spot not found
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <Ionicons name="location" size={48} color="#ffffff" />
        <Text style={styles.spotName}>{spot.name}</Text>
        <View style={styles.ratingRow}>
          {[1, 2, 3, 4, 5].map((star) => (
            <Ionicons
              key={star}
              name={star <= Math.round(spot.rating) ? 'star' : 'star-outline'}
              size={20}
              color="#fbbf24"
            />
          ))}
          <Text style={styles.ratingText}>{spot.rating.toFixed(1)}</Text>
        </View>
      </View>

      {/* Quick Info */}
      <View style={styles.quickInfoRow}>
        <View style={[styles.quickInfoItem, { backgroundColor: colors.card }]}>
          <Ionicons name="time" size={24} color={colors.primary} />
          <Text style={[styles.quickInfoLabel, { color: colors.textSecondary }]}>
            Best Time
          </Text>
          <Text style={[styles.quickInfoValue, { color: colors.text }]}>
            {spot.best_time}
          </Text>
        </View>
        <View style={[styles.quickInfoItem, { backgroundColor: colors.card }]}>
          <Ionicons name="speedometer" size={24} color={getDifficultyColor(spot.difficulty)} />
          <Text style={[styles.quickInfoLabel, { color: colors.textSecondary }]}>
            Difficulty
          </Text>
          <Text
            style={[
              styles.quickInfoValue,
              { color: getDifficultyColor(spot.difficulty) },
            ]}
          >
            {spot.difficulty}
          </Text>
        </View>
      </View>

      {/* Navigate Button */}
      <TouchableOpacity
        style={[styles.navigateButton, { backgroundColor: colors.accent }]}
        onPress={openMaps}
      >
        <Ionicons name="navigate" size={24} color="#ffffff" />
        <Text style={styles.navigateText}>Navigate to Spot</Text>
      </TouchableOpacity>

      {/* Description */}
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>About</Text>
        <Text style={[styles.description, { color: colors.textSecondary }]}>
          {spot.description}
        </Text>
      </View>

      {/* Fish Types */}
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Common Fish</Text>
        <View style={styles.tagsContainer}>
          {spot.fish_types.map((fish, index) => (
            <View key={index} style={[styles.fishTag, { backgroundColor: colors.primary }]}>
              <Ionicons name="fish" size={14} color="#ffffff" />
              <Text style={styles.fishTagText}>{fish}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Facilities */}
      {spot.facilities.length > 0 && (
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Facilities</Text>
          <View style={styles.facilitiesList}>
            {spot.facilities.map((facility, index) => (
              <View key={index} style={styles.facilityItem}>
                <Ionicons name="checkmark-circle" size={20} color={colors.accent} />
                <Text style={[styles.facilityText, { color: colors.text }]}>
                  {facility}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Coordinates */}
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Location</Text>
        <Text style={[styles.coordinates, { color: colors.textSecondary }]}>
          Lat: {spot.latitude.toFixed(6)}
        </Text>
        <Text style={[styles.coordinates, { color: colors.textSecondary }]}>
          Lng: {spot.longitude.toFixed(6)}
        </Text>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    paddingTop: 30,
    paddingBottom: 30,
  },
  spotName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginTop: 12,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 4,
  },
  ratingText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  quickInfoRow: {
    flexDirection: 'row',
    margin: 16,
    gap: 12,
  },
  quickInfoItem: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
  },
  quickInfoLabel: {
    fontSize: 12,
    marginTop: 8,
  },
  quickInfoValue: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 4,
    textTransform: 'capitalize',
  },
  navigateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  navigateText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  card: {
    margin: 16,
    marginTop: 16,
    marginBottom: 0,
    padding: 16,
    borderRadius: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  fishTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  fishTagText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  facilitiesList: {
    gap: 8,
  },
  facilityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  facilityText: {
    fontSize: 15,
  },
  coordinates: {
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 40,
  },
});
