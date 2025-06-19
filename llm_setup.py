# llm_setup.py

import os
from langchain_google_vertexai import ChatVertexAI

def initialize_llm(temperature=0.5):
    """
    Initializes and returns the Gemini LLM from Vertex AI.
    Handles potential errors during initialization.
    """

    project_id = os.getenv("GOOGLE_PROJECT_ID")
    if not project_id:
        print("FATAL: GOOGLE_PROJECT_ID environment variable is not set.")
        print("Please set it to your Google Cloud project ID.")
        return None
    try:
        llm = ChatVertexAI(
        model_name="gemini-2.0-flash-001", # Vertex AI uses slightly different model names
        # project="multi-agentic-animme" # You need to specify your project ID
        project=project_id
    )
        return llm
    except Exception as e:
        print(f"FATAL: Failed to initialize the language model. Error: {e}")
        print("Please ensure your GCP project is set up correctly and you have authenticated via 'gcloud auth application-default login'.")
        return None