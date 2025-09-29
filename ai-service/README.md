# AI Service

This is an AI microservice built with Python. It exposes APIs using **FastAPI** and can be run locally or via Docker.

---

## Prerequisites

- Python 3.10.12
- pip
- Docker (if running via Docker)

---

## Running Locally

1. **Clone the repository** (if not already):

    ```
    git clone <your-repo-url>
    cd <your-repo-folder>
    ```

2. **Create a Python virtual environment:**

    ```
    python3 -m venv venv
    ```

3. **Activate the virtual environment:**

    - On Linux/macOS:
      ```
      source venv/bin/activate
      ```
    - On Windows:
      ```
      .\venv\Scripts\activate
      ```

4. **Install dependencies:**

    ```
    pip install -r requirements.txt
    ```

5. **Run the FastAPI app:**

    ```
    uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
    ```

---

## Running via Docker

1. **Build the Docker image:**

    ```
    docker build -t ai-service .
    ```

2. **Run the Docker container:**

    ```
    docker run -p 8000:8000 ai-service
    ```
---

### Access the service

    Open your browser and go to [http://localhost:8000](http://localhost:8000)
