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
  Modal,
  ScrollView,
  Alert,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { API_URL, Colors } from '../../constants/Config';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'expo-router';

interface CatchLog {
  id: string;
  fish_species: string;
  location_name: string;
  weight: number | null;
  length: number | null;
  bait_used: string | null;
  notes: string | null;
  image_url: string | null;
  caught_at: string;
  latitude: number | null;
  longitude: number | null;
}

interface Species {
  id: string;
  name: string;
}

interface Spot {
  id: string;
  name: string;
}

export default function CatchesScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { isAuthenticated, token } = useAuth();

  const [catches, setCatches] = useState<CatchLog[]>([]);
  const [species, setSpecies] = useState<Species[]>([]);
  const [spots, setSpots] = useState<Spot[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  // Form state
  const [selectedSpecies, setSelectedSpecies] = useState('');
  const [selectedSpot, setSelectedSpot] = useState('');
  const [weight, setWeight] = useState('');
  const [length, setLength] = useState('');
  const [baitUsed, setBaitUsed] = useState('');
  const [notes, setNotes] = useState('');
  const [imageUri, setImageUri] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [speciesRes, spotsRes] = await Promise.all([
        axios.get(`${API_URL}/species`),
        axios.get(`${API_URL}/spots`),
      ]);
      setSpecies(speciesRes.data);
      setSpots(spotsRes.data);

      if (isAuthenticated && token) {
        const catchesRes = await axios.get(`${API_URL}/catches`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setCatches(catchesRes.data);
      }
    } catch (error) {
      console.log('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      setImageUri(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera permission is required to take photos');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      setImageUri(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const submitCatch = async () => {
    if (!selectedSpecies || !selectedSpot) {
      Alert.alert('Missing info', 'Please select species and location');
      return;
    }

    setSubmitting(true);
    try {
      let location = null;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          location = await Location.getCurrentPositionAsync({});
        }
      } catch (e) {
        console.log('Location error:', e);
      }

      const selectedSpotData = spots.find((s) => s.id === selectedSpot);

      const catchData = {
        fish_species: selectedSpecies,
        location_id: selectedSpot,
        location_name: selectedSpotData?.name || 'Unknown',
        weight: weight ? parseFloat(weight) : null,
        length: length ? parseFloat(length) : null,
        bait_used: baitUsed || null,
        notes: notes || null,
        image_url: imageUri || null,
        caught_at: new Date().toISOString(),
        latitude: location?.coords.latitude || null,
        longitude: location?.coords.longitude || null,
      };

      await axios.post(`${API_URL}/catches`, catchData, {
        headers: { Authorization: `Bearer ${token}` },
      });

      Alert.alert('Success', 'Catch logged successfully!');
      setShowModal(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to log catch');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setSelectedSpecies('');
    setSelectedSpot('');
    setWeight('');
    setLength('');
    setBaitUsed('');
    setNotes('');
    setImageUri('');
  };

  const renderCatchItem = ({ item }: { item: CatchLog }) => (
    <View style={[styles.catchCard, { backgroundColor: colors.card }]}>
      {item.image_url && (
        <Image source={{ uri: item.image_url }} style={styles.catchImage} />
      )}
      <View style={styles.catchInfo}>
        <Text style={[styles.catchSpecies, { color: colors.text }]}>
          {item.fish_species}
        </Text>
        <Text style={[styles.catchLocation, { color: colors.textSecondary }]}>
          {item.location_name}
        </Text>
        <View style={styles.catchDetails}>
          {item.weight && (
            <Text style={[styles.catchDetail, { color: colors.textSecondary }]}>
              {item.weight}kg
            </Text>
          )}
          {item.length && (
            <Text style={[styles.catchDetail, { color: colors.textSecondary }]}>
              {item.length}cm
            </Text>
          )}
        </View>
        <Text style={[styles.catchDate, { color: colors.textSecondary }]}>
          {new Date(item.caught_at).toLocaleDateString()}
        </Text>
      </View>
    </View>
  );

  if (!isAuthenticated) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.authPrompt}>
          <Ionicons name="trophy-outline" size={64} color={colors.textSecondary} />
          <Text style={[styles.authTitle, { color: colors.text }]}>
            Log Your Catches
          </Text>
          <Text style={[styles.authText, { color: colors.textSecondary }]}>
            Sign in to start logging your fishing catches
          </Text>
          <TouchableOpacity
            style={[styles.authButton, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/login')}
          >
            <Text style={styles.authButtonText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Add Catch Button */}
      <TouchableOpacity
        style={[styles.addButton, { backgroundColor: colors.primary }]}
        onPress={() => setShowModal(true)}
      >
        <Ionicons name="add" size={24} color="#ffffff" />
        <Text style={styles.addButtonText}>Log New Catch</Text>
      </TouchableOpacity>

      {/* Catches List */}
      <FlatList
        data={catches}
        keyExtractor={(item) => item.id}
        renderItem={renderCatchItem}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="fish-outline" size={64} color={colors.textSecondary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No catches logged yet
            </Text>
            <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
              Start by logging your first catch!
            </Text>
          </View>
        }
      />

      {/* Add Catch Modal */}
      <Modal visible={showModal} animationType="slide" transparent={false}>
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { backgroundColor: colors.primary }]}>
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <Ionicons name="close" size={28} color="#ffffff" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Log Catch</Text>
            <View style={{ width: 28 }} />
          </View>

          <ScrollView style={styles.modalContent}>
            {/* Species Selection */}
            <Text style={[styles.inputLabel, { color: colors.text }]}>Species *</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.speciesScroll}
            >
              {species.slice(0, 10).map((s) => (
                <TouchableOpacity
                  key={s.id}
                  style={[
                    styles.speciesChip,
                    {
                      backgroundColor:
                        selectedSpecies === s.name ? colors.primary : colors.card,
                    },
                  ]}
                  onPress={() => setSelectedSpecies(s.name)}
                >
                  <Text
                    style={[
                      styles.speciesChipText,
                      { color: selectedSpecies === s.name ? '#ffffff' : colors.text },
                    ]}
                  >
                    {s.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Location Selection */}
            <Text style={[styles.inputLabel, { color: colors.text }]}>Location *</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.speciesScroll}
            >
              {spots.slice(0, 8).map((spot) => (
                <TouchableOpacity
                  key={spot.id}
                  style={[
                    styles.speciesChip,
                    {
                      backgroundColor:
                        selectedSpot === spot.id ? colors.accent : colors.card,
                    },
                  ]}
                  onPress={() => setSelectedSpot(spot.id)}
                >
                  <Text
                    style={[
                      styles.speciesChipText,
                      { color: selectedSpot === spot.id ? '#ffffff' : colors.text },
                    ]}
                  >
                    {spot.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Weight & Length */}
            <View style={styles.inputRow}>
              <View style={styles.inputHalf}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>Weight (kg)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.card, color: colors.text }]}
                  value={weight}
                  onChangeText={setWeight}
                  keyboardType="numeric"
                  placeholder="0.0"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>
              <View style={styles.inputHalf}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>Length (cm)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.card, color: colors.text }]}
                  value={length}
                  onChangeText={setLength}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>
            </View>

            {/* Bait Used */}
            <Text style={[styles.inputLabel, { color: colors.text }]}>Bait Used</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.card, color: colors.text }]}
              value={baitUsed}
              onChangeText={setBaitUsed}
              placeholder="What bait did you use?"
              placeholderTextColor={colors.textSecondary}
            />

            {/* Notes */}
            <Text style={[styles.inputLabel, { color: colors.text }]}>Notes</Text>
            <TextInput
              style={[
                styles.input,
                styles.textArea,
                { backgroundColor: colors.card, color: colors.text },
              ]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Any additional notes..."
              placeholderTextColor={colors.textSecondary}
              multiline
              numberOfLines={3}
            />

            {/* Photo */}
            <Text style={[styles.inputLabel, { color: colors.text }]}>Photo</Text>
            <View style={styles.photoButtons}>
              <TouchableOpacity
                style={[styles.photoButton, { backgroundColor: colors.card }]}
                onPress={takePhoto}
              >
                <Ionicons name="camera" size={24} color={colors.primary} />
                <Text style={[styles.photoButtonText, { color: colors.text }]}>Take Photo</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.photoButton, { backgroundColor: colors.card }]}
                onPress={pickImage}
              >
                <Ionicons name="images" size={24} color={colors.primary} />
                <Text style={[styles.photoButtonText, { color: colors.text }]}>Gallery</Text>
              </TouchableOpacity>
            </View>

            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.previewImage} />
            ) : null}

            {/* Submit Button */}
            <TouchableOpacity
              style={[
                styles.submitButton,
                { backgroundColor: submitting ? colors.textSecondary : colors.primary },
              ]}
              onPress={submitCatch}
              disabled={submitting}
            >
              <Text style={styles.submitButtonText}>
                {submitting ? 'Saving...' : 'Log Catch'}
              </Text>
            </TouchableOpacity>

            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  authPrompt: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  authTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 16,
  },
  authText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 8,
  },
  authButton: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 24,
  },
  authButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    margin: 16,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  listContainer: {
    padding: 16,
  },
  catchCard: {
    flexDirection: 'row',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  catchImage: {
    width: 100,
    height: 100,
  },
  catchInfo: {
    flex: 1,
    padding: 12,
  },
  catchSpecies: {
    fontSize: 18,
    fontWeight: '600',
  },
  catchLocation: {
    fontSize: 14,
    marginTop: 2,
  },
  catchDetails: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  catchDetail: {
    fontSize: 14,
  },
  catchDate: {
    fontSize: 12,
    marginTop: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 4,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    fontSize: 16,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
  },
  inputHalf: {
    flex: 1,
  },
  speciesScroll: {
    flexGrow: 0,
  },
  speciesChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 8,
  },
  speciesChipText: {
    fontSize: 14,
    fontWeight: '500',
  },
  photoButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  photoButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  photoButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginTop: 16,
  },
  submitButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
});
