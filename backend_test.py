import requests
import sys
import json
from datetime import datetime, timedelta
from typing import Dict, Any

class HackCraftAPITester:
    def __init__(self, base_url="https://hackcraft-15.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tokens = {}  # Store tokens for different users
        self.users = {}   # Store user data
        self.events = {}  # Store created events
        self.teams = {}   # Store created teams
        self.tests_run = 0
        self.tests_passed = 0

    def log_test(self, name: str, success: bool, details: str = ""):
        """Log test results"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name} - PASSED {details}")
        else:
            print(f"❌ {name} - FAILED {details}")
        return success

    def make_request(self, method: str, endpoint: str, data: Dict = None, token: str = None, expected_status: int = 200):
        """Make HTTP request with proper headers"""
        url = f"{self.api_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        if token:
            headers['Authorization'] = f'Bearer {token}'
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)
            
            success = response.status_code == expected_status
            result_data = {}
            
            try:
                result_data = response.json()
            except:
                result_data = {"text": response.text}
            
            return success, response.status_code, result_data
            
        except Exception as e:
            return False, 0, {"error": str(e)}

    def test_user_registration(self):
        """Test user registration for all roles"""
        print("\n🔍 Testing User Registration...")
        
        roles = ['organizer', 'participant', 'judge']
        timestamp = datetime.now().strftime('%H%M%S')
        
        for role in roles:
            user_data = {
                "email": f"test_{role}_{timestamp}@hackcraft.com",
                "name": f"Test {role.title()}",
                "password": "TestPass123!",
                "role": role
            }
            
            success, status, response = self.make_request(
                'POST', 'auth/register', user_data, expected_status=200
            )
            
            if success:
                self.users[role] = {
                    "email": user_data["email"],
                    "password": user_data["password"],
                    "role": role,
                    "user_data": response
                }
                self.log_test(f"Register {role}", True, f"- User ID: {response.get('id', 'N/A')}")
            else:
                self.log_test(f"Register {role}", False, f"- Status: {status}, Response: {response}")
                return False
        
        return True

    def test_user_login(self):
        """Test user login for all registered users"""
        print("\n🔍 Testing User Login...")
        
        for role, user_info in self.users.items():
            login_data = {
                "email": user_info["email"],
                "password": user_info["password"]
            }
            
            success, status, response = self.make_request(
                'POST', 'auth/login', login_data, expected_status=200
            )
            
            if success and 'access_token' in response:
                self.tokens[role] = response['access_token']
                self.log_test(f"Login {role}", True, f"- Token received")
            else:
                self.log_test(f"Login {role}", False, f"- Status: {status}, Response: {response}")
                return False
        
        return True

    def test_jwt_authentication(self):
        """Test JWT authentication with /auth/me endpoint"""
        print("\n🔍 Testing JWT Authentication...")
        
        for role, token in self.tokens.items():
            success, status, response = self.make_request(
                'GET', 'auth/me', token=token, expected_status=200
            )
            
            if success and response.get('role') == role:
                self.log_test(f"JWT Auth {role}", True, f"- Role: {response.get('role')}")
            else:
                self.log_test(f"JWT Auth {role}", False, f"- Status: {status}, Response: {response}")
                return False
        
        return True

    def test_role_based_access_control(self):
        """Test role-based access controls"""
        print("\n🔍 Testing Role-Based Access Control...")
        
        # Test participant trying to access organizer endpoint
        success, status, response = self.make_request(
            'GET', 'events/my/organized', token=self.tokens['participant'], expected_status=403
        )
        
        if success:  # Should fail with 403
            self.log_test("RBAC - Participant accessing organizer endpoint", True, "- Correctly blocked")
        else:
            if status == 403:
                self.log_test("RBAC - Participant accessing organizer endpoint", True, "- Correctly blocked")
            else:
                self.log_test("RBAC - Participant accessing organizer endpoint", False, f"- Status: {status}")
                return False
        
        # Test organizer trying to access participant endpoint
        success, status, response = self.make_request(
            'GET', 'teams/my', token=self.tokens['organizer'], expected_status=403
        )
        
        if status == 403:
            self.log_test("RBAC - Organizer accessing participant endpoint", True, "- Correctly blocked")
        else:
            self.log_test("RBAC - Organizer accessing participant endpoint", False, f"- Status: {status}")
            return False
        
        return True

    def test_event_creation(self):
        """Test event creation by organizers"""
        print("\n🔍 Testing Event Creation...")
        
        # Create event with organizer token
        start_date = datetime.now() + timedelta(days=1)
        end_date = start_date + timedelta(days=2)
        submission_deadline = end_date - timedelta(hours=2)
        
        event_data = {
            "title": "Test Hackathon 2024",
            "description": "A test hackathon event for API testing",
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "submission_deadline": submission_deadline.isoformat(),
            "max_team_size": 4,
            "tracks": ["Web Development", "AI/ML", "Mobile Apps"],
            "prizes": ["$5000 First Prize", "$3000 Second Prize", "$1000 Third Prize"],
            "rules": "Standard hackathon rules apply. Be creative and have fun!"
        }
        
        success, status, response = self.make_request(
            'POST', 'events', event_data, token=self.tokens['organizer'], expected_status=200
        )
        
        if success and 'id' in response:
            self.events['test_event'] = response
            self.log_test("Create Event", True, f"- Event ID: {response['id']}")
            return True
        else:
            self.log_test("Create Event", False, f"- Status: {status}, Response: {response}")
            return False

    def test_event_status_update(self):
        """Test event status updates"""
        print("\n🔍 Testing Event Status Updates...")
        
        if not self.events.get('test_event'):
            self.log_test("Event Status Update", False, "- No event to update")
            return False
        
        event_id = self.events['test_event']['id']
        
        # Update event status to active
        success, status, response = self.make_request(
            'PUT', f'events/{event_id}/status?status=active', 
            token=self.tokens['organizer'], expected_status=200
        )
        
        if success:
            self.log_test("Update Event Status", True, "- Status updated to active")
            return True
        else:
            self.log_test("Update Event Status", False, f"- Status: {status}, Response: {response}")
            return False

    def test_get_events(self):
        """Test getting events list"""
        print("\n🔍 Testing Get Events...")
        
        success, status, response = self.make_request(
            'GET', 'events', expected_status=200
        )
        
        if success and isinstance(response, list):
            self.log_test("Get Events", True, f"- Found {len(response)} events")
            return True
        else:
            self.log_test("Get Events", False, f"- Status: {status}, Response: {response}")
            return False

    def test_team_creation(self):
        """Test team creation by participants"""
        print("\n🔍 Testing Team Creation...")
        
        if not self.events.get('test_event'):
            self.log_test("Create Team", False, "- No active event available")
            return False
        
        event_id = self.events['test_event']['id']
        team_data = {
            "name": "Test Team Alpha",
            "event_id": event_id
        }
        
        success, status, response = self.make_request(
            'POST', 'teams', team_data, token=self.tokens['participant'], expected_status=200
        )
        
        if success and 'id' in response:
            self.teams['test_team'] = response
            self.log_test("Create Team", True, f"- Team ID: {response['id']}")
            return True
        else:
            self.log_test("Create Team", False, f"- Status: {status}, Response: {response}")
            return False

    def test_get_my_teams(self):
        """Test getting participant's teams"""
        print("\n🔍 Testing Get My Teams...")
        
        success, status, response = self.make_request(
            'GET', 'teams/my', token=self.tokens['participant'], expected_status=200
        )
        
        if success and isinstance(response, list):
            self.log_test("Get My Teams", True, f"- Found {len(response)} teams")
            return True
        else:
            self.log_test("Get My Teams", False, f"- Status: {status}, Response: {response}")
            return False

    def test_invalid_credentials(self):
        """Test login with invalid credentials"""
        print("\n🔍 Testing Invalid Credentials...")
        
        invalid_login = {
            "email": "nonexistent@test.com",
            "password": "wrongpassword"
        }
        
        success, status, response = self.make_request(
            'POST', 'auth/login', invalid_login, expected_status=401
        )
        
        if status == 401:
            self.log_test("Invalid Credentials", True, "- Correctly rejected")
            return True
        else:
            self.log_test("Invalid Credentials", False, f"- Status: {status}")
            return False

    def test_duplicate_registration(self):
        """Test duplicate email registration"""
        print("\n🔍 Testing Duplicate Registration...")
        
        if not self.users.get('organizer'):
            self.log_test("Duplicate Registration", False, "- No existing user to duplicate")
            return False
        
        duplicate_data = {
            "email": self.users['organizer']['email'],
            "name": "Duplicate User",
            "password": "TestPass123!",
            "role": "participant"
        }
        
        success, status, response = self.make_request(
            'POST', 'auth/register', duplicate_data, expected_status=400
        )
        
        if status == 400:
            self.log_test("Duplicate Registration", True, "- Correctly rejected")
            return True
        else:
            self.log_test("Duplicate Registration", False, f"- Status: {status}")
            return False

    def run_all_tests(self):
        """Run all backend API tests"""
        print("🚀 Starting HackCraft Backend API Tests")
        print("=" * 50)
        
        # Test sequence
        tests = [
            self.test_user_registration,
            self.test_duplicate_registration,
            self.test_user_login,
            self.test_invalid_credentials,
            self.test_jwt_authentication,
            self.test_role_based_access_control,
            self.test_event_creation,
            self.test_event_status_update,
            self.test_get_events,
            self.test_team_creation,
            self.test_get_my_teams,
        ]
        
        for test in tests:
            if not test():
                print(f"\n❌ Test suite stopped due to critical failure in {test.__name__}")
                break
        
        # Print final results
        print("\n" + "=" * 50)
        print(f"📊 Test Results: {self.tests_passed}/{self.tests_run} tests passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed! Backend API is working correctly.")
            return True
        else:
            print(f"⚠️  {self.tests_run - self.tests_passed} tests failed. Please check the issues above.")
            return False

def main():
    tester = HackCraftAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())