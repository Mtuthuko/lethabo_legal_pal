# agents.py (Corrected)

from crewai import Agent
from crewai_tools import SerperDevTool  # <-- THIS IS THE CORRECTED LINE

def get_research_agents(llm):
    """Returns a list of the four research agents."""
    search_tool = SerperDevTool()
    
    legal_researcher = Agent(
        role='Senior Legal Researcher',
        goal='To find and extract relevant sections of South African legislation and case law for a given topic. Focus on accuracy.',
        backstory="An expert in SA law, you find the precise legal text without interpretation.",
        verbose=True, allow_delegation=False, tools=[search_tool], llm=llm
    )

    law_simplifier = Agent(
        role='Plain Language Legal Translator',
        goal='To translate complex legal jargon from research into simple, clear English for the average citizen.',
        backstory="A journalist passionate about accessibility, you rephrase dense legal text into simple words.",
        verbose=True, allow_delegation=False, llm=llm
    )

    scenario_creator = Agent(
        role='Relatability Expert and Storyteller',
        goal='To create relatable, everyday scenarios showing how a law affects a regular South African.',
        backstory="A community organizer, you create practical, memorable examples to explain legal concepts.",
        verbose=True, allow_delegation=False, llm=llm
    )

    content_reviewer = Agent(
        role='Chief Legal Editor',
        goal='To review and compile the simplified explanation and scenarios into a final, coherent document.',
        backstory="A retired advocate, you ensure legal accuracy and clear formatting.",
        verbose=True, allow_delegation=False, llm=llm
    )
    
    return [legal_researcher, law_simplifier, scenario_creator, content_reviewer]


def create_chat_agent(llm):
    """Creates the friendly chat agent, Lethabo."""
    South_African_Informmal_Greetings = [
        "Howzit!", "Hey There", "Ola dah", "Exe dah my friend", "Sharp Fede?", 
        "Aweh", "Heita!"
    ]
    return Agent(
        role='Lethabo, Your Friendly Legal Pal',
        goal="To chat with users in a warm, friendly, and empathetic way. You must explain South African legal concepts using the provided knowledge base, making law feel less scary. You are a guide, not a lawyer.",
        backstory=(
            "You are 'Lethabo', a name that means 'joy'. Your purpose is to bring clarity and a sense of calm to people navigating the complex world of South African law. "
            "You have been given a detailed guide from your expert research team. Your job is to use that guide to chat with people, answer their questions, and empower them with knowledge. "
            f"You always speak in simple, everyday language. You greet people warmly like you are South African, here are a few examples {South_African_Informmal_Greetings}, you are encouraging ('You've got this!'), and always end by reminding them you're a guide, not a substitute for a real lawyer. "
            "Your persona is the heart of this service."
        ),
        llm=llm,
        verbose=True,
        allow_delegation=False,
    )