# app.py (Corrected version)

import streamlit as st
from dotenv import load_dotenv

# --- Local Imports ---
from llm_setup import initialize_llm
from agents import create_chat_agent
from crew import create_legal_crew
from crewai import Task

# --- Page Setup & Styling ---
st.set_page_config(page_title="Lethabo, Your Legal Pal", page_icon="🇿🇦")

# Load CSS
def load_css(file_name):
    with open(file_name) as f:
        st.markdown(f'<style>{f.read()}</style>', unsafe_allow_html=True)
load_css("style.css")

# --- Load Environment and LLM ---
load_dotenv()
llm = initialize_llm()
if not llm:
    st.error("The Language Model could not be initialized. Please check the console for errors.")
    st.stop()


# --- Streamlit Session State ---
if "knowledge_base" not in st.session_state:
    st.session_state.knowledge_base = ""
if "messages" not in st.session_state:
    st.session_state.messages = []
if "chat_agent" not in st.session_state:
    st.session_state.chat_agent = None


# --- UI and Application Logic ---

st.title("Lethabo, Your Legal Pal 🦅")
st.markdown("##### Howzit! I'm here to help explain South African law in a way that's easy to understand.")

def start_new_chat():
    """Resets the session state to start a new conversation."""
    st.session_state.knowledge_base = ""
    st.session_state.messages = []
    st.session_state.chat_agent = None
    st.session_state.topic = ""


# --- Main Application Flow ---

# If no topic has been researched yet, show the input form.
if not st.session_state.knowledge_base:
    st.session_state.topic = st.text_input("What legal topic can I help you with today? (e.g., 'your rights during a traffic stop')")

    if st.button("Explain This to Me!") and st.session_state.topic:
        with st.spinner(f"Okay, sharp! My research team is on it. We're gathering the best info on '{st.session_state.topic}'..."):
            try:
                # 1. Create and run the research crew
                legal_crew = create_legal_crew(llm, st.session_state.topic)
                result = legal_crew.kickoff()
                st.session_state.knowledge_base = result
                
                # 2. Initialize Lethabo, our chat agent
                st.session_state.chat_agent = create_chat_agent(llm)
                
                # 3. Set up the first message
                st.session_state.messages.append({"role": "assistant", "content": f"Awesome! I've got the lowdown on '{st.session_state.topic}'. What's your first question?"})
                
                st.rerun()

            except Exception as e:
                st.error(f"Eish, something went wrong. Please try another topic. Error: {e}")

# If a topic has been researched, show the chat interface.
else:
    st.header(f"Let's chat about: {st.session_state.topic.title()}")
    st.button("Start a New Topic", on_click=start_new_chat)

    # Display chat messages
    for message in st.session_state.messages:
        with st.chat_message(message["role"]):
            st.markdown(message["content"])

    # Accept user input
    if prompt := st.chat_input("Ask me anything about this..."):
        st.session_state.messages.append({"role": "user", "content": prompt})
        with st.chat_message("user"):
            st.markdown(prompt)

        # Get the bot's response
        with st.chat_message("assistant"):
            with st.spinner("Lethabo is thinking..."):
                chat_task = Task(
                    description=f"""
                    You are Lethabo. A user is asking you a question.
                    Here is the knowledge base you MUST use:
                    --- KNOWLEDGE BASE ---
                    {st.session_state.knowledge_base}
                    --- END KNOWLEDGE BASE ---
                    
                    Here is the chat history so far: {st.session_state.messages}
                    The user's latest message is: '{prompt}'.

                    Answer the user's question in a friendly, conversational way, based ONLY on the knowledge base.
                    Remember your persona: warm, empathetic, and clear.
                    """,
                    expected_output="A friendly, conversational response that answers the user's question based on the provided text.",
                    agent=st.session_state.chat_agent
                )
                
                # =======================================================
                # THIS IS THE LINE THAT WAS FIXED
                response = st.session_state.chat_agent.execute_task(chat_task)
                # =======================================================
                
                st.markdown(response)
        
        st.session_state.messages.append({"role": "assistant", "content": response})