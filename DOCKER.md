# Docker Setup Guide

This guide explains how to run the Market-Based Optimization (MBO) application using Docker and Docker Compose.

## Prerequisites

- Docker Engine 20.10+ installed
- Docker Compose 2.0+ installed
- At least 4GB of available RAM (ML models require memory)
- 10GB of free disk space

## Quick Start

### 1. Build and Run with Docker Compose

```bash
# Build and start all services
docker-compose up --build

# Or run in detached mode (background)
docker-compose up -d --build
```

### 2. Access the Application

- **Frontend (Web UI)**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs
- **API Health Check**: http://localhost:8000/health

### 3. Stop the Application

```bash
# Stop all services
docker-compose down

# Stop and remove volumes (if using persistent data)
docker-compose down -v
```

## Architecture

The application consists of two main services:

### Frontend Service
- **Technology**: React + Vite + TypeScript
- **Port**: 3000 (mapped to container port 80)
- **Web Server**: Nginx
- **Build**: Multi-stage build for optimized production image

### Backend Service
- **Technology**: FastAPI + Python 3.11
- **Port**: 8000
- **Features**: ML models, time series forecasting, anomaly detection
- **Dependencies**: PyTorch, Prophet, XGBoost, and more

## Configuration

### Environment Variables

You can customize the application by modifying the `docker-compose.yml` or creating a `.env` file:

```env
# Backend Configuration
API_HOST=0.0.0.0
API_PORT=8000
LOG_LEVEL=info

# Frontend Configuration
NODE_ENV=production
```

### Custom Ports

To change the exposed ports, edit the `ports` section in `docker-compose.yml`:

```yaml
services:
  frontend:
    ports:
      - "8080:80"  # Change 8080 to your desired port

  backend:
    ports:
      - "9000:8000"  # Change 9000 to your desired port
```

## Development Mode

For development with hot-reload:

### Frontend Development

```bash
# Run frontend in development mode (not in Docker)
npm install
npm run dev
```

### Backend Development

```bash
# Run backend in development mode
cd ml-backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
./start.sh
```

## Building Individual Services

### Build Frontend Only

```bash
docker build -t mbo-frontend .
docker run -p 3000:80 mbo-frontend
```

### Build Backend Only

```bash
cd ml-backend
docker build -t mbo-backend .
docker run -p 8000:8000 mbo-backend
```

## Troubleshooting

### Container Fails to Start

Check the logs:
```bash
docker-compose logs frontend
docker-compose logs backend
```

### Out of Memory

The ML backend requires significant memory. Increase Docker's memory limit:
- Docker Desktop: Settings → Resources → Memory (set to at least 4GB)

### Port Already in Use

If ports 3000 or 8000 are already in use:
```bash
# Find process using the port
lsof -i :3000
lsof -i :8000

# Change ports in docker-compose.yml
```

### Backend Health Check Failing

The backend may take 30-40 seconds to start due to ML model initialization. This is normal.

## Production Considerations

### Security

1. **Use secrets for sensitive data**:
   ```yaml
   services:
     backend:
       secrets:
         - api_key
         - db_password
   ```

2. **Run behind a reverse proxy** (Nginx, Traefik) for SSL/TLS

3. **Enable rate limiting** on the backend API

### Performance

1. **Resource Limits**: Add resource constraints to prevent overconsumption
   ```yaml
   services:
     backend:
       deploy:
         resources:
           limits:
             cpus: '2'
             memory: 4G
           reservations:
             memory: 2G
   ```

2. **Horizontal Scaling**: Run multiple backend instances
   ```bash
   docker-compose up --scale backend=3
   ```

### Monitoring

Add monitoring services to `docker-compose.yml`:
- Prometheus for metrics
- Grafana for visualization
- ELK stack for log aggregation

## Persistent Data

To add persistent storage for ML models and data:

```yaml
services:
  backend:
    volumes:
      - ml-models:/app/models
      - app-data:/app/data

volumes:
  ml-models:
  app-data:
```

## Cleaning Up

Remove all containers, networks, and images:

```bash
# Remove containers and networks
docker-compose down

# Remove images
docker-compose down --rmi all

# Remove volumes
docker-compose down -v

# Remove all (nuclear option)
docker system prune -a --volumes
```

## Support

For issues and questions:
- Check the logs: `docker-compose logs`
- Review the main README.md
- Open an issue on the project repository
