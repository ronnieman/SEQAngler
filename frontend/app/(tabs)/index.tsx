import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  useColorScheme,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { API_URL, Colors } from '../../constants/Config';
import { useAuth } from '../../context/AuthContext';

interface Weather {
  temperature: number;
  wind_speed: number;
  wind_direction: string;
  humidity: number;
  conditions: string;
  uv_index: number;
  updated_at: string;
}

interface MarineWeather {
  wave_height: number;
  wave_direction: string;
  wave_period: number;
  swell_height: number;
  swell_direction: string;
  swell_period: number;
  sea_state: string;
  boating_advisory: string;
  updated_at: string;
}

interface FishingScore {
  overall_score: number;
  weather_score: number;
  tide_score: number;
  moon_score: number;
  solunar_score: number;
  conditions_summary: string;
  best_time_today: string;
}

interface ClosedSeasons {
  count: number;
  species: string[];
}

export default function HomeScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { isAuthenticated, user, isTrial, trialDaysRemaining } = useAuth();

  const [weather, setWeather] = useState<Weather | null>(null);
  const [marineWeather, setMarineWeather] = useState<MarineWeather | null>(null);
  const [fishingScore, setFishingScore] = useState<FishingScore | null>(null);
  const [closedSeasons, setClosedSeasons] = useState<ClosedSeasons | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [weatherRes, marineRes, scoreRes, closedRes] = await Promise.all([
        axios.get(`${API_URL}/weather`),
        axios.get(`${API_URL}/marine-weather`),
        axios.get(`${API_URL}/fishing-conditions/preview`),
        axios.get(`${API_URL}/species/closed-seasons`),
      ]);
      setWeather(weatherRes.data);
      setMarineWeather(marineRes.data);
      setFishingScore(scoreRes.data);
      setClosedSeasons(closedRes.data);
    } catch (error) {
      console.log('Error fetching data:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const getScoreColor = (score: number) => {
    if (score >= 8) return '#22c55e';
    if (score >= 6) return '#0ea5e9';
    if (score >= 4) return '#f59e0b';
    return '#ef4444';
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <Text style={styles.headerTitle}>SEQ Angler</Text>
        <Text style={styles.headerSubtitle}>South East Queensland Fishing</Text>
      </View>

      {/* Auth Status */}
      {!isAuthenticated ? (
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            Welcome to SEQ Angler
          </Text>
          <Text style={[styles.cardText, { color: colors.textSecondary }]}>
            Sign up for a free 30-day trial to access all features
          </Text>
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: colors.primary }]}
              onPress={() => router.push('/login')}
            >
              <Text style={styles.buttonText}>Login</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.buttonOutline, { borderColor: colors.primary }]}
              onPress={() => router.push('/register')}
            >
              <Text style={[styles.buttonOutlineText, { color: colors.primary }]}>
                Sign Up
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={styles.userRow}>
            <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
              <Text style={styles.avatarText}>
                {user?.name?.charAt(0) || 'U'}
              </Text>
            </View>
            <View>
              <Text style={[styles.userName, { color: colors.text }]}>
                {user?.name || 'User'}
              </Text>
              {isTrial && (
                <Text style={[styles.trialText, { color: colors.warning }]}>
                  Trial: {trialDaysRemaining} days left
                </Text>
              )}
            </View>
          </View>
        </View>
      )}

      {/* Weather Card */}
      {weather && (
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="partly-sunny" size={24} color={colors.warning} />
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              Current Weather
            </Text>
          </View>
          <View style={styles.weatherRow}>
            <View style={styles.weatherItem}>
              <Text style={[styles.weatherValue, { color: colors.text }]}>
                {weather.temperature}°C
              </Text>
              <Text style={[styles.weatherLabel, { color: colors.textSecondary }]}>
                Temperature
              </Text>
            </View>
            <View style={styles.weatherItem}>
              <Text style={[styles.weatherValue, { color: colors.text }]}>
                {weather.wind_speed} km/h
              </Text>
              <Text style={[styles.weatherLabel, { color: colors.textSecondary }]}>
                Wind {weather.wind_direction}
              </Text>
            </View>
            <View style={styles.weatherItem}>
              <Text style={[styles.weatherValue, { color: colors.text }]}>
                {weather.uv_index}
              </Text>
              <Text style={[styles.weatherLabel, { color: colors.textSecondary }]}>
                UV Index
              </Text>
            </View>
          </View>
          <Text style={[styles.conditions, { color: colors.textSecondary }]}>
            {weather.conditions}
          </Text>
        </View>
      )}

      {/* Marine Weather Card */}
      {marineWeather && (
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="boat" size={24} color="#0891b2" />
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              Boating Conditions
            </Text>
          </View>
          <View style={styles.weatherRow}>
            <View style={styles.weatherItem}>
              <Text style={[styles.weatherValue, { color: colors.text }]}>
                {marineWeather.wave_height}m
              </Text>
              <Text style={[styles.weatherLabel, { color: colors.textSecondary }]}>
                Wave Height
              </Text>
            </View>
            <View style={styles.weatherItem}>
              <Text style={[styles.weatherValue, { color: colors.text }]}>
                {marineWeather.swell_height}m
              </Text>
              <Text style={[styles.weatherLabel, { color: colors.textSecondary }]}>
                Swell {marineWeather.swell_direction}
              </Text>
            </View>
            <View style={styles.weatherItem}>
              <Text style={[styles.weatherValue, { color: colors.text }]}>
                {marineWeather.swell_period}s
              </Text>
              <Text style={[styles.weatherLabel, { color: colors.textSecondary }]}>
                Period
              </Text>
            </View>
          </View>
          <View style={[styles.seaStateRow, { backgroundColor: colors.background }]}>
            <Text style={[styles.seaStateLabel, { color: colors.textSecondary }]}>
              Sea State:
            </Text>
            <Text style={[styles.seaStateValue, { color: colors.text }]}>
              {marineWeather.sea_state}
            </Text>
          </View>
          <Text style={[styles.boatingAdvisory, { color: colors.primary }]}>
            {marineWeather.boating_advisory}
          </Text>
        </View>
      )}

      {/* Fishing Conditions Score */}
      {fishingScore && (
        <TouchableOpacity
          style={[styles.scoreCard, { backgroundColor: getScoreColor(fishingScore.overall_score) }]}
          onPress={() => router.push('/species')}
        >
          <View style={styles.scoreHeader}>
            <Ionicons name="speedometer" size={32} color="#ffffff" />
            <View>
              <Text style={styles.scoreTitle}>Today's Fishing</Text>
              <Text style={styles.scoreSummary}>
                {fishingScore.conditions_summary}
              </Text>
            </View>
          </View>
          <View style={styles.scoreValue}>
            <Text style={styles.scoreNumber}>{fishingScore.overall_score}</Text>
            <Text style={styles.scoreMax}>/10</Text>
          </View>
        </TouchableOpacity>
      )}

      {/* Closed Seasons Alert */}
      {closedSeasons && closedSeasons.count > 0 && (
        <View style={[styles.alertCard, { backgroundColor: '#fef2f2', borderColor: '#fecaca' }]}>
          <Ionicons name="warning" size={24} color="#ef4444" />
          <View style={styles.alertContent}>
            <Text style={styles.alertTitle}>Closed Seasons Active</Text>
            <Text style={styles.alertText}>
              {closedSeasons.count} species currently closed
            </Text>
          </View>
        </View>
      )}

      {/* Quick Actions */}
      <View style={styles.actionsGrid}>
        <TouchableOpacity
          style={[styles.actionCard, { backgroundColor: colors.card }]}
          onPress={() => router.push('/map')}
        >
          <Ionicons name="map" size={32} color={colors.primary} />
          <Text style={[styles.actionText, { color: colors.text }]}>
            Fishing Map
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionCard, { backgroundColor: colors.card }]}
          onPress={() => router.push('/species')}
        >
          <Ionicons name="fish" size={32} color="#f59e0b" />
          <Text style={[styles.actionText, { color: colors.text }]}>
            Species Guide
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionCard, { backgroundColor: colors.card }]}
          onPress={() => router.push('/catches')}
        >
          <Ionicons name="trophy" size={32} color={colors.warning} />
          <Text style={[styles.actionText, { color: colors.text }]}>
            Log Catch
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionCard, { backgroundColor: colors.card }]}
          onPress={() => router.push('/profile')}
        >
          <Ionicons name="person" size={32} color={colors.primary} />
          <Text style={[styles.actionText, { color: colors.text }]}>
            Profile
          </Text>
        </TouchableOpacity>
      </View>

      <View style={{ height: 20 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 20,
    paddingTop: 60,
    paddingBottom: 30,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  card: {
    margin: 16,
    marginBottom: 8,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  cardText: {
    fontSize: 14,
    marginTop: 4,
    marginBottom: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 16,
  },
  buttonOutline: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 2,
  },
  buttonOutlineText: {
    fontWeight: '600',
    fontSize: 16,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
  },
  trialText: {
    fontSize: 14,
    marginTop: 2,
  },
  weatherRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  weatherItem: {
    alignItems: 'center',
  },
  weatherValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  weatherLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  conditions: {
    textAlign: 'center',
    marginTop: 12,
    fontSize: 14,
  },
  scoreCard: {
    margin: 16,
    marginBottom: 8,
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scoreHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  scoreTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  scoreSummary: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    marginTop: 2,
    maxWidth: 180,
  },
  scoreValue: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  scoreNumber: {
    color: '#ffffff',
    fontSize: 48,
    fontWeight: 'bold',
  },
  scoreMax: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 20,
  },
  alertCard: {
    margin: 16,
    marginBottom: 8,
    padding: 12,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
  },
  alertContent: {
    flex: 1,
  },
  alertTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ef4444',
  },
  alertText: {
    fontSize: 14,
    color: '#b91c1c',
    marginTop: 2,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 8,
  },
  actionCard: {
    width: '46%',
    margin: '2%',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  actionText: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '500',
  },
  seaStateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    padding: 8,
    borderRadius: 8,
  },
  seaStateLabel: {
    fontSize: 14,
  },
  seaStateValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  boatingAdvisory: {
    textAlign: 'center',
    marginTop: 10,
    fontSize: 13,
    fontWeight: '500',
  },
});
