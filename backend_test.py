#!/usr/bin/env python3
"""
SEQ Angler Backend API Testing Script
Tests all major backend endpoints as requested
"""
import requests
import json
import sys
import traceback
from datetime import datetime
import base64

# Backend URL from frontend .env
BASE_URL = "https://seq-angler.preview.emergentagent.com/api"

# Test data
TEST_USER = {
    "email": "fisher@example.com", 
    "password": "TestPassword123!",
    "name": "Test Fisher"
}

# Global token storage
auth_token = None
test_results = []

def log_test(endpoint, method, success, status_code=None, response_data=None, error_msg=None):
    """Log test results"""
    result = {
        "endpoint": endpoint,
        "method": method,
        "success": success,
        "status_code": status_code,
        "timestamp": datetime.now().isoformat(),
        "error": error_msg
    }
    if response_data and success:
        result["response_sample"] = str(response_data)[:200] + "..." if len(str(response_data)) > 200 else str(response_data)
    test_results.append(result)
    
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status} {method} {endpoint} - Status: {status_code}")
    if error_msg:
        print(f"    Error: {error_msg}")

def test_api_root():
    """Test GET /api/ - API root with version info"""
    try:
        response = requests.get(f"{BASE_URL}/", timeout=30)
        success = response.status_code == 200
        data = None
        if success:
            try:
                data = response.json()
            except:
                data = response.text
        log_test("/", "GET", success, response.status_code, data, 
                response.text if not success else None)
        return success
    except Exception as e:
        log_test("/", "GET", False, None, None, str(e))
        return False

def test_weather_api():
    """Test GET /api/weather - Live weather data from Open-Meteo API"""
    try:
        response = requests.get(f"{BASE_URL}/weather", timeout=30)
        success = response.status_code == 200
        data = None
        if success:
            data = response.json()
            # Check if required fields are present
            required_fields = ["temperature", "wind_speed", "humidity", "conditions"]
            missing_fields = [f for f in required_fields if f not in data]
            if missing_fields:
                success = False
                error_msg = f"Missing required fields: {missing_fields}"
            else:
                error_msg = None
        else:
            error_msg = response.text
            
        log_test("/weather", "GET", success, response.status_code, data, error_msg)
        return success
    except Exception as e:
        log_test("/weather", "GET", False, None, None, str(e))
        return False

def test_marine_weather_api():
    """Test GET /api/marine-weather - Marine conditions"""
    try:
        response = requests.get(f"{BASE_URL}/marine-weather", timeout=30)
        success = response.status_code == 200
        data = None
        if success:
            data = response.json()
            # Check if required fields are present
            required_fields = ["wave_height", "swell_height", "sea_state"]
            missing_fields = [f for f in required_fields if f not in data]
            if missing_fields:
                success = False
                error_msg = f"Missing required fields: {missing_fields}"
            else:
                error_msg = None
        else:
            error_msg = response.text
            
        log_test("/marine-weather", "GET", success, response.status_code, data, error_msg)
        return success
    except Exception as e:
        log_test("/marine-weather", "GET", False, None, None, str(e))
        return False

def test_species_api():
    """Test GET /api/species - Should return fish species with QLD DPI regulations"""
    try:
        response = requests.get(f"{BASE_URL}/species", timeout=30)
        success = response.status_code == 200
        data = None
        error_msg = None
        
        if success:
            data = response.json()
            # Check if it's a list
            if not isinstance(data, list):
                success = False
                error_msg = "Response should be a list of species"
            elif len(data) == 0:
                success = False
                error_msg = "No species returned"
            else:
                # Check if species have required QLD regulation fields
                sample_species = data[0]
                expected_fields = ["id", "name", "scientific_name", "min_size", "bag_limit"]
                missing_fields = [f for f in expected_fields if f not in sample_species]
                if missing_fields:
                    error_msg = f"Missing QLD regulation fields: {missing_fields}"
                else:
                    # Check if we have around 26 species as specified
                    print(f"    Found {len(data)} species")
        else:
            error_msg = response.text
            
        log_test("/species", "GET", success, response.status_code, data, error_msg)
        return success, data[0]["id"] if success and data else None
    except Exception as e:
        log_test("/species", "GET", False, None, None, str(e))
        return False, None

