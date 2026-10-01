# Portfolio StockMarket

A full-stack financial portfolio and stock market application foundation built with **Angular**, **Spring Boot**, and **MySQL**.

---

## Tech Stack

### Frontend
- **Framework**: Angular 19+ (Standalone Components, Signals, RxJS)
- **Styling**: Modern CSS Design System (Custom tokens, Dark Theme, Glassmorphism)
- **HTTP Client**: Angular `HttpClient` with `fetch` support
- **Testing**: Vitest unit testing suite

### Backend
- **Framework**: Spring Boot 3.4+ (Java 21/25)
- **ORM & Data**: Spring Data JPA / Hibernate
- **Validation**: Jakarta Bean Validation (`@Valid`, constraint validations)
- **Database**: MySQL (configured strictly via environment variables)
- **Security & Networking**: Configured CORS policies for Angular client
- **Error Handling**: Centralized `@RestControllerAdvice` with standardized JSON error schemas

---

## Project Structure

```
Portfolio_StockMarket/
├── backend/                       # Spring Boot application
│   ├── src/
│   │   ├── main/
│   │   │   ├── java/com/portfolio/
│   │   │   │   ├── config/        # WebMvc & CORS configuration
│   │   │   │   ├── controller/    # REST endpoints (e.g., /api/health)
│   │   │   │   ├── dto/           # Request/Response data models
│   │   │   │   ├── exception/     # Global exception handler & error response
│   │   │   │   └── BackendApplication.java
│   │   │   └── resources/
│   │   │       ├── application.properties
│   │   │       ├── application-dev.properties
│   │   │       └── application-prod.properties
│   │   └── test/                  # Unit & integration test suites
│   ├── mvnw / mvnw.cmd            # Maven wrapper
│   └── pom.xml                    # Maven dependencies & build configuration
├── frontend/                      # Angular client application
│   ├── src/
│   │   ├── app/
│   │   │   ├── models/            # TypeScript interfaces & types
│   │   │   ├── services/          # HTTP & business services (HealthService)
│   │   │   ├── app.ts             # Root standalone component
│   │   │   ├── app.html
│   │   │   └── app.css
│   │   ├── environments/          # Environment configuration (dev, prod)
│   │   └── styles.css             # Global design tokens & styles
│   ├── angular.json               # Angular CLI configuration
│   └── package.json               # Node dependencies
├── .env.example                   # Environment variable template
├── .gitignore                     # Git ignore rules
└── README.md                      # Documentation
```

---

## Getting Started

### Prerequisites
- **Java**: JDK 21 or higher
- **Node.js**: v20+ and **npm**: v10+
- **MySQL Server**: 8.0+

---

### 1. Environment Configuration

Copy the sample environment template and set your MySQL database credentials:

```bash
cp .env.example .env
```

Required environment variables:
| Variable | Description | Example |
| :--- | :--- | :--- |
| `MYSQL_URL` | JDBC connection string | `jdbc:mysql://localhost:3306/portfolio_db?useSSL=false&serverTimezone=UTC&allowPublicKeyRetrieval=true` |
| `MYSQL_USERNAME` | MySQL database username | `root` |
| `MYSQL_PASSWORD` | MySQL database password | `your_secret_password` |
| `CORS_ALLOWED_ORIGINS` | Allowed CORS origins (optional) | `http://localhost:4200` |

---

### 2. Running the Backend (Spring Boot)

Navigate to the `backend` directory:

```bash
cd backend
```

Run using Maven Wrapper:

```bash
# Export environment variables first or supply inline:
export MYSQL_URL="jdbc:mysql://localhost:3306/portfolio_db?useSSL=false&serverTimezone=UTC"
export MYSQL_USERNAME="your_username"
export MYSQL_PASSWORD="your_password"

./mvnw spring-boot:run
```

Or build the executable JAR:

```bash
./mvnw clean package
java -jar target/backend-0.0.1-SNAPSHOT.jar
```

The backend server starts by default on `http://localhost:8080`.

#### Health Verification Endpoint
```bash
curl http://localhost:8080/api/health
```

Expected Response:
```json
{
  "status": "UP",
  "service": "portfolio-stockmarket-backend",
  "timestamp": "2026-09-29T04:16:45.954322Z",
  "message": "Backend service is healthy and running"
}
```

---

### 3. Running the Frontend (Angular)

Navigate to the `frontend` directory:

```bash
cd frontend
npm install
npm start
```

Open your browser and navigate to `http://localhost:4200`.

---

## Running Tests

### Backend Unit Tests
```bash
cd backend
./mvnw test
```

### Frontend Unit Tests
```bash
cd frontend
npm test -- --no-watch
```

---

