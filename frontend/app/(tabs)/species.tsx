import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  useColorScheme,
} from 'react-native';
import { useRouter } from 'expo-router';
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

export default function SpeciesScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const [species, setSpecies] = useState<Species[]>([]);
  const [filteredSpecies, setFilteredSpecies] = useState<Species[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSpecies();
  }, []);

  useEffect(() => {
    if (searchQuery) {
      const filtered = species.filter(
        (s) =>
          s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.scientific_name.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredSpecies(filtered);
    } else {
      setFilteredSpecies(species);
    }
  }, [searchQuery, species]);

  const fetchSpecies = async () => {
    try {
      const response = await axios.get(`${API_URL}/species`);
      setSpecies(response.data);
      setFilteredSpecies(response.data);
    } catch (error) {
      console.log('Error fetching species:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchSpecies();
    setRefreshing(false);
  };

  const isInClosedSeason = (item: Species): boolean => {
    if (!item.closed_season_start || !item.closed_season_end) return false;
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const currentDate = `${month}-${day}`;
    const start = item.closed_season_start;
    const end = item.closed_season_end;
    if (start > end) {
      return currentDate >= start || currentDate <= end;
    }
    return currentDate >= start && currentDate <= end;
  };

  const renderSpeciesItem = ({ item }: { item: Species }) => {
    const closed = isInClosedSeason(item);
    return (
      <TouchableOpacity
        style={[styles.speciesCard, { backgroundColor: colors.card }]}
        onPress={() => router.push(`/species/${item.id}`)}
      >
        <View style={styles.speciesHeader}>
          <View style={styles.speciesInfo}>
            <Text style={[styles.speciesName, { color: colors.text }]}>
              {item.name}
            </Text>
            <Text style={[styles.scientificName, { color: colors.textSecondary }]}>
              {item.scientific_name}
            </Text>
          </View>
          {item.is_protected ? (
            <View style={[styles.badge, { backgroundColor: '#dc2626' }]}>
              <Text style={styles.badgeText}>NO TAKE</Text>
            </View>
          ) : closed ? (
            <View style={[styles.badge, { backgroundColor: '#f59e0b' }]}>
              <Text style={styles.badgeText}>CLOSED</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.speciesDetails}>
          {item.min_size && (
            <View style={styles.detailItem}>
              <Ionicons name="resize" size={16} color={colors.textSecondary} />
              <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                Min: {item.min_size}cm
              </Text>
            </View>
          )}
          {item.bag_limit && (
            <View style={styles.detailItem}>
              <Ionicons name="bag" size={16} color={colors.textSecondary} />
              <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                Limit: {item.bag_limit}
              </Text>
            </View>
          )}
        </View>

        {item.best_bait.length > 0 && (
          <View style={styles.baitRow}>
            <Text style={[styles.baitLabel, { color: colors.textSecondary }]}>
              Best Bait:
            </Text>
            <Text style={[styles.baitText, { color: colors.text }]}>
              {item.best_bait.slice(0, 2).join(', ')}
            </Text>
          </View>
        )}

        <Ionicons
          name="chevron-forward"
          size={20}
          color={colors.textSecondary}
          style={styles.chevron}
        />
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Search Bar */}
      <View style={[styles.searchContainer, { backgroundColor: colors.card }]}>
        <Ionicons name="search" size={20} color={colors.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Search species..."
          placeholderTextColor={colors.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Species List */}
      <FlatList
        data={filteredSpecies}
        keyExtractor={(item) => item.id}
        renderItem={renderSpeciesItem}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="fish-outline" size={64} color={colors.textSecondary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {loading ? 'Loading species...' : 'No species found'}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  speciesCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  speciesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  speciesInfo: {
    flex: 1,
  },
  speciesName: {
    fontSize: 18,
    fontWeight: '600',
  },
  scientificName: {
    fontSize: 14,
    fontStyle: 'italic',
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  speciesDetails: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 12,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailText: {
    fontSize: 14,
  },
  baitRow: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 4,
  },
  baitLabel: {
    fontSize: 13,
  },
  baitText: {
    fontSize: 13,
    fontWeight: '500',
  },
  chevron: {
    position: 'absolute',
    right: 16,
    top: '50%',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 16,
  },
});