def test_species_by_id(species_id):
    """Test GET /api/species/{id} - Individual species details"""
    if not species_id:
        log_test(f"/species/[no-id]", "GET", False, None, None, "No species ID available from previous test")
        return False
        
    try:
        response = requests.get(f"{BASE_URL}/species/{species_id}", timeout=30)
        success = response.status_code == 200
        data = None
        
        if success:
            data = response.json()
            # Verify it's the right species
            if data.get("id") != species_id:
                success = False
                error_msg = f"Returned species ID {data.get('id')} doesn't match requested {species_id}"
            else:
                error_msg = None
        else:
            error_msg = response.text
            
        log_test(f"/species/{species_id}", "GET", success, response.status_code, data, error_msg)
        return success
    except Exception as e:
        log_test(f"/species/{species_id}", "GET", False, None, None, str(e))
        return False

def test_closed_seasons():
    """Test GET /api/species/closed-seasons - Species currently in closed season"""
    try:
        response = requests.get(f"{BASE_URL}/species/closed-seasons", timeout=30)
        success = response.status_code == 200
        data = None
        
        if success:
            data = response.json()
            # Should have structure with currently_closed, count, message
            expected_fields = ["currently_closed", "count", "message"]
            missing_fields = [f for f in expected_fields if f not in data]
            if missing_fields:
                success = False
                error_msg = f"Missing fields: {missing_fields}"
            else:
                error_msg = None
                print(f"    Found {data['count']} species in closed season")
        else:
            error_msg = response.text
            
        log_test("/species/closed-seasons", "GET", success, response.status_code, data, error_msg)
        return success
    except Exception as e:
        log_test("/species/closed-seasons", "GET", False, None, None, str(e))
        return False

def test_fishing_spots():
    """Test GET /api/spots - Should return fishing spots"""
    try:
        response = requests.get(f"{BASE_URL}/spots", timeout=30)
        success = response.status_code == 200
        data = None
        
        if success:
            data = response.json()
            if not isinstance(data, list):
                success = False
                error_msg = "Response should be a list of spots"
            elif len(data) == 0:
                success = False
                error_msg = "No fishing spots returned"
            else:
                print(f"    Found {len(data)} fishing spots")
                # Check required fields
                sample_spot = data[0]
                expected_fields = ["id", "name", "latitude", "longitude", "fish_types"]
                missing_fields = [f for f in expected_fields if f not in sample_spot]
                if missing_fields:
                    error_msg = f"Missing required fields: {missing_fields}"
                else:
                    error_msg = None
        else:
            error_msg = response.text
            
        log_test("/spots", "GET", success, response.status_code, data, error_msg)
        return success, data[0]["id"] if success and data else None
    except Exception as e:
        log_test("/spots", "GET", False, None, None, str(e))
        return False, None

def test_spot_by_id(spot_id):
    """Test GET /api/spots/{id} - Individual spot details"""
    if not spot_id:
        log_test(f"/spots/[no-id]", "GET", False, None, None, "No spot ID available from previous test")
        return False
        
    try:
        response = requests.get(f"{BASE_URL}/spots/{spot_id}", timeout=30)
        success = response.status_code == 200
        data = None
        
        if success:
            data = response.json()
            if data.get("id") != spot_id:
                success = False
                error_msg = f"Returned spot ID {data.get('id')} doesn't match requested {spot_id}"
            else:
                error_msg = None
        else:
            error_msg = response.text
            
        log_test(f"/spots/{spot_id}", "GET", success, response.status_code, data, error_msg)
        return success
    except Exception as e:
        log_test(f"/spots/{spot_id}", "GET", False, None, None, str(e))
        return False

def test_boat_ramps():
    """Test GET /api/boat-ramps - Should return boat ramps"""
    try:
        response = requests.get(f"{BASE_URL}/boat-ramps", timeout=30)
        success = response.status_code == 200
        data = None
        
        if success:
            data = response.json()
            if not isinstance(data, list):
                success = False
                error_msg = "Response should be a list of boat ramps"
            elif len(data) == 0:
                success = False
                error_msg = "No boat ramps returned"
            else:
                print(f"    Found {len(data)} boat ramps")
                # Check required fields
                sample_ramp = data[0]
                expected_fields = ["id", "name", "latitude", "longitude", "facilities"]
                missing_fields = [f for f in expected_fields if f not in sample_ramp]
                if missing_fields:
                    error_msg = f"Missing required fields: {missing_fields}"
                else:
                    error_msg = None
        else:
            error_msg = response.text
            
        log_test("/boat-ramps", "GET", success, response.status_code, data, error_msg)
        return success
    except Exception as e:
        log_test("/boat-ramps", "GET", False, None, None, str(e))
        return False

