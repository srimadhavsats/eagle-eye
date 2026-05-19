from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Eagle Eye API")

# Enable CORS for React frontend to communicate with it
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Have to tighten this up later when we deploy
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def read_root():
    return {"message": "Eagle Eye Backend Radar is Active"}
