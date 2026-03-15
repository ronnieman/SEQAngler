from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, Request, UploadFile, File
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict
import uuid
from datetime import datetime, timezone, timedelta
import jwt
import bcrypt
import math
import httpx
import base64
from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionResponse, CheckoutStatusResponse, CheckoutSessionRequest

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Settings
SECRET_KEY = os.environ.get('JWT_SECRET', 'seq-angler-default-dev-key-change-in-production')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24

# Stripe Settings
STRIPE_API_KEY = os.environ.get('STRIPE_API_KEY', '')

# Subscription Configuration
SUBSCRIPTION_PRICE = 9.99  # Monthly subscription price
FREE_TRIAL_DAYS = 30

# Create the main app
app = FastAPI(title="SEQ Angler API")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")
security = HTTPBearer()
security_optional = HTTPBearer(auto_error=False)

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ============== MODELS ==============

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    email: str
    name: str
    created_at: str
    favorite_spots: List[str] = []

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class FishingSpot(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str
    latitude: float
    longitude: float
    fish_types: List[str]
    best_time: str
    difficulty: str  # beginner, intermediate, advanced
    facilities: List[str] = []
    rating: float = 4.0
    image_url: Optional[str] = None

class FishSpecies(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    scientific_name: str
    description: str
    min_size: Optional[int] = None  # cm
    bag_limit: Optional[int] = None
    best_bait: List[str]
    best_season: List[str]
    image_url: Optional[str] = None
    is_protected: bool = False
    closed_season_start: Optional[str] = None  # "MM-DD" format
    closed_season_end: Optional[str] = None  # "MM-DD" format
    closed_season_reason: Optional[str] = None

class CatchLogCreate(BaseModel):
    fish_species: str
    location_id: str
    location_name: str
    weight: Optional[float] = None  # kg
    length: Optional[float] = None  # cm
    bait_used: Optional[str] = None
    notes: Optional[str] = None
    image_url: Optional[str] = None
    caught_at: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None

class CatchLog(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    fish_species: str
    location_id: str
    location_name: str
    weight: Optional[float] = None
    length: Optional[float] = None
    bait_used: Optional[str] = None
    notes: Optional[str] = None
    image_url: Optional[str] = None
    caught_at: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class BoatRamp(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    latitude: float
    longitude: float
    facilities: List[str]
    parking_spaces: int
    fee: bool = False

class WeatherData(BaseModel):
    temperature: float
    wind_speed: float
    wind_direction: str
    humidity: int
    conditions: str
    uv_index: int
    updated_at: str

class MarineWeatherData(BaseModel):
    wave_height: float  # meters
    wave_direction: str
    wave_period: float  # seconds
    swell_height: float  # meters
    swell_direction: str
    swell_period: float  # seconds
    secondary_swell_height: Optional[float] = None
    secondary_swell_direction: Optional[str] = None
    water_temperature: Optional[float] = None
    visibility: str
    sea_state: str  # calm, slight, moderate, rough, very rough
    boating_advisory: str
    updated_at: str

class ChannelMarker(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    marker_type: str  # port, starboard, cardinal_north, cardinal_south, cardinal_east, cardinal_west, special, isolated_danger
    latitude: float
    longitude: float
    description: Optional[str] = None
    light_characteristics: Optional[str] = None  # e.g., "Fl.R.3s" (flashing red every 3 seconds)
    color: str
    shape: str  # can, cone, pillar, spar, sphere

class TideData(BaseModel):
    high_tide_time: str
    high_tide_height: float
    low_tide_time: str
    low_tide_height: float
    next_high: str
    next_low: str
    updated_at: str

class MoonPhaseData(BaseModel):
    phase: str
    illumination: int
    phase_icon: str
    days_until_full: int
    days_until_new: int
    fishing_rating: str
    fishing_tip: str
    updated_at: str

class TidalFlowData(BaseModel):
    current_speed: float  # knots
    current_direction: str
    flow_state: str  # flooding, ebbing, slack
    water_temp: float  # celsius
    visibility: str
    updated_at: str

class DepthPoint(BaseModel):
    latitude: float
    longitude: float
    depth: float  # meters
    bottom_type: str

class ShipwreckData(BaseModel):
    id: str
    name: str
    latitude: float
    longitude: float
    depth: float
    sunk_year: Optional[int]
    vessel_type: str
    length: Optional[float]
    description: str
    fish_species: List[str]
    dive_accessible: bool

class SunMoonTimes(BaseModel):
    sunrise: str
    sunset: str
    first_light: str
    last_light: str
    day_length: str
    solar_noon: str
    golden_hour_am: str
    golden_hour_pm: str

class SolunarData(BaseModel):
    major_one_start: str
    major_one_end: str
    major_two_start: str
    major_two_end: str
    minor_one_start: str
    minor_one_end: str
    minor_two_start: str
    minor_two_end: str
    rating: str
    best_time: str

class SafetyInfo(BaseModel):
    vmr_phone: str
    coast_guard: str
    police_water: str
    weather_warnings: List[str]
    safety_tips: List[str]

class TripWaypoint(BaseModel):
    id: str
    type: str  # spot, wreck, ramp, custom
    name: str
    latitude: float
    longitude: float
    order: int
    notes: Optional[str] = None

class TripPlan(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    name: str
    trip_date: str
    waypoints: List[dict]
    notes: Optional[str] = None
    checklist: List[dict] = []
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

# ============== SUBSCRIPTION MODELS ==============

class SubscriptionStatus(BaseModel):
    is_subscribed: bool
    is_trial: bool
    trial_ends_at: Optional[str] = None
    subscription_ends_at: Optional[str] = None
    days_remaining: int = 0

class PaymentTransaction(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    session_id: str
    amount: float
    currency: str = "usd"
    payment_status: str = "pending"  # pending, paid, failed, expired
    metadata: dict = {}
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class FishingConditionsScore(BaseModel):
    overall_score: int  # 1-10
    weather_score: int
    tide_score: int
    moon_score: int
    solunar_score: int
    conditions_summary: str
    best_time_today: str
    factors: List[dict]

class CheckoutRequest(BaseModel):
    origin_url: str

# ============== GREEN ZONE MODELS ==============

class GreenZoneCoordinate(BaseModel):
    latitude: float
    longitude: float

class GreenZone(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    zone_type: str  # green, yellow, blue, habitat_protection
    marine_park: str  # e.g., "Moreton Bay Marine Park"
    description: str
    restrictions: List[str]
    penalties: str
    coordinates: List[GreenZoneCoordinate]  # Polygon boundary points
    center_lat: float
    center_lng: float
    color: str = "#22c55e"  # Default green
    opacity: float = 0.3

class ZoneProximityCheck(BaseModel):
    is_inside_zone: bool
    is_near_zone: bool
    nearest_zone: Optional[dict] = None
    distance_meters: Optional[float] = None
    warning_message: Optional[str] = None

# ============== AUTH HELPERS ==============

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_access_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    payload = {"sub": user_id, "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_current_user_optional(credentials: HTTPAuthorizationCredentials = Depends(security_optional)) -> Optional[dict]:
    """Get current user if authenticated, otherwise return None"""
    if not credentials:
        return None
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            return None
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
        return user
    except:
        return None

# ============== SUBSCRIPTION HELPERS ==============

async def check_subscription_status(user_id: str) -> SubscriptionStatus:
    """Check if user has active subscription or trial"""
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        return SubscriptionStatus(is_subscribed=False, is_trial=False, days_remaining=0)
    
    now = datetime.now(timezone.utc)
    
    # Check for active subscription
    if user.get("subscription_ends_at"):
        sub_end = datetime.fromisoformat(user["subscription_ends_at"].replace("Z", "+00:00"))
        if sub_end > now:
            days_remaining = (sub_end - now).days
            return SubscriptionStatus(
                is_subscribed=True,
                is_trial=False,
                subscription_ends_at=user["subscription_ends_at"],
                days_remaining=days_remaining
            )
    
    # Check for active trial
    if user.get("trial_ends_at"):
        trial_end = datetime.fromisoformat(user["trial_ends_at"].replace("Z", "+00:00"))
        if trial_end > now:
            days_remaining = (trial_end - now).days
            return SubscriptionStatus(
                is_subscribed=True,
                is_trial=True,
                trial_ends_at=user["trial_ends_at"],
                days_remaining=days_remaining
            )
    
    return SubscriptionStatus(is_subscribed=False, is_trial=False, days_remaining=0)

async def require_subscription(current_user: dict = Depends(get_current_user)) -> dict:
    """Dependency that requires active subscription or trial"""
    status = await check_subscription_status(current_user["id"])
    if not status.is_subscribed:
        raise HTTPException(
            status_code=403, 
            detail="Premium subscription required. Start your free trial or subscribe to access this feature."
        )
    return current_user

def is_species_in_closed_season(species: dict) -> tuple[bool, Optional[str]]:
    """Check if a species is currently in closed season"""
    if not species.get("closed_season_start") or not species.get("closed_season_end"):
        return False, None
    
    now = datetime.now(timezone.utc)
    current_month_day = f"{now.month:02d}-{now.day:02d}"
    
    start = species["closed_season_start"]
    end = species["closed_season_end"]
    
    # Handle season that spans year boundary (e.g., Nov-Feb)
    if start > end:
        in_season = current_month_day >= start or current_month_day <= end
    else:
        in_season = start <= current_month_day <= end
    
    if in_season:
        reason = species.get("closed_season_reason", "Spawning season protection")
        return True, reason
    return False, None

def calculate_fishing_conditions() -> FishingConditionsScore:
    """Calculate overall fishing conditions score based on multiple factors"""
    now = datetime.now(timezone.utc)
    hour = now.hour
    
    # Weather score (mock - based on typical good conditions)
    weather_score = 7  # Default good conditions
    
    # Tide score (mock - based on time of day approximating tide phases)
    tide_phase = (hour % 6) / 6  # Simple cycle
    if 0.2 <= tide_phase <= 0.8:  # During run/movement
        tide_score = 8
    else:  # Slack tide
        tide_score = 5
    
    # Moon score (mock - based on lunar cycle approximation)
    day_of_month = now.day
    if day_of_month in [1, 15, 16, 29, 30]:  # New/Full moon
        moon_score = 9
    elif day_of_month in [7, 8, 22, 23]:  # Quarter moons
        moon_score = 6
    else:
        moon_score = 7
    
    # Solunar score (mock - major/minor feeding periods)
    if 5 <= hour <= 8 or 16 <= hour <= 19:  # Dawn/dusk
        solunar_score = 9
    elif 10 <= hour <= 14:  # Midday
        solunar_score = 5
    else:
        solunar_score = 7
    
    # Calculate overall score (weighted average)
    overall = round((weather_score * 0.25 + tide_score * 0.30 + moon_score * 0.20 + solunar_score * 0.25))
    overall = max(1, min(10, overall))  # Clamp 1-10
    
    # Determine summary
    if overall >= 8:
        summary = "Excellent fishing conditions! Don't miss today."
    elif overall >= 6:
        summary = "Good conditions. Fish should be active."
    elif overall >= 4:
        summary = "Fair conditions. Be patient and persistent."
    else:
        summary = "Challenging conditions. Consider postponing."
    
    # Best time recommendation
    if hour < 6:
        best_time = "Sunrise (around 5:30-7:00 AM) for best results"
    elif hour < 16:
        best_time = "Evening bite starts around 4:00-6:00 PM"
    else:
        best_time = "Tomorrow morning at sunrise will be excellent"
    
    factors = [
        {"name": "Weather", "score": weather_score, "detail": "Light winds, partly cloudy"},
        {"name": "Tides", "score": tide_score, "detail": "Running tide - fish actively feeding"},
        {"name": "Moon Phase", "score": moon_score, "detail": "Good lunar influence"},
        {"name": "Solunar", "score": solunar_score, "detail": "Major feeding period approaching"}
    ]
    
    return FishingConditionsScore(
        overall_score=overall,
        weather_score=weather_score,
        tide_score=tide_score,
        moon_score=moon_score,
        solunar_score=solunar_score,
        conditions_summary=summary,
        best_time_today=best_time,
        factors=factors
    )

# ============== GREEN ZONE HELPERS ==============

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance between two points in meters using Haversine formula"""
    R = 6371000  # Earth's radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    
    a = math.sin(delta_phi/2)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    
    return R * c

def point_in_polygon(lat: float, lng: float, polygon: List[dict]) -> bool:
    """Check if a point is inside a polygon using ray casting algorithm"""
    n = len(polygon)
    inside = False
    
    j = n - 1
    for i in range(n):
        xi, yi = polygon[i]['latitude'], polygon[i]['longitude']
        xj, yj = polygon[j]['latitude'], polygon[j]['longitude']
        
        if ((yi > lng) != (yj > lng)) and (lat < (xj - xi) * (lng - yi) / (yj - yi) + xi):
            inside = not inside
        j = i
    
    return inside

def check_zone_proximity(lat: float, lng: float, zones: List[dict], warning_distance: float = 500) -> ZoneProximityCheck:
    """Check if a point is inside or near any green zone"""
    for zone in zones:
        # Check if inside the zone
        if point_in_polygon(lat, lng, zone['coordinates']):
            return ZoneProximityCheck(
                is_inside_zone=True,
                is_near_zone=True,
                nearest_zone={
                    "id": zone['id'],
                    "name": zone['name'],
                    "zone_type": zone['zone_type'],
                    "restrictions": zone['restrictions'],
                    "penalties": zone['penalties']
                },
                distance_meters=0,
                warning_message=f"WARNING: You are inside {zone['name']} - a {zone['zone_type'].replace('_', ' ')} zone. Fishing is PROHIBITED here."
            )
    
    # Check proximity to zones
    nearest_zone = None
    min_distance = float('inf')
    
    for zone in zones:
        distance = haversine_distance(lat, lng, zone['center_lat'], zone['center_lng'])
        if distance < min_distance:
            min_distance = distance
            nearest_zone = zone
    
    if nearest_zone and min_distance <= warning_distance:
        return ZoneProximityCheck(
            is_inside_zone=False,
            is_near_zone=True,
            nearest_zone={
                "id": nearest_zone['id'],
                "name": nearest_zone['name'],
                "zone_type": nearest_zone['zone_type'],
                "restrictions": nearest_zone['restrictions'],
                "penalties": nearest_zone['penalties']
            },
            distance_meters=round(min_distance),
            warning_message=f"CAUTION: You are {round(min_distance)}m from {nearest_zone['name']} - a no-fishing zone."
        )
    
    return ZoneProximityCheck(
        is_inside_zone=False,
        is_near_zone=False,
        nearest_zone={
            "id": nearest_zone['id'],
            "name": nearest_zone['name'],
            "zone_type": nearest_zone['zone_type']
        } if nearest_zone else None,
        distance_meters=round(min_distance) if nearest_zone else None,
        warning_message=None
    )

def get_default_green_zones() -> List[GreenZone]:
    """Default green zones for Moreton Bay Marine Park - Official MNP zones from QLD Zoning Plan 2019"""
    return [
        # MNP04 - Flinders Reef Marine National Park
        GreenZone(
            name="Flinders Reef (MNP04)",
            zone_type="green",
            marine_park="Moreton Bay Marine Park",
            description="Highest coral diversity of any subtropical reef in Australia. Over 175 fish species. Strictly no-take zone.",
            restrictions=["No fishing of any kind", "No anchoring - use public moorings only", "No collecting of any marine life", "Diving and snorkeling permitted"],
            penalties="Up to $13,785 fine for individuals. Commercial operators face higher penalties.",
            coordinates=[
                GreenZoneCoordinate(latitude=-27.0087, longitude=153.5085),
                GreenZoneCoordinate(latitude=-27.0087, longitude=153.5418),
                GreenZoneCoordinate(latitude=-27.0420, longitude=153.5418),
                GreenZoneCoordinate(latitude=-27.0420, longitude=153.5085),
            ],
            center_lat=-27.0253,
            center_lng=153.5251,
            color="#22c55e"
        ),
        # MNP20 - Myora/Amity Point
        GreenZone(
            name="Myora Reef (MNP20)",
            zone_type="green",
            marine_park="Moreton Bay Marine Park",
            description="One of only two locations with branching Acropora corals in Moreton Bay. No-anchoring area to protect corals.",
            restrictions=["No fishing", "No anchoring", "No collecting", "Snorkeling and diving permitted"],
            penalties="Up to $13,785 fine. Additional penalties for anchor damage to corals.",
            coordinates=[
                GreenZoneCoordinate(latitude=-27.3280, longitude=153.5500),
                GreenZoneCoordinate(latitude=-27.3280, longitude=153.5833),
                GreenZoneCoordinate(latitude=-27.3540, longitude=153.5833),
                GreenZoneCoordinate(latitude=-27.3540, longitude=153.5500),
            ],
            center_lat=-27.3410,
            center_lng=153.5667,
            color="#22c55e"
        ),
        # MNP16/MNP19 - Point Lookout
        GreenZone(
            name="Point Lookout (MNP16)",
            zone_type="green",
            marine_park="Moreton Bay Marine Park",
            description="Eastern coastline of North Stradbroke Island. Critical habitat for manta rays, turtles, and migratory fish.",
            restrictions=["No fishing", "No spearfishing", "No collecting", "Diving and snorkeling permitted"],
            penalties="Up to $13,785 fine for fishing violations.",
            coordinates=[
                GreenZoneCoordinate(latitude=-27.3560, longitude=153.5500),
                GreenZoneCoordinate(latitude=-27.3560, longitude=153.5833),
                GreenZoneCoordinate(latitude=-27.3870, longitude=153.5833),
                GreenZoneCoordinate(latitude=-27.3870, longitude=153.5500),
            ],
            center_lat=-27.3725,
            center_lng=153.5667,
            color="#22c55e"
        ),
        # MNP23 - Peel Island/Teerk Roo Ra
        GreenZone(
            name="Peel Island (MNP23)",
            zone_type="green",
            marine_park="Moreton Bay Marine Park",
            description="Historic quarantine island. Grey Nurse Shark aggregation area (GSA04). Important for endangered species protection.",
            restrictions=["No fishing", "No spearfishing", "No collecting", "Grey Nurse Shark protection applies"],
            penalties="Up to $13,785 fine. Heavy penalties for shark harassment.",
            coordinates=[
                GreenZoneCoordinate(latitude=-27.4698, longitude=153.3455),
                GreenZoneCoordinate(latitude=-27.4698, longitude=153.3746),
                GreenZoneCoordinate(latitude=-27.5071, longitude=153.3746),
                GreenZoneCoordinate(latitude=-27.5071, longitude=153.3455),
            ],
            center_lat=-27.4885,
            center_lng=153.3600,
            color="#22c55e"
        ),
        # MNP02/MNP03 - Tripcony Bight (North Moreton Bay)
        GreenZone(
            name="Tripcony Bight (MNP02)",
            zone_type="green",
            marine_park="Moreton Bay Marine Park",
            description="Seagrass meadows and dugong habitat between Bribie Island and Moreton Island. Go slow area for natural values.",
            restrictions=["No fishing", "No anchoring in seagrass", "Go slow for wildlife", "No jet skis"],
            penalties="Up to $13,785 fine.",
            coordinates=[
                GreenZoneCoordinate(latitude=-26.9417, longitude=153.3167),
                GreenZoneCoordinate(latitude=-26.9417, longitude=153.3500),
                GreenZoneCoordinate(latitude=-26.9750, longitude=153.3500),
                GreenZoneCoordinate(latitude=-26.9750, longitude=153.3167),
            ],
            center_lat=-26.9583,
            center_lng=153.3333,
            color="#22c55e"
        ),
        # MNP05 - Moreton Banks
        GreenZone(
            name="Moreton Banks (MNP05)",
            zone_type="green",
            marine_park="Moreton Bay Marine Park",
            description="Shallow sand banks important for fish breeding and nursery habitat. Dugong feeding area.",
            restrictions=["No fishing", "No anchoring", "Go slow for dugongs", "Swimming permitted"],
            penalties="Up to $13,785 fine.",
            coordinates=[
                GreenZoneCoordinate(latitude=-27.0833, longitude=153.4000),
                GreenZoneCoordinate(latitude=-27.0833, longitude=153.4333),
                GreenZoneCoordinate(latitude=-27.1167, longitude=153.4333),
                GreenZoneCoordinate(latitude=-27.1167, longitude=153.4000),
            ],
            center_lat=-27.1000,
            center_lng=153.4167,
            color="#22c55e"
        ),
        # HPZ - Pumicestone Passage Habitat Protection Zone
        GreenZone(
            name="Pumicestone Passage (HPZ)",
            zone_type="habitat_protection",
            marine_park="Moreton Bay Marine Park",
            description="Important estuary between Bribie Island and mainland. Dugong and turtle habitat. Limited fishing allowed.",
            restrictions=["No trawling", "No netting", "Line fishing with possession limits", "Go slow zones"],
            penalties="Up to $6,892 fine for habitat zone violations.",
            coordinates=[
                GreenZoneCoordinate(latitude=-26.9500, longitude=153.1333),
                GreenZoneCoordinate(latitude=-26.9500, longitude=153.1667),
                GreenZoneCoordinate(latitude=-27.0167, longitude=153.1667),
                GreenZoneCoordinate(latitude=-27.0167, longitude=153.1333),
            ],
            center_lat=-26.9833,
            center_lng=153.1500,
            color="#eab308",
            opacity=0.25
        ),
        # CPZ07 - North Stradbroke Conservation Park Zone
        GreenZone(
            name="North Stradbroke (CPZ07)",
            zone_type="yellow",
            marine_park="Moreton Bay Marine Park",
            description="Conservation Park Zone. Limited line fishing only. Important turtle nesting and seabird habitat.",
            restrictions=["Line fishing only", "No netting", "No trawling", "Catch limits apply"],
            penalties="Up to $6,892 fine for violations.",
            coordinates=[
                GreenZoneCoordinate(latitude=-27.4167, longitude=153.5000),
                GreenZoneCoordinate(latitude=-27.4167, longitude=153.5333),
                GreenZoneCoordinate(latitude=-27.4500, longitude=153.5333),
                GreenZoneCoordinate(latitude=-27.4500, longitude=153.5000),
            ],
            center_lat=-27.4333,
            center_lng=153.5167,
            color="#f59e0b",
            opacity=0.25
        ),
        # MNP14 - Wellington Point/Mud Island area
        GreenZone(
            name="Mud Island (MNP14)",
            zone_type="green",
            marine_park="Moreton Bay Marine Park",
            description="Critical shorebird roosting area. Mudflats important for migratory waders. Turtle nesting site.",
            restrictions=["No fishing", "No landing during nesting season (Oct-Mar)", "No dogs", "Stay 50m from shore"],
            penalties="Up to $13,785 fine. Wildlife disturbance attracts additional penalties.",
            coordinates=[
                GreenZoneCoordinate(latitude=-27.3280, longitude=153.2167),
                GreenZoneCoordinate(latitude=-27.3280, longitude=153.2500),
                GreenZoneCoordinate(latitude=-27.3613, longitude=153.2500),
                GreenZoneCoordinate(latitude=-27.3613, longitude=153.2167),
            ],
            center_lat=-27.3447,
            center_lng=153.2333,
            color="#22c55e"
        ),
        # MNP24 - Tangalooma Wrecks area
        GreenZone(
            name="Tangalooma (MNP24)",
            zone_type="green",
            marine_park="Moreton Bay Marine Park",
            description="15 sunken ships creating artificial reef. Popular snorkeling and diving destination. Marine sanctuary.",
            restrictions=["No fishing within 200m of wrecks", "No anchoring on wrecks", "Diving and snorkeling permitted"],
            penalties="Up to $13,785 fine.",
            coordinates=[
                GreenZoneCoordinate(latitude=-27.1667, longitude=153.3667),
                GreenZoneCoordinate(latitude=-27.1667, longitude=153.3833),
                GreenZoneCoordinate(latitude=-27.1833, longitude=153.3833),
                GreenZoneCoordinate(latitude=-27.1833, longitude=153.3667),
            ],
            center_lat=-27.1750,
            center_lng=153.3750,
            color="#22c55e"
        ),
    ]

# ============== AUTH ROUTES ==============

@api_router.post("/auth/register", response_model=TokenResponse)
async def register(user_data: UserCreate):
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = str(uuid.uuid4())
    trial_ends_at = (datetime.now(timezone.utc) + timedelta(days=FREE_TRIAL_DAYS)).isoformat()
    
    user = {
        "id": user_id,
        "email": user_data.email,
        "name": user_data.name,
        "password": hash_password(user_data.password),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "favorite_spots": [],
        "trial_ends_at": trial_ends_at,  # 30-day free trial
        "subscription_ends_at": None
    }
    await db.users.insert_one(user)
    
    token = create_access_token(user_id)
    user_response = UserResponse(
        id=user_id, email=user_data.email, name=user_data.name,
        created_at=user["created_at"], favorite_spots=[]
    )
    return TokenResponse(access_token=token, user=user_response)

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email})
    if not user or not verify_password(credentials.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_access_token(user["id"])
    user_response = UserResponse(
        id=user["id"], email=user["email"], name=user["name"],
        created_at=user["created_at"], favorite_spots=user.get("favorite_spots", [])
    )
    return TokenResponse(access_token=token, user=user_response)

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return UserResponse(**current_user)

# ============== SUBSCRIPTION & PAYMENT ROUTES ==============

@api_router.get("/subscription/status", response_model=SubscriptionStatus)
async def get_subscription_status(current_user: dict = Depends(get_current_user)):
    """Get current user's subscription status"""
    return await check_subscription_status(current_user["id"])

@api_router.get("/subscription/plans")
async def get_subscription_plans():
    """Get available subscription plans"""
    return {
        "monthly": {
            "price": SUBSCRIPTION_PRICE,
            "currency": "usd",
            "interval": "month",
            "name": "SEQ Angler Premium",
            "features": [
                "Access to all fishing spots",
                "3D map visualization",
                "Trip planner with waypoints",
                "Catch logging with GPS",
                "Fishing conditions score",
                "Shipwreck locations",
                "Boat ramp information",
                "Weather & tide data"
            ]
        },
        "free_trial": {
            "days": FREE_TRIAL_DAYS,
            "description": f"{FREE_TRIAL_DAYS}-day free trial included with signup"
        }
    }

@api_router.post("/subscription/checkout")
async def create_checkout_session(request: Request, checkout_data: CheckoutRequest, current_user: dict = Depends(get_current_user)):
    """Create Stripe checkout session for subscription"""
    if not STRIPE_API_KEY:
        raise HTTPException(status_code=500, detail="Payment system not configured")
    
    host_url = str(request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/webhook/stripe"
    
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    
    origin = checkout_data.origin_url.rstrip("/")
    success_url = f"{origin}/subscription/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/subscription"
    
    checkout_request = CheckoutSessionRequest(
        amount=float(SUBSCRIPTION_PRICE),
        currency="usd",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            "user_id": current_user["id"],
            "email": current_user["email"],
            "type": "subscription"
        }
    )
    
    try:
        session = await stripe_checkout.create_checkout_session(checkout_request)
        
        # Create payment transaction record
        transaction = PaymentTransaction(
            user_id=current_user["id"],
            session_id=session.session_id,
            amount=float(SUBSCRIPTION_PRICE),
            currency="usd",
            payment_status="pending",
            metadata={"user_id": current_user["id"], "type": "subscription"}
        )
        await db.payment_transactions.insert_one(transaction.model_dump())
        
        return {"url": session.url, "session_id": session.session_id}
    except Exception as e:
        logger.error(f"Stripe checkout error: {e}")
        raise HTTPException(status_code=500, detail="Failed to create checkout session")

@api_router.get("/subscription/checkout/status/{session_id}")
async def get_checkout_status(session_id: str, current_user: dict = Depends(get_current_user)):
    """Check payment status and update subscription if successful"""
    if not STRIPE_API_KEY:
        raise HTTPException(status_code=500, detail="Payment system not configured")
    
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url="")
    
    try:
        status = await stripe_checkout.get_checkout_status(session_id)
        
        # Check if already processed
        transaction = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
        
        if status.payment_status == "paid" and transaction and transaction.get("payment_status") != "paid":
            # Update transaction
            await db.payment_transactions.update_one(
                {"session_id": session_id},
                {"$set": {
                    "payment_status": "paid",
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }}
            )
            
            # Grant subscription (30 days from now)
            subscription_ends = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
            await db.users.update_one(
                {"id": current_user["id"]},
                {"$set": {
                    "subscription_ends_at": subscription_ends,
                    "trial_ends_at": None  # Clear trial when subscribed
                }}
            )
        
        return {
            "status": status.status,
            "payment_status": status.payment_status,
            "amount": status.amount_total / 100,  # Convert from cents
            "currency": status.currency
        }
    except Exception as e:
        logger.error(f"Stripe status check error: {e}")
        raise HTTPException(status_code=500, detail="Failed to check payment status")

@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    """Handle Stripe webhooks"""
    if not STRIPE_API_KEY:
        raise HTTPException(status_code=500, detail="Payment system not configured")
    
    try:
        body = await request.body()
        signature = request.headers.get("Stripe-Signature")
        
        stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url="")
        webhook_response = await stripe_checkout.handle_webhook(body, signature)
        
        if webhook_response.payment_status == "paid":
            # Get user_id from metadata
            user_id = webhook_response.metadata.get("user_id")
            if user_id:
                subscription_ends = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
                await db.users.update_one(
                    {"id": user_id},
                    {"$set": {
                        "subscription_ends_at": subscription_ends,
                        "trial_ends_at": None
                    }}
                )
                
                await db.payment_transactions.update_one(
                    {"session_id": webhook_response.session_id},
                    {"$set": {
                        "payment_status": "paid",
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }}
                )
        
        return {"status": "ok"}
    except Exception as e:
        logger.error(f"Webhook error: {e}")
        return {"status": "error", "message": str(e)}

# ============== FISHING CONDITIONS SCORE ==============

@api_router.get("/fishing-conditions", response_model=FishingConditionsScore)
async def get_fishing_conditions(current_user: dict = Depends(require_subscription)):
    """Get current fishing conditions score (Premium feature)"""
    return calculate_fishing_conditions()

@api_router.get("/fishing-conditions/preview")
async def get_fishing_conditions_preview():
    """Get limited preview of fishing conditions (for non-subscribers)"""
    score = calculate_fishing_conditions()
    return {
        "overall_score": score.overall_score,
        "conditions_summary": score.conditions_summary,
        "upgrade_message": "Subscribe to see detailed breakdown and best fishing times!"
    }

# ============== GREEN ZONES ==============

@api_router.get("/green-zones")
async def get_green_zones():
    """Get all marine protection zones"""
    zones = await db.green_zones.find({}, {"_id": 0}).to_list(100)
    if not zones:
        default_zones = get_default_green_zones()
        if default_zones:
            await db.green_zones.insert_many([z.model_dump() for z in default_zones])
        zones = [z.model_dump() for z in default_zones]
    return zones

@api_router.get("/green-zones/types")
async def get_zone_types():
    """Get zone type descriptions and colors"""
    return {
        "green": {
            "name": "Green Zone (Marine National Park)",
            "description": "Strictly no-take. No fishing, collecting or extraction allowed.",
            "color": "#22c55e",
            "icon": "ban"
        },
        "yellow": {
            "name": "Yellow Zone (Conservation Park)",
            "description": "Limited fishing with strict regulations. Some activities prohibited.",
            "color": "#f59e0b",
            "icon": "alert-triangle"
        },
        "habitat_protection": {
            "name": "Habitat Protection Zone",
            "description": "Fishing allowed with specific restrictions to protect habitat.",
            "color": "#eab308",
            "icon": "shield"
        },
        "blue": {
            "name": "Blue Zone (General Use)",
            "description": "General fishing allowed. Standard bag and size limits apply.",
            "color": "#3b82f6",
            "icon": "check"
        }
    }

@api_router.get("/green-zones/{zone_id}")
async def get_zone_by_id(zone_id: str):
    """Get details for a specific zone"""
    zone = await db.green_zones.find_one({"id": zone_id}, {"_id": 0})
    if not zone:
        raise HTTPException(status_code=404, detail="Zone not found")
    return zone

@api_router.post("/green-zones/check-position")
async def check_position_in_zones(lat: float, lng: float):
    """Check if a GPS position is inside or near any green zone"""
    zones = await db.green_zones.find({}, {"_id": 0}).to_list(100)
    if not zones:
        default_zones = get_default_green_zones()
        zones = [z.model_dump() for z in default_zones]
    
    result = check_zone_proximity(lat, lng, zones)
    return result

@api_router.get("/green-zones/summary/stats")
async def get_zone_stats():
    """Get summary statistics of marine protection zones"""
    zones = await db.green_zones.find({}, {"_id": 0}).to_list(100)
    if not zones:
        default_zones = get_default_green_zones()
        zones = [z.model_dump() for z in default_zones]
    
    stats = {
        "total_zones": len(zones),
        "by_type": {},
        "marine_parks": set()
    }
    
    for zone in zones:
        zone_type = zone.get("zone_type", "unknown")
        stats["by_type"][zone_type] = stats["by_type"].get(zone_type, 0) + 1
        stats["marine_parks"].add(zone.get("marine_park", "Unknown"))
    
    stats["marine_parks"] = list(stats["marine_parks"])
    
    return stats

# ============== FISHING SPOTS ==============

@api_router.get("/spots/depths")
async def get_spots_with_depths():
    """Get fishing spots with depth information"""
    spots = await db.fishing_spots.find({}, {"_id": 0}).to_list(100)
    if not spots:
        default_spots = get_default_spots()
        spots = [s.model_dump() for s in default_spots]
    
    depths = get_spot_depths()
    
    # Add depth info to spots
    for spot in spots:
        depth_info = depths.get(spot["name"], {"depth": 5.0, "bottom": "Unknown"})
        spot["depth"] = depth_info["depth"]
        spot["bottom_type"] = depth_info["bottom"]
    
    return spots

@api_router.get("/spots", response_model=List[FishingSpot])
async def get_fishing_spots():
    spots = await db.fishing_spots.find({}, {"_id": 0}).to_list(100)
    if not spots:
        # Seed default spots for Moreton Bay
        default_spots = get_default_spots()
        if default_spots:
            await db.fishing_spots.insert_many([s.model_dump() for s in default_spots])
        return default_spots
    return spots

@api_router.get("/spots/{spot_id}", response_model=FishingSpot)
async def get_fishing_spot(spot_id: str):
    spot = await db.fishing_spots.find_one({"id": spot_id}, {"_id": 0})
    if not spot:
        raise HTTPException(status_code=404, detail="Spot not found")
    return spot

@api_router.post("/spots/{spot_id}/favorite")
async def toggle_favorite(spot_id: str, current_user: dict = Depends(get_current_user)):
    user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "favorite_spots": 1})
    favorites = user.get("favorite_spots", [])
    
    if spot_id in favorites:
        favorites.remove(spot_id)
        action = "removed"
    else:
        favorites.append(spot_id)
        action = "added"
    
    await db.users.update_one({"id": current_user["id"]}, {"$set": {"favorite_spots": favorites}})
    return {"message": f"Spot {action} to favorites", "favorites": favorites}

# ============== FISH SPECIES ==============

@api_router.get("/species", response_model=List[FishSpecies])
async def get_fish_species():
    """Get all fish species - FREE feature (Species Guide)"""
    species = await db.fish_species.find({}, {"_id": 0}).to_list(100)
    if not species:
        default_species = get_default_species()
        if default_species:
            await db.fish_species.insert_many([s.model_dump() for s in default_species])
        species = [s.model_dump() for s in default_species]
    
    # Add closed season status
    for s in species:
        is_closed, reason = is_species_in_closed_season(s)
        s["is_in_closed_season"] = is_closed
        s["closed_season_message"] = reason
    
    return species

@api_router.get("/species/closed-seasons")
async def get_closed_seasons():
    """Get list of species currently in closed season"""
    species = await db.fish_species.find({}, {"_id": 0}).to_list(100)
    if not species:
        default_species = get_default_species()
        species = [s.model_dump() for s in default_species]
    
    closed_species = []
    for s in species:
        is_closed, reason = is_species_in_closed_season(s)
        if is_closed:
            closed_species.append({
                "id": s["id"],
                "name": s["name"],
                "reason": reason,
                "closed_start": s.get("closed_season_start"),
                "closed_end": s.get("closed_season_end")
            })
    
    return {
        "currently_closed": closed_species,
        "count": len(closed_species),
        "message": f"{len(closed_species)} species currently in closed season" if closed_species else "All species are currently open for fishing"
    }

@api_router.get("/species/{species_id}", response_model=FishSpecies)
async def get_fish_species_by_id(species_id: str):
    species = await db.fish_species.find_one({"id": species_id}, {"_id": 0})
    if not species:
        raise HTTPException(status_code=404, detail="Species not found")
    return species

# ============== CATCH LOGS ==============

@api_router.get("/catches", response_model=List[CatchLog])
async def get_catches(current_user: dict = Depends(get_current_user)):
    catches = await db.catch_logs.find({"user_id": current_user["id"]}, {"_id": 0}).to_list(100)
    return catches

@api_router.get("/catches/recent", response_model=List[CatchLog])
async def get_recent_catches():
    catches = await db.catch_logs.find({}, {"_id": 0}).sort("created_at", -1).to_list(10)
    return catches

@api_router.post("/catches", response_model=CatchLog)
async def create_catch(catch_data: CatchLogCreate, current_user: dict = Depends(get_current_user)):
    catch_log = CatchLog(
        user_id=current_user["id"],
        fish_species=catch_data.fish_species,
        location_id=catch_data.location_id,
        location_name=catch_data.location_name,
        weight=catch_data.weight,
        length=catch_data.length,
        bait_used=catch_data.bait_used,
        notes=catch_data.notes,
        image_url=catch_data.image_url,
        caught_at=catch_data.caught_at or datetime.now(timezone.utc).isoformat(),
        latitude=catch_data.latitude,
        longitude=catch_data.longitude
    )
    await db.catch_logs.insert_one(catch_log.model_dump())
    return catch_log

@api_router.delete("/catches/{catch_id}")
async def delete_catch(catch_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.catch_logs.delete_one({"id": catch_id, "user_id": current_user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Catch not found")
    return {"message": "Catch deleted"}

# ============== IMAGE UPLOAD ==============

UPLOAD_DIR = Path("/app/backend/uploads")
UPLOAD_DIR.mkdir(exist_ok=True)
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}

@api_router.post("/upload/image")
async def upload_image(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    """Upload an image for catch log"""
    # Check file extension
    ext = Path(file.filename).suffix.lower() if file.filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"File type not allowed. Use: {', '.join(ALLOWED_EXTENSIONS)}")
    
    # Read and check file size
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 5MB")
    
    # Generate unique filename
    file_id = str(uuid.uuid4())
    filename = f"{file_id}{ext}"
    filepath = UPLOAD_DIR / filename
    
    # Save file
    with open(filepath, "wb") as f:
        f.write(contents)
    
    # Return URL (will be served by static files)
    image_url = f"/api/uploads/{filename}"
    
    return {
        "image_url": image_url,
        "filename": filename,
        "size": len(contents),
        "message": "Image uploaded successfully"
    }

@api_router.post("/upload/image/base64")
async def upload_image_base64(data: dict, current_user: dict = Depends(get_current_user)):
    """Upload an image as base64 string"""
    base64_string = data.get("image")
    if not base64_string:
        raise HTTPException(status_code=400, detail="No image data provided")
    
    # Handle data URL format
    if "," in base64_string:
        header, base64_string = base64_string.split(",", 1)
        # Determine extension from header
        if "jpeg" in header or "jpg" in header:
            ext = ".jpg"
        elif "png" in header:
            ext = ".png"
        elif "webp" in header:
            ext = ".webp"
        else:
            ext = ".jpg"
    else:
        ext = ".jpg"
    
    try:
        image_data = base64.b64decode(base64_string)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid base64 image data")
    
    if len(image_data) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 5MB")
    
    # Generate unique filename
    file_id = str(uuid.uuid4())
    filename = f"{file_id}{ext}"
    filepath = UPLOAD_DIR / filename
    
    # Save file
    with open(filepath, "wb") as f:
        f.write(image_data)
    
    image_url = f"/api/uploads/{filename}"
    
    return {
        "image_url": image_url,
        "filename": filename,
        "size": len(image_data),
        "message": "Image uploaded successfully"
    }

# ============== BOAT RAMPS ==============

@api_router.get("/boat-ramps", response_model=List[BoatRamp])
async def get_boat_ramps():
    ramps = await db.boat_ramps.find({}, {"_id": 0}).to_list(100)
    if not ramps:
        default_ramps = get_default_boat_ramps()
        if default_ramps:
            await db.boat_ramps.insert_many([r.model_dump() for r in default_ramps])
        return default_ramps
    return ramps

# ============== WEATHER & TIDES (Real API - Open-Meteo) ==============

# Brisbane/Moreton Bay coordinates
SEQ_LAT = -27.4698
SEQ_LON = 153.0251

async def fetch_real_weather() -> dict:
    """Fetch real weather data from Open-Meteo API"""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            url = f"https://api.open-meteo.com/v1/forecast"
            params = {
                "latitude": SEQ_LAT,
                "longitude": SEQ_LON,
                "current": "temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,weather_code,uv_index",
                "timezone": "Australia/Brisbane"
            }
            response = await client.get(url, params=params)
            response.raise_for_status()
            return response.json()
    except Exception as e:
        logger.error(f"Weather API error: {e}")
        return None

def get_weather_condition(code: int) -> str:
    """Convert WMO weather code to description"""
    conditions = {
        0: "Clear Sky", 1: "Mainly Clear", 2: "Partly Cloudy", 3: "Overcast",
        45: "Foggy", 48: "Depositing Rime Fog",
        51: "Light Drizzle", 53: "Moderate Drizzle", 55: "Dense Drizzle",
        61: "Slight Rain", 63: "Moderate Rain", 65: "Heavy Rain",
        71: "Slight Snow", 73: "Moderate Snow", 75: "Heavy Snow",
        80: "Slight Rain Showers", 81: "Moderate Rain Showers", 82: "Violent Rain Showers",
        95: "Thunderstorm", 96: "Thunderstorm with Slight Hail", 99: "Thunderstorm with Heavy Hail"
    }
    return conditions.get(code, "Unknown")

def get_wind_direction(degrees: float) -> str:
    """Convert degrees to compass direction"""
    directions = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", 
                  "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"]
    idx = int((degrees + 11.25) / 22.5) % 16
    return directions[idx]

@api_router.get("/weather", response_model=WeatherData)
async def get_weather():
    """Get real-time weather for SEQ from Open-Meteo API"""
    data = await fetch_real_weather()
    
    if data and "current" in data:
        current = data["current"]
        return WeatherData(
            temperature=round(current.get("temperature_2m", 25), 1),
            wind_speed=round(current.get("wind_speed_10m", 10)),
            wind_direction=get_wind_direction(current.get("wind_direction_10m", 0)),
            humidity=round(current.get("relative_humidity_2m", 65)),
            conditions=get_weather_condition(current.get("weather_code", 0)),
            uv_index=round(current.get("uv_index", 5)),
            updated_at=datetime.now(timezone.utc).isoformat()
        )
    
    # Fallback to mock if API fails
    return WeatherData(
        temperature=26.5,
        wind_speed=12,
        wind_direction="SE",
        humidity=68,
        conditions="Partly Cloudy",
        uv_index=8,
        updated_at=datetime.now(timezone.utc).isoformat()
    )

@api_router.get("/marine-weather", response_model=MarineWeatherData)
async def get_marine_weather():
    """Get real-time marine/boating weather including wave height, swell, and sea state from Open-Meteo Marine API"""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            url = "https://marine-api.open-meteo.com/v1/marine"
            params = {
                "latitude": SEQ_LAT,
                "longitude": SEQ_LON,
                "current": "wave_height,wave_direction,wave_period,swell_wave_height,swell_wave_direction,swell_wave_period",
                "hourly": "wave_height,swell_wave_height",
                "timezone": "Australia/Brisbane",
                "forecast_days": 1
            }
            response = await client.get(url, params=params)
            response.raise_for_status()
            data = response.json()
            
            if data and "current" in data:
                current = data["current"]
                wave_height = current.get("wave_height", 0.5)
                swell_height = current.get("swell_wave_height", 0.3)
                
                # Determine sea state based on wave height (Douglas Scale)
                if wave_height < 0.1:
                    sea_state = "Calm (glassy)"
                elif wave_height < 0.5:
                    sea_state = "Calm (rippled)"
                elif wave_height < 1.25:
                    sea_state = "Slight"
                elif wave_height < 2.5:
                    sea_state = "Moderate"
                elif wave_height < 4.0:
                    sea_state = "Rough"
                elif wave_height < 6.0:
                    sea_state = "Very Rough"
                else:
                    sea_state = "High"
                
                # Generate boating advisory
                if wave_height < 0.5 and swell_height < 1.0:
                    advisory = "Excellent boating conditions. Safe for all vessels."
                elif wave_height < 1.0 and swell_height < 1.5:
                    advisory = "Good conditions. Suitable for small to medium boats."
                elif wave_height < 2.0:
                    advisory = "Fair conditions. Small craft should exercise caution."
                elif wave_height < 3.0:
                    advisory = "Moderate conditions. Not recommended for boats under 5m."
                else:
                    advisory = "CAUTION: Rough conditions. Only experienced skippers in larger vessels."
                
                # Visibility based on conditions
                visibility = "Good (>10km)" if wave_height < 2.0 else "Moderate (5-10km)"
                
                return MarineWeatherData(
                    wave_height=round(wave_height, 1),
                    wave_direction=get_wind_direction(current.get("wave_direction", 90)),
                    wave_period=round(current.get("wave_period", 6.0), 1),
                    swell_height=round(swell_height, 1),
                    swell_direction=get_wind_direction(current.get("swell_wave_direction", 135)),
                    swell_period=round(current.get("swell_wave_period", 8.0), 1),
                    water_temperature=24.5,  # Would need separate API for accurate data
                    visibility=visibility,
                    sea_state=sea_state,
                    boating_advisory=advisory,
                    updated_at=datetime.now(timezone.utc).isoformat()
                )
    except Exception as e:
        logger.error(f"Marine weather API error: {e}")
    
    # Fallback mock data
    return MarineWeatherData(
        wave_height=0.8,
        wave_direction="E",
        wave_period=6.5,
        swell_height=1.2,
        swell_direction="SE",
        swell_period=8.0,
        water_temperature=24.5,
        visibility="Good (>10km)",
        sea_state="Slight",
        boating_advisory="Good conditions. Suitable for small to medium boats.",
        updated_at=datetime.now(timezone.utc).isoformat()
    )

@api_router.get("/channel-markers", response_model=List[ChannelMarker])
async def get_channel_markers():
    """Get navigation channel markers for Moreton Bay from MSQ data"""
    markers = await db.channel_markers.find({}, {"_id": 0}).to_list(200)
    if not markers:
        # Seed default channel markers
        default_markers = get_default_channel_markers()
        await db.channel_markers.insert_many([m.model_dump() for m in default_markers])
        markers = [m.model_dump() for m in default_markers]
    return markers

def get_default_channel_markers() -> List[ChannelMarker]:
    """Default channel markers for Moreton Bay main channels - based on MSQ Beacon to Beacon guide"""
    return [
        # Brisbane River Entrance - Main Channel
        ChannelMarker(
            name="Fairway Buoy",
            marker_type="special",
            latitude=-27.3650,
            longitude=153.1833,
            description="Main shipping channel entrance marker",
            light_characteristics="Fl.Y.5s",
            color="yellow",
            shape="pillar"
        ),
        ChannelMarker(
            name="Moreton Bay G1",
            marker_type="starboard",
            latitude=-27.3517,
            longitude=153.1900,
            description="Green channel marker - keep to starboard when entering",
            light_characteristics="Fl.G.3s",
            color="green",
            shape="cone"
        ),
        ChannelMarker(
            name="Moreton Bay R2",
            marker_type="port",
            latitude=-27.3533,
            longitude=153.1750,
            description="Red channel marker - keep to port when entering",
            light_characteristics="Fl.R.3s",
            color="red",
            shape="can"
        ),
        # Boat Passage (to Tangalooma)
        ChannelMarker(
            name="Boat Passage G3",
            marker_type="starboard",
            latitude=-27.2167,
            longitude=153.3500,
            description="Northern boat passage to Tangalooma",
            light_characteristics="Fl.G.4s",
            color="green",
            shape="cone"
        ),
        ChannelMarker(
            name="Boat Passage R4",
            marker_type="port",
            latitude=-27.2200,
            longitude=153.3450,
            description="Northern boat passage marker",
            light_characteristics="Fl.R.4s",
            color="red",
            shape="can"
        ),
        # Rous Channel (to Manly/Wynnum)
        ChannelMarker(
            name="Rous Channel G5",
            marker_type="starboard",
            latitude=-27.4333,
            longitude=153.1833,
            description="Rous Channel to Manly Boat Harbour",
            light_characteristics="Fl.G.3s",
            color="green",
            shape="cone"
        ),
        ChannelMarker(
            name="Rous Channel R6",
            marker_type="port",
            latitude=-27.4350,
            longitude=153.1750,
            description="Rous Channel port marker",
            light_characteristics="Fl.R.3s",
            color="red",
            shape="can"
        ),
        # Wellington Point Channel
        ChannelMarker(
            name="Wellington Point G7",
            marker_type="starboard",
            latitude=-27.4667,
            longitude=153.2333,
            description="Wellington Point approach",
            light_characteristics="Fl.G.5s",
            color="green",
            shape="cone"
        ),
        # Redland Bay Channel
        ChannelMarker(
            name="Redland Bay R8",
            marker_type="port",
            latitude=-27.5833,
            longitude=153.3000,
            description="Redland Bay marina approach",
            light_characteristics="Fl.R.4s",
            color="red",
            shape="can"
        ),
        # Cardinal Markers - Dangerous Shoals
        ChannelMarker(
            name="Middle Banks North Cardinal",
            marker_type="cardinal_north",
            latitude=-27.2833,
            longitude=153.2667,
            description="Pass to NORTH of this marker - shallow water to south",
            light_characteristics="Q(9)15s",
            color="black_yellow",
            shape="pillar"
        ),
        ChannelMarker(
            name="Fisherman Islands South Cardinal",
            marker_type="cardinal_south",
            latitude=-27.3833,
            longitude=153.1583,
            description="Pass to SOUTH of this marker - shallow water to north",
            light_characteristics="Q(6)+LFl.10s",
            color="yellow_black",
            shape="pillar"
        ),
        ChannelMarker(
            name="Mud Island East Cardinal",
            marker_type="cardinal_east",
            latitude=-27.3400,
            longitude=153.2583,
            description="Pass to EAST of this marker - shallow water to west",
            light_characteristics="Q(3)5s",
            color="black_yellow_black",
            shape="pillar"
        ),
        ChannelMarker(
            name="St Helena West Cardinal",
            marker_type="cardinal_west",
            latitude=-27.3833,
            longitude=153.2333,
            description="Pass to WEST of this marker - shallow water to east",
            light_characteristics="Q(9)10s",
            color="yellow_black_yellow",
            shape="pillar"
        ),
        # North Stradbroke Approach
        ChannelMarker(
            name="Dunwich Channel G9",
            marker_type="starboard",
            latitude=-27.5000,
            longitude=153.4000,
            description="Dunwich ferry terminal approach",
            light_characteristics="Fl.G.3s",
            color="green",
            shape="cone"
        ),
        ChannelMarker(
            name="Dunwich Channel R10",
            marker_type="port",
            latitude=-27.5017,
            longitude=153.3950,
            description="Dunwich channel port marker",
            light_characteristics="Fl.R.3s",
            color="red",
            shape="can"
        ),
        # Scarborough Entrance
        ChannelMarker(
            name="Scarborough G11",
            marker_type="starboard",
            latitude=-27.1950,
            longitude=153.1083,
            description="Scarborough Marina approach - starboard",
            light_characteristics="Fl.G.4s",
            color="green",
            shape="cone"
        ),
        ChannelMarker(
            name="Scarborough R12",
            marker_type="port",
            latitude=-27.1967,
            longitude=153.1050,
            description="Scarborough Marina approach - port",
            light_characteristics="Fl.R.4s",
            color="red",
            shape="can"
        ),
        # Special Markers - Cables/Pipelines
        ChannelMarker(
            name="Cable Area - Fisherman Islands",
            marker_type="special",
            latitude=-27.3767,
            longitude=153.1717,
            description="WARNING: Submarine cables - No anchoring",
            light_characteristics="Fl.Y.5s",
            color="yellow",
            shape="sphere"
        ),
        ChannelMarker(
            name="Pipeline Area - Port of Brisbane",
            marker_type="special",
            latitude=-27.3683,
            longitude=153.1650,
            description="WARNING: Pipeline crossing - No anchoring",
            light_characteristics="Fl.Y.5s",
            color="yellow",
            shape="sphere"
        ),
        # Isolated Danger - Wrecks
        ChannelMarker(
            name="Isolated Danger - Wreck",
            marker_type="isolated_danger",
            latitude=-27.2500,
            longitude=153.2833,
            description="DANGER: Submerged wreck - pass well clear",
            light_characteristics="Fl(2)5s",
            color="black_red_black",
            shape="pillar"
        ),
    ]

async def fetch_marine_data() -> dict:
    """Fetch marine/tide data from Open-Meteo Marine API"""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            url = f"https://marine-api.open-meteo.com/v1/marine"
            params = {
                "latitude": SEQ_LAT,
                "longitude": SEQ_LON,
                "hourly": "wave_height,wave_direction,wave_period,swell_wave_height,swell_wave_direction",
                "timezone": "Australia/Brisbane",
                "forecast_days": 1
            }
            response = await client.get(url, params=params)
            response.raise_for_status()
            return response.json()
    except Exception as e:
        logger.error(f"Marine API error: {e}")
        return None

@api_router.get("/tides", response_model=TideData)
async def get_tides():
    """Get tide predictions - uses calculated tides based on lunar cycle"""
    now = datetime.now(timezone.utc)
    
    # Calculate approximate tide times based on moon phase
    # Brisbane tides roughly follow a 12h 25min cycle
    lunar_day_mins = 24 * 60 + 50  # 24 hours 50 minutes
    day_progress = (now.hour * 60 + now.minute) / lunar_day_mins
    
    # Approximate high/low tide times
    high_hour = int((day_progress * 12.4) % 12)
    low_hour = (high_hour + 6) % 12
    
    high_time_am = f"{high_hour:02d}:{(int(day_progress * 60) % 60):02d} AM"
    low_time_pm = f"{low_hour:02d}:{((int(day_progress * 60) + 30) % 60):02d} PM"
    next_high = f"{(high_hour + 12) % 24:02d}:{(int(day_progress * 60) % 60):02d}"
    
    # Tide heights vary with moon phase
    moon_factor = abs(math.sin(math.pi * day_progress))
    high_height = round(1.6 + (moon_factor * 0.8), 1)  # 1.6-2.4m range
    low_height = round(0.3 + (moon_factor * 0.3), 1)   # 0.3-0.6m range
    
    return TideData(
        high_tide_time=high_time_am,
        high_tide_height=high_height,
        low_tide_time=low_time_pm,
        low_tide_height=low_height,
        next_high=next_high,
        next_low=f"{(low_hour + 12) % 24:02d}:30",
        updated_at=now.isoformat()
    )

@api_router.get("/marine-conditions")
async def get_marine_conditions():
    """Get current marine/ocean conditions"""
    data = await fetch_marine_data()
    
    if data and "hourly" in data:
        hourly = data["hourly"]
        current_hour = datetime.now().hour
        
        return {
            "wave_height": hourly.get("wave_height", [0] * 24)[current_hour],
            "wave_direction": hourly.get("wave_direction", [0] * 24)[current_hour],
            "wave_period": hourly.get("wave_period", [0] * 24)[current_hour],
            "swell_height": hourly.get("swell_wave_height", [0] * 24)[current_hour],
            "swell_direction": hourly.get("swell_wave_direction", [0] * 24)[current_hour],
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "source": "Open-Meteo Marine API"
        }
    
    # Fallback mock data
    return {
        "wave_height": 0.8,
        "wave_direction": 135,
        "wave_period": 8,
        "swell_height": 1.2,
        "swell_direction": 90,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "source": "Mock Data (API unavailable)"
    }

def calculate_moon_phase():
    """Calculate moon phase based on lunar cycle"""
    from math import floor
    
    now = datetime.now(timezone.utc)
    
    # Known new moon date (Jan 29, 2025)
    known_new_moon = datetime(2025, 1, 29, 12, 36, tzinfo=timezone.utc)
    
    # Lunar cycle is approximately 29.53 days
    lunar_cycle = 29.53
    
    # Days since known new moon
    days_since = (now - known_new_moon).total_seconds() / 86400
    
    # Current position in lunar cycle (0-29.53)
    cycle_position = days_since % lunar_cycle
    
    # Calculate illumination (0-100%)
    if cycle_position <= lunar_cycle / 2:
        illumination = int((cycle_position / (lunar_cycle / 2)) * 100)
    else:
        illumination = int(((lunar_cycle - cycle_position) / (lunar_cycle / 2)) * 100)
    
    # Determine phase name and icon
    if cycle_position < 1.85:
        phase, icon = "New Moon", "🌑"
        fishing_rating, tip = "Excellent", "New moon = excellent fishing! Fish feed more actively in low light."
    elif cycle_position < 7.38:
        phase, icon = "Waxing Crescent", "🌒"
        fishing_rating, tip = "Good", "Fish are becoming more active as the moon grows."
    elif cycle_position < 9.23:
        phase, icon = "First Quarter", "🌓"
        fishing_rating, tip = "Good", "Moderate tidal movement, good for estuary fishing."
    elif cycle_position < 14.76:
        phase, icon = "Waxing Gibbous", "🌔"
        fishing_rating, tip = "Fair", "Fish may feed less during bright nights."
    elif cycle_position < 16.61:
        phase, icon = "Full Moon", "🌕"
        fishing_rating, tip = "Excellent", "Full moon = strong tides and active fish! Best night fishing."
    elif cycle_position < 22.14:
        phase, icon = "Waning Gibbous", "🌖"
        fishing_rating, tip = "Good", "Fish still active from full moon influence."
    elif cycle_position < 23.99:
        phase, icon = "Last Quarter", "🌗"
        fishing_rating, tip = "Good", "Good tidal movement, try dawn and dusk."
    else:
        phase, icon = "Waning Crescent", "🌘"
        fishing_rating, tip = "Very Good", "Fish feeding increases as moon approaches new phase."
    
    # Days until next full and new moon
    days_until_full = int((lunar_cycle / 2 - cycle_position) % lunar_cycle)
    if days_until_full > lunar_cycle / 2:
        days_until_full = int(lunar_cycle - days_until_full)
    
    days_until_new = int((lunar_cycle - cycle_position) % lunar_cycle)
    if days_until_new == 0:
        days_until_new = int(lunar_cycle)
    
    return {
        "phase": phase,
        "illumination": illumination,
        "phase_icon": icon,
        "days_until_full": days_until_full,
        "days_until_new": days_until_new,
        "fishing_rating": fishing_rating,
        "fishing_tip": tip,
    }

@api_router.get("/moon-phase", response_model=MoonPhaseData)
async def get_moon_phase():
    moon_data = calculate_moon_phase()
    return MoonPhaseData(
        **moon_data,
        updated_at=datetime.now(timezone.utc).isoformat()
    )

@api_router.get("/tidal-flow", response_model=TidalFlowData)
async def get_tidal_flow():
    """Get current tidal flow conditions for Moreton Bay"""
    from math import sin, pi
    
    now = datetime.now(timezone.utc)
    # Simulate tidal flow based on time (simplified model)
    hour = now.hour + now.minute / 60
    
    # Tidal cycle approximately 12.4 hours
    tidal_position = (hour % 12.4) / 12.4
    
    # Calculate current speed (0-2 knots typically)
    # Max flow at 1/4 and 3/4 of cycle, slack at 0 and 1/2
    flow_factor = abs(sin(tidal_position * 2 * pi))
    current_speed = round(flow_factor * 1.8, 1)
    
    # Determine flow state
    if tidal_position < 0.25:
        flow_state = "Flooding"
        direction = "NW"
    elif tidal_position < 0.5:
        flow_state = "Flooding" if tidal_position < 0.45 else "Slack High"
        direction = "N"
    elif tidal_position < 0.75:
        flow_state = "Ebbing"
        direction = "SE"
    else:
        flow_state = "Ebbing" if tidal_position < 0.95 else "Slack Low"
        direction = "S"
    
    if current_speed < 0.3:
        flow_state = "Slack"
        
    return TidalFlowData(
        current_speed=current_speed,
        current_direction=direction,
        flow_state=flow_state,
        water_temp=23.5,
        visibility="Good (5-8m)",
        updated_at=now.isoformat()
    )

@api_router.get("/bathymetry/contours")
async def get_bathymetry_contours():
    """Get depth contour data for SEQ waters"""
    # Simplified contour lines for SEQ - in production would use GEBCO data
    contours = [
        # 5m contour - inner bay
        {"depth": 5, "coordinates": [
            [-27.35, 153.10], [-27.40, 153.15], [-27.45, 153.18], 
            [-27.50, 153.20], [-27.55, 153.22]
        ]},
        # 10m contour
        {"depth": 10, "coordinates": [
            [-27.30, 153.20], [-27.35, 153.25], [-27.40, 153.28],
            [-27.50, 153.30], [-27.60, 153.32]
        ]},
        # 20m contour - outer bay
        {"depth": 20, "coordinates": [
            [-27.20, 153.30], [-27.30, 153.35], [-27.45, 153.40],
            [-27.60, 153.42], [-27.80, 153.45]
        ]},
        # 30m contour - offshore
        {"depth": 30, "coordinates": [
            [-27.10, 153.40], [-27.30, 153.45], [-27.50, 153.50],
            [-27.70, 153.52], [-27.90, 153.55]
        ]},
        # 50m contour - deep offshore
        {"depth": 50, "coordinates": [
            [-27.00, 153.50], [-27.20, 153.55], [-27.50, 153.60],
            [-27.80, 153.62], [-28.00, 153.65]
        ]},
    ]
    return {"contours": contours, "unit": "meters"}

# ============== SHIPWRECKS ==============

def get_seq_shipwrecks() -> List[dict]:
    """Real shipwrecks in SEQ waters - excellent fishing spots"""
    return [
        {
            "id": "wreck-tangalooma",
            "name": "Tangalooma Wrecks",
            "latitude": -27.1833,
            "longitude": 153.3717,
            "depth": 12.0,
            "sunk_year": 1963,
            "vessel_type": "Fleet (15 vessels)",
            "length": None,
            "description": "15 vessels deliberately sunk to create artificial reef. Queensland's most famous dive and fishing site.",
            "fish_species": ["Snapper", "Sweetlip", "Trevally", "Bream", "Wobbegong"],
            "dive_accessible": True
        },
        {
            "id": "wreck-curtin",
            "name": "HMAS Curtin (ex-Dorade)",
            "latitude": -27.0667,
            "longitude": 153.4833,
            "depth": 28.0,
            "sunk_year": 2000,
            "vessel_type": "Naval Patrol Boat",
            "length": 32.0,
            "description": "Former Navy patrol boat scuttled as artificial reef. Excellent snapper and jewfish.",
            "fish_species": ["Snapper", "Jewfish", "Cobia", "Trevally"],
            "dive_accessible": True
        },
        {
            "id": "wreck-glory-hole",
            "name": "Glory Hole Barge",
            "latitude": -27.3500,
            "longitude": 153.4167,
            "depth": 18.0,
            "sunk_year": 1985,
            "vessel_type": "Barge",
            "length": 45.0,
            "description": "Large barge wreck east of Moreton Island. Holds big snapper and pearl perch.",
            "fish_species": ["Snapper", "Pearl Perch", "Sweetlip", "Moses Perch"],
            "dive_accessible": True
        },
        {
            "id": "wreck-scottish-prince",
            "name": "Scottish Prince",
            "latitude": -27.4333,
            "longitude": 153.5500,
            "depth": 32.0,
            "sunk_year": 1887,
            "vessel_type": "Cargo Ship",
            "length": 78.0,
            "description": "Historic wreck from 1887 collision. Deep wreck with excellent reef fish.",
            "fish_species": ["Snapper", "Pearl Perch", "Cobia", "Amberjack"],
            "dive_accessible": True
        },
        {
            "id": "wreck-palm-beach-reef",
            "name": "Palm Beach Artificial Reef",
            "latitude": -28.1167,
            "longitude": 153.5000,
            "depth": 24.0,
            "sunk_year": 2009,
            "vessel_type": "Artificial Reef Modules",
            "length": None,
            "description": "Purpose-built artificial reef off Palm Beach. Great for snapper and jewfish.",
            "fish_species": ["Snapper", "Jewfish", "Trevally", "Kingfish"],
            "dive_accessible": True
        },
        {
            "id": "wreck-kirra-reef",
            "name": "Kirra Artificial Reef",
            "latitude": -28.1667,
            "longitude": 153.5333,
            "depth": 22.0,
            "sunk_year": 2006,
            "vessel_type": "Concrete Modules",
            "length": None,
            "description": "Artificial reef complex off Kirra. Popular for bottom fishing.",
            "fish_species": ["Snapper", "Sweetlip", "Moses Perch", "Bream"],
            "dive_accessible": True
        },
        {
            "id": "wreck-seaway-tower",
            "name": "Old Seaway Tower",
            "latitude": -27.9350,
            "longitude": 153.4300,
            "depth": 8.0,
            "sunk_year": 1995,
            "vessel_type": "Navigation Structure",
            "length": None,
            "description": "Old navigation tower base near Gold Coast Seaway. Great bream and flathead.",
            "fish_species": ["Bream", "Flathead", "Trevally", "Tailor"],
            "dive_accessible": False
        },
        {
            "id": "wreck-mooloolaba-fads",
            "name": "Mooloolaba FADs",
            "latitude": -26.6500,
            "longitude": 153.2500,
            "depth": 45.0,
            "sunk_year": 2015,
            "vessel_type": "Fish Aggregation Devices",
            "length": None,
            "description": "Offshore FADs attracting pelagic species. Excellent for mahi mahi and tuna.",
            "fish_species": ["Mahi Mahi", "Wahoo", "Tuna", "Marlin"],
            "dive_accessible": False
        },
        {
            "id": "wreck-flinders-reef",
            "name": "Flinders Reef Wrecks",
            "latitude": -26.9833,
            "longitude": 153.4833,
            "depth": 20.0,
            "sunk_year": None,
            "vessel_type": "Multiple Historic",
            "length": None,
            "description": "Multiple historic wrecks on Flinders Reef. Diverse marine life and great fishing.",
            "fish_species": ["Snapper", "Cobia", "Trevally", "Mackerel"],
            "dive_accessible": True
        },
        {
            "id": "wreck-ex-hmas-brisbane",
            "name": "Ex-HMAS Brisbane",
            "latitude": -26.6117,
            "longitude": 153.2783,
            "depth": 28.0,
            "sunk_year": 2005,
            "vessel_type": "Naval Destroyer",
            "length": 133.0,
            "description": "Former Navy destroyer scuttled off Mooloolaba. One of Australia's best dive wrecks.",
            "fish_species": ["Snapper", "Jewfish", "Cobia", "Kingfish", "Wobbegong"],
            "dive_accessible": True
        },
    ]

@api_router.get("/wrecks", response_model=List[ShipwreckData])
async def get_shipwrecks():
    """Get all shipwrecks in SEQ waters"""
    wrecks = get_seq_shipwrecks()
    return [ShipwreckData(**w) for w in wrecks]

@api_router.get("/wrecks/{wreck_id}")
async def get_wreck_by_id(wreck_id: str):
    """Get specific wreck details"""
    wrecks = get_seq_shipwrecks()
    wreck = next((w for w in wrecks if w["id"] == wreck_id), None)
    if not wreck:
        raise HTTPException(status_code=404, detail="Wreck not found")
    return wreck

# ============== SUN & SOLUNAR ==============

@api_router.get("/sun-times", response_model=SunMoonTimes)
async def get_sun_times():
    """Get sunrise/sunset times for SEQ (Brisbane)"""
    from math import sin, cos, acos, radians, degrees
    
    now = datetime.now(timezone.utc)
    # Brisbane coordinates
    lat, lon = -27.4698, 153.0251
    
    # Simplified sunrise/sunset calculation
    day_of_year = now.timetuple().tm_yday
    
    # Solar declination
    declination = -23.45 * cos(radians(360/365 * (day_of_year + 10)))
    
    # Hour angle
    hour_angle = degrees(acos(-sin(radians(lat)) * sin(radians(declination)) / 
                              (cos(radians(lat)) * cos(radians(declination)))))
    
    # Solar noon (approx 12:00 + timezone offset)
    solar_noon_hour = 12 - (lon - 150) / 15  # 150° is AEST reference
    
    sunrise_hour = solar_noon_hour - hour_angle / 15
    sunset_hour = solar_noon_hour + hour_angle / 15
    
    def format_time(hour):
        h = int(hour)
        m = int((hour - h) * 60)
        return f"{h:02d}:{m:02d}"
    
    return SunMoonTimes(
        sunrise=format_time(sunrise_hour + 10),  # Add AEST offset
        sunset=format_time(sunset_hour + 10),
        first_light=format_time(sunrise_hour + 10 - 0.5),
        last_light=format_time(sunset_hour + 10 + 0.5),
        day_length=format_time(sunset_hour - sunrise_hour) + " hrs",
        solar_noon=format_time(solar_noon_hour + 10),
        golden_hour_am=format_time(sunrise_hour + 10) + " - " + format_time(sunrise_hour + 10 + 1),
        golden_hour_pm=format_time(sunset_hour + 10 - 1) + " - " + format_time(sunset_hour + 10),
    )

@api_router.get("/solunar", response_model=SolunarData)
async def get_solunar_times():
    """Get solunar feeding times - when fish are most active"""
    from math import sin, pi
    
    now = datetime.now(timezone.utc)
    
    # Lunar day is approximately 24h 50m
    lunar_day_minutes = 24 * 60 + 50
    
    # Calculate moon transit time (simplified)
    days_since_new = (now - datetime(2025, 1, 29, 12, 36, tzinfo=timezone.utc)).total_seconds() / 86400
    lunar_position = (days_since_new % 29.53) / 29.53
    
    # Moon overhead time (major period 1)
    moon_overhead = (lunar_position * lunar_day_minutes) % (24 * 60)
    moon_underfoot = (moon_overhead + 12 * 60 + 25) % (24 * 60)
    
    # Minor periods at moonrise/moonset (6h 12m offset)
    moonrise = (moon_overhead - 6 * 60 - 12) % (24 * 60)
    moonset = (moon_overhead + 6 * 60 + 12) % (24 * 60)
    
    def format_minutes(mins):
        h = int(mins // 60) % 24
        m = int(mins % 60)
        return f"{h:02d}:{m:02d}"
    
    # Determine rating based on moon phase
    if lunar_position < 0.05 or lunar_position > 0.95:
        rating = "Excellent (New Moon)"
    elif 0.45 < lunar_position < 0.55:
        rating = "Excellent (Full Moon)"
    elif 0.2 < lunar_position < 0.3 or 0.7 < lunar_position < 0.8:
        rating = "Good (Quarter Moon)"
    else:
        rating = "Average"
    
    # Best time is first major period after sunrise
    best_hour = int(moon_overhead // 60)
    if 5 <= best_hour <= 18:
        best_time = f"Major period at {format_minutes(moon_overhead)}"
    else:
        best_time = f"Major period at {format_minutes(moon_underfoot)}"
    
    return SolunarData(
        major_one_start=format_minutes(moon_overhead - 60),
        major_one_end=format_minutes(moon_overhead + 60),
        major_two_start=format_minutes(moon_underfoot - 60),
        major_two_end=format_minutes(moon_underfoot + 60),
        minor_one_start=format_minutes(moonrise - 30),
        minor_one_end=format_minutes(moonrise + 30),
        minor_two_start=format_minutes(moonset - 30),
        minor_two_end=format_minutes(moonset + 30),
        rating=rating,
        best_time=best_time,
    )

# ============== SAFETY & EMERGENCY ==============

@api_router.get("/safety", response_model=SafetyInfo)
async def get_safety_info():
    """Get emergency contacts and safety information"""
    return SafetyInfo(
        vmr_phone="1800 686 586",
        coast_guard="1800 644 325",
        police_water="131 444",
        weather_warnings=[
            "Check BOM marine forecast before departing",
            "Strong wind warning currently active for offshore waters",
        ],
        safety_tips=[
            "Always wear a lifejacket",
            "File a float plan with someone onshore",
            "Carry EPIRB and flares",
            "Check fuel before departing - carry 1/3 out, 1/3 back, 1/3 reserve",
            "Monitor VHF Channel 16",
            "Check bar conditions before crossing",
        ]
    )

@api_router.get("/regulations")
async def get_fishing_regulations():
    """Get current fishing regulations summary for SEQ"""
    return {
        "last_updated": "2026-01-01",
        "license_required": True,
        "license_info": "Queensland recreational fishing is free but some species require tags",
        "size_limits": [
            {"species": "Snapper", "min_size_cm": 35, "bag_limit": 4},
            {"species": "Flathead (Dusky)", "min_size_cm": 40, "bag_limit": 10},
            {"species": "Whiting", "min_size_cm": 23, "bag_limit": 30},
            {"species": "Bream", "min_size_cm": 25, "bag_limit": 20},
            {"species": "Tailor", "min_size_cm": 35, "bag_limit": 20},
            {"species": "Cobia", "min_size_cm": 75, "bag_limit": 2},
            {"species": "Jewfish/Mulloway", "min_size_cm": 75, "bag_limit": 2},
        ],
        "closed_seasons": [
            {"species": "Snapper", "closure": "None currently"},
            {"species": "Coral Trout", "closure": "7-day spawning closure Oct"},
        ],
        "protected_species": [
            "Dugong", "Dolphins", "Turtles", "Potato Cod", "Humphead Maori Wrasse"
        ],
        "green_zones": [
            "Moreton Bay Marine Park - check zoning maps",
            "Flinders Reef - restricted areas"
        ],
        "more_info_url": "https://www.qld.gov.au/recreation/activities/boating-fishing/rec-fishing"
    }

# ============== TRIP PLANNER ==============

@api_router.get("/trips")
async def get_user_trips(current_user: dict = Depends(get_current_user)):
    """Get all trips for current user"""
    trips = await db.trips.find({"user_id": current_user["id"]}, {"_id": 0}).to_list(50)
    return trips

@api_router.post("/trips")
async def create_trip(trip_data: dict, current_user: dict = Depends(get_current_user)):
    """Create a new trip plan"""
    trip = TripPlan(
        user_id=current_user["id"],
        name=trip_data.get("name", "Fishing Trip"),
        trip_date=trip_data.get("trip_date"),
        waypoints=trip_data.get("waypoints", []),
        notes=trip_data.get("notes"),
        checklist=trip_data.get("checklist", [])
    )
    await db.trips.insert_one(trip.model_dump())
    return trip.model_dump()

@api_router.get("/trips/{trip_id}")
async def get_trip(trip_id: str, current_user: dict = Depends(get_current_user)):
    """Get a specific trip"""
    trip = await db.trips.find_one({"id": trip_id, "user_id": current_user["id"]}, {"_id": 0})
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    return trip

@api_router.put("/trips/{trip_id}")
async def update_trip(trip_id: str, trip_data: dict, current_user: dict = Depends(get_current_user)):
    """Update a trip plan"""
    trip_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.trips.update_one(
        {"id": trip_id, "user_id": current_user["id"]},
        {"$set": trip_data}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Trip not found")
    return await db.trips.find_one({"id": trip_id}, {"_id": 0})

@api_router.delete("/trips/{trip_id}")
async def delete_trip(trip_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a trip"""
    result = await db.trips.delete_one({"id": trip_id, "user_id": current_user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Trip not found")
    return {"message": "Trip deleted"}

@api_router.get("/trip-checklist-template")
async def get_checklist_template():
    """Get default fishing trip checklist"""
    return {
        "categories": [
            {
                "name": "Safety",
                "items": [
                    {"id": "safety-1", "text": "Life jackets for all passengers", "required": True},
                    {"id": "safety-2", "text": "EPIRB registered and charged", "required": True},
                    {"id": "safety-3", "text": "Flares (in date)", "required": True},
                    {"id": "safety-4", "text": "First aid kit", "required": True},
                    {"id": "safety-5", "text": "VHF radio / Phone charged", "required": True},
                    {"id": "safety-6", "text": "Float plan filed with contact", "required": False},
                ]
            },
            {
                "name": "Boat",
                "items": [
                    {"id": "boat-1", "text": "Fuel - 1/3 out, 1/3 back, 1/3 reserve", "required": True},
                    {"id": "boat-2", "text": "Anchor and rope", "required": True},
                    {"id": "boat-3", "text": "Bilge pump working", "required": True},
                    {"id": "boat-4", "text": "Navigation lights working", "required": False},
                    {"id": "boat-5", "text": "Boat plug in!", "required": True},
                ]
            },
            {
                "name": "Fishing Gear",
                "items": [
                    {"id": "gear-1", "text": "Rods and reels", "required": True},
                    {"id": "gear-2", "text": "Tackle box", "required": True},
                    {"id": "gear-3", "text": "Bait / lures", "required": True},
                    {"id": "gear-4", "text": "Knife / pliers", "required": True},
                    {"id": "gear-5", "text": "Fish measure / scale", "required": False},
                    {"id": "gear-6", "text": "Esky with ice", "required": True},
                    {"id": "gear-7", "text": "Landing net / gaff", "required": False},
                ]
            },
            {
                "name": "Personal",
                "items": [
                    {"id": "personal-1", "text": "Sunscreen", "required": True},
                    {"id": "personal-2", "text": "Hat and sunglasses", "required": True},
                    {"id": "personal-3", "text": "Food and water", "required": True},
                    {"id": "personal-4", "text": "Rain jacket", "required": False},
                    {"id": "personal-5", "text": "Camera", "required": False},
                ]
            }
        ]
    }

@api_router.post("/calculate-route")
async def calculate_route(waypoints: List[dict]):
    """Calculate distance and estimated time between waypoints"""
    from math import radians, sin, cos, sqrt, atan2
    
    def haversine(lat1, lon1, lat2, lon2):
        R = 6371  # Earth's radius in km
        lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
        c = 2 * atan2(sqrt(a), sqrt(1-a))
        return R * c
    
    if len(waypoints) < 2:
        return {"total_distance_km": 0, "total_distance_nm": 0, "legs": []}
    
    legs = []
    total_distance = 0
    
    for i in range(len(waypoints) - 1):
        wp1 = waypoints[i]
        wp2 = waypoints[i + 1]
        distance = haversine(wp1["latitude"], wp1["longitude"], wp2["latitude"], wp2["longitude"])
        total_distance += distance
        
        # Estimate time at 15 knots average
        time_hours = (distance / 1.852) / 15
        
        legs.append({
            "from": wp1.get("name", f"Point {i+1}"),
            "to": wp2.get("name", f"Point {i+2}"),
            "distance_km": round(distance, 2),
            "distance_nm": round(distance / 1.852, 2),
            "estimated_time_mins": round(time_hours * 60)
        })
    
    return {
        "total_distance_km": round(total_distance, 2),
        "total_distance_nm": round(total_distance / 1.852, 2),
        "estimated_total_time_mins": sum(leg["estimated_time_mins"] for leg in legs),
        "legs": legs
    }

# ============== DEFAULT DATA ==============

def get_default_spots() -> List[FishingSpot]:
    return [
        # Moreton Bay
        FishingSpot(
            name="Mud Island", description="Popular spot for flathead and whiting. Shallow flats ideal for wade fishing.",
            latitude=-27.3380, longitude=153.2280, fish_types=["Flathead", "Whiting", "Bream"],
            best_time="Early morning, incoming tide", difficulty="beginner", facilities=["Anchor point"],
            rating=4.5, image_url="https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=400"
        ),
        FishingSpot(
            name="Tangalooma Wrecks", description="15 sunken ships creating an artificial reef. Excellent for snapper and sweetlip.",
            latitude=-27.1830, longitude=153.3720, fish_types=["Snapper", "Sweetlip", "Trevally", "Bream"],
            best_time="Dawn and dusk", difficulty="intermediate", facilities=["Mooring buoys"],
            rating=4.8, image_url="https://images.unsplash.com/photo-1534766555764-ce878a5e3a2b?w=400"
        ),
        FishingSpot(
            name="Peel Island", description="Historic quarantine station area. Great for reef fish and pelagics.",
            latitude=-27.5020, longitude=153.3520, fish_types=["Snapper", "Pearl Perch", "Cobia"],
            best_time="Mid-morning, run-out tide", difficulty="advanced", facilities=["Anchor point", "Sheltered bays"],
            rating=4.3, image_url="https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=400"
        ),
        FishingSpot(
            name="Wynnum Flats", description="Easy access shore fishing. Perfect for beginners targeting whiting.",
            latitude=-27.4420, longitude=153.1630, fish_types=["Whiting", "Flathead", "Bream"],
            best_time="Incoming tide", difficulty="beginner", facilities=["Parking", "Toilets", "Jetty"],
            rating=4.0, image_url="https://images.unsplash.com/photo-1515541324332-7dd0c37426e0?w=400"
        ),
        FishingSpot(
            name="Green Island", description="Offshore reef with excellent snapper fishing year-round.",
            latitude=-27.4250, longitude=153.4180, fish_types=["Snapper", "Pearl Perch", "Sweetlip", "Tuskfish"],
            best_time="Early morning", difficulty="advanced", facilities=["Deep water anchorage"],
            rating=4.6, image_url="https://images.unsplash.com/photo-1682687220063-4742bd7fd538?w=400"
        ),
        FishingSpot(
            name="Wellington Point", description="Popular land-based fishing with access to deep water.",
            latitude=-27.4680, longitude=153.2420, fish_types=["Bream", "Flathead", "Tailor"],
            best_time="Evening, high tide", difficulty="beginner", facilities=["Parking", "Toilets", "Cafe nearby"],
            rating=4.2, image_url="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400"
        ),
        # Gold Coast
        FishingSpot(
            name="The Seaway", description="Gold Coast's premier fishing spot. Strong currents attract big fish.",
            latitude=-27.9380, longitude=153.4280, fish_types=["Tailor", "Trevally", "Jew", "Snapper"],
            best_time="Change of tide", difficulty="intermediate", facilities=["Rock wall", "Parking", "Lights"],
            rating=4.7, image_url="https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=400"
        ),
        FishingSpot(
            name="Jumpinpin", description="Channel between North and South Stradbroke. Excellent for big flathead.",
            latitude=-27.7280, longitude=153.4380, fish_types=["Flathead", "Whiting", "Bream", "Mangrove Jack"],
            best_time="Run-out tide", difficulty="intermediate", facilities=["Boat access only"],
            rating=4.5, image_url="https://images.unsplash.com/photo-1534766555764-ce878a5e3a2b?w=400"
        ),
        FishingSpot(
            name="Currumbin Rock", description="Land-based rock fishing. Popular for jewfish and tailor.",
            latitude=-28.1380, longitude=153.4880, fish_types=["Jewfish", "Tailor", "Bream", "Dart"],
            best_time="Dawn, high tide", difficulty="beginner", facilities=["Parking", "Beach access"],
            rating=4.2, image_url="https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=400"
        ),
        FishingSpot(
            name="Broadwater", description="Calm protected waters perfect for families. Great bream and flathead.",
            latitude=-27.9680, longitude=153.4080, fish_types=["Bream", "Flathead", "Whiting", "Flounder"],
            best_time="Morning, incoming tide", difficulty="beginner", facilities=["Boat ramps", "Jetties", "Parking"],
            rating=4.3, image_url="https://images.unsplash.com/photo-1515541324332-7dd0c37426e0?w=400"
        ),
        # Sunshine Coast
        FishingSpot(
            name="Mooloolaba Harbour", description="Protected harbour with good bream and flathead fishing.",
            latitude=-26.6830, longitude=153.1180, fish_types=["Bream", "Flathead", "Trevally", "Whiting"],
            best_time="Evening, high tide", difficulty="beginner", facilities=["Jetty", "Parking", "Toilets", "Shops"],
            rating=4.4, image_url="https://images.unsplash.com/photo-1682687220063-4742bd7fd538?w=400"
        ),
        FishingSpot(
            name="Noosa River Mouth", description="Famous for tailor and dart. Great beach and river fishing.",
            latitude=-26.3830, longitude=153.0780, fish_types=["Tailor", "Dart", "Bream", "Flathead", "Jewfish"],
            best_time="Dawn and dusk", difficulty="intermediate", facilities=["Beach parking", "Shops nearby"],
            rating=4.6, image_url="https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=400"
        ),
        FishingSpot(
            name="Caloundra Headland", description="Rock fishing with deep water access. Great for pelagics.",
            latitude=-26.8030, longitude=153.1380, fish_types=["Snapper", "Tailor", "Mackerel", "Trevally"],
            best_time="Early morning", difficulty="intermediate", facilities=["Parking", "Toilets"],
            rating=4.3, image_url="https://images.unsplash.com/photo-1534766555764-ce878a5e3a2b?w=400"
        ),
        FishingSpot(
            name="Pumicestone Passage", description="Shallow estuary famous for whiting. Ideal kayak fishing.",
            latitude=-26.9280, longitude=153.1080, fish_types=["Whiting", "Flathead", "Bream", "Flounder"],
            best_time="Incoming tide", difficulty="beginner", facilities=["Multiple boat ramps", "Kayak launches"],
            rating=4.5, image_url="https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=400"
        ),
        # Brisbane River
        FishingSpot(
            name="Brisbane River - City Reach", description="Urban fishing with surprising catches. Night fishing popular.",
            latitude=-27.4698, longitude=153.0251, fish_types=["Bream", "Flathead", "Bass", "Eel"],
            best_time="Night, run-out tide", difficulty="beginner", facilities=["City access", "Lights", "Public transport"],
            rating=3.8, image_url="https://images.unsplash.com/photo-1515541324332-7dd0c37426e0?w=400"
        ),
        FishingSpot(
            name="Breakfast Creek", description="Classic Brisbane fishing spot. Good bream and flathead.",
            latitude=-27.4480, longitude=153.0480, fish_types=["Bream", "Flathead", "Mangrove Jack"],
            best_time="Evening, high tide", difficulty="beginner", facilities=["Parking", "Pub nearby"],
            rating=4.0, image_url="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400"
        ),
        # Stradbroke Island
        FishingSpot(
            name="Point Lookout", description="North Stradbroke headland. Excellent whale watching and fishing.",
            latitude=-27.4380, longitude=153.5380, fish_types=["Tailor", "Snapper", "Kingfish", "Tuna"],
            best_time="Dawn", difficulty="advanced", facilities=["Parking", "Walking tracks"],
            rating=4.7, image_url="https://images.unsplash.com/photo-1682687220063-4742bd7fd538?w=400"
        ),
        FishingSpot(
            name="Amity Point", description="Calm waters perfect for family fishing. Famous for squid.",
            latitude=-27.4080, longitude=153.4380, fish_types=["Squid", "Whiting", "Bream", "Flathead"],
            best_time="Evening", difficulty="beginner", facilities=["Jetty", "Parking", "Toilets"],
            rating=4.4, image_url="https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=400"
        ),
    ]

def get_spot_depths() -> dict:
    """Depth data for fishing spots in meters"""
    return {
        "Mud Island": {"depth": 3.5, "bottom": "Sand/Mud"},
        "Tangalooma Wrecks": {"depth": 12.0, "bottom": "Reef/Wreck"},
        "Peel Island": {"depth": 18.0, "bottom": "Rocky Reef"},
        "Wynnum Flats": {"depth": 2.0, "bottom": "Sand"},
        "Green Island": {"depth": 25.0, "bottom": "Rocky Reef"},
        "Wellington Point": {"depth": 4.0, "bottom": "Sand/Rock"},
        "The Seaway": {"depth": 15.0, "bottom": "Sand/Rock"},
        "Jumpinpin": {"depth": 8.0, "bottom": "Sand"},
        "Currumbin Rock": {"depth": 6.0, "bottom": "Rock"},
        "Broadwater": {"depth": 3.0, "bottom": "Sand/Mud"},
        "Mooloolaba Harbour": {"depth": 5.0, "bottom": "Sand"},
        "Noosa River Mouth": {"depth": 4.0, "bottom": "Sand"},
        "Caloundra Headland": {"depth": 12.0, "bottom": "Rock"},
        "Pumicestone Passage": {"depth": 2.5, "bottom": "Sand/Seagrass"},
        "Brisbane River - City Reach": {"depth": 8.0, "bottom": "Mud"},
        "Breakfast Creek": {"depth": 4.0, "bottom": "Mud"},
        "Point Lookout": {"depth": 30.0, "bottom": "Rocky Reef"},
        "Amity Point": {"depth": 5.0, "bottom": "Sand"},
    }

def get_default_species() -> List[FishSpecies]:
    """Fish species with official Queensland DPI regulations (2025)"""
    return [
        FishSpecies(
            name="Snapper", scientific_name="Pagrus auratus",
            description="One of the most sought-after species in SEQ. Pink-red body with blue spots. Found around reefs and structure.",
            min_size=35, bag_limit=4, best_bait=["Pilchards", "Squid", "Prawns"],
            best_season=["Autumn", "Winter"], image_url="https://images.unsplash.com/photo-1564677877393-2dbc65af5e41?w=400",
            closed_season_start="07-15", closed_season_end="08-15",
            closed_season_reason="East coast closure: 15 July to 15 August (QLD DPI)"
        ),
        FishSpecies(
            name="Barramundi", scientific_name="Lates calcarifer",
            description="Iconic Australian sportfish. Slot limit 58-120cm. Found in estuaries, rivers and coastal waters.",
            min_size=58, bag_limit=5, best_bait=["Live bait", "Mullet", "Soft plastics"],
            best_season=["Summer", "Wet season"], image_url="https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=400",
            closed_season_start="11-01", closed_season_end="01-31",
            closed_season_reason="East coast closure: 1 November to 31 January (QLD DPI)"
        ),
        FishSpecies(
            name="Dusky Flathead", scientific_name="Platycephalus fuscus",
            description="Bottom-dwelling predator found in sandy estuaries. Excellent eating. Note: Max size 75cm slot limit.",
            min_size=40, bag_limit=5, best_bait=["Live bait", "Soft plastics", "Prawns"],
            best_season=["Spring", "Summer", "Autumn"], image_url="https://images.unsplash.com/photo-1629140700093-63e7651a0ee0?w=400"
        ),
        FishSpecies(
            name="Sand Whiting", scientific_name="Sillago ciliata",
            description="Delicious table fish found on sandy flats. Great for beginners. Combined limit with goldenline and northern whiting.",
            min_size=23, bag_limit=30, best_bait=["Beach worms", "Yabbies", "Prawns"],
            best_season=["Summer", "Autumn"], image_url="https://images.unsplash.com/photo-1693608597171-eab7472e7999?w=400"
        ),
        FishSpecies(
            name="Yellowfin Bream", scientific_name="Acanthopagrus australis",
            description="Versatile fish found around structure. Strong fighters for their size. Combined limit with pikey bream and tarwhine.",
            min_size=25, bag_limit=30, best_bait=["Prawns", "Mullet strips", "Bread"],
            best_season=["All year"], image_url="https://images.unsplash.com/photo-1571752726703-5e7d1f6a986d?w=400"
        ),
        FishSpecies(
            name="Tailor", scientific_name="Pomatomus saltatrix",
            description="Fast, aggressive predator. Best caught at dawn or dusk along beaches and headlands.",
            min_size=35, bag_limit=20, best_bait=["Pilchards", "Metal lures", "Poppers"],
            best_season=["Winter", "Spring"], image_url="https://images.unsplash.com/photo-1761375926995-c2afd0d56b00?w=400"
        ),
        FishSpecies(
            name="Giant Trevally", scientific_name="Caranx ignobilis",
            description="Powerful predator and popular sportfish. Found around reefs, headlands and river mouths.",
            min_size=None, bag_limit=20, best_bait=["Live bait", "Poppers", "Stickbaits"],
            best_season=["Summer", "Autumn"], image_url="https://images.unsplash.com/photo-1545816250-e12bedba42ba?w=400"
        ),
        FishSpecies(
            name="Golden Trevally", scientific_name="Gnathanodon speciosus",
            description="Distinctive yellow-gold coloration. Often found in schools. Part of combined trevally limit of 20.",
            min_size=None, bag_limit=20, best_bait=["Prawns", "Small fish", "Soft plastics"],
            best_season=["Summer"], image_url="https://images.unsplash.com/photo-1571752726703-5e7d1f6a986d?w=400"
        ),
        FishSpecies(
            name="School Mackerel", scientific_name="Scomberomorus queenslandicus",
            description="Fast schooling pelagic. Great eating and fun to catch on light tackle.",
            min_size=50, bag_limit=10, best_bait=["Metal slugs", "Pilchards", "Trolled lures"],
            best_season=["Winter", "Spring"], image_url="https://images.unsplash.com/photo-1760559468208-c91d30ae66eb?w=400"
        ),
        FishSpecies(
            name="Spotted Mackerel", scientific_name="Scomberomorus munroi",
            description="Popular inshore mackerel species. Identified by rows of spots. Excellent eating.",
            min_size=60, bag_limit=5, best_bait=["Garfish", "Pilchards", "Metal lures"],
            best_season=["Autumn", "Winter"], image_url="https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400"
        ),
        FishSpecies(
            name="Grey Mackerel", scientific_name="Scomberomorus semifasciatus",
            description="Solid mackerel species found in northern waters. Good eating, larger than school mackerel.",
            min_size=60, bag_limit=5, best_bait=["Live bait", "Trolled lures"],
            best_season=["All year"], image_url="https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=400"
        ),
        FishSpecies(
            name="Sweetlip", scientific_name="Lethrinus spp.",
            description="Reef-dwelling species with excellent flesh. Found around wrecks and reefs. Part of coral reef fin fish.",
            min_size=25, bag_limit=5, best_bait=["Squid", "Pilchards", "Prawns"],
            best_season=["Summer", "Autumn"], image_url="https://images.unsplash.com/photo-1759414505811-4a763dd0bb83?w=400"
        ),
        FishSpecies(
            name="Cobia", scientific_name="Rachycentron canadum",
            description="Large pelagic species also known as black kingfish. Powerful fighters reaching over 30kg.",
            min_size=75, bag_limit=2, best_bait=["Live bait", "Large soft plastics"],
            best_season=["Summer"], is_protected=False, image_url="https://images.unsplash.com/photo-1643093911323-afe9999db2fc?w=400"
        ),
        FishSpecies(
            name="Pearl Perch", scientific_name="Glaucosoma scapulare",
            description="Deep water reef fish with excellent flesh. Found in 50-120m depth. Same closure as snapper.",
            min_size=38, bag_limit=4, best_bait=["Squid", "Pilchards"],
            best_season=["Autumn", "Winter"], image_url="https://images.unsplash.com/photo-1771521364782-b88e79c6a998?w=400",
            closed_season_start="07-15", closed_season_end="08-15",
            closed_season_reason="East coast closure: 15 July to 15 August (QLD DPI)"
        ),
        FishSpecies(
            name="Coral Trout", scientific_name="Plectropomus leopardus",
            description="Premium reef fish with vibrant red/orange coloration. Highly prized eating. Part of coral reef fin fish.",
            min_size=38, bag_limit=7, best_bait=["Live bait", "Soft plastics"],
            best_season=["All year"], image_url="https://images.unsplash.com/photo-1646956383492-24350620eb79?w=400",
            closed_season_start="10-08", closed_season_end="10-12",
            closed_season_reason="Coral reef fin fish closure 2026: 8-12 Oct & 6-10 Nov (QLD DPI)"
        ),
        FishSpecies(
            name="Mangrove Jack", scientific_name="Lutjanus argentimaculatus",
            description="Aggressive predator found in estuaries and around structure. Excellent sport fish.",
            min_size=35, bag_limit=5, best_bait=["Live bait", "Prawns", "Soft plastics"],
            best_season=["Summer", "Autumn"], image_url="https://images.unsplash.com/photo-1763608611901-b619e7a18b78?w=400"
        ),
        FishSpecies(
            name="Spanish Mackerel", scientific_name="Scomberomorus commerson",
            description="Fast pelagic predator. Popular game fish. Closed seasons apply - check region.",
            min_size=75, bag_limit=1, best_bait=["Live bait", "Trolled lures", "Garfish"],
            best_season=["Winter", "Spring"], image_url="https://images.unsplash.com/photo-1760559468208-c91d30ae66eb?w=400",
            closed_season_start="02-01", closed_season_end="02-21",
            closed_season_reason="Southern closure: 1-21 Feb & 1-21 Mar (QLD DPI)"
        ),
        FishSpecies(
            name="Mahi Mahi", scientific_name="Coryphaena hippurus",
            description="Spectacular pelagic gamefish also known as dolphinfish. Found offshore around FADs and weed lines.",
            min_size=50, bag_limit=5, best_bait=["Trolled lures", "Live bait", "Skirted lures"],
            best_season=["Summer", "Autumn"], image_url="https://images.unsplash.com/photo-1545816250-e12bedba42ba?w=400"
        ),
        FishSpecies(
            name="Wahoo", scientific_name="Acanthocybium solandri",
            description="Lightning-fast pelagic predator. One of the fastest fish in the ocean. Excellent eating.",
            min_size=75, bag_limit=2, best_bait=["High-speed trolling lures", "Live bait"],
            best_season=["Summer"], image_url="https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400"
        ),
        FishSpecies(
            name="Golden Snapper", scientific_name="Lutjanus johnii",
            description="Also known as fingermark. Excellent eating, found around structure in estuaries and reefs.",
            min_size=35, bag_limit=5, best_bait=["Live bait", "Prawns", "Squid"],
            best_season=["Summer", "Autumn"], image_url="https://images.unsplash.com/photo-1564677877393-2dbc65af5e41?w=400"
        ),
        FishSpecies(
            name="Yellowtail Kingfish", scientific_name="Seriola lalandi",
            description="Powerful pelagic sportfish. Found around offshore reefs and structure. Great fighters.",
            min_size=60, bag_limit=2, best_bait=["Live bait", "Poppers", "Jigs"],
            best_season=["Winter", "Spring"], image_url="https://images.unsplash.com/photo-1545816250-e12bedba42ba?w=400"
        ),
        FishSpecies(
            name="Mulloway", scientific_name="Argyrosomus japonicus",
            description="Large jewfish species. Powerful fighters found in estuaries and surf. Must be kept whole on boat.",
            min_size=75, bag_limit=2, best_bait=["Live bait", "Mullet", "Squid"],
            best_season=["Autumn", "Winter"], image_url="https://images.unsplash.com/photo-1770535849160-bcf1a18d1edf?w=400"
        ),
        FishSpecies(
            name="Blue Swimmer Crab", scientific_name="Portunus armatus",
            description="Popular eating crab. Male only harvest. Min 11.5cm carapace width. Use dillies or pots.",
            min_size=12, bag_limit=20, best_bait=["Fish frames", "Chicken necks"],
            best_season=["Summer", "Autumn"], image_url="https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=400"
        ),
        FishSpecies(
            name="Mud Crab", scientific_name="Scylla serrata",
            description="Prized crustacean. Male only, no females. Min 15cm across shell. Check closed waters.",
            min_size=15, bag_limit=7, best_bait=["Fish frames", "Chicken"],
            best_season=["Summer", "Autumn"], image_url="https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=400"
        ),
        FishSpecies(
            name="Moreton Bay Bug", scientific_name="Thenus australiensis",
            description="Delicious bay lobster. Min 7.5cm across widest part of shell. Found in sandy areas.",
            min_size=8, bag_limit=20, best_bait=["Caught by hand diving or trawl"],
            best_season=["All year"], image_url="https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=400"
        ),
        FishSpecies(
            name="Dugong", scientific_name="Dugong dugon",
            description="Protected marine mammal. Do not approach or disturb. Report sightings to authorities.",
            min_size=None, bag_limit=0, best_bait=[],
            best_season=[], is_protected=True, image_url="https://images.unsplash.com/photo-1514854560434-dac06a4c6701?w=400",
            closed_season_start="01-01", closed_season_end="12-31",
            closed_season_reason="Protected species - NO TAKE permitted at any time"
        ),
    ]

def get_default_boat_ramps() -> List[BoatRamp]:
    return [
        # Moreton Bay
        BoatRamp(name="Manly Boat Harbour", latitude=-27.4540, longitude=153.1880,
                 facilities=["Parking", "Toilets", "Fish cleaning", "Fuel"], parking_spaces=200, fee=True),
        BoatRamp(name="Wynnum North", latitude=-27.4280, longitude=153.1720,
                 facilities=["Parking", "Toilets"], parking_spaces=80, fee=False),
        BoatRamp(name="Scarborough", latitude=-27.2080, longitude=153.1060,
                 facilities=["Parking", "Toilets", "Fish cleaning", "Cafe"], parking_spaces=150, fee=True),
        BoatRamp(name="Redcliffe Jetty", latitude=-27.2280, longitude=153.1150,
                 facilities=["Parking", "Toilets", "Shelter"], parking_spaces=100, fee=False),
        BoatRamp(name="Victoria Point", latitude=-27.5820, longitude=153.3020,
                 facilities=["Parking", "Toilets", "Fish cleaning"], parking_spaces=120, fee=True),
        BoatRamp(name="Raby Bay", latitude=-27.5180, longitude=153.2680,
                 facilities=["Parking", "Toilets", "Marina"], parking_spaces=60, fee=True),
        # Gold Coast
        BoatRamp(name="Runaway Bay Marina", latitude=-27.9180, longitude=153.3980,
                 facilities=["Parking", "Toilets", "Fuel", "Marina", "Fish cleaning"], parking_spaces=250, fee=True),
        BoatRamp(name="Paradise Point", latitude=-27.8880, longitude=153.3980,
                 facilities=["Parking", "Toilets", "Cafe"], parking_spaces=80, fee=False),
        BoatRamp(name="Jacobs Well", latitude=-27.7780, longitude=153.3580,
                 facilities=["Parking", "Toilets", "Fish cleaning"], parking_spaces=100, fee=False),
        BoatRamp(name="Currumbin Creek", latitude=-28.1280, longitude=153.4680,
                 facilities=["Parking", "Toilets"], parking_spaces=50, fee=False),
        # Sunshine Coast
        BoatRamp(name="Mooloolaba Marina", latitude=-26.6830, longitude=153.1180,
                 facilities=["Parking", "Toilets", "Fuel", "Marina", "Shops"], parking_spaces=180, fee=True),
        BoatRamp(name="Noosa River", latitude=-26.3930, longitude=153.0680,
                 facilities=["Parking", "Toilets", "Cafe", "Kayak hire"], parking_spaces=120, fee=True),
        BoatRamp(name="Caloundra - Bulcock Beach", latitude=-26.8030, longitude=153.1380,
                 facilities=["Parking", "Toilets", "Fish cleaning"], parking_spaces=60, fee=False),
        BoatRamp(name="Bribie Island - Bellara", latitude=-27.0280, longitude=153.1380,
                 facilities=["Parking", "Toilets"], parking_spaces=70, fee=False),
        # Brisbane
        BoatRamp(name="Rivergate Marina", latitude=-27.4080, longitude=153.1180,
                 facilities=["Parking", "Toilets", "Fuel", "Marina"], parking_spaces=150, fee=True),
        BoatRamp(name="Colmslie", latitude=-27.4680, longitude=153.0780,
                 facilities=["Parking", "Toilets"], parking_spaces=40, fee=False),
    ]

# ============== HEALTH CHECK ==============

@api_router.get("/")
async def root():
    return {"message": "SEQ Angler API - South East Queensland Fishing", "version": "1.0.0"}

@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}

# Include the router in the main app
app.include_router(api_router)

# Mount uploads directory for serving images
UPLOAD_DIR.mkdir(exist_ok=True)
app.mount("/api/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