def test_fishing_conditions_preview():
    """Test GET /api/fishing-conditions/preview - Fishing score with preview data"""
    try:
        response = requests.get(f"{BASE_URL}/fishing-conditions/preview", timeout=30)
        success = response.status_code == 200
        data = None
        
        if success:
            data = response.json()
            # Should have overall_score, conditions_summary, upgrade_message for preview
            expected_fields = ["overall_score", "conditions_summary", "upgrade_message"]
            missing_fields = [f for f in expected_fields if f not in data]
            if missing_fields:
                success = False
                error_msg = f"Missing preview fields: {missing_fields}"
            else:
                error_msg = None
                print(f"    Fishing score: {data.get('overall_score')}/10")
        else:
            error_msg = response.text
            
        log_test("/fishing-conditions/preview", "GET", success, response.status_code, data, error_msg)
        return success
    except Exception as e:
        log_test("/fishing-conditions/preview", "GET", False, None, None, str(e))
        return False

def test_user_registration():
    """Test POST /api/auth/register - Register user with 30-day trial"""
    global auth_token
    
    try:
        response = requests.post(
            f"{BASE_URL}/auth/register",
            json=TEST_USER,
            timeout=30
        )
        success = response.status_code in [200, 201]
        data = None
        error_msg = None
        
        if success:
            data = response.json()
            # Check for required fields
            expected_fields = ["access_token", "token_type", "user"]
            missing_fields = [f for f in expected_fields if f not in data]
            if missing_fields:
                success = False
                error_msg = f"Missing fields: {missing_fields}"
            else:
                # Store token for future tests
                auth_token = data["access_token"]
                print(f"    Registered user: {data['user']['email']}")
                print(f"    User ID: {data['user']['id']}")
        elif response.status_code == 400:
            # User might already exist, try login instead
            error_msg = "User already exists (will try login next)"
        else:
            error_msg = response.text
            
        log_test("/auth/register", "POST", success, response.status_code, data, error_msg)
        return success
    except Exception as e:
        log_test("/auth/register", "POST", False, None, None, str(e))
        return False

def test_user_login():
    """Test POST /api/auth/login - Login and get JWT token"""
    global auth_token
    
    try:
        login_data = {
            "email": TEST_USER["email"],
            "password": TEST_USER["password"]
        }
        
        response = requests.post(
            f"{BASE_URL}/auth/login",
            json=login_data,
            timeout=30
        )
        success = response.status_code == 200
        data = None
        
        if success:
            data = response.json()
            # Check for required fields
            expected_fields = ["access_token", "token_type", "user"]
            missing_fields = [f for f in expected_fields if f not in data]
            if missing_fields:
                success = False
                error_msg = f"Missing fields: {missing_fields}"
            else:
                # Store token for future tests
                auth_token = data["access_token"]
                error_msg = None
                print(f"    Logged in user: {data['user']['email']}")
        else:
            error_msg = response.text
            
        log_test("/auth/login", "POST", success, response.status_code, data, error_msg)
        return success
    except Exception as e:
        log_test("/auth/login", "POST", False, None, None, str(e))
        return False

def test_get_current_user():
    """Test GET /api/auth/me - Get current user (requires auth header)"""
    if not auth_token:
        log_test("/auth/me", "GET", False, None, None, "No auth token available")
        return False
        
    try:
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/auth/me", headers=headers, timeout=30)
        success = response.status_code == 200
        data = None
        
        if success:
            data = response.json()
            # Check for user fields
            expected_fields = ["id", "email", "name", "created_at"]
            missing_fields = [f for f in expected_fields if f not in data]
            if missing_fields:
                success = False
                error_msg = f"Missing user fields: {missing_fields}"
            else:
                error_msg = None
                print(f"    Current user: {data.get('name')} ({data.get('email')})")
        else:
            error_msg = response.text
            
        log_test("/auth/me", "GET", success, response.status_code, data, error_msg)
        return success
    except Exception as e:
        log_test("/auth/me", "GET", False, None, None, str(e))
        return False

