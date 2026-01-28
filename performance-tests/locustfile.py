"""
Locust performance tests for University Visitor Registration System API.

Run tests:
    locust -f locustfile.py --host=http://localhost:8000

Or headless mode:
    locust -f locustfile.py --headless --host=http://localhost:8000 -u 100 -r 10 -t 1m
"""

from locust import HttpUser, task, between, events
from locust.runners import MasterRunner
import json
import random


class UniversityVisitorUser(HttpUser):
    """
    Simulates user behavior for the University Visitor Registration System.
    """

    # Wait time between tasks (in seconds)
    wait_time = between(1, 3)

    def on_start(self):
        """
        Run when a user starts. Login and store token.
        """
        self.login()

    def login(self):
        """
        Login as a test user and store the JWT token.
        """
        # Try to login as teacher (more common)
        response = self.client.post(
            "/api/auth/login",
            json={
                "username": "teacher",
                "password": "teacher123"
            },
            catch_response=True
        )

        if response.status_code == 200:
            data = response.json()
            self.token = data.get("access_token")
            self.user_id = data.get("user", {}).get("id")
            self.username = data.get("user", {}).get("username")
            self.headers = {
                "Authorization": f"Bearer {self.token}",
                "Content-Type": "application/json"
            }
        else:
            # Fallback - try admin
            response = self.client.post(
                "/api/auth/login",
                json={
                    "username": "admin",
                    "password": "admin123"
                },
                catch_response=True
            )
            if response.status_code == 200:
                data = response.json()
                self.token = data.get("access_token")
                self.user_id = data.get("user", {}).get("id")
                self.headers = {
                    "Authorization": f"Bearer {self.token}",
                    "Content-Type": "application/json"
                }
            else:
                self.token = None
                self.headers = {}

    @task(10)
    def view_stats(self):
        """
        View dashboard statistics (high frequency - common action).
        Weight: 10
        """
        if not self.token:
            return

        with self.client.get(
            "/api/stats",
            headers=self.headers,
            catch_response=True,
            name="/api/stats (Get Dashboard Stats)"
        ) as response:
            if response.status_code == 200:
                response.success()
            elif response.status_code == 401:
                # Token expired, try to re-login
                self.login()
                response.failure("Unauthorized - re-logging")

    @task(8)
    def view_students(self):
        """
        View students list with pagination.
        Weight: 8
        """
        if not self.token:
            return

        skip = random.randint(0, 5) * 20
        limit = random.choice([10, 20, 50, 100])

        with self.client.get(
            "/api/students",
            headers=self.headers,
            params={"skip": skip, "limit": limit},
            catch_response=True,
            name="/api/students (List Students)"
        ) as response:
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    response.success()
                else:
                    response.failure(f"Unexpected response format: {type(data)}")
            elif response.status_code == 401:
                self.login()
                response.failure("Unauthorized")

    @task(5)
    def filter_students_by_department(self):
        """
        Filter students by department.
        Weight: 5
        """
        if not self.token:
            return

        department_id = random.randint(1, 8)

        with self.client.get(
            "/api/students",
            headers=self.headers,
            params={"department_id": department_id, "limit": 50},
            catch_response=True,
            name="/api/students (Filter by Department)"
        ) as response:
            if response.status_code == 200:
                response.success()

    @task(5)
    def search_students(self):
        """
        Search for students by name/email.
        Weight: 5
        """
        if not self.token:
            return

        search_terms = ["Ahmet", "Mehmet", "Ayşe", "test", "istanbul"]

        with self.client.get(
            "/api/students",
            headers=self.headers,
            params={"search": random.choice(search_terms)},
            catch_response=True,
            name="/api/students (Search)"
        ) as response:
            if response.status_code == 200:
                response.success()

    @task(3)
    def get_departments(self):
        """
        Get list of departments.
        Weight: 3
        """
        if not self.token:
            return

        with self.client.get(
            "/api/students/departments/list",
            headers=self.headers,
            catch_response=True,
            name="/api/students/departments/list"
        ) as response:
            if response.status_code == 200:
                response.success()

    @task(2)
    def view_hourly_stats(self):
        """
        View hourly statistics.
        Weight: 2
        """
        if not self.token:
            return

        days = random.choice([1, 3, 7])

        with self.client.get(
            "/api/stats/hourly",
            headers=self.headers,
            params={"days": days},
            catch_response=True,
            name="/api/stats/hourly"
        ) as response:
            if response.status_code == 200:
                response.success()

    @task(2)
    def get_history_dates(self):
        """
        Get registration history dates.
        Weight: 2
        """
        if not self.token:
            return

        with self.client.get(
            "/api/students/history/dates",
            headers=self.headers,
            catch_response=True,
            name="/api/students/history/dates"
        ) as response:
            if response.status_code == 200:
                response.success()

    @task(1)
    def get_comparison_stats(self):
        """
        Get comparison statistics (period comparison).
        Weight: 1
        """
        if not self.token:
            return

        compare_period = random.choice(["yesterday", "last_week", "last_month"])

        with self.client.get(
            "/api/stats/comparison",
            headers=self.headers,
            params={"compare_with": compare_period},
            catch_response=True,
            name="/api/stats/comparison"
        ) as response:
            if response.status_code == 200:
                response.success()

    @task(1)
    def get_heatmap_data(self):
        """
        Get heatmap data (day x hour grid).
        Weight: 1
        """
        if not self.token:
            return

        days = random.choice([7, 14, 30])

        with self.client.get(
            "/api/stats/heatmap",
            headers=self.headers,
            params={"days": days},
            catch_response=True,
            name="/api/stats/heatmap"
        ) as response:
            if response.status_code == 200:
                response.success()

    @task(1)
    def get_department_trends(self):
        """
        Get department trends over time.
        Weight: 1
        """
        if not self.token:
            return

        with self.client.get(
            "/api/stats/department-trends",
            headers=self.headers,
            params={"days": 30, "limit": 8},
            catch_response=True,
            name="/api/stats/department-trends"
        ) as response:
            if response.status_code == 200:
                response.success()


