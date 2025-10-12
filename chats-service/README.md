# Create a virtual environment

python3 -m venv venv
source venv/bin/activate

# Install all dependencies

pip install -r requirements.txt

# Run the app

uvicorn app.main:app --reload --port 50051

pip freeze > requirements.txt