def test_create_catch():
    """Test POST /api/catches - Log a catch (requires auth)"""
    if not auth_token:
        log_test("/catches", "POST", False, None, None, "No auth token available")
        return False
        
    try:
        # Sample catch data
        catch_data = {
            "fish_species": "Australian Bass",
            "location_id": "test-location-123",
            "location_name": "Wivenhoe Dam",
            "weight": 1.2,
            "length": 35.0,
            "bait_used": "Surface lure",
            "notes": "Great fight on light tackle!",
            "latitude": -27.3964,
            "longitude": 152.6108
        }
        
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.post(
            f"{BASE_URL}/catches", 
            json=catch_data, 
            headers=headers, 
            timeout=30
        )
        success = response.status_code in [200, 201]
        data = None
        
        if success:
            data = response.json()
            # Check if catch was created with required fields
            expected_fields = ["id", "user_id", "fish_species", "location_name", "caught_at"]
            missing_fields = [f for f in expected_fields if f not in data]
            if missing_fields:
                success = False
                error_msg = f"Missing catch fields: {missing_fields}"
            else:
                error_msg = None
                print(f"    Logged catch: {data.get('fish_species')} at {data.get('location_name')}")
        else:
            error_msg = response.text
            
        log_test("/catches", "POST", success, response.status_code, data, error_msg)
        return success
    except Exception as e:
        log_test("/catches", "POST", False, None, None, str(e))
        return False

def test_get_user_catches():
    """Test GET /api/catches - Get user's catches (requires auth)"""
    if not auth_token:
        log_test("/catches", "GET", False, None, None, "No auth token available")
        return False
        
    try:
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/catches", headers=headers, timeout=30)
        success = response.status_code == 200
        data = None
        
        if success:
            data = response.json()
            if not isinstance(data, list):
                success = False
                error_msg = "Response should be a list of catches"
            else:
                error_msg = None
                print(f"    Found {len(data)} catches for user")
                if data:
                    # Check first catch has required fields
                    sample_catch = data[0]
                    expected_fields = ["id", "user_id", "fish_species", "location_name"]
                    missing_fields = [f for f in expected_fields if f not in sample_catch]
                    if missing_fields:
                        success = False
                        error_msg = f"Missing catch fields: {missing_fields}"
        else:
            error_msg = response.text
            
        log_test("/catches", "GET", success, response.status_code, data, error_msg)
        return success
    except Exception as e:
        log_test("/catches", "GET", False, None, None, str(e))
        return False

def run_all_tests():
    """Run all backend API tests"""
    print(f"\n🚀 Starting SEQ Angler Backend API Tests")
    print(f"Backend URL: {BASE_URL}")
    print(f"Test started at: {datetime.now().isoformat()}")
    print("=" * 60)
    
    # Test public endpoints first
    print("\n📋 Testing Public Endpoints...")
    test_api_root()
    test_weather_api()
    test_marine_weather_api()
    
    species_success, species_id = test_species_api()
    if species_id:
        test_species_by_id(species_id)
    test_closed_seasons()
    
    spots_success, spot_id = test_fishing_spots()
    if spot_id:
        test_spot_by_id(spot_id)
        
    test_boat_ramps()
    test_fishing_conditions_preview()
    
    # Test auth endpoints
    print("\n🔐 Testing Authentication...")
    reg_success = test_user_registration()
    if not reg_success:
        # If registration fails, try login (user might exist)
        login_success = test_user_login()
    else:
        login_success = True  # Registration gives us token
    
    if auth_token:
        test_get_current_user()
        
        # Test protected endpoints
        print("\n🎣 Testing Protected Endpoints...")
        test_create_catch()
        test_get_user_catches()
    else:
        print("❌ Cannot test protected endpoints - no auth token")
    
    # Print summary
    print("\n" + "=" * 60)
    print("📊 TEST SUMMARY")
    print("=" * 60)
    
    total_tests = len(test_results)
    passed_tests = sum(1 for r in test_results if r["success"])
    failed_tests = total_tests - passed_tests
    
    print(f"Total Tests: {total_tests}")
    print(f"✅ Passed: {passed_tests}")
    print(f"❌ Failed: {failed_tests}")
    print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
    
    # Show failed tests
    if failed_tests > 0:
        print("\n❌ FAILED TESTS:")
        for result in test_results:
            if not result["success"]:
                print(f"  - {result['method']} {result['endpoint']}: {result.get('error', 'Unknown error')}")
    
    # Save detailed results
    with open("/app/backend_test_results.json", "w") as f:
        json.dump({
            "summary": {
                "total_tests": total_tests,
                "passed": passed_tests,
                "failed": failed_tests,
                "success_rate": (passed_tests/total_tests)*100
            },
            "test_results": test_results,
            "test_timestamp": datetime.now().isoformat()
        }, f, indent=2)
    
    print(f"\n📄 Detailed results saved to: /app/backend_test_results.json")
    return passed_tests == total_tests

if __name__ == "__main__":
    try:
        success = run_all_tests()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n⚠️  Test interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n💥 Test runner crashed: {e}")
        traceback.print_exc()
        sys.exit(1)