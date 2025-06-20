# Production Data Management System

A React-based application for managing production unit and charge data.

## Project Structure

```
ddb_test_v1/
├── frontend/           # React frontend application
├── backend/           # Node.js backend application
└── README.md
```

## Getting Started

### Prerequisites
- Node.js v14+
- npm v6+

### Installation

1. Clone the repository
```bash
git clone <repository-url>
cd ddb_test_v1
```

2. Install backend dependencies
```bash
cd backend
npm install
```

3. Install frontend dependencies
```bash
cd ../frontend
npm install
```

### Running the Application

1. Start the backend server
```bash
cd backend
npm start
```

2. Start the frontend application (in a new terminal)
```bash
cd frontend
npm start
```

The application will be available at http://localhost:3000

## Features
- Production site management
- Production unit data tracking
- Production charge data tracking
- Month-based data organization
- Duplicate entry prevention
- Real-time validation