class PublicUser(HttpUser):
    """
    Simulates public (unauthenticated) user accessing public endpoints.
    Weight: 1 (10% of total users)
    """

    wait_time = between(2, 5)

    @task
    def access_root(self):
        """Access root endpoint."""
        self.client.get("/", name="Root endpoint")

    @task
    def health_check(self):
        """Health check endpoint."""
        self.client.get("/health", name="Health check")

    @task
    def try_unauthorized_access(self):
        """Attempt to access protected endpoint without auth."""
        with self.client.get(
            "/api/students",
            catch_response=True,
            name="Unauthorized access attempt"
        ) as response:
            if response.status_code == 401:
                response.success()
            else:
                response.failure("Expected 401")


# Test Scenarios
class AdminUser(UniversityVisitorUser):
    """
    Admin-specific tasks that require elevated permissions.
    """

    @task(2)
    def create_student(self):
        """
        Create a new student registration.
        Weight: 2 (admin action)
        """
        if not self.token:
            return

        first_names = ["Ahmet", "Mehmet", "Ayşe", "Fatma", "Ali", "Zeynep"]
        last_names = ["Yılmaz", "Demir", "Kaya", "Şahin", "Çelik", "Arslan"]
        yks_types = ["SAYISAL", "SOZEL", "EA", "DIL"]

        student_data = {
            "first_name": random.choice(first_names),
            "last_name": random.choice(last_names),
            "email": f"test{random.randint(1000, 9999)}@example.com",
            "phone": f"0532{random.randint(1000000, 9999999)}",
            "high_school": "Test Lisesi",
            "ranking": random.randint(1000, 500000),
            "yks_score": random.uniform(300, 500),
            "yks_type": random.choice(yks_types),
            "department_id": random.randint(1, 8),
            "wants_tour": random.choice([True, False])
        }

        with self.client.post(
            "/api/students",
            headers=self.headers,
            json=student_data,
            catch_response=True,
            name="/api/students (Create Student - Admin)"
        ) as response:
            if response.status_code == 201:
                response.success()
            elif response.status_code == 403:
                response.failure("Forbidden - not admin")
            elif response.status_code == 401:
                self.login()
                response.failure("Unauthorized")

    @task(1)
    def export_excel(self):
        """
        Export data to Excel.
        Weight: 1 (admin action)
        """
        if not self.token:
            return

        with self.client.get(
            "/api/export/excel",
            headers=self.headers,
            catch_response=True,
            name="/api/export/excel (Export Data)"
        ) as response:
            if response.status_code in [200, 403]:
                response.success()
            elif response.status_code == 401:
                self.login()
                response.failure("Unauthorized")


# Locust event handlers for custom reporting
@events.request.add_listener
def on_request(request_type, name, response_time, response_length, exception, **kwargs):
    """
    Custom event handler for request logging.
    """
    if exception:
        print(f"Request {name} failed with exception: {exception}")


@events.test_stop.add_listener
def on_test_stop(environment, **kwargs):
    """
    Print summary when test stops.
    """
    if isinstance(environment.runner, MasterRunner):
        print("Test completed on master node")
    else:
        print("Test completed on worker node")


if __name__ == "__main__":
    # Allow running directly for quick testing
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="http://localhost:8000", help="Target host")
    parser.add_argument("--users", type=int, default=10, help="Number of users")
    parser.add_argument("--spawn-rate", type=int, default=2, help="Users per second")
    parser.add_argument("--time", default="1m", help="Test duration")

    args = parser.parse_args()

    # Use Locust's CLI
    import subprocess
    import sys

    cmd = [
        "locust",
        "-f", __file__,
        "--host", args.host,
        "--headless",
        "-u", str(args.users),
        "-r", str(args.spawn_rate),
        "-t", args.time
    ]

    print(f"Running: {' '.join(cmd)}")
    subprocess.run(cmd)
