import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  useColorScheme,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { API_URL, Colors } from '../../constants/Config';

interface Species {
  id: string;
  name: string;
  scientific_name: string;
  description: string;
  min_size: number | null;
  bag_limit: number | null;
  best_bait: string[];
  best_season: string[];
  is_protected: boolean;
  closed_season_start: string | null;
  closed_season_end: string | null;
  closed_season_reason: string | null;
}

export default function SpeciesDetailScreen() {
  const { id } = useLocalSearchParams();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const [species, setSpecies] = useState<Species | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSpecies();
  }, [id]);

  const fetchSpecies = async () => {
    try {
      const response = await axios.get(`${API_URL}/species/${id}`);
      setSpecies(response.data);
    } catch (error) {
      console.log('Error fetching species:', error);
    } finally {
      setLoading(false);
    }
  };

  const isInClosedSeason = (): boolean => {
    if (!species?.closed_season_start || !species?.closed_season_end) return false;
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const currentDate = `${month}-${day}`;
    const start = species.closed_season_start;
    const end = species.closed_season_end;
    if (start > end) {
      return currentDate >= start || currentDate <= end;
    }
    return currentDate >= start && currentDate <= end;
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!species) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.textSecondary }]}>
          Species not found
        </Text>
      </View>
    );
  }

  const closed = isInClosedSeason();

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <Ionicons name="fish" size={48} color="#ffffff" />
        <Text style={styles.speciesName}>{species.name}</Text>
        <Text style={styles.scientificName}>{species.scientific_name}</Text>
      </View>

      {/* Status Badge */}
      {species.is_protected ? (
        <View style={[styles.statusBanner, { backgroundColor: '#fef2f2' }]}>
          <Ionicons name="alert-circle" size={24} color="#dc2626" />
          <View>
            <Text style={[styles.statusTitle, { color: '#dc2626' }]}>
              PROTECTED SPECIES - NO TAKE
            </Text>
            <Text style={[styles.statusText, { color: '#b91c1c' }]}>
              It is illegal to catch or keep this species
            </Text>
          </View>
        </View>
      ) : closed ? (
        <View style={[styles.statusBanner, { backgroundColor: '#fef3c7' }]}>
          <Ionicons name="calendar" size={24} color="#b45309" />
          <View>
            <Text style={[styles.statusTitle, { color: '#b45309' }]}>
              CLOSED SEASON
            </Text>
            <Text style={[styles.statusText, { color: '#92400e' }]}>
              {species.closed_season_reason || 'Spawning season protection'}
            </Text>
          </View>
        </View>
      ) : null}

      {/* Regulations Card */}
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>
          QLD DPI Regulations
        </Text>
        <View style={styles.regulationsGrid}>
          <View style={styles.regulationItem}>
            <Ionicons name="resize" size={32} color={colors.primary} />
            <Text style={[styles.regulationValue, { color: colors.text }]}>
              {species.min_size ? `${species.min_size}cm` : 'No limit'}
            </Text>
            <Text style={[styles.regulationLabel, { color: colors.textSecondary }]}>
              Minimum Size
            </Text>
          </View>
          <View style={styles.regulationItem}>
            <Ionicons name="bag" size={32} color={colors.warning} />
            <Text style={[styles.regulationValue, { color: colors.text }]}>
              {species.bag_limit || 'No limit'}
            </Text>
            <Text style={[styles.regulationLabel, { color: colors.textSecondary }]}>
              Bag Limit
            </Text>
          </View>
        </View>
      </View>

      {/* Description */}
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>About</Text>
        <Text style={[styles.description, { color: colors.textSecondary }]}>
          {species.description}
        </Text>
      </View>

      {/* Best Bait */}
      {species.best_bait.length > 0 && (
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Best Bait</Text>
          <View style={styles.tagsContainer}>
            {species.best_bait.map((bait, index) => (
              <View key={index} style={[styles.tag, { backgroundColor: colors.primary }]}>
                <Text style={styles.tagText}>{bait}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Best Season */}
      {species.best_season.length > 0 && (
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Best Season</Text>
          <View style={styles.tagsContainer}>
            {species.best_season.map((season, index) => (
              <View key={index} style={[styles.tag, { backgroundColor: colors.accent }]}>
                <Text style={styles.tagText}>{season}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Closed Season Info */}
      {species.closed_season_start && species.closed_season_end && (
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Closed Season</Text>
          <Text style={[styles.closedDates, { color: colors.textSecondary }]}>
            {species.closed_season_start} to {species.closed_season_end}
          </Text>
          <Text style={[styles.closedReason, { color: colors.textSecondary }]}>
            {species.closed_season_reason}
          </Text>
        </View>
      )}

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
  speciesName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    marginTop: 12,
  },
  scientificName: {
    fontSize: 16,
    fontStyle: 'italic',
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  statusText: {
    fontSize: 14,
    marginTop: 2,
  },
  card: {
    margin: 16,
    marginTop: 0,
    padding: 16,
    borderRadius: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  regulationsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  regulationItem: {
    alignItems: 'center',
  },
  regulationValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 8,
  },
  regulationLabel: {
    fontSize: 12,
    marginTop: 4,
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
  tag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  tagText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  closedDates: {
    fontSize: 16,
    fontWeight: '500',
  },
  closedReason: {
    fontSize: 14,
    marginTop: 4,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 40,
  },
});
